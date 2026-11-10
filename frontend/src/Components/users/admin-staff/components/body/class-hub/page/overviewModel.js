import { missingVideo, monthSessions, routineNow, sessionState } from '../hubModel';

// The class's to-do list for the Overview tab. Each { id, key, vars?, tone: 'urgent' | 'normal',
// tab, params? } — key is the English text (render t(key, vars)), tab where it's done.
export function classTodos({ cls, today, now, month, sessions, roll, progress, overdue }) {
    const todos = [];
    const list = monthSessions(cls, month, sessions);

    // Sessions nobody closed (no check-in / check-out), oldest first.
    for (const session of list) {
        if (session.date > today) continue;
        if (sessionState(session, today, now).kind === 'review') {
            todos.push({ id: `review-${session.date}`, key: 'Review the check-in of {date}', vars: { date: session.date }, tone: 'urgent', tab: 'sessions', params: { day: session.date } });
        }
    }

    // Roll calls left unmarked after the session ended.
    const unmarked = new Map();
    for (const row of roll) {
        if (row.status !== 'pending' || row.date > today) continue;
        const session = list.find((item) => item.date === row.date);
        if (row.date === today && session?.end && now < session.end) continue;
        unmarked.set(row.date, (unmarked.get(row.date) ?? 0) + 1);
    }
    for (const [date, count] of unmarked) {
        todos.push({ id: `roll-${date}`, key: count === 1 ? 'Finish the roll call of {date}: {count} student unmarked' : 'Finish the roll call of {date}: {count} students unmarked', vars: { date, count }, tone: 'urgent', tab: 'sessions', params: { day: date } });
    }

    if (overdue > 0) {
        todos.push({ id: 'unpaid', key: overdue === 1 ? '{count} student hasn’t paid this course' : '{count} students haven’t paid this course', vars: { count: overdue }, tone: 'normal', tab: 'tuition' });
    }

    const routine = routineNow(progress);
    if (!(cls.schedules ?? []).length) todos.push({ id: 'slots', key: 'Add the weekly sessions', tone: 'normal', tab: 'setup' });
    if (!routine.current && !routine.planned) {
        todos.push({ id: 'routine', key: 'Plan a routine (the course students pay for)', tone: 'normal', tab: 'routines' });
    } else if (routine.current && !routine.planned && routine.current.session_count - routine.current.sessions_held <= 2) {
        todos.push({ id: 'next', key: 'Plan the next routine: this one ends soon', tone: 'normal', tab: 'routines' });
    }
    const video = missingVideo(cls, progress, today);
    if (video) todos.push({ id: 'video', key: 'Add the video of “{title}”', vars: { title: video.title }, tone: 'normal', tab: 'routines' });
    return todos;
}
