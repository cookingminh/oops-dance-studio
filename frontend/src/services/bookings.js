import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

export const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
export const DEPOSIT_STATUSES = ['waiting', 'completed', 'cancelled'];

const BOOKING_SELECT = `*, room:rooms!room_id(id, name),
    guest:profiles!guest_id(id, username, full_name, email, avatar_path, updated_at)`;

// Free windows per room on a date: [{ room_id, room_name, start_time, end_time }].
export async function getAvailableSlots(date) {
    return unwrap(await supabase.rpc('get_available_slots', { p_date: date }));
}

// Books for the signed-in user, or for `guestId` when the caller is staff. The server checks
// past dates and overlaps (PAST_DATE, SLOT_TAKEN) and computes full_payment / deposit.
export async function createBooking({ roomId, date, startTime, endTime, details, guestId }) {
    return unwrap(
        await supabase.rpc('create_booking', {
            p_room_id: roomId,
            p_date: date,
            p_start: startTime,
            p_end: endTime,
            p_details: details?.trim() || null,
            p_guest_id: guestId ?? null,
        })
    );
}

// Cancel a booking (supabase/migrations/20261117000800_booking_refunds.sql). The guest: their own pending or
// approved booking before it starts; the refund follows the cancellation policy, `refundTo` says where to send
// it. Staff: `byStudio` = the studio cancels (everything back); `refund` overrides the amount with a `note`.
// The money due back stays on the booking (refund_due) until staff pay it (services/bookingRefunds.js).
export async function cancelBooking(id, { byStudio = false, refund = null, note = null, refundTo = null } = {}) {
    return unwrap(
        await supabase.rpc('cancel_booking', { p_booking_id: id, p_by_studio: byStudio, p_refund: refund, p_note: note, p_refund_to: refundTo })
    );
}

export async function listMyBookings(guestId) {
    return unwrap(
        await supabase
            .from('bookings')
            .select('*, room:rooms!room_id(id, name)')
            .eq('guest_id', guestId)
            .order('date', { ascending: false })
            .order('start_time', { ascending: false })
    );
}

// Staff
export async function listBookings() {
    return unwrap(
        await supabase
            .from('bookings')
            .select(BOOKING_SELECT)
            .order('date', { ascending: false })
            .order('start_time', { ascending: false })
    );
}

// Staff dashboard: upcoming requests still waiting for a decision (soonest first) and how many there are.
export async function listPendingBookings({ from, limit = 5 }) {
    const response = await supabase
        .from('bookings')
        .select(BOOKING_SELECT, { count: 'exact' })
        .eq('status', 'pending')
        .gte('date', from)
        .order('date')
        .order('start_time')
        .limit(limit);
    return { rows: unwrap(response), total: response.count ?? 0 };
}

const money = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

function toRow(fields) {
    const row = {};
    const map = {
        guestId: 'guest_id',
        roomId: 'room_id',
        date: 'date',
        startTime: 'start_time',
        endTime: 'end_time',
        status: 'status',
        depositStatus: 'deposit_status',
        details: 'details',
    };
    for (const [key, column] of Object.entries(map)) {
        if (key in fields) row[column] = key === 'details' ? fields[key]?.trim() || null : fields[key];
    }
    for (const column of ['deposit', 'full_payment', 'real_income', 'bank_transfer', 'cash']) {
        if (column in fields) row[column] = money(fields[column]);
    }
    return row;
}

// Staff book for a guest in one go (booking_staff_create): the booking — approved, or 'pending' to hold it —
// priced from the room (its payment code is set by the server), another agreed `price` with its required
// `priceNote` if given, and money taken now: `paid` (the deposit, the full price or any amount) by `method`
// ('cash' | 'transfer' seen by hand) with an optional `paymentNote`. Nothing taken → the guest pays later by
// QR (services/bookingPayments.js). → the booking.
export async function staffCreateBooking({ guestId, roomId, date, startTime, endTime, details, status = 'approved', price = null, priceNote = null, paid = 0, method = 'cash', paymentNote = null }) {
    return unwrap(
        await supabase.rpc('booking_staff_create', {
            p_guest: guestId,
            p_room: roomId,
            p_date: date,
            p_start: startTime,
            p_end: endTime,
            p_details: details?.trim() || null,
            p_status: status,
            p_price: price,
            p_price_note: priceNote,
            p_paid: paid,
            p_method: method,
            p_payment_note: paymentNote,
        })
    );
}

export async function updateBooking(id, fields) {
    return unwrap(await supabase.from('bookings').update(toRow(fields)).eq('id', id).select(BOOKING_SELECT).single());
}

export async function deleteBooking(id) {
    unwrap(await supabase.from('bookings').delete().eq('id', id));
}
