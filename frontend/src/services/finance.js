import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Finance report (admin only) — supabase/migrations/20261112000100_tuition.sql, api-contract §5.
// Months are 'yyyy-MM-01'.

// One row per month, oldest first (at most 36):
// { month, tuition_billed, tuition_collected, tuition_outstanding, tuition_waived, transfer_amount,
//   cash_amount, bookings_revenue, payroll_cost, expenses_total, costs_total (= payroll_cost + expenses_total),
//   revenue (= tuition_collected + bookings_revenue), profit (= revenue − costs_total),
//   students_active, students_new (first month ever), students_continuing (also active last month),
//   students_returning (back after a break), students_left (active last month, not this month),
//   enrolments_active, enrolments_new, enrolments_renewed, enrolments_ended (per class membership;
//   switches excluded), class_switches, invoices_overdue }
// Students are counted per person, so a class switch is not churn.
// Tuition is counted by the month an invoice is for; bookings by their date; payroll is the
// month's payroll total (the payslip snapshot once finalized). Numbers come back as numbers or strings.
export async function getFinanceMonthly(from, to) {
    const rows = unwrap(await supabase.rpc('finance_monthly', { p_from: from, p_to: to }));
    return rows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === 'month' ? value : Number(value)]))
    );
}

// Per class for one month: { class_id, class_name, instructor_name, students, billed, collected,
// outstanding, sessions, instructor_pay, direct_costs (expenses tied to the class),
// margin (= collected − instructor_pay − direct_costs) }, best first. Shared costs aren't split per class.
export async function getFinanceByClass(month) {
    const rows = unwrap(await supabase.rpc('finance_by_class', { p_month: month }));
    return rows.map((row) => ({
        ...row,
        ...Object.fromEntries(['students', 'billed', 'collected', 'outstanding', 'sessions', 'instructor_pay', 'direct_costs', 'margin'].map((key) => [key, Number(row[key])])),
    }));
}

// Expenses per month and category, for the cost breakdown: { month, category, amount, items }.
export async function getFinanceExpenses(from, to) {
    const rows = unwrap(await supabase.rpc('finance_expenses', { p_from: from, p_to: to }));
    return rows.map((row) => ({ ...row, amount: Number(row.amount), items: Number(row.items) }));
}
