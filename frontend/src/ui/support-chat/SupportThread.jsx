import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuCheck, LuCheckCheck, LuLoader2, LuMessageSquarePlus, LuSparkles } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { formatClock } from '@/lib/format';
import {
    TYPING_SHOWN_MS,
    answerClose,
    getThread,
    joinTyping,
    listMessages,
    markRead,
    sendMessage,
    signSupportImages,
    subscribeToThread,
    uploadSupportImage,
} from '@/services/support';
import SupportCelebration from './SupportCelebration';
import SupportComposer from './SupportComposer';
import SupportWaiting from './SupportWaiting';
import { dayLabel, eventText, initialOf, senderLabel, studioDay, threadState, topicLabel, typingText } from './supportText';

const REFETCH_MS = 30_000; // in case Realtime is down
const GROUP_WITHIN_MS = 5 * 60_000; // messages from the same person this close together form one group
const SPRING = { type: 'spring', stiffness: 420, damping: 30 };

const byId = (a, b) => a.id - b.id;
const kindOf = (message) => (message.sender_kind === 'customer' ? 'customer' : message.sender_kind === 'system' ? 'system' : 'staff');
const sameGroup = (a, b) =>
    Boolean(a && b) &&
    kindOf(a) !== 'system' &&
    kindOf(a) === kindOf(b) &&
    a.sender_id === b.sender_id &&
    studioDay(a.created_at) === studioDay(b.created_at) &&
    Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < GROUP_WITHIN_MS;

// A staff member's squircle with their initial (the assistant gets a spark).
const Avatar = ({ message, small = false, pop = false }) => (
    <motion.span
        className={`supportAvatar${small ? ' isSmall' : ''}${message?.sender_kind === 'ai' ? ' isAi' : ''}`}
        aria-hidden="true"
        initial={pop ? { scale: 0, rotate: -20 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 18 }}
    >
        {message?.sender_kind === 'ai' ? <LuSparkles /> : initialOf(message?.sender_name)}
    </motion.span>
);

