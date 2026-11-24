import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuFilterX, LuInbox, LuPartyPopper, LuUserPlus } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listJoinClasses, listJoinRequests } from '@/services/classJoinStaff';
import { listClassSeats } from '@/services/classJoin';
import { levelOf } from '@/lib/classLevel';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import StatusSelect from '../../common/StatusSelect';
import { stagger } from '../../common/motion';
import { useStaffTasks } from '../../../tasks/staffTasks';
import JoinRequestCard from './JoinRequestCard';
import SeatsAlert from './SeatsAlert';
import JoinDialogs from './JoinDialogs';
import { JOIN_PAGE, TABS, agoText, countByClass } from './joinModel';
import './joinRequests.scss';

const TICK_MS = 60_000;
const nothing = () => Promise.resolve(undefined);

// Placeholder cards while the requests load.
export const JoinSkeleton = ({ rows = 3 }) => (
    <ul className="jrList isLoading" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
            <li key={index} className="jrCard isSkeleton">
                <span className="jrSkelWho">
                    <span className="jrSkelCircle" />
                    <span className="jrSkelLines">
                        <span style={{ width: `${70 - index * 8}%` }} />
                        <span style={{ width: `${45 + index * 6}%` }} />
                    </span>
                </span>
                <span className="jrSkelWho">
                    <span className="jrSkelThumb" />
                    <span className="jrSkelLines">
                        <span style={{ width: '60%' }} />
                        <span style={{ width: '40%' }} />
                    </span>
                </span>
                <span className="jrSkelLines isSide">
                    <span />
                </span>
            </li>
        ))}
    </ul>
);

const EmptyState = ({ tab, filtered, onClear }) => {
    const { t } = useI18n();
    const Icon = tab === 'waiting' ? LuPartyPopper : LuInbox;
    return (
        <div className="jrEmpty">
            <span className="jrEmptyIcon" aria-hidden="true">
                <Icon />
            </span>
            <strong>{tab === 'waiting' ? t('No one is waiting.') : t('Nothing answered in the last 30 days.')}</strong>
            <span>{tab === 'waiting' ? t('New requests show up here and in the bell.') : t('Approved, declined and cancelled requests stay here for 30 days.')}</span>
            {filtered && (
                <Button size="sm" variant="flat" startContent={<LuFilterX aria-hidden="true" />} onPress={onClear}>
                    {t('Show every class')}
                </Button>
            )}
        </div>
    );
};

