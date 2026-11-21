import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { getStudioToday } from './studio';
import { listLessonProgress } from './classes';
import { getTuitionSettings } from './tuition';

// Asking to join a class (supabase/migrations/20261117002500_class_join_requests.sql). A student (role guest)
// asks; staff approve (class_join_approve adds them to class_students, which bills the course and puts them
// on the roll call) or decline with a reason the student sees. RLS: a student reads only their own requests;
// every change goes through the RPCs below.
//
// A request: { id, class_id, status: 'pending' | 'approved' | 'declined' | 'cancelled', start_pref: 'now' | 'next',
//   note, decided_at, decline_reason, joined_at (the start date they got, approved only), created_at, updated_at,
//   class: { id, name, image_path, image_pos_x, image_pos_y, ended_on } }

export const JOIN_NOTE_MAX = 500;
// Three open requests at a time (class_join_request refuses a fourth).
export const MAX_OPEN_REQUESTS = 3;

const REQUEST_COLUMNS = `id, class_id, status, start_pref, note, decided_at, decline_reason, joined_at, created_at, updated_at,
    class:classes(id, name, image_path, image_pos_x, image_pos_y, ended_on)`;

// The signed-in student's requests, newest first.
export async function listMyJoinRequests() {
    return unwrap(await supabase.from('class_join_requests').select(REQUEST_COLUMNS).order('created_at', { ascending: false }));
}

// Ask to join `classId`, starting `start` ('now' = the running course, 'next' = from the next one) with an
// optional note (≤ 500 characters). Returns the new request row.
export async function requestToJoin(classId, { start = 'now', note = '' } = {}) {
    return unwrap(
        await supabase.rpc('class_join_request', { p_class_id: classId, p_start: start, p_note: note?.trim() ? note.trim() : null })
    );
}

// Withdraw one of the student's own pending requests. Returns the request, now 'cancelled'.
export async function cancelJoinRequest(id) {
    return unwrap(await supabase.rpc('class_join_cancel', { p_request: id }));
}

// Classes that have a last day (ending or ended): they take no new students (class_join_request refuses them),
// so the class cards offer no way in. Public, like the rest of `classes`.
export async function listClosedClassIds() {
    const rows = unwrap(await supabase.from('classes').select('id').not('ended_on', 'is', null));
    return new Set(rows.map((row) => row.id));
}

// What the join dialog says about one class's courses and fees, in one round trip:
//   { today, progress (lesson_progress rows; null if it failed), prices Map(course id → its own price or null =
//     the class price), settings (tuition_settings, null if unreadable), history (true when the student already has
//     an invoice in this class: then an old invoice may come back on joining, so the fee isn't predicted) }
export async function loadJoinOffer(classId) {
    const [today, progress, lessons, settings, invoices] = await Promise.all([
        getStudioToday(),
        listLessonProgress([classId]).catch(() => null),
        supabase.from('class_lessons').select('id, price').eq('class_id', classId).then(unwrap),
        getTuitionSettings().catch(() => null),
        // RLS: a student reads only their own invoices.
        supabase.from('tuition_invoices').select('id').eq('class_id', classId).limit(1).then(unwrap).catch(() => null),
    ]);
    return {
        today,
        progress,
        prices: new Map(lessons.map((row) => [row.id, row.price])),
        settings,
        history: invoices === null || invoices.length > 0,
    };
}
