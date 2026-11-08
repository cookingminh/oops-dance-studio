import { format, parseISO } from 'date-fns';

// Monthly lessons: helpers over a class's `lessons` ([{ id, month: 'yyyy-MM-01', title }]).

// 'yyyy-MM-dd' → 'yyyy-MM-01'
export const monthOf = (isoDate) => `${isoDate.slice(0, 7)}-01`;

// '2026-11-01' → 'November' (or 'November 2026' with { withYear: true })
export const monthLabel = (month, { withYear = false } = {}) => format(parseISO(month), withYear ? 'MMMM yyyy' : 'MMMM');

// The month after 'yyyy-MM-01'.
export function nextMonth(month) {
    const [year, mon] = month.split('-').map(Number);
    return mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
}

// { current, latest, needsUpdate, history } for the studio's current month.
// `current` is this month's lesson; when it's missing the class keeps showing `latest`.
export function lessonState(lessons = [], today) {
    const history = [...lessons].sort((a, b) => b.month.localeCompare(a.month));
    const thisMonth = today ? monthOf(today) : null;
    const current = history.find((lesson) => lesson.month === thisMonth) ?? null;
    const latest = history.find((lesson) => !thisMonth || lesson.month <= thisMonth) ?? history[0] ?? null;
    return { current, latest, needsUpdate: Boolean(thisMonth) && !current, history, thisMonth };
}
