import { addDays, format, parseISO, subDays } from 'date-fns';
import { formatTime, isoWeekdayOf, toIsoDate, toMinutes } from './format';

// ---- Months ----------------------------------------------------------------------------
// Tuition, payroll, expenses and the class-video showcase still work month by month.

// 'yyyy-MM-dd' → 'yyyy-MM-01'
export const monthOf = (isoDate) => `${isoDate.slice(0, 7)}-01`;

// '2026-11-01' → 'November' (or 'November 2026' with { withYear: true })
export const monthLabel = (month, { withYear = false } = {}) => format(parseISO(month), withYear ? 'MMMM yyyy' : 'MMMM');

// The month after 'yyyy-MM-01'.
export function nextMonth(month) {
    const [year, mon] = month.split('-').map(Number);
    return mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
}

// The month before 'yyyy-MM-01'.
export function prevMonth(month) {
    const [year, mon] = month.split('-').map(Number);
    return mon === 1 ? `${year - 1}-12-01` : `${year}-${String(mon - 1).padStart(2, '0')}-01`;
}

export const dayAfter = (iso) => toIsoDate(addDays(parseISO(iso), 1));
export const dayBefore = (iso) => toIsoDate(subDays(parseISO(iso), 1));

// ---- Routines --------------------------------------------------------------------------
// A class's lesson is a *routine*: one piece learned over `session_count` sessions from `starts_on`
// (supabase/migrations/20261115000100_routines.sql). The helpers below work on the rows of
// listLessonProgress(): { lesson_id, class_id, title, starts_on, session_count, sessions_held,
// sessions_cancelled, next_session, ends_on, status }. `ends_on` is the projected last session, the
// shoot day (later when sessions are cancelled, earlier with a make-up); `status` is 'planned' |
// 'current' | 'done' | 'stopped' (the class ended first).

// Once this few sessions are left, the next routine should be picked.
export const PICK_NEXT_AT = 2;

const byStart = (a, b) => a.starts_on.localeCompare(b.starts_on) || (a.lesson_id ?? 0) - (b.lesson_id ?? 0);
const isFinished = (routine) => routine.status === 'done' || routine.status === 'stopped';

export const remainingSessions = (routine) => Math.max(0, routine.session_count - routine.sessions_held);

// Progress rows → Map(class id → its rows).
export function routinesByClass(rows = []) {
    const map = new Map();
    for (const row of rows) map.set(row.class_id, [...(map.get(row.class_id) ?? []), row]);
    return map;
}

// Where one class stands with its routines (pass that class's rows):
//   routines   all of them, oldest first
//   current    the routine being learned now (the latest started one), or null
//   upcoming   planned routines, soonest first; `next` is the first of them
//   history    finished (or stopped) routines, newest first; `last` is the first of them
//   remaining  sessions left in `current` (null without one)
//   needsNext  nothing is planned and there is no routine now, or PICK_NEXT_AT sessions or fewer are left
export function routineState(rows = []) {
    const routines = [...rows].sort(byStart);
    const current = routines.filter((routine) => routine.status === 'current').at(-1) ?? null;
    const upcoming = routines.filter((routine) => routine.status === 'planned');
    const history = routines.filter(isFinished).reverse();
    const next = upcoming[0] ?? null;
    const remaining = current ? remainingSessions(current) : null;
    return {
        routines,
        current,
        upcoming,
        next,
        history,
        last: history[0] ?? null,
        remaining,
        needsNext: !next && (!current || remaining <= PICK_NEXT_AT),
    };
}

// ---- Session dates (mirrors lesson_progress) -------------------------------------------

const HORIZON_DAYS = 400; // same horizon as lesson_progress()

// Does the class meet on this date by its weekly timetable (and is it running then)?
export function meetsOn(cls, isoDate) {
    if (cls.starts_on && isoDate < cls.starts_on) return false;
    if (cls.ended_on && isoDate > cls.ended_on) return false;
    const weekday = isoWeekdayOf(isoDate);
    return (cls.schedules ?? []).some((slot) => slot.day_of_week === weekday);
}

// Session days of `cls` from `from` (inclusive): its weekly days plus `extraDates` (make-ups), minus
// `cancelledDates`, up to `count` of them, `until` (inclusive) or the class's last day.
export function sessionDates(cls, from, { count = Infinity, until, extraDates = [], cancelledDates = [] } = {}) {
    const extra = new Set(extraDates);
    const cancelled = new Set(cancelledDates);
    const dates = [];
    let day = parseISO(cls.starts_on && cls.starts_on > from ? cls.starts_on : from);
    for (let i = 0; i <= HORIZON_DAYS && dates.length < count; i += 1, day = addDays(day, 1)) {
        const iso = toIsoDate(day);
        if ((until && iso > until) || (cls.ended_on && iso > cls.ended_on)) break;
        if (!cancelled.has(iso) && (extra.has(iso) || meetsOn(cls, iso))) dates.push(iso);
    }
    return dates;
}

