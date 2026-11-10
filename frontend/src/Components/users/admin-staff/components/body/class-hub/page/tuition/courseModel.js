import { tuitionOf } from '../../hubModel';

// Tuition per course for the class page. A course is a routine (lesson_progress row); invoices
// carry `lesson_id`. Pure helpers, labels are English i18n keys.

export const COURSE_STATUS = {
    current: { label: 'Running', tone: 'good' },
    planned: { label: 'Planned', tone: 'live' },
    done: { label: 'Finished', tone: 'muted' },
    stopped: { label: 'Stopped', tone: 'muted' },
};

// Courses newest first, each with its invoices and money: [{ course, invoices, sums, open }].
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
