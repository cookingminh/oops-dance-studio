import { createContext, useContext } from 'react';
import { listClasses, listLessonProgress } from '@/services/classes';
import { listInstructorAttendance, listOpenInstructorAttendance, listStudentAttendance } from '@/services/attendance';
import { listPendingBookings } from '@/services/bookings';
import { listOwingBookings } from '@/services/bookingPayments';
import { getStudioToday } from '@/services/studio';
import { loadTuitionTodo } from '@/services/tuitionStaff';
import { withOwnTimes } from '@/services/sessions';
import { formatTime, formatVnd, isoWeekdayOf, studioTimeNow } from '@/lib/format';
import { routineState, routinesByClass, sessionTimesOf, sessionWithoutRoutine } from '@/lib/lessons';

// The "to do" list for admin and staff: what needs someone's attention right now.
// Each task: { id, kind, tone: 'urgent' | 'normal' | 'later', title, detail, to }, where title and
// detail are messages { key, vars } (English key; TaskBell translates them) or { text } for data.
const msg = (key, vars) => ({ key, vars });
const count = (n, one, many, vars) => msg(n === 1 ? one : many, { count: n, ...vars });

// Roll calls and check-ins share one page; `?class=&day=` opens that session's modal.
const ATTENDANCE_PAGE = '/admin/attendance';
const sessionLink = (classId, date) => `${ATTENDANCE_PAGE}?class=${classId}&day=${date}`;
const TUITION_PAGE = '/admin/tuition';
const personName = (person) => person?.full_name || person?.username || null; // null → "An instructor"

// Start / end ('HH:mm') of a class on a given date, from its weekly schedule. For a session row
// (which may be a make-up with its own times) use sessionTimesOf(row) from lib/lessons.
export function sessionTimes(cls, isoDate) {
    const weekday = isoWeekdayOf(isoDate);
    const slot = cls?.schedules?.find((schedule) => schedule.day_of_week === weekday);
    return { start: formatTime(slot?.start_time), end: formatTime(slot?.end_time) };
}

// Tuition: students who are late, money waiting in the bank inbox, and renewals nobody has
// answered yet (one task per month whose answers are still open).
function buildTuitionTasks({ overdue, unmatched, unanswered }) {
    const tasks = [];
    if (overdue.length) {
        // One student can be late for several classes: name each person once.
        const names = [...new Set(overdue.map((row) => row.student_name).filter(Boolean))];
        tasks.push({
            id: 'tuition-overdue',
            kind: 'tuition',
            tone: 'normal',
            title: count(names.length, '{count} student is late with tuition', '{count} students are late with tuition'),
            detail: names.length > 3
                ? msg('{names} and {count} more', { names: names.slice(0, 2).join(', '), count: names.length - 2 })
                : { text: names.join(', ') },
            to: `${TUITION_PAGE}?show=overdue`,
        });
    }
    if (unmatched.length) {
        const total = unmatched.reduce((sum, row) => sum + Number(row.amount), 0);
        tasks.push({
            id: 'tuition-transfers',
            kind: 'transfers',
            tone: 'normal',
            title: count(unmatched.length, '{count} bank transfer to sort', '{count} bank transfers to sort'),
            detail: msg('{amount} received without an invoice code', { amount: formatVnd(total) }),
            to: `${TUITION_PAGE}?show=transfers`,
        });
    }
    // One to-do per course whose renewal has unanswered students.
    const byCourse = new Map();
    for (const row of unanswered) {
        const key = row.lesson_id ?? `${row.class_id}:${row.month}`;
        const entry = byCourse.get(key) ?? { students: new Set(), due: row.due_date, course: row.lesson_title, cls: row.class_name };
        entry.students.add(row.student_id);
        if (row.due_date < entry.due) entry.due = row.due_date;
        byCourse.set(key, entry);
    }
    for (const [key, { students, due, course, cls }] of byCourse) {
        tasks.push({
            id: `tuition-renewal-${key}`,
            kind: 'renewals',
            tone: 'normal',
            title: count(students.size, '{count} student hasn’t answered for {course} ({cls})', '{count} students haven’t answered for {course} ({cls})', { course, cls }),
            detail: msg('Unpaid and unanswered after {date}: they leave the class', { date: due }),
            to: `${TUITION_PAGE}?show=renewal`,
        });
    }
    return tasks;
}

