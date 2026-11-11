import { formatTime } from '@/lib/format';

// Session changes in the class views (both roles, from my_session_changes: classData.js puts each class's
// make-ups in `cls.makeUps` and the sessions called off in `cls.calledOff`). The next session, make-ups
// included, is profileHelpers.nextSessionOf.

// The make-up on `date`, if any: { start, end ('HH:mm'), makesUp (the day it replaces, or null) }.
export function makeUpOn(cls, date) {
    const row = (cls.makeUps ?? []).find((item) => item.date === date);
    return row ? { start: formatTime(row.start_time), end: formatTime(row.end_time), makesUp: row.makes_up ?? null } : null;
}

// The session called off on `date` (the change, with its reason), if any.
export const calledOffOn = (cls, date) => (cls.calledOff ?? []).find((item) => item.date === date) ?? null;

// The class's changes from `today` to `until` (inclusive), soonest first.
export const changesBetween = (cls, today, until) => (cls.changes ?? []).filter((row) => row.date >= today && row.date <= until);
