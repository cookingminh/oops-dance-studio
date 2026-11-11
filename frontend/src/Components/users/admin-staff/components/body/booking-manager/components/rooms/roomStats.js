import { formatTime } from '@/lib/format';
import { periodOf, soonestFirst } from '../../bookingsModel';

// Booking facts per room for the "Rooms & prices" view, from every booking the page already loaded.

// Bookings that hold the room (a request, an approved one, one paid in full).
const HOLDS = ['pending', 'approved', 'completed'];
// What the reports count as room income: what the studio keeps (real_income) of approved, completed and
// cancelled bookings (a cancelled one keeps what wasn't refunded) — v_revenue_monthly.
const EARNS = ['approved', 'completed', 'cancelled'];

// "80 m² · gương 2 mặt · loa JBL" → ['80 m²', 'gương 2 mặt', 'loa JBL']
export const featuresOf = (size) => (size ?? '').split('·').map((part) => part.trim()).filter(Boolean);

// → { week, month, revenue, next } for `roomId`: bookings this week and this month that hold the room,
// this month's income and the next booking that hasn't started (null when none). `today` is the studio
// date, `now` 'HH:mm'.
export function roomStats(bookings, roomId, { today, now }) {
    const week = periodOf('week', today);
    const month = periodOf('month', today);
    const inRange = ({ from, until }) => (booking) => booking.date >= from && booking.date <= until;
    const mine = bookings.filter((booking) => booking.room_id === roomId);
    const holding = mine.filter((booking) => HOLDS.includes(booking.status));
    const next = holding
        .filter((booking) => booking.date > today || (booking.date === today && formatTime(booking.start_time) > now))
        .sort(soonestFirst)[0] ?? null;
    return {
        week: holding.filter(inRange(week)).length,
        month: holding.filter(inRange(month)).length,
        revenue: mine.filter((booking) => EARNS.includes(booking.status) && inRange(month)(booking)).reduce((sum, booking) => sum + Number(booking.real_income ?? 0), 0),
        next,
    };
}
