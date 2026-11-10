import { classPhase, listClassesWithStudents, listLessonProgress } from '@/services/classes';
import { listInstructorAttendance } from '@/services/attendance';
import { listRooms } from '@/services/rooms';
import { getStudioToday } from '@/services/studio';
import { getFinanceByClass } from '@/services/finance';
import { isoWeekdayOf } from '@/lib/format';
import { listCourseInvoices, listPastStats, listRollCallsBetween, listSessionsBetween } from '../hubQueries';
import {
    attendanceRate,
    classFlags,
    monthOf,
    monthSessions,
    nextMonth,
    phaseBadge,
    routineNow,
    sessionState,
    sessionTimes,
    tuitionOf,
} from '../hubModel';

const groupBy = (rows, key) => {
    const map = new Map();
    for (const row of rows) {
        const id = row[key];
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(row);
    }
    return map;
};

// Everything the directory shows, in a few parallel queries: every class (past ones too), this
// month's sessions and roll calls, routine progress, the running course's invoices, the money of
// past classes and (admins) this month's margin per class.
export async function loadDirectory(isAdmin) {
    const today = await getStudioToday();
    const month = monthOf(today);
    const classes = await listClassesWithStudents({ includeEnded: true });
    const endedIds = classes.filter((cls) => classPhase(cls, today) === 'ended').map((cls) => cls.id);
    const [rooms, todayRows, sessions, roll, progress, past, finance] = await Promise.all([
        listRooms(),
        listInstructorAttendance({ date: today }),
        listSessionsBetween(month, nextMonth(month)),
        listRollCallsBetween(month, nextMonth(month)),
        listLessonProgress(classes.map((cls) => cls.id)).catch(() => []),
        listPastStats(endedIds),
        isAdmin ? getFinanceByClass(month).catch(() => []) : Promise.resolve([]),
    ]);
    // Tuition is per course: the running course of each class (the next one when none runs).
    const byClass = groupBy(progress, 'class_id');
    const courseIds = classes
        .map((cls) => {
            const routine = routineNow(byClass.get(cls.id));
            return (routine.current ?? routine.planned)?.lesson_id;
        })
        .filter(Boolean);
    const invoices = await listCourseInvoices(courseIds).catch(() => []);
    return { today, month, classes, rooms, todayRows, sessions, roll, progress, past, finance, invoices };
}

// View models for the directory. `now` ('HH:mm', studio time) drives today's states.
export function buildDirectory(data, now) {
    const { today, month, classes, todayRows, sessions, roll, progress, past, finance, invoices } = data;
    const sessionsBy = groupBy(sessions, 'class_id');
    const rollBy = groupBy(roll, 'class_id');
    const progressBy = groupBy(progress, 'class_id');
    const invoicesBy = groupBy(invoices, 'lesson_id');
    const pastSessions = groupBy(past.sessions, 'class_id');
    const pastInvoices = groupBy(past.invoices, 'class_id');
    const margins = new Map(finance.map((row) => [row.class_id, row]));
    const weekday = isoWeekdayOf(today);

    const items = classes.map((cls) => {
        const badge = phaseBadge(cls, today);
        const routines = progressBy.get(cls.id) ?? [];
        const routine = routineNow(routines);
        const course = routine.current ?? routine.planned ?? null;
        const tuition = tuitionOf(course ? invoicesBy.get(course.lesson_id) ?? [] : [], today);
        const month_ = monthSessions(cls, month, sessionsBy.get(cls.id) ?? []);
        const pastPaid = pastInvoices.get(cls.id) ?? [];
        return {
            cls,
            badge,
            phase: badge.phase,
            students: cls.students?.length ?? 0,
            routine,
            course,
            tuition,
            held: month_.filter((session) => session.row?.status === 'completed').length,
            planned: month_.filter((session) => session.row?.status !== 'cancelled').length,
            attendance: attendanceRate(rollBy.get(cls.id) ?? []),
            margin: margins.get(cls.id)?.margin ?? null,
            flags: classFlags({ cls, phase: badge.phase, progress: routines, overdue: tuition.overdue.length, today }),
            past: {
                sessions: (pastSessions.get(cls.id) ?? []).length,
                students: new Set(pastPaid.filter((row) => row.status !== 'void').map((row) => row.student_id)).size,
                revenue: pastPaid.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0),
            },
        };
    });

    // Today: classes that meet today (weekly or make-up), in time order.
    const todayBy = new Map(todayRows.map((row) => [row.class_id, row]));
    const todayItems = items
        .filter(({ phase, cls }) => (phase === 'running' || phase === 'ending') && (todayBy.has(cls.id) || (cls.schedules ?? []).some((slot) => slot.day_of_week === weekday)))
        .map((item) => {
            const row = todayBy.get(item.cls.id) ?? null;
            const times = sessionTimes(item.cls, today, row);
            const marks = (rollBy.get(item.cls.id) ?? []).filter((mark) => mark.date === today);
            return {
                ...item,
                row,
                ...times,
                state: sessionState({ row, date: today, ...times }, today, now),
                marked: marks.filter((mark) => mark.status !== 'pending').length,
                rollTotal: marks.length,
                teacher: row?.instructor ?? item.cls.instructor,
                substitute: Boolean(row && row.instructor_id !== item.cls.instructor_id),
            };
        })
        .sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));

    return {
        today,
        month,
        items,
        todayItems,
        running: items.filter((item) => item.phase === 'running' || item.phase === 'ending'),
        upcoming: items.filter((item) => item.phase === 'upcoming').sort((a, b) => a.cls.starts_on.localeCompare(b.cls.starts_on)),
        past: items.filter((item) => item.phase === 'ended').sort((a, b) => b.cls.ended_on.localeCompare(a.cls.ended_on)),
    };
}
