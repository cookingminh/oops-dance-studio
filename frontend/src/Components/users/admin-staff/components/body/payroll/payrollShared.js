import { formatClock, formatTime, formatVnd, toMinutes } from '@/lib/format';
import { sessionTimes } from '../../../tasks/staffTasks';
import { sessionTimes as plannedTimes } from '../class-hub/hubModel';
import { classColor, sessionState } from '../../common/session-modal/sessionModel';

// English labels (i18n keys) for a payslip's status.
export const STATUS_LABELS = { draft: 'Draft', finalized: 'Finalized', paid: 'Paid' };

// "tháng 11 năm 2026" → "Tháng 11 năm 2026" (a heading).
export const capitalizeFirst = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

// 'instructor' → 'Instructor' (the i18n key of a role name).
export const roleTitle = (role) => (role ? role[0].toUpperCase() + role.slice(1) : '');

// Check-ins more than this many minutes after the class start count as late.
export const LATE_GRACE_MINUTES = 5;

// Why a session isn't paid, by its status (English i18n keys; "Not counted · {why}").
export const NOT_COUNTED = { pending: 'not checked in', waiting: 'not checked in', in_progress: 'not checked out', cancelled: 'cancelled' };

// Minutes an instructor checked in after the class started (0 if on time or unknown).
export function minutesLate(session) {
    if (!session.checkin_at) return 0;
    // A make-up session has its own times; a regular one follows the weekly schedule.
    const start = session.start_time ? formatTime(session.start_time) : sessionTimes(session.class, session.date).start;
    if (!start) return 0;
    const late = toMinutes(formatClock(session.checkin_at)) - toMinutes(start);
    return late > LATE_GRACE_MINUTES ? late : 0;
}

// Completed sessions per class, in the order they first appear: the payslip's lines
// ("K-pop Cover · 6 × 300.000 ₫") and the calendar's legend. [{ id, name, n, rate, total }]
export function payByClass(counted, rateOf) {
    const lines = new Map();
    for (const session of counted) {
        const line = lines.get(session.class_id) ?? { id: session.class_id, name: session.class?.name, n: 0, rate: rateOf(session), total: 0 };
        line.n += 1;
        line.total = line.n * line.rate;
        lines.set(session.class_id, line);
    }
    return [...lines.values()];
}

// How a payslip session shows on the calendar, by the shared session states:
// paid (solid), not counted (muted: cancelled, never checked in / out) or not counted yet (dashed:
// later today or later this month).
function paidStateOf(session, cls, today, now) {
    const { start, end } = plannedTimes(cls, session.date, session);
    const kind = sessionState({ row: session, date: session.date, start, end }, today, now).kind;
    if (kind === 'done') return 'paid';
    if (kind === 'live' || kind === 'soon' || kind === 'planned') return 'later';
    return 'off';
}

const TONES = { paid: 'solid', off: 'muted', later: 'dashed' };

// One payslip session (an instructor_attendance row of `profileId`) as a <CalendarView> item: the
// class colour, the check-in → check-out times when it was paid (else the timetable's), the pay
// or why it isn't counted, and make-up / substitute / late badges. `data` is the row.
export function payslipItem(session, { cls, profileId, rate, today, now, t }) {
    const planned = plannedTimes(cls, session.date, session);
    const paidState = paidStateOf(session, cls, today, now);
    const actual = paidState === 'paid' && session.checkin_at && session.checkout_at;
    const late = minutesLate(session);
    let subtitle = formatVnd(rate);
    if (paidState === 'off') subtitle = t('Not counted · {why}', { why: t(NOT_COUNTED[session.status] ?? 'not checked in') });
    if (paidState === 'later') subtitle = t('Not counted yet');
    const badges = [
        session.is_extra && t('Make-up'),
        cls.instructor_id && cls.instructor_id !== profileId && t('Substitute'),
        late > 0 && t('{minutes} min late', { minutes: late }),
    ].filter(Boolean);
    return {
        id: session.id,
        date: session.date,
        start: actual ? formatClock(session.checkin_at) : planned.start || '08:00',
        end: actual ? formatClock(session.checkout_at) : planned.end || planned.start || '09:00',
        title: cls.name,
        subtitle,
        color: classColor(session.class_id),
        status: session.status,
        statusLabel: '',
        tone: TONES[paidState],
        badge: badges.length ? badges.join(' · ') : undefined,
        data: session,
    };
}
