import { supabase } from '@/lib/supabase';
import { extensionFor } from '@/lib/image';
import { toAppError, unwrap } from './errors';

// Chat with the studio (supabase/migrations/20261117001900_support_chat.sql, api-contract §5 Support chat).
// Signed-in students, room guests and instructors ask from the bubble; staff and admins answer from the Inbox.
//   * Hours (studio time, from support_status()): phase 'open' (08:00–21:45: new questions and messages),
//     'last_call' (21:45–22:00: only conversations already open go on), 'closed' (nobody writes, staff included;
//     at closing time open conversations get a 'paused' note and carry on in the morning).
//   * One open conversation per person. Thread status: 'open' | 'closing' (staff asked whether it's sorted) |
//     'closed' (for good; a new question is a new conversation). waiting_since: the person waits for the studio.
//   * Message: { id, thread_id, sender_kind: 'customer' | 'staff' | 'system' | 'ai', sender_id, sender_name,
//     body, image_path, event, created_at }. System messages have an `event` instead of text:
//     'joined' (someone took the conversation) | 'close_asked' | 'kept_open' | 'closed' | 'auto_closed' | 'paused'.
//   * Staff appear to the person by first name only ("Lê Hoàng Nam" → "Nam"): sender_name of staff messages and
//     notes, and the thread's assigned_name (who is helping). Staff pages keep full names (support_inbox).
//   * While nobody has taken it, the bubble counts down reply_minutes from the thread's waiting_since.
//   * Errors: SUPPORT_CLOSED (outside the hours: refresh the status), RATE_LIMITED (20 messages in 10 minutes).

export const SUPPORT_BUCKET = 'support-images';
export const MESSAGE_MAX = 2000;
const SIGNED_URL_SECONDS = 3600;

// Topics (English labels, translated where shown). Students and room guests pick from the first list,
// instructors from the second; the server checks the same lists.
export const CUSTOMER_TOPICS = [
    { key: 'booking', label: 'Room booking' },
    { key: 'classes', label: 'Classes & schedule' },
    { key: 'tuition', label: 'Tuition & payment' },
    { key: 'absence', label: 'Absence & make-up' },
    { key: 'account', label: 'Account' },
    { key: 'other', label: 'Something else' },
];
export const INSTRUCTOR_TOPICS = [
    { key: 'checkin', label: 'Check-in & hours' },
    { key: 'payroll', label: 'Pay' },
    { key: 'cover', label: 'Cover & time off' },
    { key: 'teaching', label: 'My classes & students' },
    { key: 'account', label: 'Account' },
    { key: 'other', label: 'Something else' },
];
export const TOPIC_LABELS = Object.fromEntries([...CUSTOMER_TOPICS, ...INSTRUCTOR_TOPICS].map((topic) => [topic.key, topic.label]));
export const topicsFor = (role) => (role === 'instructor' ? INSTRUCTOR_TOPICS : CUSTOMER_TOPICS);

// ---------------------------------------------------------------------------
// Everyone
// ---------------------------------------------------------------------------

// → { phase: 'open' | 'last_call' | 'closed', opens, last_start, closes ('HH:mm'), reply_minutes, now,
//     thread: { id, status, category, waiting_since, assigned_name } | null (signed in: the open conversation),
//     unread (signed in) | null }
export async function getSupportStatus() {
    return unwrap(await supabase.rpc('support_status'));
}

// ---------------------------------------------------------------------------
// Students, guests, instructors
// ---------------------------------------------------------------------------

// Their conversations (open one first): [{ id, category, status, created_at, last_message_at, closed_at,
// closed_by, unread, last_sender_kind, last_body, last_event, last_has_image }].
export async function listMyThreads() {
    return unwrap(await supabase.rpc('support_my_threads'));
}

// A new conversation with its first message → the thread row. SUPPORT_CLOSED after 21:45.
export async function startThread({ category, body, imagePath = null, openedFrom = null }) {
    return unwrap(
        await supabase.rpc('support_start', { p_category: category, p_body: body, p_image_path: imagePath, p_opened_from: openedFrom })
    );
}

// The studio asked whether it's sorted: true closes it for good, false keeps it open → the thread row.
export async function answerClose(threadId, resolved) {
    return unwrap(await supabase.rpc('support_answer_close', { p_thread: threadId, p_resolved: resolved }));
}

// ---------------------------------------------------------------------------
// Both sides
// ---------------------------------------------------------------------------

export async function getThread(threadId) {
    return unwrap(await supabase.from('support_threads').select('*').eq('id', threadId).maybeSingle());
}

export async function listMessages(threadId) {
    return unwrap(await supabase.from('support_messages').select('*').eq('thread_id', threadId).order('id'));
}

