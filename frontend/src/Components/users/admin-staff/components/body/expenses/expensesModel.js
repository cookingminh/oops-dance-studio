import { EXPENSE_CATEGORIES, categoryOf } from '@/lib/expenseCategories';
import { monthOf, nextMonth, prevMonth } from '@/lib/lessons';

// Pure helpers for the expenses page: month sums, the amount field, search and recurring status.

export { monthOf, nextMonth, prevMonth };

export const capitalizeFirst = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const amountOf = (row) => Number(row.amount) || 0;
export const sumAmount = (rows = []) => rows.reduce((sum, row) => sum + amountOf(row), 0);

// The month's money: total, class-tied vs shared, per category (with last month beside it) and
// per class. `cutoff` ('yyyy-MM-dd' in last month) also sums last month up to the same day, so a
// month that is still running is compared with last month at the same point.
export function summarize(rows = [], previous = [], cutoff = null) {
    const tied = rows.filter((row) => row.class_id);
    const categories = new Map(EXPENSE_CATEGORIES.map((category) => [category.key, { key: category.key, amount: 0, items: 0, previous: 0 }]));
    for (const row of rows) {
        const entry = categories.get(categoryOf(row.category).key);
        entry.amount += amountOf(row);
        entry.items += 1;
    }
    for (const row of previous) categories.get(categoryOf(row.category).key).previous += amountOf(row);

    const classes = new Map();
    for (const row of tied) {
        const entry = classes.get(row.class_id) ?? { id: row.class_id, name: row.class?.name ?? '—', amount: 0, items: 0 };
        entry.amount += amountOf(row);
        entry.items += 1;
        classes.set(row.class_id, entry);
    }

    return {
        total: sumAmount(rows),
        count: rows.length,
        tied: sumAmount(tied),
        shared: sumAmount(rows) - sumAmount(tied),
        previousTotal: sumAmount(previous),
        previousToDate: cutoff ? sumAmount(previous.filter((row) => row.spent_on <= cutoff)) : null,
        categories: [...categories.values()].filter((entry) => entry.amount > 0 || entry.previous > 0).sort((a, b) => b.amount - a.amount || b.previous - a.previous),
        classes: [...classes.values()].sort((a, b) => b.amount - a.amount),
    };
}

// The same day of the month before ('2026-11-09' → '2026-10-09'; 31 March → 28/29 Feb).
export function sameDayLastMonth(isoDate) {
    const last = prevMonth(monthOf(isoDate));
    const [year, month] = last.split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    return `${last.slice(0, 8)}${String(Math.min(Number(isoDate.slice(8, 10)), days)).padStart(2, '0')}`;
}

// ---- Amount field ----------------------------------------------------------------------

export const QUICK_AMOUNTS = [100000, 200000, 500000, 1000000, 2000000, 5000000];
export const MAX_AMOUNT = 999999999999; // numeric(12, 0)

// What the amount field shows: the digits grouped the Vietnamese way (1.200.000).
export const groupDigits = (value) => (value ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

// Typing turns into a whole number of đồng. A trailing "k" multiplies by a thousand and "m" (or
// "tr", triệu) by a million, so "500k" and "1.5m" both work.
export function parseAmountInput(text) {
    const raw = String(text ?? '').trim().toLowerCase();
    const shorthand = raw.match(/^([\d.,\s]*\d)\s*(k|m|tr)$/);
    if (shorthand) {
        const number = Number(shorthand[1].replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(number)) return null;
        return Math.min(MAX_AMOUNT, Math.round(number * (shorthand[2] === 'k' ? 1000 : 1000000)));
    }
    const digits = raw.replace(/\D/g, '');
    return digits ? Math.min(MAX_AMOUNT, Number(digits)) : null;
}

// Short money for chips and bar labels: 500k, 1.5M (English) / 1,5 Tr (Vietnamese).
export function compactVnd(value, intl = 'en-GB') {
    const amount = Number(value) || 0;
    if (Math.abs(amount) < 1000000) return `${Math.round(amount / 1000)}k`;
    return new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
}

// ---- Search ------------------------------------------------------------------------------

// Lower case without Vietnamese accents, so "dien" finds "Tiền điện".
export const fold = (text) =>
    String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();

export const expenseSearchText = (expense, t) => {
    const category = categoryOf(expense.category);
    return fold([expense.description, expense.vendor, expense.class?.name, category.label, t(category.label), expense.author?.full_name, expense.author?.username, expense.amount].join(' '));
};

// Class filter: 'all', 'shared' (no class) or a class id.
export function matchesFilters(expense, { category, classKey }) {
    if (category !== 'all' && categoryOf(expense.category).key !== category) return false;
    if (classKey === 'shared') return !expense.class_id;
    if (classKey !== 'all') return String(expense.class_id) === String(classKey);
    return true;
}

// ---- Receipts ----------------------------------------------------------------------------

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_ACCEPT = 'image/*,.heic,.heif,application/pdf,.pdf';
export const isPdfPath = (path) => /\.pdf$/i.test(path ?? '');
export const isPdfFile = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '');
// Browsers can't draw HEIC, so those get a file chip instead of a preview (the upload converts them).
export const canPreview = (file) => Boolean(file) && /^image\/(jpeg|png|webp|gif)$/i.test(file.type);

// ---- Recurring costs ---------------------------------------------------------------------

// Where a recurring cost stands this month:
//   paused · ended (its last month is behind us) · upcoming (starts later) · added (this month's
//   row exists) · due (its day hasn't come yet; the nightly check adds it then).
export function recurringStatus(item, { thisMonth, today, addedIds }) {
    if (!thisMonth) return { key: 'due' };
    if (item.ends_on && item.ends_on < thisMonth) return { key: 'ended', month: item.ends_on };
    if (!item.active) return { key: 'paused' };
    if (item.starts_on > thisMonth) return { key: 'upcoming', month: item.starts_on };
    if (addedIds.has(item.id)) return { key: 'added', lastMonth: item.ends_on === thisMonth };
    const day = `${thisMonth.slice(0, 8)}${String(item.day_of_month).padStart(2, '0')}`;
    return { key: today && day <= today ? 'late' : 'due', date: day, lastMonth: item.ends_on === thisMonth };
}

// Months for the recurring dialog: a year back (or the cost's own start) to a year ahead.
export function monthRange(from, to) {
    const months = [];
    for (let month = from; month <= to && months.length < 60; month = nextMonth(month)) months.push(month);
    return months;
}

export function shiftMonth(month, by) {
    let result = month;
    for (let i = 0; i < Math.abs(by); i += 1) result = by > 0 ? nextMonth(result) : prevMonth(result);
    return result;
}
