import { formatClock, formatTime, toMinutes } from '@/lib/format';
import { sessionTimes } from '../../../tasks/staffTasks';

// English labels (i18n keys) for a payslip's status.
export const STATUS_LABELS = { draft: 'Draft', finalized: 'Finalized', paid: 'Paid' };

// "tháng 11 năm 2026" → "Tháng 11 năm 2026" (a heading).
export const capitalizeFirst = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

// 'instructor' → 'Instructor' (the i18n key of a role name).
export const roleTitle = (role) => (role ? role[0].toUpperCase() + role.slice(1) : '');

// Check-ins more than this many minutes after the class start count as late.
export const LATE_GRACE_MINUTES = 5;

// Minutes an instructor checked in after the class started (0 if on time or unknown).
export function minutesLate(session) {
    if (!session.checkin_at) return 0;
    // A make-up session has its own times; a regular one follows the weekly schedule.
    const start = session.start_time ? formatTime(session.start_time) : sessionTimes(session.class, session.date).start;
    if (!start) return 0;
    const late = toMinutes(formatClock(session.checkin_at)) - toMinutes(start);
    return late > LATE_GRACE_MINUTES ? late : 0;
}
