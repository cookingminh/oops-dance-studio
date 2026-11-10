import { LuAlertTriangle, LuArrowRightLeft, LuCheck, LuClock, LuGift, LuMinusCircle, LuPieChart } from 'react-icons/lu';
import { amountDue, invoiceState } from '@/services/tuition';
import { splitSong } from '@/lib/lessons';
import { isSwitchedAway } from '../../../../../admin-staff/components/common/switch-class/switchNotes';
import { courseFacts, joinedLate } from '../../../../../admin-staff/components/body/tuition/tuitionModel';

export { joinedLate };

// Pure helpers for the student's tuition views (the page, the overview card, the class line).
// Tuition is per COURSE (khoá): one invoice per course, a course being one routine of N sessions.
// `today` is the studio's 'yyyy-MM-dd'.

const byClass = (a, b) => a.class_name.localeCompare(b.class_name, 'vi');
const byStart = (a, b) => a.course.starts_on.localeCompare(b.course.starts_on);
// Cancelled and moved courses go after the live ones (they're just a note).
const liveFirst = (a, b) => Number(a.status === 'void') - Number(b.status === 'void');
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

// What ClassThumb needs; the class may have been deleted (the invoice keeps its name).
export const invoiceClass = (invoice) => ({ id: invoice.class_id ?? invoice.id, name: invoice.class_name, image_path: invoice.class?.image_path ?? null });

// "Super Shy — NewJeans" → "Super Shy", for short labels (buttons). Course titles are data.
export const songOf = (title) => splitSong(title).song || title || '';

// The server's rules (tuition_set_renewal / private.reinstate), so buttons only show when they work.
const isOpenCourse = (invoice) => invoice.course?.phase !== 'done';
export const canStop = (invoice) => invoice.status === 'unpaid' && Number(invoice.paid_amount) === 0 && isOpenCourse(invoice);
export const canRejoin = (invoice) =>
    invoice.status === 'void' && ['stopped', 'not_renewed'].includes(invoice.void_reason) && isOpenCourse(invoice) && invoice.class_id != null;
export const needsAnswer = (invoice) => invoice.status === 'unpaid' && !invoice.renewal && isOpenCourse(invoice);

