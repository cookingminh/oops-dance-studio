import { isAutomaticRent } from '@/lib/expenseCategories';
import { isoWeekdayOf } from '@/lib/format';
import { datesOf, monthSessions } from '../../hubModel';

// Pure helpers behind the Money tab's calendar and day dialog (services/classDay.js loads the month).

const amountOf = (row) => Number(row?.amount) || 0;

// 'HH:mm' → minutes since midnight (null without a time).
const minutesOf = (time) => {
    if (!time) return null;
    const [hours, minutes] = String(time).split(':').map(Number);
    return hours * 60 + (minutes || 0);
};

// A session's rent at `perHour` đồng an hour, rounded to the thousand like the server's (private.charge_venue_rent).
// null when the times aren't known or there is no price.
export function rentFor(perHour, start, end) {
    const from = minutesOf(start);
    const to = minutesOf(end);
    const rate = Number(perHour) || 0;
    if (from === null || to === null || to <= from || rate <= 0) return null;
    return Math.round((rate * (to - from)) / 60 / 1000) * 1000;
}

// Where a session is taught: its own place (a recorded session), else its class's.
//   { venue (venues_list() row) | null, room (venue_rooms_list() row) | null, ownRoom ({ id, name }) | null,
//     label "Studio Thỏ · Phòng lớn" | "Room A" | '' , rooms (the studio's rooms to pick from) }
export function sessionPlace(session, cls, { venues = [], rooms = [], ownRooms = [] } = {}) {
    const row = session?.row;
    const venueId = row ? row.venue_id : cls?.venue_id ?? null;
    const roomId = row ? row.venue_room_id : cls?.venue_room_id ?? cls?.venue_room?.id ?? null;
    const ownRoomId = row ? row.room_id : cls?.room_id ?? null;
    const venue = venueId ? venues.find((item) => item.id === venueId) ?? (cls?.venue?.id === venueId ? cls.venue : { id: venueId, name: '' }) : null;
    const room = venueId && roomId ? rooms.find((item) => item.id === roomId) ?? null : null;
    const ownRoom = !venueId && ownRoomId ? ownRooms.find((item) => item.id === ownRoomId) ?? (cls?.room?.id === ownRoomId ? cls.room : null) : null;
    // The studio's rooms in its order; an inactive one only while this session is in it.
    const choices = venueId
        ? rooms
              .filter((item) => item.venue_id === venueId && (item.active || item.id === roomId))
              .sort((a, b) => a.position - b.position || a.id - b.id)
        : [];
    const label = venue ? [venue.name, room?.name].filter(Boolean).join(' · ') : ownRoom?.name ?? '';
    return { venue, room, ownRoom, label, rooms: choices };
}

// The month as calendar days: Map 'yyyy-MM-dd' → { date, in, out, costs, income, session }.
//   session: monthSessions() entry ({ date, row, start, end, extra }) or null.
export function monthDays({ cls, month, costs = [], sessions = [], income = [] }) {
    const days = new Map(datesOf(month).map((date) => [date, { date, in: 0, out: 0, costs: [], income: [], session: null }]));
    for (const cost of costs) {
        const day = days.get(cost.spent_on);
        if (!day) continue;
        day.costs.push(cost);
        day.out += amountOf(cost);
    }
    for (const payment of income) {
        const day = days.get(payment.day);
        if (!day) continue;
        day.income.push(payment);
        day.in += Number(payment.paid_amount) || 0;
    }
    for (const session of monthSessions(cls, month, sessions)) {
        const day = days.get(session.date);
        if (day) day.session = session;
    }
    // The automatic rent first, then in the order they were added.
    for (const day of days.values()) day.costs.sort((a, b) => Number(isAutomaticRent(b)) - Number(isAutomaticRent(a)) || a.id - b.id);
    return days;
}

// The month grid: weeks of 7 (Monday first); days of other months are null.
export function monthGrid(month) {
    const dates = datesOf(month);
    const cells = [...Array(isoWeekdayOf(dates[0]) - 1).fill(null), ...dates];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
    return weeks;
}

// What came in and went out over the month.
export function monthTotals(days) {
    let totalIn = 0;
    let totalOut = 0;
    for (const day of days.values()) {
        totalIn += day.in;
        totalOut += day.out;
    }
    return { in: totalIn, out: totalOut };
}

// The automatic rent charged for a session (an expense row), or null.
export const rentOfSession = (costs, sessionId) => (sessionId ? costs.find((cost) => isAutomaticRent(cost) && cost.session_id === sessionId) ?? null : null);

// The list view: every cost and payment of the month, newest day first (payments before costs on a day).
export function monthEntries(days) {
    const entries = [];
    for (const day of [...days.values()].reverse()) {
        for (const payment of [...day.income].reverse()) entries.push({ kind: 'in', key: `in-${payment.id}`, date: day.date, payment });
        for (const cost of day.costs) entries.push({ kind: 'out', key: `out-${cost.id}`, date: day.date, cost });
    }
    return entries;
}
