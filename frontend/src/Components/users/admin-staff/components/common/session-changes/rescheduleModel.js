import { addDays, parseISO } from 'date-fns';
import { TIME_OPTIONS, formatTime, toIsoDate, toMinutes } from '@/lib/format';
import { dayAfter, meetsOn, projectedEnd, usualSlot } from '@/lib/lessons';

// Pure helpers for the Call off / move dialog: where the make-up could go and what happens to the shoot day.

export const CLOSE = toMinutes('22:00');
export const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export const onGrid = (time) => TIME_OPTIONS.includes(time);

// The make-up's first times: the session's own (moving Wed 18:00–19:30 keeps 18:00–19:30), else the class's
// usual slot; always on the 30-minute grid and before closing.
export function firstTimes(cls, session) {
    const usual = usualSlot(cls);
    const own = session?.start && onGrid(session.start) && session.end && onGrid(session.end) && session.end > session.start;
    if (own) return { start: session.start, end: session.end };
    const start = onGrid(usual.start) ? usual.start : '18:00';
    return { start, end: toClock(Math.min(CLOSE, toMinutes(start) + usual.minutes)) };
}

// Days from `from` (inclusive, up to 3 weeks) the class doesn't meet, runs and has no make-up yet: where a
// make-up may go. At most `count` of them.
export function freeDays(cls, from, takenDates, count = 7) {
    const days = [];
    for (let offset = 0; offset < 21 && days.length < count; offset += 1) {
        const day = toIsoDate(addDays(parseISO(from), offset));
        if (cls.ended_on && day > cls.ended_on) break;
        if ((!cls.starts_on || day >= cls.starts_on) && !meetsOn(cls, day) && !takenDates.has(day)) days.push(day);
    }
    return days;
}

// Do the free stretches of the room (get_available_slots rows of that room) hold start–end?
export const fitsIn = (free, start, end) => free.some((slot) => formatTime(slot.start_time) <= start && formatTime(slot.end_time) >= end);

// Where the make-up should start looking: the day after the session, never before today.
export const searchFrom = (date, today) => (dayAfter(date) > today ? dayAfter(date) : today);

// What a change does to the shoot day (the routine's last session, lesson_progress.ends_on), as notes
// [{ key, vars, date? }] (English keys; `date` is filled in as a day by the dialog):
//   routines        lesson_progress rows of the class      makeUps / cancelledDates  listClassSessionChanges()
//   date            the session called off (already cancelled in make-up mode)
//   newDate         the make-up's day, or null (only called off)
// The dialog projects the routine again with the change (lib/lessons mirrors lesson_progress); when that
// projection doesn't match the server's today, it falls back to plain words without dates.
export function shootDayNotes({ cls, routines = [], makeUps = [], cancelledDates = [], date, newDate }) {
    const extraDates = makeUps.map((row) => row.date);
    const notes = [];
    for (const routine of routines) {
        if (!['current', 'planned'].includes(routine.status) || !routine.ends_on) continue;
        const title = routine.title;
        const isShoot = routine.ends_on === date;
        const options = { extraDates, cancelledDates };
        const trusted = projectedEnd(cls, routine.starts_on, routine.session_count, options) === routine.ends_on;
        if (!trusted) {
            if (isShoot) notes.push({ key: newDate ? 'This is the shoot day of “{title}”. The make-up becomes the shoot day.' : 'This is the shoot day of “{title}”. The shoot day moves to the next session.', vars: { title } });
            continue;
        }
        const after = projectedEnd(cls, routine.starts_on, routine.session_count, {
            extraDates: newDate ? [...extraDates, newDate] : extraDates,
            cancelledDates: cancelledDates.includes(date) ? cancelledDates : [...cancelledDates, date],
        });
        if (after === routine.ends_on) continue;
        if (isShoot) {
            if (newDate && after === newDate) notes.push({ key: 'This is the shoot day of “{title}”. The make-up becomes the shoot day.', vars: { title } });
            else if (after) notes.push({ key: newDate ? 'This is the shoot day of “{title}”. The shoot day moves to {day}.' : 'This is the shoot day of “{title}”. The shoot day moves to the next session, {day}.', vars: { title }, date: after });
            else notes.push({ key: 'This is the shoot day of “{title}”. The class ends before another session, so check the routine.', vars: { title } });
        } else if (after && newDate && after === newDate) {
            notes.push({ key: 'The make-up becomes the shoot day of “{title}”.', vars: { title } });
        } else if (after) {
            notes.push({ key: 'The shoot day of “{title}” moves to {day}.', vars: { title }, date: after });
        }
    }
    return notes;
}
