import { addMinutes, endOfMonth, format, parse, startOfMonth } from 'date-fns';
import { formatTime, toMinutes } from '@/lib/format';
import { asDate, calendarRange, toIso } from '../../common/calendar/calendarModel';

// Pure helpers of the bookings page (filters, counts, calendar items).

export const PAGE_SIZE = 10;

export const SCOPES = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All dates' },
];

export const STATUS_FILTERS = ['all', 'pending', 'approved', 'completed', 'rejected', 'cancelled'];

// Page layouts: the calendar (week / month) or the searchable table.
export const MODES = ['week', 'month', 'list'];

export const capitalize = (text) => text[0].toUpperCase() + text.slice(1);
export const byRoomId = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
export const soonestFirst = (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);

export function countBy(list, keyOf) {
    const counts = new Map();
    for (const item of list) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
    return counts;
}

export const guestName = (booking, t) => booking.guest?.full_name || booking.guest?.username || booking.guest?.email || t('Guest');

// The days a header count covers: the shown week, or the month itself (not the grid's spill-over days).
export function periodOf(view, date) {
    if (view !== 'month') return calendarRange('week', date);
    const day = asDate(date);
    return { from: toIso(startOfMonth(day)), until: toIso(endOfMonth(day)) };
}

// Pending requests wait (dashed + a badge), approved ones are solid, the rest are done with (muted;
// cancelled and rejected are also struck through by the calendar).
const TONES = { pending: 'dashed', approved: 'solid', completed: 'muted', cancelled: 'muted', rejected: 'muted' };

// `withRoom` false when the calendar shows rooms as lanes (the lane already says which room).
export function bookingItem(booking, { roomColor, t, withRoom = true }) {
    return {
        id: `b${booking.id}`,
        date: booking.date,
        start: formatTime(booking.start_time),
        end: formatTime(booking.end_time),
        title: guestName(booking, t),
        subtitle: withRoom ? booking.room?.name : undefined,
        color: roomColor.get(booking.room_id),
        lane: String(booking.room_id),
        status: booking.status,
        statusLabel: t(booking.status),
        tone: TONES[booking.status] ?? 'solid',
        badge: booking.status === 'pending' ? t('Awaiting approval') : undefined,
        data: booking,
    };
}

// A class session behind the bookings: it explains why that slot of the room is taken.
export function sessionItem(session, { roomColor, t, withRoom = true }) {
    return {
        id: `s${session.key}`,
        date: session.date,
        start: session.start,
        end: session.end,
        title: session.class_name,
        subtitle: [t('Class'), withRoom ? session.room_name : null, session.instructor_name].filter(Boolean).join(' · '),
        color: roomColor.get(session.room_id),
        lane: String(session.room_id),
        status: 'class',
        statusLabel: t('Class'),
        tone: 'background',
        badge: session.is_extra ? t('Make-up') : undefined,
        data: session,
    };
}

// "New booking" from a free slot: the dragged range, or one hour from the picked start (within
// opening hours); the room of the lane, else the selected room tab.
export function slotDraft({ date, time, end, roomId }) {
    const draft = { date, roomId: roomId ?? '' };
    if (!time) return draft;
    if (end) return { ...draft, startTime: time, endTime: end };
    const oneHour = format(addMinutes(parse(time, 'HH:mm', new Date()), 60), 'HH:mm');
    return { ...draft, startTime: time, endTime: oneHour > '22:00' || oneHour < time ? '22:00' : oneHour };
}

// Room lanes for the week calendar ("All rooms"): same order and colours as the room tabs; the
// short label is the room's letter ("Phòng A" → "A").
export const roomLanes = (rooms, roomColor) =>
    rooms.map((room) => {
        const last = room.name.trim().split(/\s+/).at(-1);
        return { id: String(room.id), label: room.name, short: last.length <= 3 ? last : room.name, color: roomColor.get(room.id) };
    });

// Quick reasons for another agreed price (Change price dialog, new booking form), as discounts and
// surcharges; some set an amount too. Only the group matching the change is offered (a lower total →
// discounts, a higher one → surcharges); both while the total is still the list price.
const thousand = (amount) => Math.max(0, Math.round(amount / 1000) * 1000);
export function priceReasons({ list, total, rate }) {
    const discounts = [
        { label: 'Regular customer −10%', amount: thousand(list * 0.9) },
        { label: 'One hour less', amount: Math.max(list - rate, 0) },
    ];
    const surcharges = [{ label: 'Extra hour', amount: list + rate }, { label: 'Late finish surcharge' }, { label: 'Damage fee' }];
    if (total < list) return { discounts, surcharges: [] };
    if (total > list) return { discounts: [], surcharges };
    return { discounts, surcharges };
}

// A room's price for the hours of a booking ('HH:mm' → 'HH:mm'), as the server prices it (room price ×
// hours); null without a room or with times the wrong way round.
export function listPriceFor(room, startTime, endTime) {
    if (!room || !startTime || !endTime) return null;
    const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
    return hours > 0 ? Math.round(Number(room.price ?? 0) * hours) : null;
}

// A past booking (approved or completed, within the last 60 days) whose balance is still open — the
// "Owes money" filter, like listOwingBookings() behind the staff to-do.
export function isOwing(booking, today, days = 60) {
    if (!['approved', 'completed'].includes(booking.status) || booking.date >= today) return false;
    const from = new Date(`${today}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - days);
    if (booking.date < from.toISOString().slice(0, 10)) return false;
    return Number(booking.full_payment ?? 0) - Number(booking.bank_transfer ?? 0) - Number(booking.cash ?? 0) > 0;
}
