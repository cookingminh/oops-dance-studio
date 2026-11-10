import { addDays, addMonths, addWeeks, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

// Pure helpers behind <CalendarView>. Dates travel as 'yyyy-MM-dd' strings and times as 'HH:mm',
// like everywhere else in the app; Date objects only exist inside these helpers.

export const CALENDAR_VIEWS = ['week', 'month'];
export const SLOT_MINUTES = 30;

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export const toIso = (date) => format(date, 'yyyy-MM-dd');

// Date | 'yyyy-MM-dd' → Date at local midnight.
export const asDate = (value) => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value) return parseISO(value.slice(0, 10));
    return new Date();
};

// 'HH:mm' (or 'HH:mm:ss') → minutes since midnight.
export const minutesOf = (time) => {
    const [hours, minutes] = String(time ?? '0:0').split(':').map(Number);
    return hours * 60 + (minutes || 0);
};

export const timeOf = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// The studio's date when the page doesn't pass `today` (the server's studio_today() is the truth).
export const studioTodayIso = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Monday → Sunday of the week holding `date`.
export function weekDays(date) {
    const monday = startOfWeek(asDate(date), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

// The month grid: always 6 weeks × 7 days, starting on the Monday on or before the 1st.
export function monthWeeks(date) {
    const first = startOfWeek(startOfMonth(asDate(date)), { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
}

// First and last day shown ('yyyy-MM-dd', both inclusive): load the data for this range.
export function calendarRange(view, date) {
    if (view === 'month') {
        const weeks = monthWeeks(date);
        return { from: toIso(weeks[0][0]), until: toIso(weeks[5][6]) };
    }
    const days = weekDays(date);
    return { from: toIso(days[0]), until: toIso(days[6]) };
}

// ‹ / › move a week or a month (the 1st, so a 31st never skips a short month).
export const shiftDate = (view, date, step) =>
    view === 'month' ? addMonths(startOfMonth(asDate(date)), step) : addWeeks(asDate(date), step);

export const sortItems = (a, b) =>
    a.date.localeCompare(b.date) || minutesOf(a.start) - minutesOf(b.start) || minutesOf(b.end) - minutesOf(a.end);

// Map of 'yyyy-MM-dd' → items of that day, sorted by time.
export function itemsByDate(items) {
    const days = new Map();
    for (const item of [...items].sort(sortItems)) {
        if (!days.has(item.date)) days.set(item.date, []);
        days.get(item.date).push(item);
    }
    return days;
}

// Side-by-side placement for one day: overlapping items share the width. Returns
// [{ item, column, columns }]; `columns` is the widest overlap of the item's cluster.
export function layoutDay(items) {
    const placed = [];
    let cluster = [];
    let clusterEnd = -1;
    const closeCluster = () => {
        const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));
        for (const entry of cluster) placed.push({ ...entry, columns });
        cluster = [];
    };
    for (const item of [...items].sort(sortItems)) {
        const start = minutesOf(item.start);
        const end = Math.max(minutesOf(item.end), start + 15);
        if (cluster.length && start >= clusterEnd) closeCluster();
        // First column whose last item has ended.
        const taken = new Set(cluster.filter((entry) => entry.end > start).map((entry) => entry.column));
        let column = 0;
        while (taken.has(column)) column += 1;
        cluster.push({ item, column, start, end });
        clusterEnd = Math.max(clusterEnd, end);
    }
    if (cluster.length) closeCluster();
    return placed;
}

// Tone of an item: 'solid' unless it says otherwise.
export const toneOf = (item) => item.tone ?? 'solid';
export const isBackground = (item) => toneOf(item) === 'background';

// Status words for screen readers and the agenda: the item's own label, else the translated status.
export const statusText = (item, t) => item.statusLabel ?? (item.status ? t(item.status) : '');

// "Tue 10 Nov 18:00–19:30 Hip-hop Foundation, Bin, done, Make-up" (an item's accessible name).
export function itemLabel(item, { t, formatDate }) {
    const when = `${formatDate(item.date, 'short')} ${item.start}–${item.end}`;
    return [`${when} ${item.title ?? ''}`.trim(), item.subtitle, statusText(item, t), item.badge].filter(Boolean).join(', ');
}
