import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { signProofUrls } from './storage';

// Read-only queries for the session calendars (the Attendance page and a class's Sessions tab).
// Light rows: the session modal loads one session's proofs and roll call itself. RLS: staff and
// admins read every session and roll call.

const PERSON = 'id, username, full_name, email, avatar_path, updated_at';
const SESSION = `id, class_id, instructor_id, room_id, date, status, is_extra, start_time, end_time, checkin_at, checkout_at, details,
    checkin_proof_path, checkout_proof_path,
    instructor:profiles!instructor_id(${PERSON})`;

// Sessions (instructor_attendance) from `from` to `until` (inclusive), of one class or of all.
export async function listSessionRows({ from, until, classId } = {}) {
    let query = supabase.from('instructor_attendance').select(SESSION).order('date');
    if (from) query = query.gte('date', from);
    if (until) query = query.lte('date', until);
    if (classId) query = query.eq('class_id', classId);
    return unwrap(await query);
}

// Roll-call marks (class, date, status) from `from` to `until` (inclusive), of one class or of all.
export async function listRollMarks({ from, until, classId } = {}) {
    let query = supabase.from('student_attendance').select('class_id, date, status');
    if (from) query = query.gte('date', from);
    if (until) query = query.lte('date', until);
    if (classId) query = query.eq('class_id', classId);
    return unwrap(await query);
}

// Today's sessions with their check-in / check-out proof photos (signed for an hour).
export async function listSessionsWithProofs(date) {
    const rows = await listSessionRows({ from: date, until: date });
    let urls = {};
    try {
        urls = await signProofUrls(rows.flatMap((row) => [row.checkin_proof_path, row.checkout_proof_path]));
    } catch {
        // Thumbnails are a nicety: the sessions still show without them.
    }
    return rows.map((row) => ({ ...row, checkin_proof_url: urls[row.checkin_proof_path] ?? null, checkout_proof_url: urls[row.checkout_proof_path] ?? null }));
}
