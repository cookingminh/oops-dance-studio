import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { signProofUrls, uploadProof } from './storage';
import { PLACE_EMBEDS } from './venues';

const PERSON = 'id, username, full_name, email, avatar_path, updated_at';
// start_time / end_time / is_extra: a make-up session's own times (regular sessions take theirs from the schedule).
// checkout_late: checked out more than 10 minutes after the end (20261117001100_checkin_window).
// The session's own place (room, or rented studio and its room) and its class's: lib/place.js placeOf(row, row.class).
const INSTRUCTOR_ATTENDANCE_SELECT = `id, class_id, instructor_id, room_id, venue_id, venue_room_id, date, checkin_at, checkout_at,
    checkout_late, status, checkin_proof_path, checkout_proof_path, details, start_time, end_time, is_extra,
    class:classes!class_id(id, name, image_path, schedules:class_schedules(id, day_of_week, start_time, end_time),
        ${PLACE_EMBEDS}),
    ${PLACE_EMBEDS}`;

export const INSTRUCTOR_ATTENDANCE_STATUSES = ['pending', 'waiting', 'in_progress', 'completed', 'cancelled'];
export const STUDENT_ATTENDANCE_STATUSES = ['pending', 'absent', 'attend'];

// Adds checkin_proof_url / checkout_proof_url (signed, 1 h) to each row.
async function withProofUrls(rows) {
    const urls = await signProofUrls(rows.flatMap((row) => [row.checkin_proof_path, row.checkout_proof_path]));
    return rows.map((row) => ({
        ...row,
        checkin_proof_url: urls[row.checkin_proof_path] ?? null,
        checkout_proof_url: urls[row.checkout_proof_path] ?? null,
    }));
}

// ---- Instructor -----------------------------------------------------------

export async function listMyInstructorAttendance(instructorId, { date, withProofs = false } = {}) {
    let query = supabase
        .from('instructor_attendance')
        .select(INSTRUCTOR_ATTENDANCE_SELECT)
        .eq('instructor_id', instructorId)
        .order('date', { ascending: false });
    if (date) query = query.eq('date', date);
    const rows = unwrap(await query);
    return withProofs ? withProofUrls(rows) : rows;
}

// Uploads the proof photo first; the RPC checks it exists and sets the time server-side.
export async function checkIn(attendance, proofFile) {
    const path = await uploadProof(attendance.instructor_id, attendance.id, 'checkin', proofFile);
    return unwrap(await supabase.rpc('instructor_check_in', { p_attendance_id: attendance.id, p_proof_path: path }));
}

export async function checkOut(attendance, proofFile) {
    const path = await uploadProof(attendance.instructor_id, attendance.id, 'checkout', proofFile);
    return unwrap(await supabase.rpc('instructor_check_out', { p_attendance_id: attendance.id, p_proof_path: path }));
}

// ---- Staff ----------------------------------------------------------------

// `from` inclusive, `to` exclusive ('yyyy-MM-dd').
export async function listInstructorAttendance({ from, to, date, withProofs = false } = {}) {
    let query = supabase
        .from('instructor_attendance')
        .select(`${INSTRUCTOR_ATTENDANCE_SELECT}, instructor:profiles!instructor_id(${PERSON})`)
        .order('date', { ascending: false });
    if (date) query = query.eq('date', date);
    if (from) query = query.gte('date', from);
    if (to) query = query.lt('date', to);
    const rows = unwrap(await query);
    return withProofs ? withProofUrls(rows) : rows;
}

// Sessions up to `until` that are still open (not completed or cancelled): today's not-yet-finished
// sessions and past ones nobody settled. Oldest first.
export async function listOpenInstructorAttendance({ until }) {
    return unwrap(
        await supabase
            .from('instructor_attendance')
            .select(`${INSTRUCTOR_ATTENDANCE_SELECT}, instructor:profiles!instructor_id(${PERSON})`)
            .in('status', ['pending', 'waiting', 'in_progress'])
            .lte('date', until)
            .order('date')
    );
}

export async function listRecentCheckins(limit = 6) {
    return unwrap(
        await supabase
            .from('instructor_attendance')
            .select(`id, status, checkin_at, checkout_at, checkout_late, class:classes!class_id(id, name),
                instructor:profiles!instructor_id(${PERSON})`)
            .not('checkin_at', 'is', null)
            .order('checkin_at', { ascending: false })
            .limit(limit)
    );
}

export async function updateInstructorAttendance(id, fields) {
    const patch = {};
    if ('status' in fields) patch.status = fields.status;
    if ('details' in fields) patch.details = fields.details?.trim() || null;
    if ('instructorId' in fields) patch.instructor_id = fields.instructorId;
    return unwrap(await supabase.from('instructor_attendance').update(patch).eq('id', id).select('id').single());
}

// Creates this week's rows; returns how many were created (0 = already generated).
export async function generateInstructorAttendance() {
    return unwrap(await supabase.rpc('generate_instructor_attendance'));
}

// ---- Student attendance ---------------------------------------------------

export async function listStudentAttendance({ date }) {
    return unwrap(
        await supabase
            .from('student_attendance')
            .select(`id, class_id, student_id, date, status, details,
                student:profiles!student_id(${PERSON}, contact_number, date_of_birth),
                class:classes!class_id(id, name, image_path, room_id, venue_id, venue_room_id,
                    instructor:profiles!instructor_id(${PERSON}),
                    ${PLACE_EMBEDS},
                    schedules:class_schedules(id, day_of_week, start_time, end_time))`)
            .eq('date', date)
            .order('class_id')
    );
}

// Staff: every roll-call row of one class up to `until` (newest first), for its attendance history.
export async function listClassAttendanceHistory(classId, { until } = {}) {
    let query = supabase
        .from('student_attendance')
        .select('id, date, status, student_id')
        .eq('class_id', classId)
        .order('date', { ascending: false });
    if (until) query = query.lte('date', until);
    return unwrap(await query);
}

// Roll-call rows of several classes, newest first; `from` / `until` inclusive ('yyyy-MM-dd').
// RLS: an instructor gets the rows of their own classes, staff get everything.
export async function listStudentAttendanceForClasses(classIds, { from, until } = {}) {
    if (classIds.length === 0) return [];
    let query = supabase
        .from('student_attendance')
        .select('id, class_id, student_id, date, status')
        .in('class_id', classIds)
        .order('date', { ascending: false });
    if (from) query = query.gte('date', from);
    if (until) query = query.lte('date', until);
    return unwrap(await query);
}

export async function setStudentAttendanceStatus(id, status) {
    return unwrap(await supabase.from('student_attendance').update({ status }).eq('id', id).select('id, status').single());
}

// Creates today's rows; returns how many were created.
export async function generateStudentAttendance() {
    return unwrap(await supabase.rpc('generate_student_attendance'));
}

export async function listMyStudentAttendance(studentId) {
    return unwrap(
        await supabase
            .from('student_attendance')
            .select('id, date, status, details, class:classes!class_id(id, name, image_path)')
            .eq('student_id', studentId)
            .order('date', { ascending: false })
    );
}
