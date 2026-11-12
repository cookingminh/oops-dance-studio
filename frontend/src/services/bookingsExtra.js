import { addDays, format, getISODay, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Read-only helpers for the bookings calendar: the class sessions that hold a room on given days,
// shown behind the bookings so staff see why a slot is taken. Sessions at a rented studio (venue_id, no
// room) hold no room and stay out. RLS: staff read classes, schedules and every instructor_attendance row.

const CLASS_COLUMNS = `id, name, room_id, starts_on, ended_on,
    instructor:profiles!instructor_id(id, full_name, username),
    room:rooms!room_id(id, name),
    schedules:class_schedules(id, day_of_week, start_time, end_time)`;

const iso = (date) => format(date, 'yyyy-MM-dd');
const hhmm = (time) => (time ? time.slice(0, 5) : '');

// Class sessions between `from` and `until` ('yyyy-MM-dd', inclusive), oldest first:
// [{ key, class_id, class_name, instructor_name, room_id, room_name, date, start, end, is_extra, makes_up }]
// (`makes_up`: the day a make-up replaces, or null).
// Weekly sessions count while the class runs (starts_on … ended_on) and not on a day whose session
// was cancelled (that frees the room); make-up sessions come from instructor_attendance.
export async function listRoomSessions({ from, until }) {
    const [classes, changes] = await Promise.all([
        supabase.from('classes').select(CLASS_COLUMNS).or(`ended_on.is.null,ended_on.gte.${from}`),
        supabase
            .from('instructor_attendance')
            .select('id, class_id, room_id, venue_id, date, status, start_time, end_time, is_extra, makes_up')
            .gte('date', from)
            .lte('date', until)
            .or('is_extra.eq.true,status.eq.cancelled'),
    ]).then(([classRows, changeRows]) => [unwrap(classRows), unwrap(changeRows)]);

    const cancelled = new Set(changes.filter((row) => row.status === 'cancelled').map((row) => `${row.class_id}|${row.date}`));
    const byId = new Map(classes.map((cls) => [cls.id, cls]));
    const describe = (cls) => ({
        class_id: cls.id,
        class_name: cls.name,
        instructor_name: cls.instructor?.full_name || cls.instructor?.username || '',
    });

    const sessions = [];
    for (let day = parseISO(from); iso(day) <= until; day = addDays(day, 1)) {
        const date = iso(day);
        const weekday = getISODay(day);
        for (const cls of classes) {
            if (!cls.room_id) continue;
            if (cls.starts_on && cls.starts_on > date) continue;
            if (cls.ended_on && cls.ended_on < date) continue;
            if (cancelled.has(`${cls.id}|${date}`)) continue;
            for (const slot of cls.schedules ?? []) {
                if (slot.day_of_week !== weekday) continue;
                sessions.push({
                    key: `w${slot.id}-${date}`,
                    ...describe(cls),
                    room_id: cls.room_id,
                    room_name: cls.room?.name ?? '',
                    date,
                    start: hhmm(slot.start_time),
                    end: hhmm(slot.end_time),
                    is_extra: false,
                    makes_up: null,
                });
            }
        }
    }

    for (const row of changes) {
        if (!row.is_extra || row.status === 'cancelled' || !row.start_time) continue;
        const cls = byId.get(row.class_id);
        // A make-up at a venue holds no room, even if its class has since moved into one.
        const roomId = row.venue_id ? null : row.room_id ?? cls?.room_id;
        if (!roomId) continue;
        sessions.push({
            key: `m${row.id}`,
            ...(cls ? describe(cls) : { class_id: row.class_id, class_name: '', instructor_name: '' }),
            room_id: roomId,
            room_name: cls?.room_id === roomId ? cls.room?.name ?? '' : '',
            date: row.date,
            start: hhmm(row.start_time),
            end: hhmm(row.end_time),
            is_extra: true,
            makes_up: row.makes_up ?? null,
        });
    }

    return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
