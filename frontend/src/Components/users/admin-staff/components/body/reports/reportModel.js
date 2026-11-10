import { categoryOf } from '@/lib/expenseCategories';

// Pure helpers for the finance report: the month window, derived ratios, KPI deltas, the cost
// groups and the per-class sort. No React here (react-refresh: .jsx files only export components).

export const PERIODS = [6, 12];

// 'yyyy-MM-01' ± n months.
export function shiftMonth(month, n) {
    const [year, mon] = month.split('-').map(Number);
    const index = year * 12 + (mon - 1) + n;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

export const monthOfDay = (isoDate) => `${isoDate.slice(0, 7)}-01`;

// Day of the month and its length, for "day 9 of 30".
export function monthProgress(today) {
    const [year, mon, day] = today.split('-').map(Number);
    return { day, days: new Date(year, mon, 0).getDate() };
}

// A month counts once the studio had any tuition or room booking in it. Months before that
// only carry staff salaries (the payroll exists for every month), which would read as losses.
export const hasActivity = (row) =>
    Boolean(row) && (row.tuition_billed > 0 || row.tuition_collected > 0 || row.bookings_revenue > 0 || row.enrolments_active > 0);

const ratio = (part, whole) => (whole > 0 ? part / whole : null);

// Adds the ratios the report reads. `prev` is the month before (for the renewal rate).
export function enrich(row, prev, thisMonth) {
    const paid = row.transfer_amount + row.cash_amount;
    return {
        ...row,
        inProgress: row.month === thisMonth,
        margin: row.revenue > 0 ? row.profit / row.revenue : null,
        collectionRate: ratio(row.tuition_collected, row.tuition_billed),
        revenuePerStudent: ratio(row.revenue, row.students_active),
        // Of last month's students (people), the share still here this month. A class switch
        // keeps someone active, so it never lowers this.
        retention: prev?.students_active > 0 ? Math.min(1, row.students_continuing / prev.students_active) : null,
        // Of last month's class enrolments, the share that carried on into this one.
        renewalRate: prev?.enrolments_active > 0 ? Math.min(1, row.enrolments_renewed / prev.enrolments_active) : null,
        transferShare: ratio(row.transfer_amount, paid),
    };
}

// finance_monthly rows (oldest first, one month before the window up to next month) →
// { byMonth, recordsStart, next }. `next` is next month (its renewal may already be open).
export function indexMonths(rows, thisMonth) {
    const byMonth = new Map();
    rows.forEach((row, index) => byMonth.set(row.month, enrich(row, rows[index - 1], thisMonth)));
    const recordsStart = rows.find((row) => row.month <= thisMonth && hasActivity(row))?.month ?? null;
    return { byMonth, recordsStart, next: byMonth.get(shiftMonth(thisMonth, 1)) ?? null };
}

// The months a period shows, ending with this month, leading months without records dropped.
export function windowMonths(period, thisMonth, recordsStart) {
    if (!recordsStart) return [];
    return Array.from({ length: period }, (_, i) => shiftMonth(thisMonth, i - period + 1)).filter((month) => month >= recordsStart);
}

// The month the report opens on: the last full month (this month while nothing else exists).
export function defaultFocus(months, thisMonth) {
    const full = months.filter((month) => month < thisMonth);
    return full.at(-1) ?? months.at(-1) ?? null;
}

// The headline tiles. better: which direction is good news (costs and debts: down).
// flow: a running total, so a month still in progress can't be compared with a full one.
export const KPIS = [
    { key: 'revenue', label: 'Revenue', kind: 'money', better: 'up', flow: true },
    { key: 'costs_total', label: 'Costs', kind: 'money', better: 'down', flow: true },
    { key: 'profit', label: 'Profit', kind: 'money', better: 'up', flow: true },
    { key: 'margin', label: 'Profit margin', kind: 'pct', better: 'up', flow: true },
    { key: 'collectionRate', label: 'Collection rate', kind: 'pct', better: 'up', flow: true },
    { key: 'students_active', label: 'Active students', kind: 'count', better: 'up', flow: false },
    { key: 'revenuePerStudent', label: 'Revenue per student', kind: 'money', better: 'up', flow: true },
    { key: 'tuition_outstanding', label: 'Outstanding', kind: 'money', better: 'down', flow: true },
];

// Change from `prev` to `cur` for one KPI: { dir: 'up'|'down'|'flat', good: bool|null,
// mode: 'pct'|'pts'|'money'|'count', amount }. Money changes are relative while last month was
// positive; otherwise (a loss, or zero) the change is shown as an amount.
export function kpiDelta(kpi, cur, prev) {
    const a = cur?.[kpi.key];
    const b = prev?.[kpi.key];
    if (a === null || a === undefined || b === null || b === undefined) return null;
    let mode = kpi.kind === 'pct' ? 'pts' : kpi.kind;
    let amount = a - b;
    if (kpi.kind === 'money' && b > 0 && a >= 0) {
        mode = 'pct';
        amount = (a - b) / b;
    }
    const flatBelow = mode === 'pct' || mode === 'pts' ? 0.0005 : 0.5;
    const dir = Math.abs(amount) < flatBelow ? 'flat' : amount > 0 ? 'up' : 'down';
    return { dir, good: dir === 'flat' ? null : (dir === 'up') === (kpi.better === 'up'), mode, amount };
}

// Per-class rows with their margin share; sorted by `sort` = { key, dir }.
export const classMarginPct = (row) => (row.collected > 0 ? row.margin / row.collected : null);

export function sortClasses(rows, { key, dir }) {
    const value = (row) => (key === 'marginPct' ? classMarginPct(row) ?? -Infinity : row[key]);
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        if (key === 'class_name') return sign * String(a.class_name).localeCompare(String(b.class_name), 'vi');
        return sign * (value(a) - value(b)) || String(a.class_name).localeCompare(String(b.class_name), 'vi');
    });
}