// Splits the student's tuition (loadMyTuition's data) into what the page shows:
//   current   courses running now, plus finished ones still unpaid (shown first)
//   upcoming  courses that haven't started: the renewal (continue or stop?), soonest first
//   history   finished courses that are settled (paid, waived or cancelled), newest first
//   gaps      classes they're in with no course running or billed (the studio is planning the next one)
//   places    Map(class id → { joined_at, leaves_after }) — leaves_after: they leave after that day
//   toPay / overdue / left / dueBy   what is owed now (running and finished courses)
//   paidThisYear                      money paid on courses starting this year
//   all                               every invoice (to name the other class of a class switch)
// Each invoice comes back with `course` (courseFacts) and, for a course that hasn't started, `previous`:
// the title of the class's course before it (the one they finish first).
export function arrangeTuition({ invoices = [], today, progress = [], enrolments = [] }) {
    const progressById = new Map(progress.map((row) => [row.lesson_id, row]));
    const all = invoices.map((invoice) => ({ ...invoice, course: courseFacts(invoice, progressById.get(invoice.lesson_id), today) }));
    for (const invoice of all) {
        if (invoice.course.phase !== 'planned') continue;
        const before = progress
            .filter((row) => row.class_id === invoice.class_id && row.starts_on < invoice.course.starts_on)
            .sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
        invoice.previous = before?.title ?? null;
    }

    const current = all
        .filter((invoice) => invoice.course.phase === 'current' || (invoice.course.phase === 'done' && invoice.status === 'unpaid'))
        .sort((a, b) => Number(b.course.phase === 'done') - Number(a.course.phase === 'done') || liveFirst(a, b) || byClass(a, b));
    const upcoming = all.filter((invoice) => invoice.course.phase === 'planned').sort((a, b) => byStart(a, b) || byClass(a, b));
    const history = all
        .filter((invoice) => invoice.course.phase === 'done' && invoice.status !== 'unpaid')
        .sort((a, b) => byStart(b, a) || byClass(a, b));
    const toPay = current.filter((invoice) => invoice.status === 'unpaid');
    const overdue = toPay.filter((invoice) => invoice.due_date < today);
    const year = today.slice(0, 4);

    // A class they're in with nothing running or billed: say so instead of leaving it out.
    const billed = new Set([...current, ...upcoming].filter((invoice) => invoice.status !== 'void').map((invoice) => invoice.class_id));
    const gaps = enrolments
        .filter((place) => !billed.has(place.class_id) && place.joined_at <= today)
        .map((place) => {
            const known = all.find((invoice) => invoice.class_id === place.class_id);
            const next = progress
                .filter((row) => row.class_id === place.class_id && row.status === 'planned')
                .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
            return known ? { classId: place.class_id, name: known.class_name, image_path: known.class?.image_path ?? null, next: next ?? null } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return {
        current,
        live: current.filter((invoice) => invoice.status !== 'void'),
        upcoming,
        history,
        gaps,
        places: new Map(enrolments.map((place) => [place.class_id, place])),
        toPay,
        overdue,
        left: sum(toPay, amountDue),
        dueBy: toPay.map((invoice) => invoice.due_date).sort()[0] ?? null,
        paidThisYear: sum(
            all.filter((invoice) => invoice.course.starts_on.startsWith(year)),
            (invoice) => Number(invoice.paid_amount),
        ),
        year,
        all,
    };
}

// timestamptz → the studio's calendar date ('yyyy-MM-dd'), e.g. when an invoice was paid.
const STUDIO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
export const studioDay = (timestamp) => (timestamp ? STUDIO_DAY.format(new Date(timestamp)) : null);

// Headline and a friendly line for the page and the overview (English keys, translated here).
//   tone  'good' | 'due' | 'late'
export function tuitionHeadline(view, settings, { t, tn, formatDate }) {
    if (view.overdue.length) {
        return {
            tone: 'late',
            title: tn(view.overdue.length, '{count} course is overdue', '{count} courses are overdue'),
            text: t('No stress: scan the QR code and it’s sorted in seconds.'),
        };
    }
    if (view.toPay.length) {
        return {
            tone: 'due',
            title: tn(view.toPay.length, '{count} course to pay by {date}', '{count} courses to pay by {date}', { date: formatDate(view.dueBy, 'dayMonth') }),
            text: t('Scan the QR code in your banking app. We’ll see it within seconds.'),
        };
    }
    const title = view.live.length ? t('All paid up 🎉') : t('Nothing to pay right now');
    const next = view.upcoming.filter((invoice) => invoice.status !== 'void');
    if (!next.length) {
        const running = view.live[0];
        const sessions = settings?.renewal_open_sessions ?? 2;
        if (!running) return { tone: 'good', title, text: t('Your next course shows up here as soon as the studio plans it.') };
        return {
            tone: 'good',
            title,
            text: tn(sessions, 'Your next course opens for renewal when {course} has {count} session left.', 'Your next course opens for renewal when {course} has {count} sessions left.', {
                course: songOf(running.course.title),
            }),
        };
    }
    const open = next.filter((invoice) => invoice.status === 'unpaid');
    const first = open.find((invoice) => !invoice.renewal) ?? open[0] ?? next[0];
    const vars = { course: songOf(first.course.title), date: formatDate(first.due_date, 'dayMonth') };
    if (open.some((invoice) => !invoice.renewal)) return { tone: 'good', title, text: t('Next: tell us about {course} by {date}.', vars) };
    if (open.length) return { tone: 'good', title, text: t('{course} is open: pay by {date} whenever you’re ready.', vars) };
    return { tone: 'good', title, text: t('{course} is sorted too. You’re all set!', vars) };
}

// The invoice the student would pay first: overdue before due, oldest first.
export const firstToPay = (toPay) => [...toPay].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;

const VOID_LABELS = { stopped: 'Stopped', not_renewed: 'Not renewed', removed: 'Left the class', switched: 'Moved', class_ended: 'Class ended' };

// How an invoice reads as a chip. `key` is English source text with {placeholders}.
//   tone  'good' | 'due' | 'late' | 'calm' | 'muted'
export function statusOf(invoice, today) {
    const state = invoiceState(invoice, today);
    switch (state) {
        case 'paid':
            return { state, key: 'Paid', tone: 'good', icon: LuCheck };
        case 'waived':
            return { state, key: 'Waived', tone: 'calm', icon: LuGift };
        case 'void':
            // A class switch reads calmly: the place (and the money) moved, nothing was lost.
            if (isSwitchedAway(invoice)) return { state, key: VOID_LABELS.switched, tone: 'muted', icon: LuArrowRightLeft };
            return { state, key: VOID_LABELS[invoice.void_reason] ?? 'Cancelled', tone: 'muted', icon: LuMinusCircle };
        case 'overdue':
            return { state, key: 'Overdue', tone: 'late', icon: LuAlertTriangle };
        case 'partial':
            return { state, key: 'Part paid', tone: 'due', icon: LuPieChart };
        default:
            return { state, key: 'Due by {date}', tone: 'due', icon: LuClock, vars: { date: invoice.due_date } };
    }
}
