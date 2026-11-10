import { bookingDue, bookingReceived } from '@/services/bookingPayments';
import { toMinutes } from '@/lib/format';

// Reading a room booking's money for the pay dialog, the receipt and the booking pages (staff and guest).
// Labels are English source text, translated where they are shown.

const money = (value) => Number(value ?? 0);

export const bookingHours = (booking) => Math.max(toMinutes(booking.end_time.slice(0, 5)) - toMinutes(booking.start_time.slice(0, 5)), 0) / 60;

// The room's price for one hour: the list price (room price × hours, kept by the server) over the hours.
export function hourlyRate(booking) {
    const hours = bookingHours(booking);
    return hours ? Math.round(money(booking.list_price ?? booking.full_payment) / hours) : 0;
}

// The agreed price when staff changed it: { list, total, diff (negative = discount), note }; null while the
// booking costs its list price.
export function priceChange(booking) {
    if (booking.list_price === null || booking.list_price === undefined) return null;
    const list = money(booking.list_price);
    const total = money(booking.full_payment);
    return list === total ? null : { list, total, diff: total - list, note: booking.price_note ?? '' };
}

// Entries recorded before the history existed carry this note (an i18n key).
export const LEGACY_ENTRY = 'Recorded before payment history';

// Where the money stands, as a pill: { label, tone: 'good' | 'due' | 'late' | 'idle' }. A cancelled booking
// says where its refund stands (booking_refunds: refund_due still to give back, refund_paid given back).
export function paymentState(booking) {
    const received = bookingReceived(booking);
    const total = money(booking.full_payment);
    if (['rejected', 'cancelled'].includes(booking.status)) {
        if (money(booking.refund_due) > 0) return { label: 'Refund due', tone: 'due' };
        if (money(booking.refund_paid) > 0) return { label: 'Refunded', tone: 'good' };
        return received > 0 ? { label: 'Paid, booking cancelled', tone: 'late' } : { label: 'Nothing to pay', tone: 'idle' };
    }
    if (total > 0 && received >= total) return { label: 'Fully paid', tone: 'good' };
    if (booking.deposit_status === 'completed') return { label: 'Deposit paid', tone: 'good' };
    if (booking.deposit_status === 'waiting' && money(booking.deposit) > 0) {
        return { label: received > 0 ? 'Part of the deposit paid' : 'Deposit due', tone: 'due' };
    }
    if (received > 0) return { label: 'Partly paid', tone: 'due' };
    return total > 0 ? { label: 'Not paid yet', tone: 'due' } : { label: 'Nothing to pay', tone: 'idle' };
}

// What the pay dialog offers: the (rest of the) deposit while it is open, or everything left; once
// the deposit is in, the rest. [{ key, label, amount }], first = suggested.
export function payChoices(booking) {
    const due = bookingDue(booking);
    const left = Math.max(money(booking.full_payment) - bookingReceived(booking), 0);
    if (due.kind === 'deposit') {
        return [{ key: 'deposit', label: 'Deposit', amount: due.amount }, ...(left > due.amount ? [{ key: 'full', label: 'Full amount', amount: left }] : [])];
    }
    if (left > 0) return [{ key: 'rest', label: bookingReceived(booking) > 0 ? 'The rest' : 'Full amount', amount: left }];
    return [];
}

// The button that opens the pay dialog: "Pay deposit" / "Pay the rest" / "Pay for the room", or null when nothing
// is due (or the booking is cancelled / rejected).
export function payLabel(booking) {
    const due = bookingDue(booking);
    if (!due.amount) return null;
    if (due.kind === 'deposit') return 'Pay deposit';
    return bookingReceived(booking) > 0 ? 'Pay the rest' : 'Pay for the room';
}
