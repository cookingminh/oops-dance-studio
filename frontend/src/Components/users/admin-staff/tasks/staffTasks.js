import { createContext, useContext } from 'react';
import { format, parseISO } from 'date-fns';
import { listClasses } from '@/services/classes';
import { listInstructorAttendance, listOpenInstructorAttendance, listStudentAttendance } from '@/services/attendance';
import { listPendingBookings } from '@/services/bookings';
import { getStudioToday } from '@/services/studio';
import { formatTime, isoWeekdayOf, studioTimeNow } from '@/lib/format';
import { lessonState, monthLabel } from '@/lib/lessons';

// The "to do" list for admin and staff: what needs someone's attention right now.
// Each task: { id, kind, tone: 'urgent' | 'normal' | 'later', title, detail, to }.

const ATTENDANCE_PAGE = '/admin/attendance-records';
const personName = (person) => person?.full_name || person?.username || 'An instructor';
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Start / end ('HH:mm') of a class on a given date, from its weekly schedule.
export function sessionTimes(cls, isoDate) {
    const weekday = isoWeekdayOf(isoDate);
    const slot = cls?.schedules?.find((schedule) => schedule.day_of_week === weekday);
    return { start: formatTime(slot?.start_time), end: formatTime(slot?.end_time) };
}

export async function loadStaffTasks() {
    const today = await getStudioToday();
    const now = studioTimeNow();
    const weekday = isoWeekdayOf(today);
    const [open, todayRecords, classes, students, pending] = await Promise.all([
        listOpenInstructorAttendance({ until: today }),
        listInstructorAttendance({ date: today }),
        listClasses(),
        listStudentAttendance({ date: today }),
        listPendingBookings({ from: today, limit: 1 }),
    ]);

    const attendance = [];
    for (const row of open) {
        const who = personName(row.instructor);
        const { start, end } = sessionTimes(row.class, row.date);
        if (row.date < today) {
            attendance.push({
                id: `review-${row.id}`,
                kind: 'review',
                tone: 'urgent',
                title: `Review ${who}’s session`,
                detail: `${row.class?.name} on ${format(parseISO(row.date), 'EEE d MMM')} · ${row.status === 'in_progress' ? 'never checked out' : 'no check-in'}`,
                to: ATTENDANCE_PAGE,
            });
        } else if (row.status === 'in_progress' && end && now >= end) {
            attendance.push({
                id: `checkout-${row.id}`,
                kind: 'checkout',
                tone: 'urgent',
                title: `${who} hasn’t checked out`,
                detail: `${row.class?.name} ended at ${end}`,
                to: ATTENDANCE_PAGE,
            });
        } else if (row.status !== 'in_progress' && start && now >= start) {
            attendance.push({
                id: `checkin-${row.id}`,
                kind: 'checkin',
                tone: 'urgent',
                title: `${who} hasn’t checked in`,
                detail: `${row.class?.name} started at ${start}`,
                to: ATTENDANCE_PAGE,
            });
        }
    }

    const todaysClasses = classes.filter((cls) => cls.schedules.some((schedule) => schedule.day_of_week === weekday));
    const withRecord = new Set(todayRecords.map((row) => row.class_id));
    const missing = todaysClasses.filter((cls) => !withRecord.has(cls.id));
    if (missing.length) {
        attendance.push({
            id: 'generate-instructor',
            kind: 'generate',
            tone: 'normal',
            title: 'Create this week’s instructor records',
            detail: `${plural(missing.length, 'class', 'classes')} today ${missing.length === 1 ? 'has' : 'have'} no check-in record yet`,
            to: ATTENDANCE_PAGE,
        });
    }

    // Student attendance: every class today that still has unmarked students. How pressing it is
    // depends on the time: ended → urgent, in class now → today, not started yet → later today.
    const studentTasks = [];
    const unmarked = new Map();
    for (const row of students) {
        if (row.status !== 'pending') continue;
        unmarked.set(row.class_id, (unmarked.get(row.class_id) ?? 0) + 1);
    }
    for (const cls of todaysClasses) {
        const count = unmarked.get(cls.id);
        if (!count) continue;
        const { start, end } = sessionTimes(cls, today);
        const who = plural(count, 'student', 'students');
        let task;
        if (end && now >= end) {
            task = { tone: 'urgent', title: `Attendance not taken for ${cls.name}`, detail: `${who} unmarked · ended at ${end}` };
        } else if (start && now >= start) {
            task = { tone: 'normal', title: `Take attendance for ${cls.name}`, detail: `${who} unmarked · in class until ${end}` };
        } else {
            task = { tone: 'later', title: `Take attendance for ${cls.name}`, detail: `${who} · starts at ${start}` };
        }
        studentTasks.push({ id: `students-${cls.id}`, kind: 'students', to: '/admin/students', ...task });
    }
    if (todaysClasses.length && students.length === 0) {
        studentTasks.push({
            id: 'generate-students',
            kind: 'generate',
            tone: 'normal',
            title: 'Create today’s student records',
            detail: `${plural(todaysClasses.length, 'class', 'classes')} on the timetable today`,
            to: '/admin/students',
        });
    }

    // Monthly lessons: classes still showing last month's piece.
    const stale = classes.filter((cls) => lessonState(cls.lessons, today).needsUpdate);
    const lessonTasks = stale.length
        ? [{
            id: 'lessons',
            kind: 'lessons',
            tone: 'normal',
            title: `Set ${monthLabel(`${today.slice(0, 7)}-01`)}’s lesson for ${plural(stale.length, 'class', 'classes')}`,
            detail: stale.map((cls) => cls.name).join(', '),
            to: '/admin/classes',
        }]
        : [];

    const bookingTasks = pending.total
        ? [{
            id: 'bookings',
            kind: 'bookings',
            tone: 'normal',
            title: `${plural(pending.total, 'booking request', 'booking requests')} to review`,
            detail: 'Upcoming bookings waiting for approval',
            to: '/admin/bookings',
        }]
        : [];

    return {
        today,
        checkedAt: now,
        tasks: [...attendance, ...studentTasks, ...lessonTasks, ...bookingTasks],
        // Sidebar badges.
        counts: {
            '/admin/attendance-records': attendance.length,
            '/admin/students': studentTasks.length,
            '/admin/bookings': pending.total,
            '/admin/classes': stale.length,
        },
    };
}

const EMPTY = { data: undefined, loading: false, error: null, refresh: () => {} };

export const StaffTasksContext = createContext(EMPTY);

// { data: { tasks, counts, … } | undefined, loading, error, refresh }. Safe outside the provider.
export const useStaffTasks = () => useContext(StaffTasksContext);