// One conversation, as the person who asked sees it: the messages (live), who is helping and whether they read
// it, "… is typing", "Is everything sorted?" when the studio asks, and the text box while the chat is open and
// the studio is answering. Messages that arrive after the first load spring in from their side.
const SupportThread = ({ threadId, status, userId, onChanged, onNewQuestion }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const toast = useToast();
    const [thread, setThread] = useState(null);
    const [messages, setMessages] = useState(null);
    const [urls, setUrls] = useState({});
    const [failed, setFailed] = useState(false);
    const [draft, setDraft] = useState('');
    const [answering, setAnswering] = useState(null); // true | false while the answer is on its way
    const [celebrating, setCelebrating] = useState(false);
    const [typingAt, setTypingAt] = useState(0); // the studio's last "typing" ping
    const listRef = useRef(null);
    const firstIds = useRef(null); // the messages of the first load: they don't animate in one by one
    const typingRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const [row, rows] = await Promise.all([getThread(threadId), listMessages(threadId)]);
            setThread(row);
            setMessages(rows ?? []);
            if (!firstIds.current) firstIds.current = new Set((rows ?? []).map((message) => message.id));
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, [threadId]);

    useEffect(() => {
        setThread(null);
        setMessages(null);
        firstIds.current = null;
        load();
        const timer = setInterval(load, REFETCH_MS);
        return () => clearInterval(timer);
    }, [load]);

    useEffect(
        () =>
            subscribeToThread(threadId, {
                onMessage: (message) => {
                    if (message.sender_kind === 'staff' || message.sender_kind === 'ai') setTypingAt(0);
                    setMessages((list) => (list && !list.some((item) => item.id === message.id) ? [...list, message].sort(byId) : list));
                },
                onThread: (row) => setThread((current) => (current ? { ...current, ...row } : row)),
                // Joined: once more, so a reply sent while the channel was joining isn't missed.
                onReady: load,
            }),
        [threadId, load]
    );

    // "… is typing", both ways, while the chat is open.
    const mine = thread?.customer_id === userId;
    const live = Boolean(thread) && thread.status !== 'closed' && mine;
    useEffect(() => {
        if (!live) return undefined;
        const channel = joinTyping(threadId, { side: 'customer', onTyping: () => setTypingAt(Date.now()) });
        typingRef.current = channel;
        return () => {
            channel.leave();
            typingRef.current = null;
        };
    }, [threadId, live]);
    useEffect(() => {
        if (!typingAt) return undefined;
        const timer = setTimeout(() => setTypingAt(0), TYPING_SHOWN_MS);
        return () => clearTimeout(timer);
    }, [typingAt]);

    // A studio reply on screen counts as read (also one arriving while the chat is open).
    const lastFromStudio = useMemo(() => {
        const list = messages ?? [];
        for (let index = list.length - 1; index >= 0; index -= 1) {
            if (list[index].sender_kind !== 'customer') return list[index].id;
        }
        return null;
    }, [messages]);
    useEffect(() => {
        if (!mine || lastFromStudio == null) return;
        markRead(threadId)
            .then(() => onChanged())
            .catch(() => {});
    }, [mine, lastFromStudio, threadId, onChanged]);

    // Photos: signed links for the ones not signed yet.
    useEffect(() => {
        const missing = (messages ?? []).map((message) => message.image_path).filter((path) => path && !urls[path]);
        if (missing.length === 0) return;
        signSupportImages(missing)
            .then((signed) => setUrls((current) => ({ ...current, ...signed })))
            .catch(() => {});
    }, [messages, urls]);

    // Keep the newest message (or the typing dots) in view.
    const typing = Boolean(typingAt) && Boolean(thread) && thread.status !== 'closed';
    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages?.length, thread?.status, typing]);

    const send = async ({ body, file }) => {
        try {
            const imagePath = file ? await uploadSupportImage(thread.customer_id, file) : null;
            const message = await sendMessage(threadId, { body, imagePath });
            setMessages((list) => (list.some((item) => item.id === message.id) ? list : [...list, message].sort(byId)));
            load();
            onChanged();
            return true;
        } catch (error) {
            toast.error(error);
            if (error?.code === 'SUPPORT_CLOSED' || error?.code === 'INVALID_STATE') {
                onChanged();
                load();
            }
            return false;
        }
    };

    const answer = async (resolved) => {
        setAnswering(resolved);
        try {
            setThread(await answerClose(threadId, resolved));
            if (resolved) setCelebrating(true);
            await load();
            onChanged();
        } catch (error) {
            toast.error(error);
            load();
        } finally {
            setAnswering(null);
        }
    };
    const stopCelebrating = useCallback(() => setCelebrating(false), []);

    if (failed && !messages) {
        return (
            <div className="supportBody">
                <p className="supportEmpty">{t('This chat couldn’t be loaded. Check your connection and try again.')}</p>
            </div>
        );
    }
    if (!thread || !messages) {
        return (
            <div className="supportBody supportLoading" aria-busy="true">
                <LuLoader2 className="supportSpin" aria-hidden="true" />
            </div>
        );
    }

    const closed = thread.status === 'closed';
    const phase = status?.phase ?? 'open';
    const state = threadState(t, thread);
    // Nobody from the studio has taken it yet: count down to the usual answer time (not at night).
    const waitingForSomeone = !closed && !thread.assigned_to && Boolean(thread.waiting_since) && phase !== 'closed';
    // The person's latest message gets "Sent" / "Seen" (the studio opened the chat after it).
    const lastMineId = [...messages].reverse().find((message) => message.sender_kind === 'customer')?.id ?? null;
    const seen = (message) => Boolean(thread.staff_read_at) && Date.parse(thread.staff_read_at) >= Date.parse(message.created_at);
    const fresh = (message) => Boolean(firstIds.current) && !firstIds.current.has(message.id);

    return (
        <>
            <div className="supportThreadBar">
                <span className="supportThreadTopic">{topicLabel(t, thread.category)}</span>
                <span className="supportThreadWho">
                    {thread.assigned_name && !closed && <Avatar key={thread.assigned_name} message={{ sender_name: thread.assigned_name }} small pop />}
                    <span className={`supportState is-${state.tone}`}>{state.text}</span>
                </span>
            </div>
            <div className="supportBody supportThread" ref={listRef}>
                <ol className="supportMessages" role="log" aria-live="polite" aria-label={t('Messages')}>
                    {messages.map((message, index) => {
                        const previous = messages[index - 1];
                        const next = messages[index + 1];
                        const newDay = !previous || studioDay(previous.created_at) !== studioDay(message.created_at);
                        const kind = kindOf(message);
                        const groupStart = newDay || !sameGroup(previous, message);
                        const groupEnd = !sameGroup(message, next);
                        const isFresh = fresh(message);
                        const mineLast = message.id === lastMineId;
                        return (
                            <Fragment key={message.id}>
                                {newDay && (
                                    <li className="supportDay" aria-hidden="true">
                                        <span>{dayLabel(i18n, message.created_at)}</span>
                                    </li>
                                )}
                                {kind === 'system' ? (
                                    <motion.li
                                        className={`supportMsg is-system event-${message.event}`}
                                        initial={isFresh ? { opacity: 0, y: 8, scale: 0.94 } : false}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={SPRING}
                                    >
                                        <p>
                                            {message.event === 'joined' && <Avatar message={message} small pop={isFresh} />}
                                            <span>{eventText(t, message.event, status, message.sender_name)}</span>
                                        </p>
                                        <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                                    </motion.li>
                                ) : (
                                    <motion.li
                                        className={`supportMsg is-${kind}${message.sender_kind === 'ai' ? ' is-ai' : ''}${groupStart ? ' isGroupStart' : ''}${groupEnd ? ' isGroupEnd' : ''}`}
                                        initial={isFresh ? { opacity: 0, y: 10, x: kind === 'customer' ? 16 : -16, scale: 0.95 } : false}
                                        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                                        transition={SPRING}
                                    >
                                        {kind === 'staff' &&
                                            (groupStart ? <Avatar message={message} pop={isFresh} /> : <span className="supportAvatarSpace" aria-hidden="true" />)}
                                        <div className="supportMsgMain">
                                            {kind === 'staff' && groupStart && <span className="supportMsgName">{senderLabel(t, message)}</span>}
                                            <div className="supportMsgBubble">
                                                {message.image_path &&
                                                    (urls[message.image_path] ? (
                                                        <a className="supportMsgPhoto" href={urls[message.image_path]} target="_blank" rel="noopener noreferrer">
                                                            <img src={urls[message.image_path]} alt={t('A photo in the chat')} />
                                                        </a>
                                                    ) : (
                                                        <span className="supportMsgPhoto isLoading" aria-label={t('A photo in the chat')} />
                                                    ))}
                                                {message.body && <p>{message.body}</p>}
                                            </div>
                                            {(groupEnd || mineLast) && (
                                                <span className="supportMsgMeta">
                                                    <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                                                    {mineLast && (
                                                        <AnimatePresence initial={false} mode="wait">
                                                            <motion.span
                                                                key={seen(message) ? 'seen' : 'sent'}
                                                                className={`supportReceipt${seen(message) ? ' isSeen' : ''}`}
                                                                initial={{ opacity: 0, y: 3 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -3 }}
                                                                transition={{ duration: 0.18 }}
                                                            >
                                                                {seen(message) ? <LuCheckCheck aria-hidden="true" /> : <LuCheck aria-hidden="true" />}
                                                                {seen(message) ? t('Seen') : t('Sent')}
                                                            </motion.span>
                                                        </AnimatePresence>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </motion.li>
                                )}
                            </Fragment>
                        );
                    })}
                    <AnimatePresence>
                        {typing && (
                            <motion.li
                                key="typing"
                                className="supportTyping"
                                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                transition={SPRING}
                            >
                                <Avatar message={{ sender_name: thread.assigned_name ?? 'Oops' }} />
                                <span className="supportTypingBubble">
                                    <span className="supportTypingDots" aria-hidden="true">
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                    <span className="supportTypingText">{typingText(t, thread.assigned_name)}</span>
                                </span>
                            </motion.li>
                        )}
                    </AnimatePresence>
                </ol>
            </div>
            <div className="supportFooter">
                <AnimatePresence>
                    {waitingForSomeone && (
                        <SupportWaiting key="waiting" since={thread.waiting_since} minutes={status?.reply_minutes ?? 5} serverNow={status?.now} />
                    )}
                </AnimatePresence>
                {thread.status === 'closing' && mine && (
                    <motion.div
                        className="supportCloseCard"
                        role="group"
                        aria-label={t('Is everything sorted?')}
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={SPRING}
                    >
                        <p>{t('Is everything sorted?')}</p>
                        <div>
                            <button type="button" className="supportPrimary" onClick={() => answer(true)} disabled={answering !== null}>
                                {answering === true ? <LuLoader2 className="supportSpin" /> : <LuCheck />} {t('Yes, close the chat')}
                            </button>
                            <button type="button" className="supportGhost" onClick={() => answer(false)} disabled={answering !== null}>
                                {answering === false && <LuLoader2 className="supportSpin" />} {t('Not yet, I still need help')}
                            </button>
                        </div>
                    </motion.div>
                )}
                {closed && celebrating && <SupportCelebration onDone={stopCelebrating} />}
                {closed && !celebrating && (
                    <motion.div className="supportClosedNote" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        <p>{t('This chat is closed.')}</p>
                        {phase === 'open' && !status?.thread && (
                            <button type="button" className="supportPrimary" onClick={onNewQuestion}>
                                <LuMessageSquarePlus /> {t('Ask a new question')}
                            </button>
                        )}
                    </motion.div>
                )}
                {!closed && (
                    <SupportComposer
                        value={draft}
                        onChange={setDraft}
                        onSend={send}
                        onTyping={phase !== 'closed' ? () => typingRef.current?.ping() : undefined}
                        placeholder={t('Write a message…')}
                        disabled={phase === 'closed'}
                        disabledNote={t('Chat is paused until {opens}. Your conversation stays here.', { opens: status?.opens ?? '08:00' })}
                    />
                )}
            </div>
        </>
    );
};

export default SupportThread;
