// Pure helpers for join requests on the staff side (the Join requests page, the class hub's block, the bell).
// Labels are English i18n keys: components render t(key, vars).

export const JOIN_PAGE = '/admin/join-requests';

// A request waiting longer than this is late: an amber tag on the page, an urgent task in the bell.
export const LATE_HOURS = 24;

export const TABS = [
    { key: 'waiting', label: 'Waiting' },
    { key: 'answered', label: 'Answered' },
];

// What the student asked for (class_join_requests.start_pref).
export const START_LABELS = {
    now: 'From the running course',
    next: 'From the next course',
};

// The same, as what they want (the approve dialog, the activity feed).
export const START_ASKED = {
    now: 'Wants to start now',
    next: 'Wants to start from the next course',
};

// How an answered request ended, as a pill.
export const STATUS = {
    approved: { label: 'Approved', tone: 'good' },
    declined: { label: 'Declined', tone: 'alert' },
    // The student cancelled it (decided_by is then the student: not shown as who answered).
    cancelled: { label: 'Cancelled by the student', tone: 'muted' },
};

// Quick reasons for a decline (the student reads the one picked, in the words staff see).
export const DECLINE_REASONS = ['The class is full', 'This level may not suit you yet. Try a newbie class', 'The time slot changed'];
export const REASON_MAX = 300;

export const hoursSince = (timestamp, now = Date.now()) => (timestamp ? Math.max(0, (now - Date.parse(timestamp)) / 3_600_000) : 0);
export const isLate = (request, now) => request.status === 'pending' && hoursSince(request.created_at, now) > LATE_HOURS;

// "just now", "25 min ago", "3 hours ago", "2 days ago" — how long ago something happened (translated).
export function agoText(timestamp, { t, tn }, now = Date.now()) {
    const minutes = Math.floor(hoursSince(timestamp, now) * 60);
    if (minutes < 1) return t('just now');
    if (minutes < 60) return tn(minutes, '{count} min ago', '{count} min ago');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return tn(hours, '{count} hour ago', '{count} hours ago');
    return tn(Math.floor(hours / 24), '{count} day ago', '{count} days ago');
}

// When a request was made, beside its other facts: "Asked 3 hours ago" within a day, then "Asked Thu 19 Nov"
// (a late request already says how long it has waited).
export function askedText(timestamp, i18n, now = Date.now()) {
    const hours = hoursSince(timestamp, now);
    if (hours < 1 / 60) return i18n.t('Asked just now');
    if (hours < 24) return i18n.t('Asked {time}', { time: agoText(timestamp, i18n, now) });
    return i18n.t('Asked {date}', { date: i18n.formatDate(studioDateOf(timestamp), 'short') });
}

// timestamptz → the studio's calendar date 'yyyy-MM-dd'.
const studioDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
export const studioDateOf = (timestamp) => studioDay.format(new Date(timestamp));

// "Waiting 2 days" for a request past LATE_HOURS (translated).
export const lateText = (request, { tn }, now = Date.now()) => {
    const days = Math.max(1, Math.floor(hoursSince(request.created_at, now) / 24));
    return tn(days, 'Waiting {count} day', 'Waiting {count} days');
};

export const personName = (person) => person?.full_name || person?.username || person?.email || '';

// The waiting requests per class id → count.
export function countByClass(requests = []) {
    const counts = new Map();
    for (const request of requests) counts.set(request.class_id, (counts.get(request.class_id) ?? 0) + 1);
    return counts;
}
