import { supabase } from '@/lib/supabase';
import { toAppError, unwrap } from '@/services/errors';
import { signProofUrls } from '@/services/storage';

// Read-only queries the class hub needs that src/services/ doesn't have yet (candidates for a
// services/classHub.js). RLS: staff and admins read every class, session, roll call and invoice.

const PERSON = 'id, username, full_name, email, avatar_path, updated_at';
const STUDENT = `${PERSON}, contact_number`;
const SESSION = 'id, class_id, instructor_id, room_id, date, status, is_extra, start_time, end_time, checkin_at, checkout_at, checkout_late, cancel_reason, makes_up';

// Light rows for the directory: every class's sessions in [from, to).
export async function listSessionsBetween(from, to) {
    return unwrap(await supabase.from('instructor_attendance').select(SESSION).gte('date', from).lt('date', to));
}

// Light roll-call rows of every class in [from, to).
export async function listRollCallsBetween(from, to) {
    return unwrap(await supabase.from('student_attendance').select('class_id, student_id, date, status').gte('date', from).lt('date', to));
}

// Invoices of some courses (light): paid x / y per course on the cards.
export async function listCourseInvoices(lessonIds) {
    if (lessonIds.length === 0) return [];
    return unwrap(
        await supabase
            .from('tuition_invoices')
            .select('id, class_id, lesson_id, student_id, amount, paid_amount, status, due_date')
            .in('lesson_id', lessonIds)
    );
}

// Past classes: their completed sessions and every invoice (students and revenue).
export async function listPastStats(classIds) {
    if (classIds.length === 0) return { sessions: [], invoices: [] };
    const [sessions, invoices] = await Promise.all([
        supabase.from('instructor_attendance').select('class_id').in('class_id', classIds).eq('status', 'completed').then(unwrap),
        supabase.from('tuition_invoices').select('class_id, student_id, paid_amount, status').in('class_id', classIds).then(unwrap),
    ]);
    return { sessions, invoices };
}

// One class's sessions in [from, to) with the instructor teaching each and signed proof photos.
export async function listClassSessions(classId, from, to) {
    const rows = unwrap(
        await supabase
            .from('instructor_attendance')
            .select(`${SESSION}, checkin_proof_path, checkout_proof_path, details, instructor:profiles!instructor_id(${PERSON})`)
            .eq('class_id', classId)
            .gte('date', from)
            .lt('date', to)
            .order('date')
    );
    let urls = {};
    try {
        urls = await signProofUrls(rows.flatMap((row) => [row.checkin_proof_path, row.checkout_proof_path]));
    } catch {
        // Proof thumbnails are a nicety: the sessions still show without them.
    }
    return rows.map((row) => ({
        ...row,
        checkin_proof_url: urls[row.checkin_proof_path] ?? null,
        checkout_proof_url: urls[row.checkout_proof_path] ?? null,
    }));
}

// The make-up that replaces a class's session on `date` (a session moved to another day), or null.
export async function getMakeUpFor(classId, date) {
    const rows = unwrap(
        await supabase
            .from('instructor_attendance')
            .select('id, date, status, start_time, end_time')
            .eq('class_id', classId)
            .eq('makes_up', date)
            .neq('status', 'cancelled')
            .order('date')
            .limit(1)
    );
    return rows[0] ?? null;
}

// One class's roll calls from `from` to `until` (inclusive) with each student's profile.
export async function listClassRollCalls(classId, from, until) {
    return unwrap(
        await supabase
            .from('student_attendance')
            .select(`id, class_id, student_id, date, status, student:profiles!student_id(${STUDENT})`)
            .eq('class_id', classId)
            .gte('date', from)
            .lte('date', until)
            .order('date')
    );
}

// For { count } head queries.
function countOf({ count, error }) {
    if (error) throw toAppError(error);
    return count ?? 0;
}

// What keeps a class from being deleted: completed sessions, marked roll calls and payments.
export async function getClassHistory(classId) {
    const [sessions, marks, payments] = await Promise.all([
        supabase.from('instructor_attendance').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('status', 'completed'),
        supabase.from('student_attendance').select('id', { count: 'exact', head: true }).eq('class_id', classId).neq('status', 'pending'),
        supabase.from('tuition_invoices').select('id', { count: 'exact', head: true }).eq('class_id', classId).gt('paid_amount', 0),
    ]);
    return { sessions: countOf(sessions), marks: countOf(marks), payments: countOf(payments) };
}
