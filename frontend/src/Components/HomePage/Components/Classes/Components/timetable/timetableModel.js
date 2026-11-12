import { WEEKDAYS, formatTime } from '@/lib/format';
import { publicPlaceOf } from '@/lib/place';
import { AREA } from '../../../NavBar/contactInfo';

// The week's sessions from list_public_classes() rows: { key, day_of_week, start, end, cls, place }.
export function sessionsOf(rows) {
    return (rows ?? []).flatMap((cls) =>
        (cls.schedules ?? []).map((s) => ({
            key: `${cls.id}-${s.day_of_week}-${s.start_time}`,
            day_of_week: s.day_of_week,
            start: formatTime(s.start_time),
            end: formatTime(s.end_time),
            cls,
            place: publicPlaceOf(cls),
        }))
    );
}

const byTime = (a, b) => a.start.localeCompare(b.start) || a.cls.name.localeCompare(b.cls.name);

// One column per weekday (ISO 1–7), its sessions in time order.
export const daysOf = (sessions) =>
    WEEKDAYS.map((day) => ({ ...day, sessions: sessions.filter((s) => s.day_of_week === day.value).sort(byTime) }));

// How a place reads in "Classes held at …": a rented studio by its area (the first part of its address —
// "Đê La Thành nhỏ, Hà Nội" → "Đê La Thành nhỏ"), the studio's own rooms by the studio's area.
const areaOf = (place) => {
    if (place.kind === 'room') return AREA;
    return (place.address ?? '').split(',')[0].trim() || place.name;
};

// The places of the week, each once, in the order the week reaches them (Monday first, earliest first).
export function placesOf(sessions) {
    const seen = new Map();
    for (const s of [...sessions].sort((a, b) => a.day_of_week - b.day_of_week || byTime(a, b))) {
        if (!s.place.name) continue;
        const label = areaOf(s.place);
        const key = label.toLocaleLowerCase('vi');
        if (!seen.has(key)) seen.set(key, label);
    }
    return [...seen.values()];
}

// The poster's rows, as on the printed schedule: a class keeps one row across its days, classes on different
// days share a row, the advanced classes sit at the bottom and, within a level, the fullest row is on top.
// Earliest classes are placed first. Returns rows of 7 cells (Monday … Sunday), each a session or null.
export function posterRowsOf(sessions, levelRank = () => 0) {
    // A class's line: its sessions on different days (a second session on the same day starts another line).
    const lines = [];
    const byClass = new Map();
    for (const s of [...sessions].sort(byTime)) {
        const own = byClass.get(s.cls.id) ?? [];
        let line = own.find((candidate) => !candidate.days.has(s.day_of_week));
        if (!line) {
            line = { cls: s.cls, days: new Set(), sessions: [], first: s.start };
            own.push(line);
            lines.push(line);
            byClass.set(s.cls.id, own);
        }
        line.days.add(s.day_of_week);
        line.sessions.push(s);
        if (s.start < line.first) line.first = s.start;
    }
    lines.sort((a, b) => levelRank(a.cls) - levelRank(b.cls) || a.first.localeCompare(b.first) || a.cls.name.localeCompare(b.cls.name));

    // Fill each row from the top, but never put a lower level's class above a higher level's row.
    const rows = [];
    for (const line of lines) {
        const rank = levelRank(line.cls);
        let row = rows.find((candidate) => candidate.rank === rank && [...line.days].every((day) => !candidate.cells[day - 1]));
        if (!row) {
            row = { rank, cells: Array(7).fill(null) };
            rows.push(row);
        }
        for (const s of line.sessions) row.cells[s.day_of_week - 1] = s;
    }
    // Within a level the fullest row goes first (as the printed schedule does).
    const filled = (row) => row.cells.filter(Boolean).length;
    return rows.sort((a, b) => a.rank - b.rank || filled(b) - filled(a)).map((row) => row.cells);
}
