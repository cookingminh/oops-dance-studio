import { sessionDates } from '@/lib/lessons';
import { tuitionOf } from '../../hubModel';
import { shiftIso, typicalDueDate } from '../../../tuition/tuitionModel';

// Tuition per course for the class page. A course is a routine (lesson_progress row); invoices
// carry `lesson_id`. Pure helpers, labels are English i18n keys.

// The chip of each course in the picker: lesson_progress status → label and tone. Only a course
// that is running now is "Current"; a finished one never is.
export const COURSE_STATUS = {
    current: { label: 'Current', tone: 'good' },
    planned: { label: 'Up next', tone: 'live' },
    done: { label: 'Finished', tone: 'muted' },
    stopped: { label: 'Stopped', tone: 'muted' },
};

// Courses newest first, each with its invoices and money: [{ key, course, invoices, sums, open }].
// Invoices without a course (older monthly ones) come last as one group.
export function groupByCourse(progress, invoices, today) {
    const byLesson = new Map();
    for (const invoice of invoices) {
        const key = invoice.lesson_id ?? 'none';
        if (!byLesson.has(key)) byLesson.set(key, []);
        byLesson.get(key).push(invoice);
    }
    const groups = [...progress]
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on))
        .map((course) => {
            const rows = byLesson.get(course.lesson_id) ?? [];
            return { key: String(course.lesson_id), course, invoices: rows, sums: tuitionOf(rows, today), open: course.status === 'current' || course.status === 'planned' };
        });
    const loose = byLesson.get('none');
    if (loose?.length) groups.push({ key: 'none', course: null, invoices: loose, sums: tuitionOf(loose, today), open: false });
    return groups;
}

// Which course the picker opens on: the running one, else the next one, else the latest finished.
export function defaultCourseKey(groups) {
    const pick = (status) => groups.find((group) => group.course?.status === status);
    return (pick('current') ?? pick('planned') ?? groups.find((group) => group.course) ?? groups[0])?.key ?? null;
}

// A course's facts for CourseFacts (tuition/TuitionParts): from one of its invoices (withCourses),
// else from its progress row.
export function courseFactsOf(group) {
    if (group.invoices[0]?.course) return group.invoices[0].course;
    const row = group.course;
    if (!row) return null;
    return {
        id: row.lesson_id,
        title: row.title,
        starts_on: row.starts_on,
        session_count: row.session_count,
        sessions_held: row.sessions_held,
        ends_on: row.ends_on,
        next_session: row.next_session,
        price: null,
        phase: row.status === 'planned' ? 'planned' : row.status === 'current' ? 'current' : 'done',
    };
}

// Members who have no invoice for the course yet (its renewal isn't open for them).
export const unbilledMembers = (cls, invoices) => {
    const billed = new Set(invoices.map((invoice) => invoice.student_id));
    return (cls.students ?? []).filter((row) => row.student && !billed.has(row.student.id));
};

// What a course costs in full: its own fee (class_lessons.price), else the class price.
export function coursePriceOf(cls, lessonId) {
    const lesson = (cls.lessons ?? []).find((row) => row.id === lessonId);
    return Number(lesson?.price ?? cls.price ?? 0);
}

// The next course's renewal, in plain facts for the class page:
//   open      its invoices exist (students can pay or answer)
//   due       when answers are due (the date most of its unpaid invoices share), or null
//   opensOn   the day it opens by itself ('yyyy-MM-dd'): the night after the running course's session
//             that leaves `openAt` sessions — null when it should open with tonight's check
//   opensIn   sessions until then (≤ 0: tonight)
// The session dates follow the weekly timetable from the next session (make-ups aren't known here).
export function renewalFacts(cls, current, next, invoices, openAt) {
    const open = invoices.length > 0;
    const due = typicalDueDate(invoices.filter((invoice) => invoice.status === 'unpaid'));
    if (open || !current) return { open, due, opensOn: null, opensIn: null };
    const left = Math.max(0, current.session_count - current.sessions_held);
    const opensIn = left - openAt;
    if (opensIn <= 0 || !current.next_session) return { open, due, opensOn: null, opensIn };
    const dates = sessionDates(cls, current.next_session, { count: opensIn });
    return { open, due, opensOn: dates.length === opensIn ? shiftIso(dates.at(-1), 1) : null, opensIn };
}
