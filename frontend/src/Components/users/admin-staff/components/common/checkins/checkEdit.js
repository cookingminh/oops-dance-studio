import { toMinutes } from '@/lib/format';

// Pure helpers of staff correcting a session's check-in / check-out (CheckEditor.jsx, services/checkins.js).
// Labels are English keys.

// Ready-made reasons (stored as the English key, shown translated); staff can type their own.
export const CHECK_REASONS = ['Forgot to check out', 'Forgot to check in', 'Wrong time', 'Kept back by the studio'];

// The reason that excuses a late check-out (picking it unmarks "late").
export const EXCUSED_REASON = 'Kept back by the studio';

// The reason to start with: a missing check-out / check-in was forgotten, a time already there was wrong.
export function defaultReason(which, row) {
    if (which === 'out' && !row?.checkout_at) return 'Forgot to check out';
    if (which === 'in' && !row?.checkin_at) return 'Forgot to check in';
    return 'Wrong time';
}

// A clock time as typed: digits only become "HH:mm" ("1930" → "19:30"), a typed colon is kept ("9:30").
export function typeClock(text) {
    const raw = String(text ?? '');
    if (raw.includes(':')) {
        const [hours, minutes = ''] = raw.split(':');
        return `${hours.replace(/\D/g, '').slice(-2)}:${minutes.replace(/\D/g, '').slice(0, 2)}`;
    }
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// On leaving the field: "9:30" → "09:30", "19" → "19:00".
export function tidyClock(text) {
    const value = typeClock(text);
    if (!value) return '';
    const [hours, minutes = ''] = value.includes(':') ? value.split(':') : [value, ''];
    return `${hours.padStart(2, '0')}:${(minutes || '00').padEnd(2, '0')}`;
}

export const isClock = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '');

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

// What is wrong (English key, or ''): times like 19:30, the check-out after the check-in, and a reason.
export function checkFormProblem({ checkin, checkout, reason }) {
    if (!isClock(checkin)) return 'Enter the check-in time, like 18:15.';
    if (checkout && !isClock(checkout)) return 'Enter the check-out time, like 19:30.';
    if (checkout && toMinutes(checkout) <= toMinutes(checkin)) return 'The check-out comes after the check-in.';
    if (!reason.trim()) return 'Say why the times change.';
    return '';
}
