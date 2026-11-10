import { addDays, parseISO } from 'date-fns';
import { classPhase } from '@/services/classes';
import { formatTime, isoWeekdayOf, toIsoDate } from '@/lib/format';
import { monthOf, nextMonth, prevMonth } from '@/lib/lessons';

// Pure helpers for the class hub (directory + one class's page). Labels are English i18n keys:
// components render t(key, vars).

export { monthOf, nextMonth, prevMonth };

// Where the hub lives (Body.jsx mounts it at classes/*).
export const HUB_BASE = '/admin/classes';

// '/admin/class-hub/7?tab=students'
export function classPath(id, params) {
    const query = params ? new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null)).toString() : '';
    return `${HUB_BASE}/${id}${query ? `?${query}` : ''}`;
}

// The class page's tabs, in order. `adminOnly` tabs are hidden from staff.
export const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'students', label: 'Students' },
    { key: 'sessions', label: 'Sessions & attendance' },
    { key: 'tuition', label: 'Tuition' },
    { key: 'routines', label: 'Routines' },
    { key: 'money', label: 'Money', adminOnly: true },
    { key: 'setup', label: 'Setup' },
];

// The directory's views.
export const VIEWS = ['today', 'month', 'upcoming', 'past', 'timetable'];

// ---- Dates ---------------------------------------------------------------------------

export const shiftDay = (isoDate, days) => toIsoDate(addDays(parseISO(isoDate), days));
export const lastDayOf = (month) => shiftDay(nextMonth(month), -1);

// Every 'yyyy-MM-dd' of a month.
export function datesOf(month) {
    const dates = [];
    for (let day = month, end = nextMonth(month); day < end; day = shiftDay(day, 1)) dates.push(day);
    return dates;
}

// ---- Weekly sessions ---------------------------------------------------------------------

export const bySlot = (a, b) => a.day_of_week - b.day_of_week || String(a.start_time).localeCompare(String(b.start_time));

// The weekly sessions: the live ones, or the snapshot kept when the class ended.
export const weeklySlots = (cls) => [...(cls.schedules?.length ? cls.schedules : cls.final_schedule ?? [])].sort(bySlot);

export const runsOn = (cls, isoDate) => (!cls.starts_on || cls.starts_on <= isoDate) && (!cls.ended_on || cls.ended_on >= isoDate);

// Start / end ('HH:mm') of one session: a make-up has its own times, a regular one follows the
// weekly slot of that weekday.
export function sessionTimes(cls, isoDate, row) {
    if (row?.start_time) return { start: formatTime(row.start_time), end: formatTime(row.end_time) };
    const weekday = isoWeekdayOf(isoDate);
    const slot = weeklySlots(cls).find((item) => item.day_of_week === weekday);
    return { start: formatTime(slot?.start_time), end: formatTime(slot?.end_time) };
}

// One class's sessions in a month: the days its timetable gives (inside its run) plus every
// recorded session (make-ups, or days from a timetable that has changed since). Oldest first:
// [{ date, start, end, row (instructor_attendance or null), extra }].
export function monthSessions(cls, month, rows = []) {
    const byDate = new Map(rows.map((row) => [row.date, row]));
    const days = new Map();
    const weekdays = new Set((cls.schedules ?? []).map((slot) => slot.day_of_week));
    if (weekdays.size) {
        for (const date of datesOf(month)) {
            if (runsOn(cls, date) && weekdays.has(isoWeekdayOf(date))) days.set(date, byDate.get(date) ?? null);
        }
    }
    for (const row of rows) if (!days.has(row.date)) days.set(row.date, row);
    return [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, row]) => ({ date, row, extra: Boolean(row?.is_extra), ...sessionTimes(cls, date, row) }));
}

// The next session from today on (today's counts until it ends): { date, start, end, row } or null.
export function nextSession(cls, today, now, rows = []) {
    const upcoming = rows
        .filter((row) => row.date >= today && row.status !== 'cancelled' && row.status !== 'completed')
        .map((row) => ({ date: row.date, row, ...sessionTimes(cls, row.date, row) }));
    const weekdays = new Set((cls.schedules ?? []).map((slot) => slot.day_of_week));
    const cancelled = new Set(rows.filter((row) => row.status === 'cancelled' || row.status === 'completed').map((row) => row.date));
    if (weekdays.size) {
        for (let i = 0, day = cls.starts_on && cls.starts_on > today ? cls.starts_on : today; i < 21; i += 1, day = shiftDay(day, 1)) {
            if (!runsOn(cls, day)) break;
            if (weekdays.has(isoWeekdayOf(day)) && !cancelled.has(day) && !upcoming.some((item) => item.date === day)) {
                upcoming.push({ date: day, row: null, ...sessionTimes(cls, day, null) });
                break;
            }
        }
    }
    return upcoming
        .filter((item) => item.date > today || !item.end || now < item.end)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0] ?? null;
}

