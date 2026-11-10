import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { getStudioToday } from './studio';
import { listLessonProgress } from './classes';
import { getTuitionSettings, listStudentInvoices } from './tuition';

// Read-only queries behind the "Switch class" dialog and the staff tuition page. The switch
// itself is switchClass() in ./tuition.js (supabase/migrations/20261116000400_switch_after_course.sql:
// no switch in the middle of a course — they finish the course they're in and join the new class
// from its next course). RLS: staff and admins read every class, enrolment and invoice
// (class_students_select, tuition_invoices_select).

const SWITCH_CLASS = `id, name, price, image_path, instructor_id, starts_on, ended_on,
    instructor:profiles!instructor_id(id, full_name, username),
    schedules:class_schedules(day_of_week, start_time, end_time),
    lessons:class_lessons(id, title, starts_on, session_count, price),
    members:class_students(count)`;

// Everything the dialog needs for one student, in two round trips:
//   { today: 'yyyy-MM-dd', settings (renewal_open_sessions, due_session, prorate_late_join…),
//     classes      classes that haven't ended, with `memberCount` and `lessons` (their courses)
//     progress     Map(lesson id → listLessonProgress row): sessions held, last session, status
//     enrolments   Map(class id → { joined_at, leaves_after }): the classes they're in
//     enrolledIds  Set of those class ids
//     invoices     theirs, newest first }
export async function loadSwitchOptions(studentId) {
    const today = await getStudioToday();
    const [settings, classes, enrolments, invoices] = await Promise.all([
        getTuitionSettings(),
        supabase.from('classes').select(SWITCH_CLASS).or(`ended_on.is.null,ended_on.gte.${today}`).order('name').then(unwrap),
        supabase.from('class_students').select('class_id, joined_at, leaves_after').eq('student_id', studentId).then(unwrap),
        listStudentInvoices(studentId),
    ]);
    const progress = await listLessonProgress(classes.map((cls) => cls.id)).catch(() => []);
    return {
        today,
        settings,
        classes: classes.map(({ members, ...cls }) => ({ ...cls, memberCount: members?.[0]?.count ?? 0 })),
        progress: new Map(progress.map((row) => [row.lesson_id, row])),
        enrolments: new Map(enrolments.map((row) => [row.class_id, row])),
        enrolledIds: new Set(enrolments.map((row) => row.class_id)),
        invoices,
    };
}

// Every enrolment, as Map("classId:studentId" → { joined_at, leaves_after }): who is in which class
// now (only they can be switched), who joins from a later course and who leaves after a date.
export async function listEnrolments() {
    const rows = unwrap(await supabase.from('class_students').select('class_id, student_id, joined_at, leaves_after'));
    return new Map(rows.map((row) => [`${row.class_id}:${row.student_id}`, { joined_at: row.joined_at, leaves_after: row.leaves_after }]));
}

// One student's places: Map(class id → { joined_at, leaves_after }) (the person panel).
export async function listStudentPlaces(studentId) {
    const rows = unwrap(await supabase.from('class_students').select('class_id, joined_at, leaves_after').eq('student_id', studentId));
    return new Map(rows.map((row) => [row.class_id, row]));
}
