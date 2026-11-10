import { useEffect, useState } from 'react';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { formatTime, isoWeekdayOf, toIsoDate, toMinutes } from '@/lib/format';

// Pure helpers (and two clock hooks) shared by the /profile pages.

// ---- Clock -------------------------------------------------------------------------

const STUDIO_CLOCK = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

// Seconds since midnight in the studio's timezone.
export function studioSecondsNow() {
    const [h, m, s] = STUDIO_CLOCK.format(new Date()).split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

const toClock = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;

// Studio time that refreshes every `everyMs`: { seconds, now: 'HH:mm' }. Pages use the
// one-minute default; only the countdown ticks every second (so only it re-renders).
export function useStudioNow(everyMs = 60_000) {
    const [seconds, setSeconds] = useState(studioSecondsNow);
    useEffect(() => {
        const timer = setInterval(() => setSeconds(studioSecondsNow()), everyMs);
        return () => clearInterval(timer);
    }, [everyMs]);
    return { seconds, now: toClock(seconds) };
}

// ---- Sessions ----------------------------------------------------------------------

// { start, end } ('HH:mm') of `cls` on the weekday of `isoDate`.
export function sessionTimes(cls, isoDate) {
    const weekday = isoWeekdayOf(isoDate);
    const slot = cls?.schedules?.find((schedule) => schedule.day_of_week === weekday);
    return { start: formatTime(slot?.start_time), end: formatTime(slot?.end_time) };
}

// Sessions of `classes` (each with `schedules`) in the `days` days from `today`, soonest first.
// Today's sessions that already ended are skipped (also an instructor's session today that is
// already completed or cancelled, from `cls.todaySession`); `isLive` marks one in progress.
export function upcomingSessions(classes, today, now, days = 7) {
    const sessions = [];
    for (let offset = 0; offset < days; offset += 1) {
        const date = toIsoDate(addDays(parseISO(today), offset));
        const weekday = isoWeekdayOf(date);
        for (const cls of classes) {
            const settledToday = ['completed', 'cancelled'].includes(cls.todaySession?.status);
            for (const schedule of cls.schedules ?? []) {
                if (schedule.day_of_week !== weekday) continue;
                const start = formatTime(schedule.start_time);
                const end = formatTime(schedule.end_time);
                if (offset === 0 && (now >= end || settledToday)) continue;
                sessions.push({ cls, date, start, end, isLive: offset === 0 && now >= start && now < end });
            }
        }
    }
    return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

// The next (or current) session of one class within a week and a day, or null.
export const nextSessionOf = (cls, today, now) => upcomingSessions([cls], today, now, 8)[0] ?? null;

// Seconds from studio `today` + `nowSeconds` until `session` starts (negative once it started).
export function secondsUntil(session, today, nowSeconds) {
    const days = differenceInCalendarDays(parseISO(session.date), parseISO(today));
    return days * 86_400 + toMinutes(session.start) * 60 - nowSeconds;
}

export function splitDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return { days: Math.floor(s / 86_400), hours: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

// Short "in …" text for a session (English keys, translated with `t`).
export function startsInText(session, today, nowSeconds, { t, tn }) {
    const left = secondsUntil(session, today, nowSeconds);
    if (session.isLive || left <= 0) return t('Happening now');
    const { days, hours, minutes } = splitDuration(left);
    if (days >= 2) return tn(days, 'in {count} day', 'in {count} days');
    if (days === 1) return t('in 1 day {hours} h', { hours });
    if (hours > 0) return t('in {hours} h {minutes} min', { hours, minutes });
    return tn(Math.max(1, minutes), 'in {count} minute', 'in {count} minutes');
}

// Where an instructor's session (an instructor_attendance row) stands right now.
//   key   English text with {placeholders} (render t(key, vars))
//   tone  'good' | 'live' | 'alert' | 'idle' | 'muted'
export function sessionPhase(record, now) {
    const { start, end } = sessionTimes(record.class, record.date);
    switch (record.status) {
        case 'completed':
            return { key: 'Done', tone: 'good' };
        case 'cancelled':
            return { key: 'Cancelled', tone: 'muted' };
        case 'in_progress':
            return end && now >= end ? { key: 'Not checked out', tone: 'alert' } : { key: 'Teaching now', tone: 'live' };
        default:
            if (start && now >= start) return { key: 'Not checked in', tone: 'alert' };
            return start ? { key: 'Starts at {start}', vars: { start }, tone: 'idle' } : { key: 'Not started', tone: 'idle' };
    }
}

export const canCheckIn = (record) => record?.status === 'pending' || record?.status === 'waiting';
export const canCheckOut = (record) => record?.status === 'in_progress';

// ---- Attendance --------------------------------------------------------------------

// Roll-call rows ({ date, status }) → totals, rate (null before anything is marked), the current
// run of attended sessions and the last `recentCount` marked sessions (oldest first).
export function attendanceSummary(rows = [], recentCount = 10) {
    const marked = rows.filter((row) => row.status !== 'pending').sort((a, b) => a.date.localeCompare(b.date));
    const attended = marked.filter((row) => row.status === 'attend').length;
    const absent = marked.length - attended;
    let streak = 0;
    for (let i = marked.length - 1; i >= 0 && marked[i].status === 'attend'; i -= 1) streak += 1;
    return {
        attended,
        absent,
        pending: rows.length - marked.length,
        rate: marked.length ? Math.round((attended / marked.length) * 100) : null,
        streak,
        recent: marked.slice(-recentCount),
    };
}

// ---- Looks -------------------------------------------------------------------------

// Classes without a photo get a gradient; each class keeps its own warm hue.
const HUES = [352, 22, 330, 268, 196, 38, 160];
export const classHue = (id) => HUES[Math.abs(Number(id) || 0) % HUES.length];

// 'Super Shy — NewJeans' → { song: 'Super Shy', artist: 'NewJeans' }
export function splitSong(title = '') {
    const [song, ...rest] = title.split(/\s+[—–-]\s+/);
    return { song: song?.trim() ?? '', artist: rest.join(' — ').trim() };
}

// Given name for greetings: the last word of a Vietnamese full name ("Nguyễn Thảo Vy" → "Vy").
export const givenName = (user) => user?.full_name?.trim().split(/\s+/).pop() || user?.username || '';

export const greetingFor = (hour) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

// True while the window is phone-sized (tables turn into cards there).
export function useIsPhone(query = '(max-width: 720px)') {
    const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const onChange = () => setMatches(media.matches);
        onChange();
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [query]);
    return matches;
}
