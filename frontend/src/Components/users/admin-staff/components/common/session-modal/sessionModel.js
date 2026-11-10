import { isoWeekdayOf } from '@/lib/format';
import { classPhase } from '@/services/classes';
import { classHue } from '@/Components/users/instructor-guest/components/body/profileHelpers';
import { fold, personName, runsOn, sessionState, sessionTimes, shiftDay } from '../../body/class-hub/hubModel';

// Pure helpers for class sessions (instructor_attendance rows plus the days a class's timetable
// gives): the session modal, the attendance page and the class page's calendar share them.
// A session: { key, cls, date, start, end, row (instructor_attendance or null), extra }.

export { personName, sessionState, shiftDay };

// Statuses a session can still leave (check-in, check-out, approve, cancel).
export const OPEN_STATUSES = ['pending', 'waiting', 'in_progress'];

export const sessionKey = (classId, date) => `${classId}_${date}`;

// Every session of one class from `from` to `until` (inclusive): the days its timetable gives while
// it runs, plus every recorded session (make-ups, days of an older timetable). Oldest first.
export function rangeSessions(cls, from, until, rows = []) {
    const byDate = new Map(rows.map((row) => [row.date, row]));
    const days = new Map();
    const weekdays = new Set((cls.schedules ?? []).map((slot) => slot.day_of_week));
    if (weekdays.size) {
        for (let day = from; day <= until; day = shiftDay(day, 1)) {
            if (runsOn(cls, day) && weekdays.has(isoWeekdayOf(day))) days.set(day, byDate.get(day) ?? null);
        }
    }
    for (const row of rows) if (row.date >= from && row.date <= until && !days.has(row.date)) days.set(row.date, row);
    return [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, row]) => ({ key: sessionKey(cls.id, date), cls, date, row, extra: Boolean(row?.is_extra), ...sessionTimes(cls, date, row) }));
}

// Sessions of many classes; `rows` are instructor_attendance rows of any of them.
export function sessionsOfClasses(classes, from, until, rows = []) {
    const byClass = new Map();
    for (const row of rows) {
        if (!byClass.has(row.class_id)) byClass.set(row.class_id, []);
        byClass.get(row.class_id).push(row);
    }
    return classes.flatMap((cls) => rangeSessions(cls, from, until, byClass.get(cls.id) ?? []));
}

// Who teaches a session: its own instructor (a substitute) or the class's.
export const teacherOf = (session) => session.row?.instructor ?? session.cls.instructor ?? null;
export const isSubstitute = (session) => Boolean(session.row && session.cls.instructor_id && session.row.instructor_id !== session.cls.instructor_id);

// A class that has ended is history: its sessions are read-only.
export const isReadOnly = (cls, today) => Boolean(cls && today && classPhase(cls, today) === 'ended');

// What staff may do with a session (the rules the attendance page and the class page always had):
//   approve     mark completed: an open session of today or earlier (also a cancelled one that did happen)
//   cancel      an open session (it then doesn't count for the routine)
//   substitute  before the instructor has checked in
//   reopen      a cancelled weekly session goes back to planned (a cancelled make-up is added again
//               instead, so its room is checked)
export function sessionRules(session, today, readOnly) {
    const row = session.row;
    if (!row || readOnly) return { approve: false, cancel: false, substitute: false, reopen: false, note: false };
    const open = OPEN_STATUSES.includes(row.status);
    const cancelled = row.status === 'cancelled';
    return {
        approve: (open || cancelled) && session.date <= today,
        cancel: open,
        substitute: row.status === 'pending' || row.status === 'waiting',
        reopen: cancelled && !row.is_extra,
        note: true,
    };
}

// ---- Calendar items ----------------------------------------------------------------------------

// Each class keeps its own hue (the same as on the instructor and student pages).
export const classColor = (classId) => `hsl(${classHue(classId)}, 62%, 46%)`;

// Status colours for one class's calendar (all its sessions share the class colour otherwise).
const STATE_COLORS = {
    done: 'hsl(152, 60%, 36%)',
    review: 'hsl(0, 66%, 43%)',
    live: 'hsl(217, 75%, 50%)',
    soon: 'hsl(217, 60%, 56%)',
    planned: 'hsl(240, 4%, 56%)',
    missing: 'hsl(240, 4%, 66%)',
    cancelled: 'hsl(240, 4%, 66%)',
};

