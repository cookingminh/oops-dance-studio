import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Session changes (supabase/migrations/20261117000900_session_changes.sql, api-contract §5 Session changes):
// call a session off with a reason the class sees, move it to another day as a make-up in one step, close
// the studio for a day, and — for students and teachers — what changed ahead in their classes.
// Session rows (instructor_attendance) carry `cancel_reason` (when cancelled) and `makes_up` (a make-up: the
// day it replaces). The routine's end and shoot day follow by themselves.

// Ready-made reasons (English keys, translated where shown); staff can type their own.
export const CHANGE_REASONS = ['Storm / bad weather', 'Teacher is ill', 'Problem with the room', 'Public holiday'];

// Staff: call off the class's session on `date` ('yyyy-MM-dd', today or later), even one ahead whose row
// doesn't exist yet. INVALID_STATE when the class doesn't meet that day or the session already started.
export async function cancelSession(classId, date, reason) {
    return unwrap(await supabase.rpc('session_cancel', { p_class: classId, p_date: date, p_reason: reason }));
}

// Staff: call it off and add the make-up on `newDate` at start–end ('HH:mm') in one step (also for a session
// already called off). Make-up rules: another day the class doesn't meet, 08:00–22:00, the room free
// (SLOT_TAKEN) → { cancelled, make_up }.
export async function moveSession({ classId, date, newDate, start, end, reason }) {
    return unwrap(
        await supabase.rpc('session_move', { p_class: classId, p_date: date, p_new_date: newDate, p_start: start, p_end: end, p_reason: reason })
    );
}

// Staff: close the studio on `date`: every class session that day is called off with `reason`, and with
// `cancelBookings` every pending / approved room booking that day is cancelled by the studio (everything
// paid becomes due back) → { sessions, bookings, classes: [{ class_id, name }] }.
export async function closeStudioDay(date, reason, { cancelBookings = true } = {}) {
    return unwrap(await supabase.rpc('studio_close_day', { p_date: date, p_reason: reason, p_cancel_bookings: cancelBookings }));
}

// Students and teachers: what changed in their classes from today to `days` ahead:
// [{ id, class_id, class_name, date, kind: 'cancelled' | 'make_up', start_time, end_time, reason, makes_up, room_name }].
export async function listMySessionChanges(days = 21) {
    return unwrap(await supabase.rpc('my_session_changes', { p_days: days }));
}
