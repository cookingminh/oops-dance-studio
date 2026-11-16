import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuCheck, LuLoader2, LuMessageSquarePlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { formatClock } from '@/lib/format';
import {
    answerClose,
    getThread,
    listMessages,
    markRead,
    sendMessage,
    signSupportImages,
    subscribeToThread,
    uploadSupportImage,
} from '@/services/support';
import SupportComposer from './SupportComposer';
import { dayLabel, eventText, senderLabel, studioDay, topicLabel } from './supportText';

const REFETCH_MS = 30_000; // in case Realtime is down

const byId = (a, b) => a.id - b.id;
const kindOf = (message) => (message.sender_kind === 'customer' ? 'customer' : message.sender_kind === 'system' ? 'system' : 'staff');

// One conversation, as the person who asked sees it: the messages (live), "Is everything sorted?" when the
// studio asks, and the text box while the chat is open and the studio is answering.
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
    const listRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const [row, rows] = await Promise.all([getThread(threadId), listMessages(threadId)]);
            setThread(row);
            setMessages(rows ?? []);
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, [threadId]);

    useEffect(() => {
        setThread(null);
        setMessages(null);
        load();
        const timer = setInterval(load, REFETCH_MS);
        return () => clearInterval(timer);
    }, [load]);

    useEffect(
        () =>
            subscribeToThread(threadId, {
                onMessage: (message) =>
                    setMessages((list) => (list && !list.some((item) => item.id === message.id) ? [...list, message].sort(byId) : list)),
                onThread: (row) => setThread((current) => (current ? { ...current, ...row } : row)),
            }),
        [threadId]
    );

    // A studio reply on screen counts as read (also one arriving while the chat is open).
    const mine = thread?.customer_id === userId;
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

    // Keep the newest message in view.
    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages?.length, thread?.status]);

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
            await load();
            onChanged();
        } catch (error) {
            toast.error(error);
            load();
        } finally {
            setAnswering(null);
        }
    };

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

    return (
        <>
            <div className="supportThreadBar">
                <span className="supportThreadTopic">{topicLabel(t, thread.category)}</span>
                <span className={`supportState is-${thread.status}`}>
                    {closed ? t('Chat closed') : thread.status === 'closing' ? t('Is it sorted?') : t('Ongoing')}
                </span>
            </div>
            <div className="supportBody supportThread" ref={listRef}>
                <ol className="supportMessages" role="log" aria-live="polite" aria-label={t('Messages')}>
                    {messages.map((message, index) => {
                        const previous = messages[index - 1];
                        const newDay = !previous || studioDay(previous.created_at) !== studioDay(message.created_at);
                        const kind = kindOf(message);
                        const showName = kind === 'staff' && (newDay || previous.sender_id !== message.sender_id || kindOf(previous) !== 'staff');
                        return (
                            <Fragment key={message.id}>
                                {newDay && (
                                    <li className="supportDay" aria-hidden="true">
                                        <span>{dayLabel(i18n, message.created_at)}</span>
                                    </li>
                                )}
                                {kind === 'system' ? (
                                    <li className={`supportMsg is-system event-${message.event}`}>
                                        <p>{eventText(t, message.event, status)}</p>
                                        <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                                    </li>
                                ) : (
                                    <li className={`supportMsg is-${kind}${message.sender_kind === 'ai' ? ' is-ai' : ''}`}>
                                        {showName && <span className="supportMsgName">{senderLabel(t, message)}</span>}
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
                                        <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                                    </li>
                                )}
                            </Fragment>
                        );
                    })}
                </ol>
            </div>
            <div className="supportFooter">
                {thread.status === 'closing' && mine && (
                    <div className="supportCloseCard" role="group" aria-label={t('Is everything sorted?')}>
                        <p>{t('Is everything sorted?')}</p>
                        <div>
                            <button type="button" className="supportPrimary" onClick={() => answer(true)} disabled={answering !== null}>
                                {answering === true ? <LuLoader2 className="supportSpin" /> : <LuCheck />} {t('Yes, close the chat')}
                            </button>
                            <button type="button" className="supportGhost" onClick={() => answer(false)} disabled={answering !== null}>
                                {answering === false && <LuLoader2 className="supportSpin" />} {t('Not yet, I still need help')}
                            </button>
                        </div>
                    </div>
                )}
                {closed ? (
                    <div className="supportClosedNote">
                        <p>{t('This chat is closed.')}</p>
                        {phase === 'open' && !status?.thread && (
                            <button type="button" className="supportPrimary" onClick={onNewQuestion}>
                                <LuMessageSquarePlus /> {t('Ask a new question')}
                            </button>
                        )}
                    </div>
                ) : (
                    <SupportComposer
                        value={draft}
                        onChange={setDraft}
                        onSend={send}
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
