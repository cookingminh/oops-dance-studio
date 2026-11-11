import { toMinutes } from '@/lib/format';

// Pure helpers of the staff "Edit check-in/out times" dialog (services/checkins.js). Labels are English keys.

// Ready-made reasons (stored as the English key, shown translated); staff can type their own.
export const CHECK_REASONS = ['Forgot to check out', 'Forgot to check in', 'Wrong time', 'Kept back by the studio'];

// The late mark: worked out from the times (null), or staff decide.
export const LATE_CHOICES = [
    { key: 'auto', label: 'Auto', value: null },
    { key: 'late', label: 'Mark late', value: true },
    { key: 'ontime', label: 'Not late', value: false },
];

// A reason picked from CHECK_REASONS shows in the reader's language; one staff typed shows as written.
export const checkReasonText = (reason, t) => (reason && CHECK_REASONS.includes(reason) ? t(reason) : reason ?? '');

// What to store: a ready-made reason (as shown in this language) goes back to its key.
export function checkReasonToSave(text, t) {
    const typed = String(text ?? '').trim();
    return CHECK_REASONS.find((key) => t(key) === typed) ?? typed;
}

// Late by the times: a check-out more than 10 minutes after the session's end ('HH:mm' both), as the
// server works it out; null when either time is missing.
export function lateByTimes(checkout, end, graceMinutes = 10) {
    if (!checkout || !end) return null;
    return toMinutes(checkout) > toMinutes(end) + graceMinutes;
}

// What is wrong with the form (English key, or ''): a check-in time is needed, the check-out comes after
// it, and a reason.
export function checkFormProblem({ checkin, checkout, reason }) {
    if (!checkin) return 'Enter the check-in time.';
    if (checkout && toMinutes(checkout) <= toMinutes(checkin)) return 'The check-out comes after the check-in.';
    if (!reason.trim()) return 'Say why the times change.';
    return '';
}