// Routines: a class whose routine is nearly done with nothing planned next, or that has none.
function buildRoutineTasks(classes, progress, today) {
    if (!progress) return [];
    const byClass = routinesByClass(progress);
    const tasks = [];
    for (const cls of classes) {
        const state = routineState(byClass.get(cls.id));
        const bare = sessionWithoutRoutine(cls, state, today);
        if (!state.needsNext && !bare) continue;
        // Straight to the class's Routines tab, where the next routine is planned.
        const task = { id: `routine-${cls.id}`, kind: 'lessons', tone: 'normal', to: `/admin/classes/${cls.id}?tab=routines` };
        if (state.current) {
            tasks.push({
                ...task,
                title: count(state.remaining, '{cls} finishes its routine in {count} session — plan the next one', '{cls} finishes its routine in {count} sessions — plan the next one', { cls: cls.name }),
                detail: state.current.ends_on
                    ? msg('“{title}” · last session {date}', { title: state.current.title, date: state.current.ends_on })
                    : { text: state.current.title },
            });
        } else if (bare) {
            tasks.push({
                ...task,
                title: msg('{cls} has no routine until {date}', { cls: cls.name, date: state.next.starts_on }),
                detail: msg('Next: “{title}”', { title: state.next.title }),
            });
        } else {
            tasks.push({
                ...task,
                title: msg('{cls} has no routine', { cls: cls.name }),
                detail: state.last?.ends_on
                    ? msg('“{title}” was filmed {date}', { title: state.last.title, date: state.last.ends_on })
                    : msg('Pick the song students learn next'),
            });
        }
    }
    return tasks;
}

