import { EXPENSE_CATEGORIES } from '@/lib/expenseCategories';
import { classMarginPct } from './reportModel';

// CSV for the accountant: plain numbers (VND, no thousands separators), ratios as percentages
// with one decimal, a BOM so Excel reads the Vietnamese names as UTF-8.
const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const percent = (value) => (value === null || value === undefined ? '' : (value * 100).toFixed(1));

function download(filename, head, lines) {
    const csv = [head, ...lines].map((line) => line.map(cell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

// `expenses`: Map month → [{ category, amount }] (indexExpenses). One column per category that
// has any cost in these months, in the categories' own order.
export function downloadMonthlyCsv(rows, expenses, t) {
    const amountOf = (month, key) => (expenses.get(month) ?? []).find((row) => row.category === key)?.amount ?? 0;
    const categories = EXPENSE_CATEGORIES.filter(({ key }) => rows.some((row) => amountOf(row.month, key) > 0));
    const head = [
        t('Month'), t('Status'), t('Tuition billed'), t('Tuition collected'), t('Collection rate (%)'), t('Outstanding'), t('Waived'),
        t('Bank transfer'), t('Cash'), t('Room bookings'), t('Revenue'), t('Payroll cost'), t('Expenses'),
        ...categories.map(({ label }) => t('Expenses: {category}', { category: t(label) })),
        t('Costs'), t('Profit'), t('Profit margin (%)'),
        t('Active students'), t('New students'), t('Continuing students'), t('Returning students'), t('Students who left'), t('Retention (%)'), t('Class switches'),
        t('Enrolments'), t('New enrolments'), t('Renewed enrolments'), t('Ended enrolments'), t('Renewal rate (%)'), t('Overdue invoices'),
    ];
    const lines = rows.map((r) => [
        r.month.slice(0, 7), r.inProgress ? t('In progress') : t('Full month'), r.tuition_billed, r.tuition_collected, percent(r.collectionRate),
        r.tuition_outstanding, r.tuition_waived, r.transfer_amount, r.cash_amount, r.bookings_revenue, r.revenue, r.payroll_cost, r.expenses_total,
        ...categories.map(({ key }) => amountOf(r.month, key)),
        r.costs_total, r.profit, percent(r.margin),
        r.students_active, r.students_new, r.students_continuing, r.students_returning, r.students_left, percent(r.retention), r.class_switches,
        r.enrolments_active, r.enrolments_new, r.enrolments_renewed, r.enrolments_ended, percent(r.renewalRate), r.invoices_overdue,
    ]);
    download(`finance-monthly-${rows[0].month.slice(0, 7)}_${rows.at(-1).month.slice(0, 7)}.csv`, head, lines);
}

export function downloadClassCsv(rows, month, t) {
    const head = [
        t('Class'), t('Instructor'), t('Students'), t('Tuition billed'), t('Tuition collected'), t('Outstanding'), t('Sessions'), t('Instructor pay'),
        t('Class costs'), t('Margin'), t('Margin (%)'),
    ];
    const lines = rows.map((r) => [
        r.class_name, r.instructor_name, r.students, r.billed, r.collected, r.outstanding, r.sessions, r.instructor_pay, r.direct_costs, r.margin, percent(classMarginPct(r)),
    ]);
    download(`finance-classes-${month.slice(0, 7)}.csv`, head, lines);
}
