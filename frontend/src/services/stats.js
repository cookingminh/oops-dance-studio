import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Staff: { monthly_booking_count, total_students, classes_today, revenue_this_month }
export async function dashboardStats() {
    return unwrap(await supabase.rpc('dashboard_stats'));
}

// Instructor: { class_count, completed_sessions }; guest: { class_count, attended_count, absent_count }
export async function myStats() {
    return unwrap(await supabase.rpc('my_stats'));
}

// Approved/completed bookings per month and room (staff; RLS on bookings applies).
export async function revenueMonthly() {
    return unwrap(await supabase.from('v_revenue_monthly').select('*').order('month'));
}

// `from` inclusive, `to` exclusive ('yyyy-MM-dd').
export async function bookingStatusByRoom({ from, to }) {
    let query = supabase.from('bookings').select('room_id, status, room:rooms!room_id(id, name)');
    if (from) query = query.gte('date', from);
    if (to) query = query.lt('date', to);
    return unwrap(await query);
}

export async function classEnrolment() {
    const rows = unwrap(await supabase.from('classes').select('id, name, class_students(count)').order('name'));
    return rows.map((row) => ({ id: row.id, name: row.name, students: row.class_students?.[0]?.count ?? 0 }));
}