export function classTotals(rows) {
    const sum = (key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    return Object.fromEntries(['students', 'billed', 'collected', 'outstanding', 'sessions', 'instructor_pay', 'direct_costs', 'margin'].map((key) => [key, sum(key)]));
}

// ---- Costs ---------------------------------------------------------------------------

// finance_expenses rows → Map month → [{ category, amount, items }], biggest first.
export function indexExpenses(rows = []) {
    const byMonth = new Map();
    for (const row of rows) {
        if (!byMonth.has(row.month)) byMonth.set(row.month, []);
        byMonth.get(row.month).push(row);
    }
    for (const list of byMonth.values()) list.sort((a, b) => b.amount - a.amount);
    return byMonth;
}

export const OTHER_GROUP = '__other';
const NAMED_MAX = 5;

// Which expense categories get a colour of their own: the biggest over every loaded month (so
// colours don't move when the period or the month changes), at most five. The rest, and the
// category literally called "other", fold into one Other group.
// → { named: [category keys, biggest first], folded: Set of keys in Other }
export function costGroups(expenseRows = []) {
    const totals = new Map();
    for (const row of expenseRows) totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
    const ranked = [...totals.entries()].filter(([key, amount]) => key !== 'other' && amount > 0).sort((a, b) => b[1] - a[1]).map(([key]) => key);
    const named = ranked.slice(0, NAMED_MAX);
    const folded = new Set([...ranked.slice(NAMED_MAX), ...(totals.has('other') ? ['other'] : [])]);
    return { named, folded };
}

export const groupOf = (category, groups) => (groups.named.includes(category) ? category : OTHER_GROUP);

// One month's expenses summed per group: { [group]: amount }.
export function groupAmounts(list = [], groups) {
    const amounts = {};
    for (const row of list) {
        const group = groupOf(row.category, groups);
        amounts[group] = (amounts[group] ?? 0) + row.amount;
    }
    return amounts;
}

// The English label (for t()) of a category or of the Other group.
export const groupLabel = (group) => (group === OTHER_GROUP ? 'Other' : categoryOf(group).label);

// Payroll split for the ledger, from payroll_month rows. Null when the parts don't add up to
// the month's payroll cost (then the ledger shows payroll as one line).
export function payrollParts(people, payrollCost) {
    if (!people?.length) return null;
    const sum = (pick) => people.reduce((total, row) => total + pick(row), 0);
    const parts = {
        sessions: sum((row) => Number(row.session_pay ?? 0)),
        salaries: sum((row) => Number(row.base_salary ?? 0)),
        adjustments: sum((row) => Number(row.bonuses ?? 0) + Number(row.deductions ?? 0)),
    };
    return Math.abs(parts.sessions + parts.salaries + parts.adjustments - payrollCost) < 1 ? parts : null;
}
