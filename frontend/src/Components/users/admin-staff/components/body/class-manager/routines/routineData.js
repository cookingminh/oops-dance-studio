import { listClassLessons, listLessonProgress } from '@/services/classes';
import { listClassSessionChanges } from '@/services/sessions';
import { getTuitionSettings, listClassInvoices } from '@/services/tuition';

const RENEWAL_OPENS_AT = 2; // tuition_settings.renewal_open_sessions when it can't be read

// Everything the routines panel shows for one class: its routines (= courses: progress rows with
// their video, month and fee), its make-up sessions, the days a session was cancelled, and for each
// planned course the invoices of its renewal.
export async function loadRoutines(classId) {
    const [progress, lessons, changes, settings] = await Promise.all([
        listLessonProgress([classId]),
        listClassLessons([classId]),
        listClassSessionChanges(classId),
        getTuitionSettings().catch(() => null),
    ]);
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const planned = progress.filter((row) => row.status === 'planned');
    const invoices = await Promise.all(planned.map((row) => listClassInvoices(classId, { lessonId: row.lesson_id }).catch(() => null)));
    return {
        routines: progress.map((row) => withLesson(row, lessonById.get(row.lesson_id))),
        makeUps: changes.makeUps,
        cancelledDates: changes.cancelledDates,
        // lesson id → its invoices (null when they couldn't be read)
        renewals: new Map(planned.map((row, index) => [row.lesson_id, invoices[index]])),
        renewalOpensAt: settings?.renewal_open_sessions ?? RENEWAL_OPENS_AT,
    };
}

// A progress row with what LessonVideo and the fee need from its class_lessons row
// ({ id, month, video_url, price: the course fee, null = the class price }).
export const withLesson = (row, lesson) => ({
    ...row,
    id: row.lesson_id,
    month: lesson?.month ?? row.starts_on,
    video_url: lesson?.video_url ?? null,
    price: lesson?.price ?? null,
});

// How a course's renewal stands from its invoices: { open, paid, waiting, stopping }.
export function renewalCounts(invoices = []) {
    const counts = { open: invoices.length > 0, paid: 0, waiting: 0, stopping: 0 };
    for (const invoice of invoices) {
        if (invoice.status === 'paid' || invoice.status === 'waived') counts.paid += 1;
        else if (invoice.renewal === 'stop' || (invoice.status === 'void' && ['stopped', 'not_renewed'].includes(invoice.void_reason))) counts.stopping += 1;
        else if (invoice.status === 'unpaid') counts.waiting += 1;
    }
    return counts;
}

// Options for the date helpers in lib/lessons: make-ups count as sessions, cancelled days don't.
export const dateOptions = (data) => ({
    extraDates: (data?.makeUps ?? []).map((row) => row.date),
    cancelledDates: data?.cancelledDates ?? [],
});

// The routine an instructor_attendance-style row date falls in (start ≤ date ≤ projected end).
export const inRoutine = (routine, date) => date >= routine.starts_on && (!routine.ends_on || date <= routine.ends_on);

// A failed make-up as a message { key, vars } (English key, translated where shown), or null to
// show the error as it is. The server says what the room is taken by: "a booking 18:00–19:00",
// 'class "K-pop Cover" 18:00–19:30' or 'a make-up session of "Breaking Kids" 14:00–15:00'.
export function makeUpProblem(error) {
    const detail = error?.detail ?? '';
    if (error?.code === 'SLOT_TAKEN') {
        const taken = detail.replace(/^the room is taken by\s*/i, '');
        let match = taken.match(/^a booking (\d\d:\d\d)–(\d\d:\d\d)$/);
        if (match) return { key: 'The room is booked {start}–{end} that day.', vars: { start: match[1], end: match[2] } };
        match = taken.match(/^class "(.+)" (\d\d:\d\d)–(\d\d:\d\d)$/);
        if (match) return { key: '{cls} has the room {start}–{end} that day.', vars: { cls: match[1], start: match[2], end: match[3] } };
        match = taken.match(/^a make-up session of "(.+)" (\d\d:\d\d)–(\d\d:\d\d)$/);
        if (match) return { key: '{cls} has a make-up session in the room {start}–{end} that day.', vars: { cls: match[1], start: match[2], end: match[3] } };
        return taken ? { key: 'The room is taken by {what}.', vars: { what: taken } } : null;
    }
    if (error?.code === 'INVALID_STATE' && /already meets/i.test(detail)) return { key: 'The class already has a session that day. Pick another day.' };
    if (error?.code === 'INVALID_STATE' && /doesn.t run/i.test(detail)) return { key: 'The class isn’t running on that day.' };
    if (error?.code === 'INVALID_INPUT' && /today or a later day/i.test(detail)) return { key: 'Pick today or a later day.' };
    if (error?.code === 'INVALID_INPUT' && /08:00 and 22:00/.test(detail)) return { key: 'Sessions must be between 08:00 and 22:00.' };
    return null;
}
