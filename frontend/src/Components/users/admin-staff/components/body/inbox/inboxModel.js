import { TOPIC_LABELS } from '@/services/support';

// Pure helpers for the Inbox (/admin/inbox): tabs, how long someone has waited, what a row's last message
// says, and the words for system notes. Labels are English i18n keys.

export const INBOX_TABS = [
    { key: 'waiting', label: 'Waiting' },
    { key: 'answered', label: 'Answered' },
    { key: 'closed', label: 'Closed' },
];
export const TAB_KEYS = INBOX_TABS.map((tab) => tab.key);

// Every topic, students' and instructors' ('account' and 'other' are shared).
export const TOPIC_OPTIONS = Object.entries(TOPIC_LABELS).map(([key, label]) => ({ key, label }));
export const topicLabel = (key) => TOPIC_LABELS[key] ?? 'Something else';

// Waiting longer than this is urgent (the bell, the row's colour).
export const URGENT_MINUTES = 15;

export const minutesSince = (timestamp, now = Date.now()) => (timestamp ? Math.max(0, Math.floor((now - Date.parse(timestamp)) / 60000)) : 0);

// "25 min", "2 h 10 min", "3 days" (translated).
export function durationText(minutes, { t, tn }) {
    if (minutes < 1) return t('under a minute');
    if (minutes < 60) return tn(minutes, '{count} min', '{count} min');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        const rest = minutes % 60;
        return rest ? t('{hours} h {minutes} min', { hours, minutes: rest }) : t('{hours} h', { hours });
    }
    const days = Math.floor(hours / 24);
    return tn(days, '{count} day', '{count} days');
}

// A system note, as staff read it in the conversation. `customer` is the person asking.
export function eventText(message, customer, { t }) {
    switch (message.event) {
        case 'joined':
            return t('{name} joined the chat', { name: message.sender_name || t('The studio') });
        case 'close_asked':
            return t('{name} asked whether it’s sorted', { name: message.sender_name || t('The studio') });
        case 'kept_open':
            return t('{name} said it isn’t sorted yet', { name: customer });
        case 'closed':
            return t('{name} closed the chat', { name: customer });
        case 'auto_closed':
            return t('Closed by itself after 24 hours without an answer');
        case 'paused':
            return t('Paused for the night — the studio was closed');
        default:
            return '';
    }
}

// The same, short, for a row of the list.
const EVENT_SHORT = {
    joined: 'Joined the chat',
    close_asked: 'Asked whether it’s sorted',
    kept_open: 'Not sorted yet',
    closed: 'Closed the chat',
    auto_closed: 'Closed after 24 hours',
    paused: 'Paused for the night',
};

// The last message of a row: { who: 'customer' | 'studio' | 'note', text }.
export function previewOf(row, { t }) {
    if (row.last_event) return { who: 'note', text: t(EVENT_SHORT[row.last_event] ?? '') };
    const text = row.last_body || (row.last_has_image ? t('Sent a photo') : '');
    return { who: row.last_sender_kind === 'customer' ? 'customer' : 'studio', text };
}

// Where the conversation stands, for the header chip: { tone, text }.
export function statusOf(thread, now, i18n, customer) {
    const { t } = i18n;
    if (thread.status === 'closed') {
        return { tone: 'closed', text: thread.closed_by === 'system' ? t('Closed by itself') : t('Closed by {name}', { name: customer }) };
    }
    if (thread.status === 'closing') return { tone: 'closing', text: t('Asked to close') };
    if (thread.waiting_since) {
        const minutes = minutesSince(thread.waiting_since, now);
        return { tone: minutes > URGENT_MINUTES ? 'urgent' : 'waiting', text: t('Waiting {time}', { time: durationText(minutes, i18n) }) };
    }
    return { tone: 'answered', text: t('Answered') };
}

// Messages → [{ day: 'yyyy-MM-dd' (studio day), messages }].
const studioDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
export const studioDateOf = (timestamp) => studioDay.format(new Date(timestamp));

export function byDay(messages) {
    const days = [];
    for (const message of messages) {
        const day = studioDateOf(message.created_at);
        if (days.at(-1)?.day !== day) days.push({ day, messages: [] });
        days.at(-1).messages.push(message);
    }
    return days;
}

// Adds a message that arrived live (or after sending) unless it is already there.
export const withMessage = (list, message) => (list.some((item) => item.id === message.id) ? list : [...list, message].sort((a, b) => a.id - b.id));
