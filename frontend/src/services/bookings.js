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

// Owner while pending; staff while pending or approved.
export async function cancelBooking(id) {
    return unwrap(await supabase.rpc('cancel_booking', { p_booking_id: id }));
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

// Staff booking on behalf of a guest: create_booking validates it and sets the amounts, then any
// status / payment values the staff entered are applied on top.
export async function createBookingForGuest(fields) {
    const created = await createBooking(fields);
    const extra = { status: fields.status, depositStatus: fields.depositStatus };
    for (const column of ['deposit', 'full_payment', 'real_income', 'bank_transfer', 'cash']) {
        if (fields[column] !== '' && fields[column] !== null && fields[column] !== undefined) extra[column] = fields[column];
    }
    return updateBooking(created.id, extra);
}

export async function updateBooking(id, fields) {
    return unwrap(await supabase.from('bookings').update(toRow(fields)).eq('id', id).select(BOOKING_SELECT).single());
}

export async function deleteBooking(id) {
    unwrap(await supabase.from('bookings').delete().eq('id', id));
}
