import { addMonths, format, getDaysInMonth, getISODay, parseISO } from 'date-fns';
import { formatTime } from '@/lib/format';
import { payLabel } from '@/ui/payment/bookingMoney';

// Pure helpers behind My bookings → Calendar. Dates travel as 'yyyy-MM-dd' strings, months as 'yyyy-MM-01'.

// The deposit's state as a word (English, translated where it is shown).
export const DEPOSIT_LABELS = { waiting: 'waiting', completed: 'paid', cancelled: 'cancelled' };

// List | Calendar, remembered in this browser only.
const VIEW_KEY = 'oops-my-bookings-view';
export function readView() {
    try {
        return window.localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
    } catch {
        return 'list';
    }
}
export function rememberView(view) {
    try {
        window.localStorage.setItem(VIEW_KEY, view);
    } catch {
        // Private mode or blocked storage: the choice just isn't remembered.
    }
}

export const monthOf = (date) => `${date.slice(0, 7)}-01`;
export const inMonth = (date, month) => date.slice(0, 7) === month.slice(0, 7);
export const shiftMonth = (month, step) => format(addMonths(parseISO(month), step), 'yyyy-MM-dd');

// The month as weeks of 7 days (Monday first); days of the months around it are null.
export function monthGrid(month) {
    const first = parseISO(month);
    const dates = Array.from({ length: getDaysInMonth(first) }, (_, index) => `${month.slice(0, 8)}${String(index + 1).padStart(2, '0')}`);
    const cells = [...Array(getISODay(first) - 1).fill(null), ...dates];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
    return weeks;
}

const isOff = (booking) => ['cancelled', 'rejected'].includes(booking.status);

// The colour of a booking on the calendar: 'pending' | 'approved' | 'completed' | 'off' (cancelled or rejected).
export const toneOf = (booking) => (isOff(booking) ? 'off' : booking.status);

// Money still to pay on it (the deposit, or the rest): the same rule as its Pay button.
export const isOwed = (booking) => Boolean(payLabel(booking));

// "13:00–15:00", short enough for a chip.
export const chipTimes = (booking) => `${formatTime(booking.start_time)}–${formatTime(booking.end_time)}`;

const byTime = (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);

// Map 'yyyy-MM-dd' → that day's bookings, by start time.
export function bookingsByDay(bookings) {
    const days = new Map();
    for (const booking of [...bookings].sort(byTime)) {
        if (!days.has(booking.date)) days.set(booking.date, []);
        days.get(booking.date).push(booking);
    }
    return days;
}

// The month the calendar opens on: the next booking still on (from today), else this month.
export function defaultMonth(bookings, today) {
    const next = bookings.filter((booking) => booking.date >= today && !isOff(booking)).sort(byTime)[0];
    return monthOf(next?.date ?? today);
}

// The day picked on a phone when none is: the next day with bookings in the month (from today), else
// today when it is in the month, else the month's first day with bookings, else its 1st.
export function defaultPick(month, byDay, today) {
    const days = [...byDay.keys()].filter((date) => inMonth(date, month)).sort();
    return days.find((date) => date >= today) ?? (inMonth(today, month) ? today : days[0] ?? month);
}
