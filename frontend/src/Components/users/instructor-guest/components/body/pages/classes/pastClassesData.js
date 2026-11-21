import { useMemo } from 'react';
import { useI18n } from '@/i18n/i18nContext';
import { listPublicClasses } from '@/services/classes';
import { listMyStudentAttendance } from '@/services/attendance';
import { loadMyTuition } from '@/services/tuitionStudent';
import { avatarUrl } from '@/services/storage';
import { splitSong } from '@/lib/lessons';
import { arrangeTuition } from '../tuition/tuitionData';

// "Classes you've taken" (PastClasses.jsx): every course the student was billed for that has started,
// in the classes they're in, the ones they left and the ones that ended. Newest first, one row per
// invoice. Courses that haven't started yet stay on the tuition page (the renewal question).
//
// Reads what the tuition views already load (loadMyTuition: invoices, course progress, places, the
// pay settings), plus the public class listing for each class's teacher and picture (students can't
// read other people's profiles) and the student's own roll calls (sessions attended per course).
// A class that has ended isn't in the public listing: its courses show without a teacher.

// One course: { id, invoice (arrangeTuition's, with `course`), classKey, className, image (ClassThumb),
//   teacher: { name, avatar } | null, song, artist, month ('yyyy-MM-01'), startsOn, endsOn,
//   held, total, attended (null when unknown), videoUrl, isNow }
function courseRow(invoice, { listed, rollCalls, raw, today }) {
    const cls = invoice.class_id != null ? listed.get(invoice.class_id) : null;
    const course = invoice.course;
    const { song, artist } = splitSong(course.title || invoice.lesson_title || '');
    // Roll calls from its first session to its last (unknown for a running course: up to today).
    const until = course.ends_on ?? (course.phase === 'current' ? today : null);
    const calls = until ? rollCalls.filter((row) => row.class?.id === invoice.class_id && row.date >= course.starts_on && row.date <= until) : [];
    // No roll call marked for it (none kept, e.g. after leaving the class): unknown, not "came to 0".
    const came = calls.length ? calls.filter((row) => row.status === 'attend').length : null;
    return {
        id: invoice.id,
        invoice,
        classKey: invoice.class_id ?? invoice.class_name,
        className: invoice.class_name,
        image: {
            id: invoice.class_id ?? invoice.id,
            name: invoice.class_name,
            image_path: cls?.image_path ?? invoice.class?.image_path ?? null,
            image_pos_x: cls?.image_pos_x,
            image_pos_y: cls?.image_pos_y,
        },
        teacher: cls?.instructor_name ? { name: cls.instructor_name, avatar: avatarUrl(cls.instructor_avatar_path) } : null,
        song: song || course.title || '',
        artist,
        month: invoice.month,
        startsOn: course.starts_on,
        endsOn: course.ends_on,
        held: course.sessions_held,
        total: course.session_count,
        attended: came,
        videoUrl: raw.get(invoice.id)?.course?.video_url ?? null,
        isNow: course.phase === 'current',
    };
}

const newestFirst = (a, b) => b.startsOn.localeCompare(a.startsOn) || a.className.localeCompare(b.className, 'vi');

// Pure: the rows and the classes for the filter chips ({ key, id, name, count }, by name).
export function arrangePastClasses({ tuition, classes = [], attendance = [] }) {
    const view = arrangeTuition(tuition);
    const context = {
        listed: new Map(classes.map((cls) => [cls.id, cls])),
        rollCalls: attendance.filter((row) => row.status !== 'pending'), // marked: attended or missed
        raw: new Map((tuition.invoices ?? []).map((invoice) => [invoice.id, invoice])),
        today: tuition.today,
    };
    const rows = view.all
        .filter((invoice) => invoice.course.phase !== 'planned')
        .map((invoice) => courseRow(invoice, context))
        .sort(newestFirst);

    const byClass = new Map();
    for (const row of rows) {
        const entry = byClass.get(row.classKey) ?? { key: row.classKey, id: row.invoice.class_id, name: row.className, count: 0 };
        entry.count += 1;
        byClass.set(row.classKey, entry);
    }
    return {
        today: tuition.today,
        rows,
        classes: [...byClass.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
        all: view.all, // to name the other class of a class switch (MovedTo)
        settings: tuition.settings,
        sandbox: tuition.sandbox,
    };
}

// Rows grouped by the month each course was billed for, newest first: [{ month, rows }].
export function groupByMonth(rows) {
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.month)) groups.set(row.month, []);
        groups.get(row.month).push(row);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => ({ month, rows: items }));
}

// 'yyyy-MM-dd' → a short day of a course's period: "3 Nov" (English), "3/11" (Vietnamese, as people write it).
export function useShortDay() {
    const { lang, intl } = useI18n();
    return useMemo(() => {
        const format = new Intl.DateTimeFormat(intl, { day: 'numeric', month: lang === 'vi' ? 'numeric' : 'short' });
        return (iso) => (iso ? format.format(new Date(`${iso}T00:00:00`)) : '');
    }, [lang, intl]);
}

// The teacher and roll calls only add to the rows: without them the list still shows.
export async function loadPastClasses(userId) {
    const [tuition, classes, attendance] = await Promise.all([
        loadMyTuition(userId),
        listPublicClasses().catch(() => []),
        listMyStudentAttendance(userId).catch(() => []),
    ]);
    return arrangePastClasses({ tuition, classes, attendance });
}
