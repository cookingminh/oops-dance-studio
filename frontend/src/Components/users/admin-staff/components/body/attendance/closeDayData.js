import { supabase } from '@/lib/supabase';
import { unwrap } from '@/services/errors';
import { listSessionRows } from '@/services/attendanceHub';
import { bookingReceived } from '@/services/bookingPayments';
import { meetsOn } from '@/lib/lessons';
import { sessionTimes } from '../class-hub/hubModel';

// What closing the studio on a day would touch (the Close-for-a-day dialog's preview), the same way
// studio_close_day picks it: every class meeting that day (by its timetable or with a session that day)
// whose session hasn't been called off, started or happened; and the pending / approved / paid-up (completed)
// room bookings that day, which the studio cancels with everything paid going back. RLS: staff read every
// session and booking.

const BOOKING = 'id, status, date, start_time, end_time, bank_transfer, cash, room:rooms!room_id(id, name), guest:profiles!guest_id(id, username, full_name)';

const DONE = ['cancelled', 'in_progress', 'completed'];

// → { sessions: [{ cls, start, end, row, off: 'cancelled' | 'started' | null }], bookings, refund }
export async function loadDayPreview(date, classes) {
    const [rows, bookings] = await Promise.all([
        listSessionRows({ from: date, until: date }),
        supabase
            .from('bookings')
            .select(BOOKING)
            .eq('date', date)
            .in('status', ['pending', 'approved', 'completed'])
            .order('start_time')
            .then(unwrap),
    ]);
    const rowOf = new Map(rows.map((row) => [row.class_id, row]));
    const sessions = classes
        .filter((cls) => meetsOn(cls, date) || rowOf.has(cls.id))
        .map((cls) => {
            const row = rowOf.get(cls.id) ?? null;
            let off = null;
            if (row?.status === 'cancelled') off = 'cancelled';
            else if (DONE.includes(row?.status)) off = 'started';
            return { cls, row, off, ...sessionTimes(cls, date, row) };
        })
        .sort((a, b) => (a.start || '99').localeCompare(b.start || '99') || a.cls.name.localeCompare(b.cls.name));
    const refund = bookings.reduce((sum, booking) => sum + bookingReceived(booking), 0);
    return { sessions, bookings, refund };
}
