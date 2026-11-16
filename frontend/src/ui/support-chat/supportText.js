import { TOPIC_LABELS } from '@/services/support';

// Words for the chat bubble and panel (English keys; Vietnamese in i18n/vi/supportChat.js).

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// timestamptz → 'yyyy-MM-dd' in studio time (a message sent at 00:30 belongs to that day, not to UTC's).
export const studioDay = (timestamp) => dayKeyFormat.format(new Date(timestamp));

// "Today" / "Yesterday" / "Monday 16 November".
export function dayLabel(i18n, timestamp) {
    const day = studioDay(timestamp);
    const today = studioDay(Date.now());
    const yesterday = studioDay(Date.now() - 86_400_000);
    if (day === today) return i18n.t('Today');
    if (day === yesterday) return i18n.t('Yesterday');
    return i18n.formatDate(day, 'long');
}

export const isOnline = (status) => Boolean(status) && status.phase !== 'closed';

// "08:00–22:00" never breaks across lines (word joiners around the dash).
const keepRanges = (text) => text.replace(/(\d)–(\d)/g, '$1⁠–⁠$2');

// The line under "Oops! Studio" in the panel's header.
export function statusLine(t, status) {
    if (!status) return '';
    const vars = { opens: status.opens, last_start: status.last_start, closes: status.closes };
    if (status.phase === 'open') return keepRanges(t('Online · {opens}–{closes}', vars));
    if (status.phase === 'last_call') return t('New questions until {last_start} · open chats until {closes}', vars);
    return t('Offline · back at {opens}', vars);
}

// A system message, from the reader's side (the person who asked). `name`: who it's about (a staff member's
// first name for 'joined').
export function eventText(t, event, status, name) {
    switch (event) {
        case 'joined':
            return name ? t('{name} has joined the chat.', { name }) : t('Someone from the studio has joined the chat.');
        case 'close_asked':
            return t('The studio asked whether everything is sorted.');
        case 'kept_open':
            return t('You said it isn’t sorted yet.');
        case 'closed':
            return t('You closed this chat.');
        case 'auto_closed':
            return t('This chat closed after 24 hours without an answer.');
        case 'paused':
            return t('The studio is closed for tonight. If this isn’t sorted yet, staff will carry on from {opens}.', {
                opens: status?.opens ?? '08:00',
            });
        default:
            return '';
    }
}

// The chip next to the topic: closed, asked to close, who is helping, or still waiting for someone.
export function threadState(t, thread) {
    if (thread.status === 'closed') return { tone: 'closed', text: t('Chat closed') };
    if (thread.status === 'closing') return { tone: 'closing', text: t('Is it sorted?') };
    if (thread.assigned_name) return { tone: 'open', text: t('{name} is helping you', { name: thread.assigned_name }) };
    return { tone: 'waiting', text: t('Waiting for staff') };
}

// 272 000 ms → "4:32".
export function countdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Who wrote a message on the studio's side.
export function senderLabel(t, message) {
    if (message.sender_kind === 'ai') return t('Assistant');
    return message.sender_name ? t('{name} · Oops! Studio', { name: message.sender_name }) : 'Oops! Studio';
}

export const topicLabel = (t, key) => t(TOPIC_LABELS[key] ?? 'Something else');

// The last line of a conversation in "Past chats".
export function previewText(t, item, status) {
    if (item.last_body) return item.last_body;
    if (item.last_has_image) return t('Sent a photo');
    return eventText(t, item.last_event, status);
}
