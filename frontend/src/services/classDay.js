import { supabase } from '@/lib/supabase';
import { nextMonth } from '@/lib/lessons';
import { listExpenses } from './expenses';
import { unwrap } from './errors';

// One class's money day by day (the class page's Money tab: the calendar and the day dialog). Admin only, like
// the tab: expenses RLS shows admins every cost (staff would only get their own), tuition_invoices is staff's.
//
// A month ('yyyy-MM-01') → {
//   costs:    expenses of the class that month (services/expenses.js rows, newest first)
//   sessions: the class's instructor_attendance rows that month (light, with the room at a rented studio)
//   income:   tuition received that month: [{ id, student_name, lesson_title, paid_amount, method, paid_at, day }]
//   rooms:    every rented studio's rooms with their rents (venue_rooms_list(), staff) }

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const STUDIO_OFFSET = '+07:00'; // Vietnam has no daylight saving time
const studioDate = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// timestamptz → the studio's 'yyyy-MM-dd'.
export const studioDayOf = (timestamp) => (timestamp ? studioDate.format(new Date(timestamp)) : null);

const SESSION = 'id, class_id, date, status, is_extra, start_time, end_time, room_id, venue_id, venue_room_id, checkin_at, checkout_at, makes_up';

// The class's sessions in a month. (attendanceHub.listSessionRows has no room at a rented studio.)
export async function listMonthSessions(classId, month) {
    return unwrap(
        await supabase
            .from('instructor_attendance')
            .select(SESSION)
            .eq('class_id', classId)
            .gte('date', month)
            .lt('date', nextMonth(month))
            .order('date')
    );
}

// Tuition received that month: invoices of the class paid in full during it (paid_at, the studio's days), with
// what was received. An invoice paid in part has no paid_at yet, so it counts once it is paid up.
export async function listMonthIncome(classId, month) {
    const rows = unwrap(
        await supabase
            .from('tuition_invoices')
            .select('id, student_id, student_name, lesson_title, month, paid_amount, method, paid_at, status')
            .eq('class_id', classId)
            .gt('paid_amount', 0)
            .gte('paid_at', `${month}T00:00:00${STUDIO_OFFSET}`)
            .lt('paid_at', `${nextMonth(month)}T00:00:00${STUDIO_OFFSET}`)
            .order('paid_at')
    );
    return rows.map((row) => ({ ...row, paid_amount: Number(row.paid_amount) || 0, day: studioDayOf(row.paid_at) }));
}

// Staff: every rented studio's rooms with their rents per hour, by studio and position.
export async function listStudioRooms() {
    return unwrap(await supabase.rpc('venue_rooms_list'));
}

// Everything the calendar needs for a month.
export async function loadClassMonth(classId, month) {
    const [costs, sessions, income, rooms] = await Promise.all([
        listExpenses(month, { classId }),
        listMonthSessions(classId, month),
        listMonthIncome(classId, month),
        listStudioRooms().catch(() => []),
    ]);
    return { costs, sessions, income, rooms };
}

// Staff: one session in another room of its studio (roomId null = no particular room, the studio's own price).
// A rent already charged for it is worked out again at the new room's price. Refused for a session called off
// (INVALID_STATE) or a room of another studio (INVALID_INPUT). → the session row.
export async function setSessionRoom(sessionId, roomId) {
    return unwrap(await supabase.rpc('session_set_venue_room', { p_session: sessionId, p_room: roomId ?? null }));
}
