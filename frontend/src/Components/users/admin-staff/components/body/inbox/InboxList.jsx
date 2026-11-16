import { useRef } from 'react';
import { motion } from 'framer-motion';
import { LuInbox } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatClock } from '@/lib/format';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { INBOX_TABS, TOPIC_OPTIONS, URGENT_MINUTES, durationText, minutesSince, previewOf, studioDateOf, topicLabel } from './inboxModel';

// The left column: Waiting / Answered / Closed (ARIA tabs), a topic filter and the conversations.
const InboxList = ({ tab, onTab, topic, onTopic, counts, list, selectedId, onOpen, now, meId }) => {
    const i18n = useI18n();
    const { t, formatDate } = i18n;
    const tabsRef = useRef(null);
    const today = studioDateOf(new Date(now).toISOString());
    const rows = list.data ?? [];

    const onKeyDown = (event) => {
        const index = INBOX_TABS.findIndex((item) => item.key === tab);
        const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: INBOX_TABS.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const next = INBOX_TABS[(moves[event.key] + INBOX_TABS.length) % INBOX_TABS.length];
        onTab(next.key);
        tabsRef.current?.querySelector(`#inbox-tab-${next.key}`)?.focus();
    };

    // When: how long they've waited (Waiting), the last message (Answered), when it closed (Closed).
    const whenOf = (row) => {
        if (tab === 'waiting') return t('Waiting {time}', { time: durationText(minutesSince(row.waiting_since, now), i18n) });
        const at = tab === 'closed' ? row.closed_at : row.last_message_at;
        if (!at) return '';
        return studioDateOf(at) === today ? formatClock(at) : formatDate(studioDateOf(at), 'short');
    };

    return (
        <section className="inboxPane inboxListPane" aria-label={t('Conversations')}>
            <div className="hubTabs inboxTabs" role="tablist" aria-label={t('Conversations')} ref={tabsRef} onKeyDown={onKeyDown}>
                {INBOX_TABS.map((item) => {
                    const selected = item.key === tab;
                    const count = counts?.[item.key];
                    return (
                        <button
                            key={item.key}
                            id={`inbox-tab-${item.key}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls="inbox-list"
                            tabIndex={selected ? 0 : -1}
                            className={selected ? 'isSelected' : ''}
                            onClick={() => onTab(item.key)}
                        >
                            <span>{t(item.label)}</span>
                            {count ? <span className="segCount">{count}</span> : null}
                            {selected && <motion.span layoutId="inboxTabLine" className="hubTabLine" transition={{ type: 'spring', stiffness: 500, damping: 40 }} aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>

            <label className="inboxTopic">
                <span className="sr-only">{t('Topic')}</span>
                <select value={topic ?? ''} onChange={(event) => onTopic(event.target.value || null)}>
                    <option value="">{t('All topics')}</option>
                    {TOPIC_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                            {t(option.label)}
                        </option>
                    ))}
                </select>
            </label>

            <div id="inbox-list" role="tabpanel" aria-labelledby={`inbox-tab-${tab}`} className="inboxListScroll">
                {list.error && !list.data ? (
                    <ErrorMessage error={list.error} onRetry={list.reload} />
                ) : list.loading && !list.data ? (
                    <Loading />
                ) : rows.length === 0 ? (
                    <div className="inboxEmpty">
                        <LuInbox aria-hidden="true" />
                        <strong>{t(tab === 'waiting' ? 'Nobody is waiting' : tab === 'answered' ? 'No open chats the studio has answered' : 'No closed chats yet')}</strong>
                        {tab === 'waiting' && <span>{t('New questions from the chat bubble show up here.')}</span>}
                    </div>
                ) : (
                    <ul className="inboxRows">
                        {rows.map((row) => {
                            const preview = previewOf(row, i18n);
                            const urgent = tab === 'waiting' && minutesSince(row.waiting_since, now) > URGENT_MINUTES;
                            const unread = row.unread > 0 && tab !== 'closed';
                            return (
                                <li key={row.id}>
                                    <button
                                        type="button"
                                        className={`inboxRow${row.id === selectedId ? ' isSelected' : ''}${unread ? ' isUnread' : ''}${urgent ? ' isUrgent' : ''}`}
                                        aria-current={row.id === selectedId ? 'true' : undefined}
                                        onClick={() => onOpen(row.id)}
                                    >
                                        <span className="inboxRowTop">
                                            <strong className="inboxRowName">{row.customer_name}</strong>
                                            {row.customer_role === 'instructor' && <span className="inboxChip isInstructor">{t('Instructor')}</span>}
                                            <span className="inboxRowWhen">{whenOf(row)}</span>
                                        </span>
                                        <span className="inboxRowTopic">
                                            {t(topicLabel(row.category))}
                                            {row.status === 'closing' && <span className="inboxChip isClosing">{t('Asked to close')}</span>}
                                        </span>
                                        <span className={`inboxRowPreview is-${preview.who}`}>
                                            {preview.who === 'studio' && <span className="inboxRowWho">{t('Studio:')} </span>}
                                            {preview.text}
                                        </span>
                                        <span className="inboxRowFoot">
                                            <span className="inboxRowOwner">
                                                {row.assigned_to ? (row.assigned_to === meId ? t('You have it') : t('{name} has it', { name: row.assigned_name })) : t('Nobody has it yet')}
                                            </span>
                                            {unread && (
                                                <span className="inboxUnread" aria-label={t('{count} unread', { count: row.unread })}>
                                                    {row.unread > 9 ? '9+' : row.unread}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default InboxList;
