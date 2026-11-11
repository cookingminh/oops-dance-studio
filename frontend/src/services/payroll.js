import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Payroll (admin only; see supabase/migrations/20261110000100_payroll.sql).
// `month` is always 'yyyy-MM-01'.

const PERSON = 'id, username, full_name, email, avatar_path, updated_at';

// One row per person to pay: sessions, session_pay, base_salary, bonuses, deductions (≤ 0),
// total, status ('draft' | 'finalized' | 'paid'), finalized_at, paid_at.
export async function getPayrollMonth(month) {
    return unwrap(await supabase.rpc('payroll_month', { p_month: month }));
}

export async function finalizePayslip(profileId, month) {
    return unwrap(await supabase.rpc('payroll_finalize', { p_profile: profileId, p_month: month }));
}

export async function reopenPayslip(profileId, month) {
    unwrap(await supabase.rpc('payroll_reopen', { p_profile: profileId, p_month: month }));
}

export async function setPayslipPaid(profileId, month, paid) {
    return unwrap(await supabase.rpc('payroll_set_paid', { p_profile: profileId, p_month: month, p_paid: paid }));
}

// ---- Bonuses (+) and deductions (−) ------------------------------------------------

export async function listAdjustments(profileId, month) {
    return unwrap(
        await supabase
            .from('payroll_adjustments')
            .select(`id, amount, reason, attendance_id, created_at, author:profiles!created_by(${PERSON})`)
            .eq('profile_id', profileId)
            .eq('month', month)
            .order('created_at')
    );
}

export async function addAdjustment({ profileId, month, amount, reason, attendanceId }) {
    return unwrap(
        await supabase
            .from('payroll_adjustments')
            .insert({ profile_id: profileId, month, amount, reason: reason.trim(), attendance_id: attendanceId ?? null })
            .select('id')
            .single()
    );
}

export async function deleteAdjustment(id) {
    unwrap(await supabase.from('payroll_adjustments').delete().eq('id', id));
}

// ---- Rates and salaries -------------------------------------------------------------

export async function getDefaultSessionRate() {
    const row = unwrap(await supabase.from('payroll_settings').select('default_session_rate').eq('id', 1).single());
    return Number(row.default_session_rate);
}

export async function setDefaultSessionRate(rate) {
    unwrap(await supabase.from('payroll_settings').update({ default_session_rate: rate }).eq('id', 1));
}

// { [classId]: rate }
export async function getClassRates() {
    const rows = unwrap(await supabase.from('class_pay_rates').select('class_id, session_rate'));
    return Object.fromEntries(rows.map((row) => [row.class_id, Number(row.session_rate)]));
}

// `rate` null → the class goes back to the default rate.
export async function setClassRate(classId, rate) {
    if (rate === null) unwrap(await supabase.from('class_pay_rates').delete().eq('class_id', classId));
    else unwrap(await supabase.from('class_pay_rates').upsert({ class_id: classId, session_rate: rate }));
}

// { [profileId]: monthly salary }
export async function getStaffSalaries() {
    const rows = unwrap(await supabase.from('staff_salaries').select('profile_id, monthly_salary'));
    return Object.fromEntries(rows.map((row) => [row.profile_id, Number(row.monthly_salary)]));
}

export async function setStaffSalary(profileId, salary) {
    if (salary === null) unwrap(await supabase.from('staff_salaries').delete().eq('profile_id', profileId));
    else unwrap(await supabase.from('staff_salaries').upsert({ profile_id: profileId, monthly_salary: salary }));
}

// An instructor's sessions in a month (every status), oldest first, for the payslip breakdown.
export async function listInstructorMonth(instructorId, month) {
    const [year, mon] = month.split('-').map(Number);
    const next = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    return unwrap(
        await supabase
            .from('instructor_attendance')
            .select(`id, class_id, date, status, checkin_at, checkout_at, checkout_late, details, start_time, end_time, is_extra,
                class:classes!class_id(id, name, schedules:class_schedules(day_of_week, start_time, end_time))`)
            .eq('instructor_id', instructorId)
            .gte('date', month)
            .lt('date', next)
            .order('date')
    );
}
