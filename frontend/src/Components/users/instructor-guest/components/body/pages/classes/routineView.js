import { formatTime } from '@/lib/format';
import { nextSessionOf } from '../../profileHelpers';

// Make-up sessions in the class views (instructors only: students can't read session rows).

// A class's make-ups still to come (or running) as sessions { cls, date, start, end, isLive, isMakeUp }.
export function makeUpSessions(cls, today, now) {
    return (cls.makeUps ?? [])
        .filter((row) => row.status !== 'completed' && row.status !== 'cancelled')
        .map((row) => {
            const start = formatTime(row.start_time);
            const end = formatTime(row.end_time);
            return { cls, date: row.date, start, end, isMakeUp: true, isLive: row.date === today && now >= start && now < end };
        })
        .filter((session) => session.date > today || (session.date === today && now < session.end));
}

// The next session of a class, weekly or make-up, or null.
export function nextSessionWithMakeUps(cls, today, now) {
    const sessions = [nextSessionOf(cls, today, now), ...makeUpSessions(cls, today, now)].filter(Boolean);
    return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0] ?? null;
}

// The make-up on `date`, if any ({ start, end } 'HH:mm').
export function makeUpOn(cls, date) {
    const row = (cls.makeUps ?? []).find((item) => item.date === date && item.status !== 'cancelled');
    return row ? { start: formatTime(row.start_time), end: formatTime(row.end_time) } : null;
}
