import { POLICY_DEFAULTS, refundPolicyLines } from '@/services/bookingRefunds';
import { formatTime } from '@/lib/format';

// Reading the cancellation policy and a cancellation quote (services/bookingRefunds.js) for the guest's
// cancel dialog, the staff's, the policy editor and the booking form. Keys are English i18n text.

// The policy line each quote tier falls under (pending and studio share the last line).
const TIER_KEYS = {
    full: 'Cancel {hours} hours or more ahead: full refund',
    partial: 'Cancel {hours} hours or more ahead: {percent}% back',
    none: 'Less than {hours} hours ahead: no refund',
    pending: 'Not approved yet, or cancelled by the studio: full refund',
    studio: 'Not approved yet, or cancelled by the studio: full refund',
};

// A quote carries the policy it was worked out with; as booking_settings columns.
export const quoteSettings = (quote) => ({
    refund_full_hours: quote.full_hours ?? null,
    refund_partial_hours: quote.partial_hours ?? POLICY_DEFAULTS.refund_partial_hours,
    refund_partial_percent: quote.partial_percent ?? POLICY_DEFAULTS.refund_partial_percent,
});

// A 0 % partial step gives nothing back: it reads as the "no refund" line (the policy list has no 0 % line).
export const tierOf = (quote) => (quote.tier === 'partial' && Number(quote.percent) === 0 ? 'none' : quote.tier);

// The policy's lines, the one `quote` falls under marked `current`: [{ key, vars, current }].
export function policyLines(settings, quote = null) {
    const current = quote ? TIER_KEYS[tierOf(quote)] : null;
    return refundPolicyLines(settings).map((line) => ({ ...line, current: line.key === current }));
}

// The step that applies to `quote`, on its own: { key, vars } ("Cancel 24 hours or more ahead: 50% back").
export function quoteStep(quote) {
    const tier = tierOf(quote);
    if (tier === 'pending') return { key: 'Not approved yet: full refund', vars: {} };
    if (tier === 'studio') return { key: 'Cancelled by the studio: full refund', vars: {} };
    const line = refundPolicyLines(quoteSettings(quote)).find((item) => item.key === TIER_KEYS[tier]);
    return line ?? { key: TIER_KEYS.none, vars: { hours: quote.partial_hours } };
}

// The hours below which nothing comes back (the "no refund" line's number).
export const noRefundHours = (settings) => refundPolicyLines(settings).find((line) => line.key === TIER_KEYS.none)?.vars.hours;

// A guest may cancel a pending, approved or completed booking until it starts (studio date + 'HH:mm' now):
// a booking paid in full becomes `completed` by itself (20261117001000_booking_auto_complete) and is still
// ahead of them.
export const guestCanCancel = (booking, today, now) =>
    ['pending', 'approved', 'completed'].includes(booking.status) && Boolean(today) && (booking.date > today || (booking.date === today && formatTime(booking.start_time) > now));

// Money on a cancelled booking: { due (still to give back), paid (given back) }.
export const refundOf = (booking) => ({ due: Number(booking?.refund_due ?? 0), paid: Number(booking?.refund_paid ?? 0) });
