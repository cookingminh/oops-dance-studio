import { listClassesWithStudents } from '@/services/classes';
import { listOpenInstructorAttendance } from '@/services/attendance';
import { listRollMarks, listSessionRows, listSessionsWithProofs } from '@/services/attendanceHub';
import { listInstructors } from '@/services/users';
import { getStudioToday } from '@/services/studio';
import { sessionTimes } from '../class-hub/hubModel';
import { rangeSessions, sessionKey, sessionsOfClasses, shiftDay } from '../../common/session-modal/sessionModel';

// Data for the Attendance page. Every class (past ones too, for their old sessions) is loaded
// once; the sections then load their own sessions.

// { today, classes (with members), instructors }
export async function loadBase() {
    const [today, classes, instructors] = await Promise.all([getStudioToday(), listClassesWithStudents({ includeEnded: true }), listInstructors()]);
    return { today, classes, instructors };
}

// Groups roll-call marks by `${class_id}_${date}`.
export function marksByKey(marks) {
    const map = new Map();
    for (const mark of marks) {
        const key = sessionKey(mark.class_id, mark.date);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(mark);
    }
    return map;
}

// A session object for an instructor_attendance row (the class from `classes` when it's there).
export function sessionOfRow(row, classes) {
    const cls = classes.find((item) => item.id === row.class_id) ?? { ...row.class, id: row.class_id, room: row.room };
    return { key: sessionKey(row.class_id, row.date), cls, date: row.date, row, extra: Boolean(row.is_extra), ...sessionTimes(cls, row.date, row) };
}

// Today: every session (timetable + records, make-ups included) in time order with its proofs and
// roll-call marks, and the earlier sessions nobody closed (oldest first).
export async function loadToday(today, classes) {
    const [rows, marks, open] = await Promise.all([
        listSessionsWithProofs(today),
        listRollMarks({ from: today, until: today }),
        listOpenInstructorAttendance({ until: shiftDay(today, -1) }),
    ]);
    const byClass = new Map();
    for (const row of rows) byClass.set(row.class_id, [...(byClass.get(row.class_id) ?? []), row]);
    const sessions = classes
        .flatMap((cls) => rangeSessions(cls, today, today, byClass.get(cls.id) ?? []))
        .sort((a, b) => (a.start || '99').localeCompare(b.start || '99') || a.cls.name.localeCompare(b.cls.name));
    return { sessions, marks: marksByKey(marks), review: open.map((row) => ({ ...sessionOfRow(row, classes), source: row })) };
}

// The calendar's range: sessions of every class (timetable + records) and their roll-call marks.
export async function loadRange(classes, from, until) {
    const [rows, marks] = await Promise.all([listSessionRows({ from, until }), listRollMarks({ from, until })]);
    return { sessions: sessionsOfClasses(classes, from, until, rows), marks: marksByKey(marks) };
}

// The list: every recorded session, newest first.
export async function loadAll(classes) {
    const rows = await listSessionRows();
    return rows.map((row) => sessionOfRow(row, classes)).sort((a, b) => b.date.localeCompare(a.date) || (b.start || '').localeCompare(a.start || ''));
}
