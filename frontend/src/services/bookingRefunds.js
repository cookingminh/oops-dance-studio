import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Booking cancellations and refunds (supabase/migrations/20261117000800_booking_refunds.sql,
// api-contract §5 Booking refunds). The policy lives in booking_settings (everyone reads it, admins change it):
//   refund_full_hours       cancelling at least this many hours ahead gets everything back (null = no such step)
//   refund_partial_hours    at least this many hours ahead gets refund_partial_percent % back; later, nothing
// A booking not approved yet, or one the studio cancels or rejects, gets everything back.
// On a booking: refund_due (still to give back), refund_paid (given back), refund_to (where the guest wants it),
// refund_note, cancel_kind ('guest' | 'studio'), cancelled_at.

export const POLICY_DEFAULTS = { refund_full_hours: null, refund_partial_hours: 24, refund_partial_percent: 50 };

export async function getBookingSettings() {
    const rows = unwrap(await supabase.from('booking_settings').select('refund_full_hours, refund_partial_hours, refund_partial_percent, updated_at').eq('id', 1));
    return rows[0] ?? POLICY_DEFAULTS;
}

// Admin. fullHours null = no full-refund step.
export async function setRefundPolicy({ fullHours, partialHours, partialPercent }) {
    return unwrap(
        await supabase.rpc('booking_set_refund_policy', { p_full_hours: fullHours ?? null, p_partial_hours: partialHours, p_partial_percent: partialPercent })
    );
}

// What cancelling now would give back: { received, percent, refund, keep, hours_before,
// tier: 'full' | 'partial' | 'none' | 'pending' | 'studio', full_hours, partial_hours, partial_percent }.
export async function cancelQuote(bookingId, { byStudio = false } = {}) {
    return unwrap(await supabase.rpc('booking_cancel_quote', { p_booking: bookingId, p_by_studio: byStudio }));
}

// Staff paid the refund back ('transfer' | 'cash').
export async function refundBooking(bookingId, { method = 'transfer', note = null } = {}) {
    return unwrap(await supabase.rpc('booking_refund', { p_booking: bookingId, p_method: method, p_note: note }));
}

// Staff change what is due back (0 … what was paid), with a reason.
export async function setBookingRefund(bookingId, amount, note) {
    return unwrap(await supabase.rpc('booking_set_refund', { p_booking: bookingId, p_amount: amount, p_note: note }));
}

// Staff: cancelled or rejected bookings with money still to give back, oldest first.
export async function listRefundsDue() {
    return unwrap(
        await supabase
            .from('bookings')
            .select('id, date, start_time, end_time, status, refund_due, refund_to, cancelled_at, guest:profiles!guest_id(id, full_name, username), room:rooms!room_id(id, name)')
            .gt('refund_due', 0)
            .order('cancelled_at', { ascending: true })
    );
}

// The policy as lines to show ({ key, vars }: English i18n keys), most generous first.
export function refundPolicyLines(settings) {
    const s = { ...POLICY_DEFAULTS, ...settings };
    const lines = [];
    if (s.refund_full_hours) lines.push({ key: 'Cancel {hours} hours or more ahead: full refund', vars: { hours: s.refund_full_hours } });
    if (s.refund_partial_percent > 0) {
        lines.push({ key: 'Cancel {hours} hours or more ahead: {percent}% back', vars: { hours: s.refund_partial_hours, percent: s.refund_partial_percent } });
    }
    lines.push({ key: 'Less than {hours} hours ahead: no refund', vars: { hours: s.refund_partial_percent > 0 ? s.refund_partial_hours : s.refund_full_hours ?? s.refund_partial_hours } });
    lines.push({ key: 'Not approved yet, or cancelled by the studio: full refund', vars: {} });
    return lines;
}