// Write in a conversation (text, a photo, or both) → the message row.
export async function sendMessage(threadId, { body = null, imagePath = null }) {
    return unwrap(await supabase.rpc('support_send', { p_thread: threadId, p_body: body, p_image_path: imagePath }));
}

// What's in the conversation now counts as read (by the person, or by the studio).
export async function markRead(threadId) {
    return unwrap(await supabase.rpc('support_mark_read', { p_thread: threadId }));
}

// A photo (already prepared with prepareImage()) for `customerId`'s conversation → its path.
export async function uploadSupportImage(customerId, file) {
    const path = `${customerId}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600' });
    if (error) throw toAppError(error);
    return path;
}

// { [path]: signedUrl } for chat photos.
export async function signSupportImages(paths) {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return {};
    const { data, error } = await supabase.storage.from(SUPPORT_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
    if (error) throw toAppError(error);
    return Object.fromEntries(data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
}

// Live updates of one conversation: new messages and changes to the thread (status, read marks). onReady runs
// once the channel has joined: refetch then, so nothing sent while it was joining is missed.
// Returns a function that stops listening. RLS decides what arrives.
export function subscribeToThread(threadId, { onMessage, onThread, onReady }) {
    const channel = supabase
        .channel(`support-thread-${threadId}-${crypto.randomUUID().slice(0, 8)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `thread_id=eq.${threadId}` }, (payload) =>
            onMessage?.(payload.new)
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_threads', filter: `id=eq.${threadId}` }, (payload) =>
            onThread?.(payload.new)
        )
        .subscribe((state) => {
            if (state === 'SUBSCRIBED') onReady?.();
        });
    return () => {
        supabase.removeChannel(channel);
    };
}

// "… is typing" between the person and the studio, live (Realtime broadcast on the conversation's channel; nothing is
// stored, and only the side travels — never a name: the reader already knows who is on the other side).
//   const typing = joinTyping(threadId, { side: 'staff', onTyping: ({ side }) => … });
//   typing.ping();   // call on every keystroke: sent at most every 2 s
//   typing.leave();  // on unmount
// The reader shows the indicator for TYPING_SHOWN_MS after the last ping, and drops it when a message from that
// side arrives.
export const TYPING_SHOWN_MS = 4000;
const TYPING_EVERY_MS = 2000;
export function joinTyping(threadId, { side, onTyping }) {
    const channel = supabase.channel(`support-typing-${threadId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.side && payload.side !== side) onTyping?.(payload);
    });
    channel.subscribe();
    let last = 0;
    return {
        ping() {
            const now = Date.now();
            if (now - last < TYPING_EVERY_MS) return;
            last = now;
            channel.send({ type: 'broadcast', event: 'typing', payload: { side } }).catch(() => {});
        },
        leave() {
            supabase.removeChannel(channel);
        },
    };
}

// ---------------------------------------------------------------------------
// Staff and admins
// ---------------------------------------------------------------------------

// tab: 'waiting' (longest first) | 'answered' (latest first) | 'closed' (latest 100); category narrows it.
// → [{ id, customer_id, customer_name, customer_role, customer_avatar, category, status, assigned_to,
//      assigned_name, waiting_since, last_message_at, created_at, closed_at, closed_by, opened_from, unread,
//      last_sender_kind, last_body, last_event, last_has_image }]
export async function listInbox(tab = 'waiting', category = null) {
    return unwrap(await supabase.rpc('support_inbox', { p_tab: tab, p_category: category }));
}

// → { waiting, oldest_waiting_since, mine, answered }
export async function getSupportCounts() {
    return unwrap(await supabase.rpc('support_counts'));
}

// Take a conversation (staffId null = yourself) or hand it to another staff member → the thread row.
export async function claimThread(threadId, staffId = null) {
    return unwrap(await supabase.rpc('support_claim', { p_thread: threadId, p_staff: staffId }));
}

// Ask the person whether it's sorted → the thread row (status 'closing').
export async function requestClose(threadId) {
    return unwrap(await supabase.rpc('support_request_close', { p_thread: threadId }));
}

// → { id, name, email, phone, role, avatar_path, joined, classes: [{ id, name, teaches }],
//     unpaid: { count, amount }, bookings: [{ id, date, start, end, room, status }], conversations }
export async function getCustomerCard(customerId) {
    return unwrap(await supabase.rpc('support_customer_card', { p_customer: customerId }));
}

// Any change in any conversation (the Inbox refreshes its list). Returns a function that stops listening.
export function subscribeToInbox(onChange) {
    const channel = supabase
        .channel(`support-inbox-${crypto.randomUUID().slice(0, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_threads' }, (payload) => onChange?.(payload))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => onChange?.(payload))
        .subscribe();
    return () => {
        supabase.removeChannel(channel);
    };
}