// Calendar statuses (CalendarView `status`, also the filter keys): one word per kind of state.
const STATUS_OF_KIND = { done: 'done', cancelled: 'cancelled', review: 'review', live: 'live', soon: 'pending', planned: 'pending', missing: 'missing' };

// Roll call of a session: { marked, total } from roll-call rows ({ status }).
export function rollOf(rows = []) {
    return { marked: rows.filter((row) => row.status !== 'pending').length, total: rows.length };
}

// One CalendarView item. `byState` (one class's calendar): coloured by state, with the state as
// title and who teaches below; otherwise the class colour, the class name as title and the state
// as status text. `t` translates.
export function calendarItem(session, { today, now, roll, t, byState = false }) {
    const state = sessionState(session, today, now);
    const status = STATUS_OF_KIND[state.kind] ?? 'pending';
    const teacher = personName(teacherOf(session)) || t('No instructor');
    const substitute = isSubstitute(session);
    let tone = 'solid';
    if (state.kind === 'cancelled' || state.kind === 'missing') tone = 'muted';
    else if (state.kind === 'planned' || state.kind === 'soon') tone = 'dashed';
    const { marked, total } = rollOf(roll);
    let badge = total ? `${marked}/${total}` : undefined;
    if (session.extra) badge = t('Make-up');
    // The class page already says it in the title.
    if (state.kind === 'review' && !byState) badge = t('Needs review');
    const who = substitute ? `${teacher} · ${t('Substitute')}` : teacher;
    return {
        id: session.key,
        date: session.date,
        start: session.start || '08:00',
        end: session.end || session.start || '09:00',
        title: byState ? t(state.key, state.vars) : session.cls.name,
        subtitle: byState ? who : [who, session.cls.room?.name].filter(Boolean).join(' · '),
        color: byState ? STATE_COLORS[state.kind] : classColor(session.cls.id),
        status,
        statusLabel: byState ? '' : t(state.key, state.vars),
        tone,
        badge,
        data: session,
    };
}

// ---- Filters (attendance page) ------------------------------------------------------------------

// Filter keys for the status picker, in order; labels are English keys.
export const STATUS_FILTERS = [
    { key: 'review', label: 'Needs review', color: 'hsl(0, 66%, 43%)' },
    { key: 'pending', label: 'Planned', color: 'hsl(217, 60%, 56%)' },
    { key: 'live', label: 'Teaching now', color: 'hsl(217, 75%, 50%)' },
    { key: 'done', label: 'Done', color: 'hsl(152, 60%, 36%)' },
    { key: 'cancelled', label: 'Cancelled', color: 'hsl(240, 4%, 66%)' },
    { key: 'missing', label: 'No record', color: 'hsl(240, 4%, 76%)' },
    { key: 'makeup', label: 'Make-up', color: 'hsl(30, 85%, 45%)' },
];

export const statusKeyOf = (session, today, now) => STATUS_OF_KIND[sessionState(session, today, now).kind] ?? 'pending';

export const matchesStatus = (session, filter, today, now) =>
    filter === 'all' || (filter === 'makeup' ? session.extra : statusKeyOf(session, today, now) === filter);

// Every word of `term` appears in the session's class, instructor, room, note or date.
export function matchesSearch(session, term) {
    if (!term.trim()) return true;
    const teacher = teacherOf(session);
    const haystack = fold([session.cls.name, personName(teacher), teacher?.email, session.cls.room?.name, session.row?.details, session.date].join(' '));
    return fold(term)
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word));
}

// The pickers: every class and everyone who teaches (the classes' instructors and any substitute
// in `sessions`), so a choice stays listed while paging to weeks without it.
export function filterOptions(sessions, allClasses = []) {
    const people = new Map();
    const classes = new Map();
    for (const cls of allClasses) {
        classes.set(cls.id, cls.name);
        if (cls.instructor?.id) people.set(cls.instructor.id, personName(cls.instructor));
    }
    for (const session of sessions) {
        const teacher = teacherOf(session);
        if (teacher?.id) people.set(teacher.id, personName(teacher));
        classes.set(session.cls.id, session.cls.name);
    }
    const sorted = (map) => [...map].map(([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name));
    return { instructors: sorted(people), classes: sorted(classes) };
}
