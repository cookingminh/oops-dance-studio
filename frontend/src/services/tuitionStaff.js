import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { getStudioToday } from './studio';
import { listLessonProgress } from './classes';
import { INVOICE } from './tuition';

// Extra read-only queries for the staff tuition page (/admin/tuition) and the staff to-do list.
// Everything else (writes, month lists, transfers) lives in ./tuition.js. RLS: staff and admins
// read every invoice, class and transfer (tuition_invoices_select, bank_transfers_select).
// Tuition is per course (khoá): one invoice per student and course (`lesson_id`).

const PERSON = 'id, username, full_name, email, contact_number, avatar_path, updated_at';
const CLASS = 'id, name, image_path, price, instructor_id';
const COURSE = 'course:class_lessons!lesson_id(id, title, starts_on, session_count, price, video_url)';

// Every unpaid invoice of any course, with the student's profile, oldest due date first:
// the invoices an unmatched bank transfer could be paying.
export async function listUnpaidInvoices() {
    return unwrap(
        await supabase
            .from('tuition_invoices')
            .select(`${INVOICE}, student:profiles!student_id(${PERSON}), ${COURSE}`)
            .eq('status', 'unpaid')
            .order('due_date')
            .order('student_name')
    );
}

// What the staff tuition page works from, in three small round trips:
//   today     the studio's 'yyyy-MM-dd'
//   classes   classes that haven't ended: { id, name, image_path, price, starts_on, ended_on }
//   progress  listLessonProgress() of those classes: one row per course with sessions held, the last
//             session (ends_on) and status 'planned' | 'current' | 'done' | 'stopped'
//   invoices  every invoice of their running and planned courses, plus every unpaid invoice of any
//             course (finished courses still owed), with the student, the class and the course
export async function loadTuitionBoard() {
    const today = await getStudioToday();
    const classes = unwrap(
        await supabase
            .from('classes')
            .select('id, name, image_path, price, starts_on, ended_on')
            .or(`ended_on.is.null,ended_on.gte.${today}`)
            .order('name')
    );
    const progress = await listLessonProgress(classes.map((cls) => cls.id));
    const open = progress.filter((row) => row.status === 'current' || row.status === 'planned').map((row) => row.lesson_id);
    let query = supabase
        .from('tuition_invoices')
        .select(`${INVOICE}, student:profiles!student_id(${PERSON}), class:classes!class_id(${CLASS}), ${COURSE}`);
    query = open.length ? query.or(`lesson_id.in.(${open.join(',')}),status.eq.unpaid`) : query.eq('status', 'unpaid');
    const invoices = unwrap(await query.order('class_name').order('student_name'));
    return { today, classes, progress, invoices };
}

// Progress of the given courses' classes (for a month of older courses): lesson id → row.
export async function loadCourseProgress(classIds) {
    const rows = await listLessonProgress([...new Set(classIds.filter((id) => id != null))]);
    return new Map(rows.map((row) => [row.lesson_id, row]));
}

// One student's tuition for the person panel (People): their invoices (newest course first, with the
// course), their places now (Map class id → { joined_at, leaves_after }) and the progress of those
// courses (Map lesson id → listLessonProgress row).
export async function loadStudentTuition(studentId) {
    const [invoices, places] = await Promise.all([
        supabase
            .from('tuition_invoices')
            .select(`${INVOICE}, class:classes!class_id(${CLASS}), ${COURSE}`)
            .eq('student_id', studentId)
            .order('month', { ascending: false })
            .then(unwrap),
        supabase.from('class_students').select('class_id, joined_at, leaves_after').eq('student_id', studentId).then(unwrap),
    ]);
    const progress = await loadCourseProgress([...invoices.map((row) => row.class_id), ...places.map((row) => row.class_id)]).catch(() => new Map());
    return { invoices, places: new Map(places.map((row) => [row.class_id, row])), progress };
}

// What the to-do list needs, in three small queries (`today` is the studio's 'yyyy-MM-dd'):
//   overdue     unpaid invoices past their due date (any course), oldest first:
//               { id, student_id, student_name, class_name, lesson_title, due_date }
//   unmatched   bank transfers waiting in the inbox: { id, amount }
//   unanswered  unpaid, unanswered invoices still in their window (the daily job cancels them the
//               day after the due date), soonest due first — one renewal question per student and course:
//               { id, student_id, class_id, class_name, lesson_id, lesson_title, month, due_date }
export async function loadTuitionTodo(today) {
    const [overdue, unmatched, unanswered] = await Promise.all([
        supabase
            .from('tuition_invoices')
            .select('id, student_id, student_name, class_name, lesson_title, due_date')
            .eq('status', 'unpaid')
            .lt('due_date', today)
            .order('due_date'),
        supabase.from('bank_transfers').select('id, amount').eq('status', 'unmatched'),
        supabase
            .from('tuition_invoices')
            .select('id, student_id, class_id, class_name, lesson_id, lesson_title, month, due_date')
            .eq('status', 'unpaid')
            .is('renewal', null)
            .eq('paid_amount', 0)
            .gte('due_date', today)
            .order('due_date'),
    ]);
    return { overdue: unwrap(overdue), unmatched: unwrap(unmatched), unanswered: unwrap(unanswered) };
}
