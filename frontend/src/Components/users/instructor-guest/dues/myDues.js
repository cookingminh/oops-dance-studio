import { differenceInCalendarDays, parseISO } from 'date-fns';
import { ROLES } from '@/auth/roles';
import { amountDue, getTuitionSettings, isPaymentSandbox } from '@/services/tuition';
import { loadMyTuition } from '@/services/tuitionStudent';
import { listMyBookings } from '@/services/bookings';
import { bookingDue } from '@/services/bookingPayments';
import { getStudioToday } from '@/services/studio';
import { arrangeTuition, needsAnswer, songOf } from '../components/body/pages/tuition/tuitionData';

// What a signed-in student or guest still has to pay (or answer), for the bell, the menu badges and the
// daily reminder in /profile. Each item:
//   { id, kind: 'tuition' | 'renewal' | 'deposit' | 'room', tone: 'late' | 'soon' | 'due', days (until due;
//     negative = late), amount, to (the page), invoice? | booking?, … words for the message }
// Rules, so nobody is nagged for nothing:
//   tuition   an unpaid course running now or finished: late after its due date, 'soon' within SOON_DAYS
//   renewal   the next course, unpaid: asks for an answer (none yet) or the money (said "continue")
//   deposit   a booking ahead still waiting for its deposit (a pending one is confirmed once it arrives)
//   room      a booking whose day has passed with money still owed

export const SOON_DAYS = 3;
export const DUES_PAGES = { tuition: '/profile/tuition', bookings: '/profile/my-bookings' };

const daysUntil = (iso, today) => differenceInCalendarDays(parseISO(iso), parseISO(today));
const toneOf = (days) => {
    if (days < 0) return 'late';
    return days <= SOON_DAYS ? 'soon' : 'due';
};

export function tuitionDues(tuition) {
    if (!tuition) return [];
    const { today } = tuition;
    const view = arrangeTuition(tuition);
    const items = view.toPay.map((invoice) => {
        const days = daysUntil(invoice.due_date, today);
        return {
            id: `tuition-${invoice.id}`,
            kind: 'tuition',
            tone: toneOf(days),
            days,
            amount: amountDue(invoice),
            to: DUES_PAGES.tuition,
            invoice,
            className: invoice.class_name,
            course: songOf(invoice.course.title),
            date: invoice.due_date,
        };
    });
    for (const invoice of view.upcoming) {
        if (invoice.status !== 'unpaid') continue;
        const days = daysUntil(invoice.due_date, today);
        items.push({
            id: `renewal-${invoice.id}`,
            kind: 'renewal',
            ask: needsAnswer(invoice),
            tone: toneOf(days),
            days,
            amount: amountDue(invoice),
            to: DUES_PAGES.tuition,
            invoice,
            className: invoice.class_name,
            course: songOf(invoice.course.title),
            date: invoice.due_date,
        });
    }
    return items;
}

export function bookingDues(bookings, today) {
    const items = [];
    for (const booking of bookings ?? []) {
        if (!['pending', 'approved', 'completed'].includes(booking.status)) continue;
        const due = bookingDue(booking);
        if (!due.amount) continue;
        const past = booking.date < today;
        if (due.kind === 'deposit' && !past) {
            const days = daysUntil(booking.date, today);
            items.push({ id: `deposit-${booking.id}`, kind: 'deposit', tone: days <= SOON_DAYS ? 'soon' : 'due', days, amount: due.amount, to: DUES_PAGES.bookings, booking });
        } else if (past && booking.status !== 'pending') {
            items.push({ id: `room-${booking.id}`, kind: 'room', tone: 'late', days: daysUntil(booking.date, today), amount: due.amount, to: DUES_PAGES.bookings, booking });
        }
    }
    return items;
}

const TONE_ORDER = { late: 0, soon: 1, due: 2 };
export const byUrgency = (a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.days - b.days || b.amount - a.amount;

// Everything for one person: { today, items (most urgent first), counts: { [page]: n }, settings, sandbox }.
// Students (guests) get tuition and bookings; instructors only bookings.
export async function loadMyDues(user, role) {
    const isStudent = role === ROLES.guest;
    const [today, tuition, bookings, settings, sandbox] = await Promise.all([
        getStudioToday(),
        isStudent ? loadMyTuition(user.id).catch(() => null) : null,
        listMyBookings(user.id).catch(() => []),
        getTuitionSettings().catch(() => null),
        isPaymentSandbox().catch(() => false),
    ]);
    const items = [...tuitionDues(tuition), ...bookingDues(bookings, today)].sort(byUrgency);
    const counts = {};
    for (const item of items) counts[item.to] = (counts[item.to] ?? 0) + 1;
    return { today, items, counts, settings, sandbox };
}
