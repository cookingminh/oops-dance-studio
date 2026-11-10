import { supabase } from '@/lib/supabase';
import { toAppError, unwrap } from './errors';
import { listProfiles } from './users';
import { getClassRates, getDefaultSessionRate, getStaffSalaries } from './payroll';

// Read-only queries behind the admin People page (/admin/users). RLS lets staff and admins read
// every profile, enrolment, booking and attendance row; the pay tables are admin-only, like the page.

const CLASS_BRIEF = `id, name, image_path, instructor_id,
    schedules:class_schedules(day_of_week, start_time, end_time)`;

// Everyone, every enrolment and every class: enough to label people (Student vs Guest) and say
// which classes they take or teach.
export async function listPeopleDirectory() {
    const [profiles, enrolments, classes] = await Promise.all([
        listProfiles(),
        supabase.from('class_students').select('class_id, student_id, joined_at, leaves_after').then(unwrap),
        supabase.from('classes').select(CLASS_BRIEF).order('name').then(unwrap),
    ]);
    return { profiles, enrolments, classes };
}

// For `{ count, error }` results of head-only count queries.
function countOf({ count, error }) {
    if (error) throw toAppError(error);
    return count ?? 0;
}

// What one person has done at the studio: latest bookings, roll-call marks, teaching sessions this
// month, pay settings, and how many teaching sessions and finalized payslips they have (records the
// page won't delete: payslips would go with the profile). `month` is 'yyyy-MM-01', `nextMonth` the
// first day after it.
export async function getPersonActivity(person, { month, nextMonth }) {
    const paid = person.role !== 'guest';
    const [bookings, marks, monthSessions, sessionCount, payslipCount, pay] = await Promise.all([
        supabase
            .from('bookings')
            .select('id, date, start_time, end_time, status, room:rooms!room_id(id, name)', { count: 'exact' })
            .eq('guest_id', person.id)
            .order('date', { ascending: false })
            .order('start_time', { ascending: false })
            .limit(4),
        supabase.from('student_attendance').select('date, status').eq('student_id', person.id).order('date', { ascending: false }),
        supabase
            .from('instructor_attendance')
            .select('id, date, status')
            .eq('instructor_id', person.id)
            .gte('date', month)
            .lt('date', nextMonth),
        supabase.from('instructor_attendance').select('id', { count: 'exact', head: true }).eq('instructor_id', person.id),
        supabase.from('payslips').select('profile_id', { count: 'exact', head: true }).eq('profile_id', person.id),
        paid ? getPay(person) : null,
    ]);
    return {
        bookings: unwrap(bookings),
        bookingCount: bookings.count ?? 0,
        marks: unwrap(marks),
        monthSessions: unwrap(monthSessions),
        sessionCount: countOf(sessionCount),
        payslipCount: countOf(payslipCount),
        pay,
    };
}

// Instructors: the studio's default session rate and per-class rates. Staff and admins: their salary.
async function getPay(person) {
    if (person.role === 'instructor') {
        const [defaultRate, classRates] = await Promise.all([getDefaultSessionRate(), getClassRates()]);
        return { defaultRate, classRates };
    }
    const salaries = await getStaffSalaries();
    return { salary: salaries[person.id] ?? null };
}
