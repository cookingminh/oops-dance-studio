import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuClock, LuMessagesSquare, LuMoon } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useI18n } from '@/i18n/i18nContext';
import { listProfiles } from '@/services/users';
import { getCustomerCard, getSupportCounts, getSupportStatus, listInbox, subscribeToInbox } from '@/services/support';
import { fadeUp } from '../../common/motion';
import { useStaffTasks } from '../../../tasks/staffTasks';
import { TAB_KEYS } from './inboxModel';
import { useInboxThread, useNow } from './useInboxThread';
import InboxList from './InboxList';
import InboxThread from './InboxThread';
import InboxCard from './InboxCard';
import './inbox.scss';

const STATUS_EVERY_MS = 60_000;
const FALLBACK_MS = 30_000;
const LIVE_DEBOUNCE_MS = 500;
const nothing = () => Promise.resolve(null);

// /admin/inbox (staff and admins): questions from the chat bubble. The list (Waiting / Answered / Closed),
// the open conversation and who is asking. ?tab=, ?topic= and ?thread=<id> live in the URL, so the bell and
// the Activity page can open one conversation. Everything updates live (Realtime), with a refetch as a fallback.
const Inbox = () => {
    const { t } = useI18n();
    const { user, role } = useAuth();
    const tasks = useStaffTasks();
    const [params, setParams] = useSearchParams();
    const tab = TAB_KEYS.includes(params.get('tab')) ? params.get('tab') : 'waiting';
    const topic = params.get('topic') || null;
    const threadId = Number(params.get('thread')) || null;

    const list = useAsync(() => listInbox(tab, topic), [tab, topic]);
    const counts = useAsync(getSupportCounts, []);
    const status = useAsync(getSupportStatus, []);
    const staff = useAsync(() => listProfiles().then((rows) => rows.filter((person) => person.role === ROLES.admin || person.role === ROLES.staff)), []);
    const thread = useInboxThread(threadId);
    const customerId = thread.thread?.customer_id ?? null;
    const card = useAsync(() => (customerId ? getCustomerCard(customerId) : nothing()), [customerId, threadId]);
    const now = useNow(30_000);

    // Reloads through refs, so the live subscription is made once.
    const reloads = useRef({});
    reloads.current = { list: list.reload, counts: counts.reload, status: status.reload, tasks: tasks.refresh };

    useEffect(() => {
        let timer;
        const refresh = () => {
            reloads.current.list();
            reloads.current.counts();
        };
        const stop = subscribeToInbox(() => {
            clearTimeout(timer);
            timer = setTimeout(refresh, LIVE_DEBOUNCE_MS);
        });
        const fallback = setInterval(refresh, FALLBACK_MS);
        const hours = setInterval(() => reloads.current.status(), STATUS_EVERY_MS);
        return () => {
            stop();
            clearTimeout(timer);
            clearInterval(fallback);
            clearInterval(hours);
        };
    }, []);

    // The bell and the sidebar badge follow when the number of people waiting changes.
    const waiting = counts.data?.waiting;
    const badge = tasks.data?.counts?.['/admin/inbox'];
    useEffect(() => {
        if (waiting !== undefined && badge !== undefined && waiting !== badge) reloads.current.tasks?.();
    }, [waiting, badge]);

    const setParam = (patch) =>
        setParams(
            (old) => {
                const next = new URLSearchParams(old);
                for (const [key, value] of Object.entries(patch)) {
                    if (value === null || value === undefined || value === '') next.delete(key);
                    else next.set(key, String(value));
                }
                return next;
            },
            { replace: true }
        );

    const onChanged = () => {
        list.reload();
        counts.reload();
    };

    const phase = status.data?.phase;
    const listRow = list.data?.find((row) => row.id === threadId);
    const customerName = listRow?.customer_name ?? card.data?.name ?? thread.messages.find((message) => message.sender_kind === 'customer')?.sender_name ?? '';

    return (
        <motion.div variants={fadeUp} className="inboxPage">
            {status.data && (
                <p className={`inboxHours is-${phase}`}>
                    {phase === 'closed' ? <LuMoon aria-hidden="true" /> : <LuClock aria-hidden="true" />}
                    {phase === 'closed'
                        ? t('The studio is closed: nobody can write until {opens}. Questions sent before closing wait here.', { opens: status.data.opens })
                        : phase === 'last_call'
                          ? t('Last call: no new questions after {last}; open chats go on until {closes}.', { last: status.data.last_start, closes: status.data.closes })
                          : t('Chat is open {opens}–{closes} · new questions until {last}.', { opens: status.data.opens, closes: status.data.closes, last: status.data.last_start })}
                </p>
            )}

            <div className={`inboxLayout${threadId ? ' hasThread' : ''}`}>
                <InboxList
                    tab={tab}
                    onTab={(key) => setParam({ tab: key === 'waiting' ? null : key })}
                    topic={topic}
                    onTopic={(key) => setParam({ topic: key })}
                    counts={{ waiting: counts.data?.waiting, answered: counts.data?.answered }}
                    list={list}
                    selectedId={threadId}
                    onOpen={(id) => setParam({ thread: id })}
                    now={now}
                    meId={user?.id}
                />
                {threadId ? (
                    <>
                        <InboxThread
                            data={thread}
                            customerName={customerName}
                            phase={phase}
                            opens={status.data?.opens ?? '08:00'}
                            meId={user?.id}
                            staff={staff.data ?? []}
                            now={now}
                            onBack={() => setParam({ thread: null })}
                            onChanged={onChanged}
                            onStatus={status.reload}
                        />
                        <InboxCard card={card} thread={thread.thread} isAdmin={role === ROLES.admin} />
                    </>
                ) : (
                    <section className="inboxPane inboxPlaceholder">
                        <LuMessagesSquare aria-hidden="true" />
                        <strong>{t('Pick a conversation')}</strong>
                        <span>{t('Questions from the chat bubble on the website and in students’ and instructors’ pages.')}</span>
                    </section>
                )}
            </div>
        </motion.div>
    );
};

export default Inbox;
