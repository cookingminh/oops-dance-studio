import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Instructor check-ins, corrected by staff (supabase/migrations/20261117001100_checkin_window.sql, api-contract
// §5 session_edit_check). Instructors check in from 15 minutes before a session until it ends and check out
// any time after; more than 10 minutes after the end the session is marked `checkout_late`. Staff fix a
// forgotten or wrong time here, always with a reason; each correction is in the activity log
// (sessions · check_edited, with the times before and after).

// Staff: set the check-in (required) and check-out (null = not checked out yet) of the session
// `attendanceId` (timestamps, e.g. studioMoment()). `late`: null = worked out from the times (more than 10
// minutes after the end), true / false = staff decide (e.g. excused). A session with a check-out becomes
// completed. INVALID_INPUT without a reason or with the check-out before the check-in; INVALID_STATE for a
// session called off.
export async function editSessionCheck({ attendanceId, checkinAt, checkoutAt = null, late = null, reason }) {
    return unwrap(
        await supabase.rpc('session_edit_check', {
            p_attendance: attendanceId,
            p_checkin_at: checkinAt,
            p_checkout_at: checkoutAt,
            p_checkout_late: late,
            p_reason: reason,
        })
    );
}

// A studio date ('yyyy-MM-dd') and clock time ('HH:mm') as a timestamp (Vietnam keeps +07:00 all year).
export const studioMoment = (date, time) => `${date}T${time}:00+07:00`;