// Where a session stands: { key, vars?, tone, kind } (key = English i18n text).
// tone: 'good' | 'live' | 'alert' | 'idle' | 'muted' (the shared phaseBadge colours).
export function sessionState({ row, date, start, end }, today, now) {
    const past = date < today;
    const isToday = date === today;
    switch (row?.status) {
        case 'completed':
            return { key: 'Done', tone: 'good', kind: 'done' };
        case 'cancelled':
            return { key: 'Cancelled', tone: 'muted', kind: 'cancelled' };
        case 'in_progress':
            return past || (isToday && end && now >= end)
                ? { key: 'Not checked out', tone: 'alert', kind: 'review' }
                : { key: 'Teaching now', tone: 'live', kind: 'live' };
        case 'pending':
        case 'waiting':
            if (past) return { key: 'Needs review', tone: 'alert', kind: 'review' };
            if (isToday && start && now >= start) return { key: 'Not checked in', tone: 'alert', kind: 'review' };
            if (isToday) return start ? { key: 'Starts at {start}', vars: { start }, tone: 'idle', kind: 'soon' } : { key: 'Today', tone: 'idle', kind: 'soon' };
            return { key: 'Planned', tone: 'idle', kind: 'planned' };
        default:
            if (past) return { key: 'No record', tone: 'muted', kind: 'missing' };
            if (isToday) return { key: 'No record yet', tone: 'idle', kind: 'missing' };
            return { key: 'Planned', tone: 'idle', kind: 'planned' };
    }
}

// ---- Phase ---------------------------------------------------------------------------------

// The class's phase as a badge: { phase, key, date?, tone }. Render t(key, { date: formatDate(date, 'dayMonth') }).
export function phaseBadge(cls, today) {
    const phase = classPhase(cls, today);
    switch (phase) {
        case 'upcoming':
            return { phase, key: 'Opens {date}', date: cls.starts_on, tone: 'live' };
        case 'ending':
            return cls.ended_on === today ? { phase, key: 'Last day today', tone: 'alert' } : { phase, key: 'Ends {date}', date: cls.ended_on, tone: 'alert' };
        case 'ended':
            return { phase, key: 'Ended {date}', date: cls.ended_on, tone: 'muted' };
        default:
            return { phase, key: 'Running', tone: 'good' };
    }
}

// ---- Routines --------------------------------------------------------------------------------

// The current routine (or the next planned one) from lesson_progress rows of one class.
export function routineNow(progress = []) {
    const current = progress.filter((item) => item.status === 'current').sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
    const planned = progress.filter((item) => item.status === 'planned').sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null;
    const done = progress.filter((item) => item.status === 'done').sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
    return { current, planned, done };
}

// The latest finished routine that is still missing its class video (within ~6 weeks of its end).
export function missingVideo(cls, progress, today) {
    const { done } = routineNow(progress);
    if (!done?.ends_on || shiftDay(done.ends_on, 45) < today) return null;
    const lesson = (cls.lessons ?? []).find((item) => item.id === done.lesson_id);
    return lesson && !lesson.video_url ? done : null;
}

// ---- Money and attendance ------------------------------------------------------------------

// Invoices that count for a month: billed (unpaid + paid + waived), settled (paid + waived), overdue.
export function tuitionOf(invoices, today) {
    const live = invoices.filter((invoice) => invoice.status !== 'void');
    const settled = live.filter((invoice) => invoice.status === 'paid' || invoice.status === 'waived').length;
    const overdue = live.filter((invoice) => invoice.status === 'unpaid' && invoice.due_date < today);
    const collected = invoices.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0);
    const billed = live.filter((invoice) => invoice.status !== 'waived').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    return { count: live.length, settled, overdue, collected, billed };
}

// Share of marked roll calls that were "attended" (null when nothing is marked yet).
export function attendanceRate(rows) {
    const attended = rows.filter((row) => row.status === 'attend').length;
    const marked = attended + rows.filter((row) => row.status === 'absent').length;
    return marked ? attended / marked : null;
}

export const percent = (rate) => (rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`);

// Flags a class shows on its card and page ({ key, vars?, tone: 'warn' | 'alert', icon key }).
export function classFlags({ cls, phase, progress, overdue, today }) {
    const flags = [];
    if (phase === 'ended') return flags;
    if (!(cls.schedules ?? []).length) flags.push({ id: 'sessions', key: 'No weekly sessions', tone: 'warn' });
    const routine = routineNow(progress);
    if (!routine.current && !routine.planned) flags.push({ id: 'routine', key: 'No routine', tone: 'warn' });
    else if (routine.current && !routine.planned && routine.current.session_count - routine.current.sessions_held <= 2) {
        flags.push({ id: 'ending', key: 'Routine ends soon', tone: 'warn' });
    }
    if (overdue > 0) flags.push({ id: 'unpaid', key: overdue === 1 ? '{count} overdue' : '{count} overdue', vars: { count: overdue }, tone: 'alert' });
    if (missingVideo(cls, progress, today)) flags.push({ id: 'video', key: 'Video missing', tone: 'warn' });
    return flags;
}

// ---- Search -----------------------------------------------------------------------------------

// Lower case without Vietnamese accents ("Nâng Cao" → "nang cao", "Đỗ" → "do").
export const fold = (text) =>
    String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();

export function matchesClass(cls, term) {
    if (!term) return true;
    const haystack = fold([cls.name, cls.instructor?.full_name, cls.instructor?.username, cls.room?.name, cls.lesson].join(' '));
    return fold(term)
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word));
}

export const personName = (person) => person?.full_name || person?.username || person?.email || '';
