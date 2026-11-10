import { formatVnd } from '@/lib/format';

// Helpers of the staff refund dialogs (cancel a booking, change a refund). Labels are English i18n keys.

// Quick reasons for a refund that isn't the policy's amount.
export const REFUND_REASONS = ['Moved to another booking', 'Regular customer', 'Problem on the studio’s side'];

// What is wrong with an amount staff typed (whole VND, 0 … what was received; another amount than the
// suggested one needs a reason), translated; '' when it is fine.
export function refundProblem({ typed, received, changed, note }, t, reasonMessage) {
    const value = Number(typed);
    if (typed === '' || !Number.isInteger(value) || value < 0 || value > received) {
        return t('Enter an amount between 0 and {amount}.', { amount: formatVnd(received) });
    }
    if (changed && !note.trim()) return t(reasonMessage);
    return '';
}

// Who cancelled, as a short label: a rejected request, or a cancellation by the guest or the studio.
export function cancelledBy(booking) {
    if (booking.status === 'rejected') return 'Rejected by the studio';
    return booking.cancel_kind === 'guest' ? 'Cancelled by the guest' : 'Cancelled by the studio';
}

// timestamptz → the studio's calendar date 'yyyy-MM-dd'.
const studioDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
export const studioDay = (timestamp) => (timestamp ? studioDate.format(new Date(timestamp)) : null);
