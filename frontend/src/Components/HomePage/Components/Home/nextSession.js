import { formatTime } from '@/lib/format';

const ISO_DAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Weekday (ISO 1–7) and 'HH:mm' right now at the studio (Asia/Ho_Chi_Minh), whatever the visitor's clock zone.
export function studioNow(date = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            .formatToParts(date)
            .map((part) => [part.type, part.value])
    );
    return { day: ISO_DAY[parts.weekday], time: `${parts.hour}:${parts.minute}` };
}

// The class on now, or the next one on the weekly timetable: { cls, start, end, inDays, live }.
// inDays: 0 = today, 1 = tomorrow, … Returns null when nothing is scheduled.
export function nextSession(classes, now = studioNow()) {
    const sessions = classes.flatMap((cls) =>
        (cls.schedules ?? []).map((s) => ({ cls, day: s.day_of_week, start: formatTime(s.start_time), end: formatTime(s.end_time) }))
    );
    if (sessions.length === 0) return null;
    for (let inDays = 0; inDays <= 7; inDays += 1) {
        const day = ((now.day - 1 + inDays) % 7) + 1;
        const candidates = sessions
            .filter((s) => s.day === day && (inDays > 0 || s.end > now.time))
            .sort((a, b) => a.start.localeCompare(b.start));
        if (candidates.length) {
            const next = candidates[0];
            return { ...next, inDays, live: inDays === 0 && next.start <= now.time };
        }
    }
    return null;
}
