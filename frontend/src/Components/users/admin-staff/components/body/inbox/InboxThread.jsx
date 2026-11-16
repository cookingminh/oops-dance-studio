import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@nextui-org/react';
import { LuArrowLeft, LuCheckCheck, LuClock, LuForward, LuHand, LuImagePlus, LuMoon, LuSend, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { formatClock } from '@/lib/format';
import { prepareImage } from '@/lib/image';
import { MESSAGE_MAX, claimThread, requestClose, sendMessage, uploadSupportImage } from '@/services/support';
import { byDay, eventText, statusOf, topicLabel } from './inboxModel';

// The middle column: one conversation, its actions (take it, hand it over, ask to close) and the reply box.
// The person writes on the left, the studio on the right; system notes sit in the middle.
const InboxThread = ({ data, customerName, phase, opens, meId, staff, now, onBack, onChanged, onStatus }) => {
    const i18n = useI18n();
    const { t, formatDate } = i18n;
    const toast = useToast();
    const { thread, messages, images, loading, error, missing } = data;
    const [draft, setDraft] = useState('');
    const [photo, setPhoto] = useState(null); // { file, url, path? }
    const [sending, setSending] = useState(false);
    const [busy, setBusy] = useState(null); // 'take' | 'hand' | 'close'
    const scrollRef = useRef(null);
    const fileRef = useRef(null);
    const textRef = useRef(null);

    // A new conversation starts with an empty box (the draft stays while the same one is open).
    useEffect(() => {
        setDraft('');
        setPhoto(null);
    }, [thread?.id]);
    const photoUrl = photo?.url;
    useEffect(
        () => () => {
            if (photoUrl) URL.revokeObjectURL(photoUrl);
        },
        [photoUrl]
    );

    // Stay at the newest message.
    useLayoutEffect(() => {
        const box = scrollRef.current;
        if (box) box.scrollTop = box.scrollHeight;
    }, [messages.length, thread?.id]);

    // The box grows with the text, up to a few lines.
    useLayoutEffect(() => {
        const box = textRef.current;
        if (!box) return;
        box.style.height = 'auto';
        box.style.height = `${Math.min(box.scrollHeight, 180)}px`;
    }, [draft]);

    if (error && !thread) return <section className="inboxPane inboxThreadPane"><ErrorMessage error={error} onRetry={data.reload} /></section>;
    if (loading && !thread) return <section className="inboxPane inboxThreadPane"><Loading /></section>;
    if (missing || !thread) {
        return (
            <section className="inboxPane inboxThreadPane inboxGone">
                <p>{t('This chat doesn’t exist any more.')}</p>
                <Button size="sm" variant="flat" onPress={onBack}>
                    {t('Back to the list')}
                </Button>
            </section>
        );
    }

    const closed = thread.status === 'closed';
    const night = phase === 'closed';
    const canWrite = !closed && !night;
    const assignee = thread.assigned_to ? staff.find((person) => person.id === thread.assigned_to) : null;
    const assigneeName = assignee ? assignee.full_name || assignee.username || assignee.email : null;
    const owner = thread.assigned_to === meId ? t('You have it') : assigneeName ? t('With {name}', { name: assigneeName }) : t('Nobody has it yet');
    const handTo = staff.filter((person) => person.id !== meId && person.id !== thread.assigned_to);
    const status = statusOf(thread, now, i18n, customerName);

    const fail = (err) => {
        toast.error(err);
        if (err?.code === 'SUPPORT_CLOSED') onStatus();
    };

    const act = async (kind, run) => {
        setBusy(kind);
        try {
            const row = await run();
            if (row) data.setThread(row);
            data.reload();
            onChanged();
        } catch (err) {
            fail(err);
        } finally {
            setBusy(null);
        }
    };

    const pickPhoto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const prepared = await prepareImage(file);
            setPhoto({ file: prepared, url: URL.createObjectURL(prepared) });
        } catch (err) {
            toast.error(err);
        }
    };

    const send = async () => {
        const body = draft.trim();
        if (!canWrite || sending || (!body && !photo)) return;
        setSending(true);
        try {
            let imagePath = photo?.path ?? null;
            if (photo && !imagePath) {
                imagePath = await uploadSupportImage(thread.customer_id, photo.file);
                setPhoto((prev) => (prev ? { ...prev, path: imagePath } : prev)); // a retry doesn't upload it again
            }
            const message = await sendMessage(thread.id, { body: body || null, imagePath });
            data.addMessage(message);
            setDraft('');
            setPhoto(null);
            onChanged();
        } catch (err) {
            fail(err); // the draft stays
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
        }
    };

    return (
        <section className="inboxPane inboxThreadPane inboxThread" aria-label={t('Chat with {name}', { name: customerName })}>
            <header className="inboxThreadHead">
                <button type="button" className="inboxBack iconButton" onClick={onBack} aria-label={t('Back to the list')}>
                    <LuArrowLeft />
                </button>
                <div className="inboxThreadTitles">
                    <h2>{customerName}</h2>
                    <p>
                        <span>{t(topicLabel(thread.category))}</span>
                        <span className={`inboxStatus is-${status.tone}`}>{status.text}</span>
                        {!closed && <span className="inboxOwner">{owner}</span>}
                    </p>
                </div>
                {!closed && (
                    <div className="inboxActions">
                        {thread.assigned_to !== meId && (
                            <Button size="sm" variant="flat" startContent={<LuHand aria-hidden="true" />} isLoading={busy === 'take'} onPress={() => act('take', () => claimThread(thread.id))}>
                                {t('Take it')}
                            </Button>
                        )}
                        {handTo.length > 0 && (
                            <Dropdown placement="bottom-end" classNames={{ content: 'adminPortal' }}>
                                <DropdownTrigger>
                                    <Button size="sm" variant="flat" startContent={<LuForward aria-hidden="true" />} isLoading={busy === 'hand'}>
                                        {t('Hand over')}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label={t('Hand over to')} items={handTo} onAction={(key) => act('hand', () => claimThread(thread.id, String(key)))}>
                                    {(person) => (
                                        <DropdownItem key={person.id} description={t(person.role === 'admin' ? 'Admin' : 'Staff')}>
                                            {person.full_name || person.username || person.email}
                                        </DropdownItem>
                                    )}
                                </DropdownMenu>
                            </Dropdown>
                        )}
                        {thread.status === 'open' && (
                            <Button
                                size="sm"
                                color="danger"
                                variant="flat"
                                startContent={<LuCheckCheck aria-hidden="true" />}
                                isDisabled={night}
                                isLoading={busy === 'close'}
                                onPress={() => act('close', () => requestClose(thread.id))}
                            >
                                {t('Ask to close')}
                            </Button>
                        )}
                    </div>
                )}
            </header>

            <div className="inboxMessages" ref={scrollRef} aria-live="polite">
                {byDay(messages).map(({ day, messages: list }) => (
                    <div key={day} className="inboxDay">
                        <p className="inboxDayLabel">
                            <span>{formatDate(day, 'long')}</span>
                        </p>
                        {list.map((message) =>
                            message.sender_kind === 'system' ? (
                                <p key={message.id} className={`inboxNote is-${message.event}`}>
                                    {message.event === 'paused' && <LuMoon aria-hidden="true" />}
                                    <span>{eventText(message, customerName, i18n)}</span>
                                    <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                                </p>
                            ) : (
                                <div key={message.id} className={`inboxMsg is-${message.sender_kind === 'customer' ? 'customer' : 'studio'}`}>
                                    {message.sender_kind !== 'customer' && (
                                        <span className="inboxMsgWho">
                                            {message.sender_kind === 'ai' ? t('Assistant') : message.sender_id === meId ? t('You') : message.sender_name || t('The studio')}
                                        </span>
                                    )}
                                    <div className="inboxBubble">
                                        {message.image_path &&
                                            (images[message.image_path] ? (
                                                <a href={images[message.image_path]} target="_blank" rel="noopener noreferrer" className="inboxPhoto">
                                                    <img src={images[message.image_path]} alt={t('Photo from the chat')} />
                                                </a>
                                            ) : (
                                                <span className="inboxPhoto isLoading">{t('Loading the photo…')}</span>
                                            ))}
                                        {message.body && <p>{message.body}</p>}
                                    </div>
                                    <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                                </div>
                            )
                        )}
                    </div>
                ))}
            </div>

            {thread.status === 'closing' && (
                <p className="inboxBanner is-closing">
                    <LuClock aria-hidden="true" />
                    {t('Waiting for {name} to confirm it’s sorted. It closes by itself 24 hours after you asked.', { name: customerName })}
                </p>
            )}

            {closed ? (
                <p className="inboxBanner is-closed">{t('This chat is closed. A new question starts a new chat.')}</p>
            ) : (
                <div className="inboxComposer">
                    {night && (
                        <p className="inboxBanner is-night">
                            <LuMoon aria-hidden="true" />
                            {t('The studio is closed: chats open again at {time}.', { time: opens })}
                        </p>
                    )}
                    {photo && (
                        <div className="inboxDraftPhoto">
                            <img src={photo.url} alt={t('Photo to send')} />
                            <button type="button" className="iconButton" onClick={() => setPhoto(null)} aria-label={t('Remove the photo')}>
                                <LuX />
                            </button>
                        </div>
                    )}
                    <div className="inboxComposerRow">
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
                        <button
                            type="button"
                            className="iconButton inboxAttach"
                            onClick={() => fileRef.current?.click()}
                            disabled={!canWrite || sending}
                            aria-label={t('Add a photo')}
                            title={t('Add a photo')}
                        >
                            <LuImagePlus />
                        </button>
                        <textarea
                            ref={textRef}
                            rows={1}
                            value={draft}
                            maxLength={MESSAGE_MAX}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={onKeyDown}
                            disabled={!canWrite}
                            placeholder={canWrite ? t('Write a reply…') : ''}
                            title={t('Enter sends, Shift+Enter starts a new line')}
                            aria-label={t('Reply to {name}', { name: customerName })}
                        />
                        <Button
                            isIconOnly
                            color="danger"
                            className="inboxSend"
                            aria-label={t('Send')}
                            isLoading={sending}
                            isDisabled={!canWrite || (!draft.trim() && !photo)}
                            onPress={send}
                        >
                            <LuSend />
                        </Button>
                    </div>
                    {draft.length > MESSAGE_MAX - 200 && (
                        <p className="inboxCount">
                            {draft.length}/{MESSAGE_MAX}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default InboxThread;