// /admin/join-requests (staff and admins): students who asked to join a class from the website. Waiting (oldest
// first, late ones tagged) with Approve / Decline, and what was answered in the last 30 days. ?tab= and ?class= live
// in the URL. The bell and the sidebar badge follow every answer.
const JoinRequests = () => {
    const i18n = useI18n();
    const { t, tn } = i18n;
    const tasks = useStaffTasks();
    const [params, setParams] = useSearchParams();
    const tab = TABS.some((item) => item.key === params.get('tab')) ? params.get('tab') : 'waiting';
    const classId = Number(params.get('class')) || null;
    const [dialog, setDialog] = useState(null); // { kind: 'approve' | 'decline', request }
    const [now, setNow] = useState(() => Date.now());

    const waiting = useAsync(() => listJoinRequests({ status: 'pending' }), []);
    const answered = useAsync(() => (tab === 'answered' ? listJoinRequests({ status: 'answered' }) : nothing()), [tab]);
    const classes = useAsync(listJoinClasses, []);
    // Places left in the classes with a maximum: a full class can't take a request until its maximum goes up.
    const seats = useAsync(() => listClassSeats().catch(() => new Map()), []);

    // "Asked 3 hours ago" moves on, and new requests come in while the page is open.
    const reloads = useRef({});
    reloads.current = { waiting: waiting.reload, tasks: tasks.refresh };
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
            reloads.current.waiting();
        }, TICK_MS);
        return () => clearInterval(timer);
    }, []);

    // The bell and the sidebar badge follow when the number waiting changes.
    const waitingCount = waiting.data?.length;
    const badge = tasks.data?.counts?.[JOIN_PAGE];
    useEffect(() => {
        if (waitingCount !== undefined && badge !== undefined && waitingCount !== badge) reloads.current.tasks?.();
    }, [waitingCount, badge]);

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

    const list = tab === 'waiting' ? waiting : answered;
    const rows = useMemo(() => (list.data ?? []).filter((row) => !classId || row.class_id === classId), [list.data, classId]);
    // The filter counts what the tab shows.
    const perClass = useMemo(() => countByClass(list.data), [list.data]);

    // Every class that hasn't ended, and any other class a request on screen is for (an answered one may have ended).
    const classOptions = useMemo(() => {
        const known = new Map((classes.data ?? []).map((cls) => [cls.id, cls]));
        for (const row of [...(waiting.data ?? []), ...(answered.data ?? [])]) {
            if (row.class && !known.has(row.class_id)) known.set(row.class_id, { id: row.class_id, name: row.class.name, level: row.class.level });
        }
        const sorted = [...known.values()].sort((a, b) => a.name.localeCompare(b.name));
        return [
            { key: 'all', label: t('All classes'), count: list.data?.length ?? 0 },
            ...sorted.map((cls) => ({ key: String(cls.id), label: cls.name, count: perClass.get(cls.id) ?? 0, color: levelOf(cls.level).color })),
        ];
    }, [classes.data, waiting.data, answered.data, list.data, perClass, t]);

    const done = () => {
        setDialog(null);
        waiting.reload();
        seats.reload();
        if (answered.data !== undefined || tab === 'answered') answered.reload();
        tasks.refresh();
    };

    const oldest = waiting.data?.[0];
    // Waiting requests per class, oldest first (all of them, whatever the filter): "3 places left · 5 asking".
    const waitingByClass = new Map();
    for (const request of waiting.data ?? []) waitingByClass.set(request.class_id, [...(waitingByClass.get(request.class_id) ?? []), request]);
    const subtitle =
        tab === 'answered'
            ? t('Answered in the last 30 days')
            : waiting.data === undefined
              ? t('Loading…')
              : waiting.data.length
                ? `${tn(waiting.data.length, '{count} request waiting for an answer', '{count} requests waiting for an answer')} · ${t('the oldest asked {time}', { time: agoText(oldest.created_at, i18n, now) })}`
                : t('Nobody is waiting for an answer');

    return (
        <>
            <SectionCard icon={LuUserPlus} title={t('Join requests')} subtitle={subtitle} className="jrPage">
                <div className="jrToolbar">
                    <Segmented
                        label={t('Requests')}
                        options={TABS.map((item) => ({ key: item.key, label: t(item.label), count: item.key === 'waiting' ? waiting.data?.length ?? undefined : undefined }))}
                        value={tab}
                        onChange={(key) => setParam({ tab: key === 'waiting' ? null : key })}
                    />
                    <StatusSelect label={t('Class')} options={classOptions} value={classId ? String(classId) : 'all'} onChange={(key) => setParam({ class: key === 'all' ? null : key })} />
                </div>

                {list.error && !list.data ? (
                    <ErrorMessage error={list.error} onRetry={list.reload} />
                ) : list.data === undefined ? (
                    <JoinSkeleton />
                ) : rows.length === 0 ? (
                    <EmptyState tab={tab} filtered={Boolean(classId)} onClear={() => setParam({ class: null })} />
                ) : (
                    <>
                        {/* Classes whose waiting requests don't all fit (full, or more asking than places). */}
                        {tab === 'waiting' &&
                            [...waitingByClass.entries()]
                                .filter(([id]) => !classId || id === classId)
                                .map(([id, list]) => (
                                    <SeatsAlert
                                        key={id}
                                        name={list[0].class?.name}
                                        seats={seats.data?.get(id) ?? null}
                                        waiting={list}
                                        onDeclineRest={(requests) => setDialog({ kind: 'declineRest', className: list[0].class?.name ?? '', requests })}
                                    />
                                ))}
                        <motion.ul key={tab} className="jrList" variants={stagger} initial="hidden" animate="show" aria-label={tab === 'waiting' ? t('Waiting') : t('Answered')}>
                            {rows.map((request) => (
                                <JoinRequestCard
                                    key={request.id}
                                    request={request}
                                    seats={seats.data?.get(request.class_id) ?? null}
                                    asking={waitingByClass.get(request.class_id)?.length ?? 0}
                                    now={now}
                                    onApprove={(item) => setDialog({ kind: 'approve', request: item })}
                                    onDecline={(item) => setDialog({ kind: 'decline', request: item })}
                                />
                            ))}
                        </motion.ul>
                    </>
                )}
            </SectionCard>

            <JoinDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={done} />
        </>
    );
};

export default JoinRequests;