// The first session on or after `isoDate`, or null.
export const nextSessionFrom = (cls, isoDate, options) => sessionDates(cls, isoDate, { ...options, count: 1 })[0] ?? null;

// Last session of a routine of `count` sessions from `startsOn`, or null when the class stops first.
export function projectedEnd(cls, startsOn, count, options) {
    const dates = sessionDates(cls, startsOn, { ...options, count });
    return count > 0 && dates.length === count ? dates.at(-1) : null;
}

// Where the next routine should start: the session after the latest routine's last one (or the
// class's next session when nothing is running).
export function suggestedStart(cls, rows, today, options) {
    const latest = [...rows].sort(byStart).at(-1);
    const from = latest?.ends_on && latest.ends_on >= today ? dayAfter(latest.ends_on) : today;
    return nextSessionFrom(cls, from, options) ?? from;
}

// One routine at a time (the server checks it too, migration 20261117000100): a routine starts after the
// last session of the one before it and ends before the next one starts. For a new routine (no `id`) the
// one before is the latest routine of the class — the next routine comes after everything planned.
//   before / after   the neighbouring routines (null when none)
//   earliest         the first day it may start ('yyyy-MM-dd'), or null
export function routineNeighbours(rows, { id, startsOn } = {}) {
    const others = rows.filter((routine) => routine.lesson_id !== id).sort(byStart);
    const before = id ? others.filter((routine) => routine.starts_on < startsOn).at(-1) ?? null : others.at(-1) ?? null;
    const after = id ? others.find((routine) => routine.starts_on > startsOn) ?? null : null;
    return { before, after, earliest: before?.ends_on ? dayAfter(before.ends_on) : null };
}

// Between routines: the class's next session when it comes before the next routine starts (those
// sessions have no routine), otherwise null.
export function sessionWithoutRoutine(cls, state, today, options) {
    if (state.current || !state.next) return null;
    const first = nextSessionFrom(cls, today, options);
    return first && first < state.next.starts_on ? first : null;
}

// What's wrong between consecutive routines, for the ones that still matter (finished pairs are history):
//   { kind: 'overlap', first, second }            `second` starts before `first`'s last session
//   { kind: 'gap', first, second, dates }         class sessions (today or later) with no routine
//   { kind: 'cutShort', routine }                 the class ends before the routine's last session
export function routineIssues(cls, rows, today, options) {
    const routines = [...rows].sort(byStart);
    const issues = [];
    for (const routine of routines) {
        if (!isFinished(routine) && !routine.ends_on && cls.ended_on) issues.push({ kind: 'cutShort', routine });
    }
    for (let i = 1; i < routines.length; i += 1) {
        const first = routines[i - 1];
        const second = routines[i];
        if (isFinished(second)) continue;
        // A finished routine's sessions are all in the past, so only an unfinished one can overlap.
        if (!isFinished(first) && (!first.ends_on || first.ends_on >= second.starts_on)) {
            issues.push({ kind: 'overlap', first, second });
            continue;
        }
        if (!first.ends_on) continue;
        const from = first.ends_on >= today ? dayAfter(first.ends_on) : today;
        if (from >= second.starts_on) continue;
        const dates = sessionDates(cls, from, { ...options, until: dayBefore(second.starts_on) });
        if (dates.length) issues.push({ kind: 'gap', first, second, dates });
    }
    return issues;
}

// ---- Sessions (instructor_attendance rows) -----------------------------------------------
// Make-up sessions (is_extra) carry their own start_time / end_time; regular sessions take the
// class's weekly slot for that day.

export const isMakeUp = (record) => Boolean(record?.is_extra);

// { start, end } ('HH:mm') of a session row ({ date, start_time?, end_time?, class: { schedules } }).
export function sessionTimesOf(record) {
    if (record?.start_time) return { start: formatTime(record.start_time), end: formatTime(record.end_time) };
    const weekday = record?.date ? isoWeekdayOf(record.date) : null;
    const slot = record?.class?.schedules?.find((schedule) => schedule.day_of_week === weekday);
    return { start: formatTime(slot?.start_time), end: formatTime(slot?.end_time) };
}

// The class's usual session: the most common weekly slot → { start: 'HH:mm', minutes }.
export function usualSlot(cls) {
    const counts = new Map();
    for (const slot of cls?.schedules ?? []) {
        const start = formatTime(slot.start_time);
        const minutes = toMinutes(formatTime(slot.end_time)) - toMinutes(start);
        const key = `${start}/${minutes}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!best) return { start: '18:00', minutes: 90 };
    const [start, minutes] = best.split('/');
    return { start, minutes: Number(minutes) };
}

// 'Super Shy — NewJeans' → { song: 'Super Shy', artist: 'NewJeans' }
export function splitSong(title = '') {
    const [song, ...rest] = (title ?? '').split(/\s+[—–-]\s+/);
    return { song: song?.trim() ?? '', artist: rest.join(' — ').trim() };
}