export async function loadStaffTasks() {
    const today = await getStudioToday();
    const now = studioTimeNow();
    const weekday = isoWeekdayOf(today);
    const [open, todayRecords, { classes, progress }, students, pending, owing, tuition] = await Promise.all([
        // Make-up sessions carry their own times (withOwnTimes), regular ones the weekly slot.
        listOpenInstructorAttendance({ until: today }).then(withOwnTimes),
        listInstructorAttendance({ date: today }).then(withOwnTimes),
        listClasses().then(async (list) => ({
            classes: list,
            // Routines are newer: if their progress can't load, the other tasks still show.
            progress: await listLessonProgress(list.map((cls) => cls.id)).catch(() => null),
        })),
        listStudentAttendance({ date: today }),
        listPendingBookings({ from: today, limit: 1 }),
        // Booking payments are newer: if they can't load, the other tasks still show.
        listOwingBookings(today).catch(() => []),
        // Tuition is a newer feature: if it can't load, the other tasks still show.
        loadTuitionTodo(today).catch(() => null),
    ]);

    const attendance = [];
    for (const row of open) {
        const who = personName(row.instructor);
        const cls = row.class?.name;
        const { start, end } = sessionTimesOf(row);
        if (row.date < today) {
            attendance.push({
                id: `review-${row.id}`,
                kind: 'review',
                tone: 'urgent',
                title: msg('Review {who}’s session', { who }),
                detail: msg(row.status === 'in_progress' ? '{cls} on {date} · never checked out' : '{cls} on {date} · no check-in', { cls, date: row.date }),
                to: sessionLink(row.class_id, row.date),
            });
        } else if (row.status === 'in_progress' && end && now >= end) {
            attendance.push({
                id: `checkout-${row.id}`,
                kind: 'checkout',
                tone: 'urgent',
                title: msg('{who} hasn’t checked out', { who }),
                detail: msg('{cls} ended at {end}', { cls, end }),
                to: sessionLink(row.class_id, row.date),
            });
        } else if (row.status !== 'in_progress' && start && now >= start) {
            attendance.push({
                id: `checkin-${row.id}`,
                kind: 'checkin',
                tone: 'urgent',
                title: msg('{who} hasn’t checked in', { who }),
                detail: msg('{cls} started at {start}', { cls, start }),
                to: sessionLink(row.class_id, row.date),
            });
        }
    }

    const weeklyToday = classes.filter((cls) => cls.schedules.some((schedule) => schedule.day_of_week === weekday));
    const withRecord = new Set(todayRecords.map((row) => row.class_id));
    const missing = weeklyToday.filter((cls) => !withRecord.has(cls.id));
    if (missing.length) {
        attendance.push({
            id: 'generate-instructor',
            kind: 'generate',
            tone: 'normal',
            title: msg('Create this week’s instructor records'),
            detail: count(missing.length, '{count} class today has no check-in record yet', '{count} classes today have no check-in record yet'),
            to: ATTENDANCE_PAGE,
        });
    }

    // Classes meeting today: their weekly session, or a make-up session with its own times.
    const makeUpToday = new Map(todayRecords.filter((row) => row.is_extra && row.status !== 'cancelled').map((row) => [row.class_id, row]));
    const todaysClasses = classes.filter((cls) => weeklyToday.includes(cls) || makeUpToday.has(cls.id));
    const timesToday = (cls) => (makeUpToday.has(cls.id) ? sessionTimesOf(makeUpToday.get(cls.id)) : sessionTimes(cls, today));

    // Student attendance: every class today that still has unmarked students. How pressing it is
    // depends on the time: ended → urgent, in class now → today, not started yet → later today.
    const studentTasks = [];
    const unmarked = new Map();
    for (const row of students) {
        if (row.status !== 'pending') continue;
        unmarked.set(row.class_id, (unmarked.get(row.class_id) ?? 0) + 1);
    }
    for (const cls of todaysClasses) {
        const n = unmarked.get(cls.id);
        if (!n) continue;
        const { start, end } = timesToday(cls);
        let task;
        if (end && now >= end) {
            task = {
                tone: 'urgent',
                title: msg('Attendance not taken for {cls}', { cls: cls.name }),
                detail: count(n, '{count} student unmarked · ended at {end}', '{count} students unmarked · ended at {end}', { end }),
            };
        } else if (start && now >= start) {
            task = {
                tone: 'normal',
                title: msg('Take attendance for {cls}', { cls: cls.name }),
                detail: count(n, '{count} student unmarked · in class until {end}', '{count} students unmarked · in class until {end}', { end }),
            };
        } else {
            task = {
                tone: 'later',
                title: msg('Take attendance for {cls}', { cls: cls.name }),
                detail: count(n, '{count} student · starts at {start}', '{count} students · starts at {start}', { start }),
            };
        }
        studentTasks.push({ id: `students-${cls.id}`, kind: 'students', to: sessionLink(cls.id, today), ...task });
    }
    if (todaysClasses.length && students.length === 0) {
        studentTasks.push({
            id: 'generate-students',
            kind: 'generate',
            tone: 'normal',
            title: msg('Create today’s student records'),
            detail: count(todaysClasses.length, '{count} class on the timetable today', '{count} classes on the timetable today'),
            to: ATTENDANCE_PAGE,
        });
    }

    const lessonTasks = buildRoutineTasks(classes, progress, today);

    const bookingTasks = pending.total
        ? [{
            id: 'bookings',
            kind: 'bookings',
            tone: 'normal',
            title: count(pending.total, '{count} booking request to review', '{count} booking requests to review'),
            detail: msg('Upcoming bookings waiting for approval'),
            to: '/admin/bookings?status=pending',
        }]
        : [];
    // Sessions that are over but still owe money (the rest after a deposit, usually): one booking → open it;
    // several → the list of what is owed.
    if (owing.length) {
        const total = owing.reduce((sum, row) => sum + row.owed, 0);
        const one = owing.length === 1 ? owing[0] : null;
        bookingTasks.push({
            id: 'bookings-owing',
            kind: 'bookings',
            tone: 'normal',
            title: one
                ? msg('{guest} still owes for their booking', { guest: personName(one.guest) ?? `#${one.id}` })
                : count(owing.length, '{count} past booking still owes money', '{count} past bookings still owe money'),
            detail: one
                ? msg('{amount} left · {room} on {date}', { amount: formatVnd(one.owed), room: one.room?.name ?? '', date: one.date })
                : msg('{amount} left to collect', { amount: formatVnd(total) }),
            to: one ? `/admin/bookings?booking=${one.id}` : '/admin/bookings?view=list&owing=1',
        });
    }

    const tuitionTasks = tuition ? buildTuitionTasks(tuition) : [];

    return {
        today,
        checkedAt: now,
        tasks: [...attendance, ...studentTasks, ...lessonTasks, ...bookingTasks, ...tuitionTasks],
        // Sidebar badges.
        counts: {
            [ATTENDANCE_PAGE]: attendance.length + studentTasks.length,
            '/admin/bookings': pending.total + owing.length,
            '/admin/classes': lessonTasks.length,
            // Invoices to chase and transfers to sort (renewal answers are a reminder, not a count).
            [TUITION_PAGE]: tuition ? new Set(tuition.overdue.map((row) => row.student_id)).size + tuition.unmatched.length : 0,
        },
    };
}

const EMPTY = { data: undefined, loading: false, error: null, refresh: () => {} };

export const StaffTasksContext = createContext(EMPTY);

// { data: { tasks, counts, … } | undefined, loading, error, refresh }. Safe outside the provider.
export const useStaffTasks = () => useContext(StaffTasksContext);
