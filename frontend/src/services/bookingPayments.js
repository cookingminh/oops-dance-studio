import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Paying a room booking by bank transfer (supabase/migrations/20261117000500_booking_payments.sql), like
// tuition: every booking has a `payment_code` ('OOPS' + 6 characters, one namespace with the tuition
// invoices). A transfer whose content carries it is matched by the bank webhook: the amount is added to
// `bank_transfer`, `real_income` follows while it equals what was received, and the deposit counts as paid
// once covered. Booking money fields: deposit, full_payment (the agreed price), list_price (room price × hours,
// follows the room and times), price_note (why the agreed price differs), bank_transfer, cash, real_income,
// deposit_status. Staff change money only through the functions below (no hand-edited amounts): every
// amount then has a line in the booking's payment history.

const money = (value) => Number(value ?? 0);

// What has come in (transfers + cash).
export const bookingReceived = (booking) => money(booking?.bank_transfer) + money(booking?.cash);

// What is left to pay on the booking in total: the agreed price minus what came in (0 for a rejected or
// cancelled booking). This is the "still to pay" figure.
export function bookingBalance(booking) {
    if (!booking || ['rejected', 'cancelled'].includes(booking.status)) return 0;
    return Math.max(Number(booking.full_payment ?? 0) - bookingReceived(booking), 0);
}

// The part of it to pay first: the rest of the deposit while the deposit is open, else the whole balance
// (mirrors private.booking_due, which the sandbox simulates). { amount, kind: 'deposit' | 'balance' | null }.
// Show it as "deposit to pay first", next to bookingBalance — not instead of it.
export function bookingDue(booking) {
    if (!booking || ['rejected', 'cancelled'].includes(booking.status)) return { amount: 0, kind: null };
    const received = bookingReceived(booking);
    if (booking.deposit_status === 'waiting' && money(booking.deposit) > 0) {
        const amount = Math.max(money(booking.deposit) - received, 0);
        if (amount > 0) return { amount, kind: 'deposit' };
    }
    const amount = Math.max(money(booking.full_payment) - received, 0);
    return { amount, kind: amount > 0 ? 'balance' : null };
}

// The transfer content to type in a banking app: the code first (that's what is matched), then a hint.
export const bookingTransferContent = (booking) => `${booking.payment_code} dat phong ${booking.date.slice(8, 10)}/${booking.date.slice(5, 7)}`;

// VietQR image for `amount` (default: what is due now). Null until an admin has entered the bank account
// (tuition settings, getTuitionSettings()).
export function bookingQrUrl(settings, booking, amount = bookingDue(booking).amount) {
    if (!settings?.bank_code || !settings?.account_no || !booking?.payment_code) return null;
    const params = new URLSearchParams({ amount: String(Math.round(amount)), addInfo: bookingTransferContent(booking) });
    if (settings.account_name) params.set('accountName', settings.account_name);
    return `https://img.vietqr.io/image/${encodeURIComponent(settings.bank_code)}-${encodeURIComponent(settings.account_no)}-compact2.png?${params}`;
}

// The booking's payments, oldest first (its guest and staff): [{ kind: 'bank' | 'entry', id, method:
// 'transfer' | 'cash', received_at, amount (negative = refunded), content (bank transfer content; null for
// entries), note, recorded_by, recorded_by_name (entries: the staff member) }]. Entries recorded before the
// history existed carry the note 'Recorded before payment history'.
export async function listBookingPayments(bookingId) {
    return unwrap(await supabase.rpc('booking_payments', { p_booking: bookingId }));
}

// Staff: money taken by hand — cash (default) or a transfer the bank webhook didn't see; a negative amount
// refunds the guest (a note is then required). → the booking.
export async function recordBookingPayment(bookingId, amount, { method = 'cash', note = null } = {}) {
    return unwrap(await supabase.rpc('booking_record_payment', { p_booking: bookingId, p_amount: amount, p_method: method, p_note: note }));
}

// Staff: remove an entry recorded by mistake (kind 'entry' rows only). → the booking.
export async function deleteBookingPayment(entryId) {
    return unwrap(await supabase.rpc('booking_delete_payment', { p_entry: entryId }));
}

// Staff: agree another total (a discount, extra time, a surcharge…). `note` is required unless the total is
// the list price again; an open deposit becomes half the new total, or `deposit`. → the booking.
export async function setBookingPrice(bookingId, amount, { note = null, deposit = null } = {}) {
    return unwrap(await supabase.rpc('booking_set_price', { p_booking: bookingId, p_amount: amount, p_note: note, p_deposit: deposit }));
}

// Staff: put an inbox transfer on a booking (no code or a wrong one), or take it back off.
export async function assignTransferToBooking(transferId, bookingId) {
    return unwrap(await supabase.rpc('booking_assign_transfer', { p_transfer: transferId, p_booking: bookingId }));
}

export async function unassignBookingTransfer(transferId) {
    return unwrap(await supabase.rpc('booking_unassign_transfer', { p_transfer: transferId }));
}

// Sandbox only (demo / local stack; isPaymentSandbox()): pretend the bank sent `amount` (default: what is
// due now) → { transfer_id, status, booking_id, note }.
export async function simulateBookingTransfer(bookingId, amount = null) {
    return unwrap(await supabase.rpc('booking_simulate_transfer', { p_booking: bookingId, p_amount: amount }));
}

// Staff: bookings whose session is over (before `today`, the last `days` days) and still owe money:
// [{ id, date, start_time, end_time, status, payment_code, full_payment, bank_transfer, cash, owed, guest, room }],
// oldest first.
export async function listOwingBookings(today, { days = 60 } = {}) {
    const from = new Date(`${today}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - days);
    const rows = unwrap(
        await supabase
            .from('bookings')
            .select('id, date, start_time, end_time, status, payment_code, deposit, deposit_status, full_payment, bank_transfer, cash, guest:profiles!guest_id(id, full_name, username), room:rooms!room_id(id, name)')
            .in('status', ['approved', 'completed'])
            .lt('date', today)
            .gte('date', from.toISOString().slice(0, 10))
            .order('date')
    );
    return rows
        .map((row) => ({ ...row, owed: Math.max(Number(row.full_payment ?? 0) - bookingReceived(row), 0) }))
        .filter((row) => row.owed > 0);
}

// Staff looking a booking up to assign a transfer: by '#123', '123' or its OOPS code.
export async function findBooking(term) {
    const text = String(term ?? '').trim().replace(/^#/, '').toUpperCase();
    if (!text) return null;
    const query = supabase.from('bookings').select('id, date, start_time, end_time, status, payment_code, deposit, full_payment, bank_transfer, cash, deposit_status, room:rooms!room_id(id, name), guest:profiles!guest_id(id, full_name, username)');
    const result = /^\d+$/.test(text) ? await query.eq('id', Number(text)).maybeSingle() : await query.eq('payment_code', text).maybeSingle();
    return unwrap(result);
}
