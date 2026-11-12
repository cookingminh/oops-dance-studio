import { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, Button, Tooltip } from '@nextui-org/react';
import { LuBan, LuCalendarClock, LuCalendarPlus, LuCheck, LuCloudLightning, LuInfo, LuListChecks, LuPlus, LuSun } from 'react-icons/lu';
import { generateInstructorAttendance, generateStudentAttendance, updateInstructorAttendance } from '@/services/attendance';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import { placeOf } from '@/lib/place';
import placeholder from '@/assets/images/logo-mark.webp';
import SectionCard from '../../../common/SectionCard';
import { fadeUp, stagger } from '../../../common/motion';
import { useStudioClock } from '../../../common/useStudioClock';
import MakeUpTag from '../../class-manager/routines/MakeUpTag';
import { reasonText } from '../../../common/session-changes/changeText';
import { OPEN_STATUSES, canReschedule, classColor, isSubstitute, personName, rollOf, sessionState, teacherOf } from '../../../common/session-modal/sessionModel';
import LateTag from '../../../common/checkins/LateTag';
import { CheckMini } from './AttendanceParts';

// Today at a glance: every session in time order (weekly and make-up) with the instructor's
// check-in / check-out and proofs, the roll call so far and one-click actions — take the roll
// call, mark completed when a check-in is missing, call off / move (or cancel one that started). The
// whole session opens in the modal. The header also closes the studio for a day (onCloseDay).
const TodayBoard = ({ state, today, isReadOnly, onOpen, onChanged, onViewProof, onReschedule, onCloseDay }) => {
    const { t, tn, formatDate } = useI18n();
    const toast = useToast();
    const now = useStudioClock();
    const [busy, setBusy] = useState(null); // session key, 'roll' or 'week'

    const sessions = state.data?.sessions ?? [];
    const marks = state.data?.marks ?? new Map();
    const live = sessions.filter((session) => session.row?.status !== 'cancelled');
    const done = live.filter((session) => session.row?.status === 'completed').length;
    const rolls = live.map((session) => rollOf(marks.get(session.key)));
    const marked = rolls.reduce((sum, roll) => sum + roll.marked, 0);
    const students = rolls.reduce((sum, roll) => sum + roll.total, 0);
    const noRecord = live.filter((session) => !session.row).length;
    const noRoll = live.filter((session) => !marks.get(session.key)?.length).length;

    const run = async (key, task) => {
        setBusy(key);
        try {
            await task();
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const approve = (session) =>
        run(session.key, async () => {
            await updateInstructorAttendance(session.row.id, { status: 'completed' });
            toast.success('Marked as completed.');
        });
    // A session that hasn't started is called off (or moved) with a reason the class sees.
    const cancel = (session) => {
        if (canReschedule(session, today, isReadOnly(session.cls))) {
            onReschedule(session);
            return;
        }
        if (!window.confirm(t('Cancel this session? It won’t count for the routine, which then ends one session later.'))) return;
        run(session.key, async () => {
            await updateInstructorAttendance(session.row.id, { status: 'cancelled' });
            toast.success('Session cancelled.');
        });
    };
    const createRolls = () =>
        run('roll', async () => {
            const created = await generateStudentAttendance();
            toast.success(created > 0 ? t('Created {count} attendance records for today.', { count: created }) : 'Today’s records already exist.');
        });
    const createWeek = () =>
        run('week', async () => {
            const created = await generateInstructorAttendance();
            toast.success(created > 0 ? t('Created {count} records for this week.', { count: created }) : 'This week’s records already exist.');
        });

    const subtitle = today
        ? [
            formatDate(today, 'long'),
            t('{done} of {total} done', { done, total: live.length }),
            students ? t('{marked} of {total} students marked', { marked, total: students }) : null,
        ].filter(Boolean).join(' · ')
        : t('Loading today…');

    return (
        <SectionCard
            className="atTodayCard"
            icon={LuSun}
            title={t('Today')}
            subtitle={subtitle}
            actions={
                <Button variant="flat" color="danger" startContent={<LuCloudLightning aria-hidden="true" />} onPress={onCloseDay}>
                    {t('Close for a day')}
                </Button>
            }
        >
            {(noRecord > 0 || noRoll > 0) && (
                <div className="atNotices">
                    {noRecord > 0 && (
                        <p className="inlineNotice atCatchUp">
                            <LuInfo aria-hidden="true" />
                            <span>{tn(noRecord, '{count} class on today’s timetable has no session yet.', '{count} classes on today’s timetable have no session yet.')}</span>
                            <Button size="sm" variant="flat" startContent={<LuCalendarPlus aria-hidden="true" />} isLoading={busy === 'week'} onPress={createWeek}>
                                {t('Create them')}
                            </Button>
                        </p>
                    )}
                    {noRoll > 0 && (
                        <p className="inlineNotice atCatchUp">
                            <LuInfo aria-hidden="true" />
                            <span>{tn(noRoll, '{count} class today has no roll call yet.', '{count} classes today have no roll call yet.')}</span>
                            <Button size="sm" variant="flat" startContent={<LuPlus aria-hidden="true" />} isLoading={busy === 'roll'} onPress={createRolls}>
                                {t('Create them')}
                            </Button>
                        </p>
                    )}
                </div>
            )}
            <AsyncState state={state} isEmpty={sessions.length === 0} emptyText="No sessions scheduled today.">
                <motion.ol className="atToday" variants={stagger} initial="hidden" animate="show" aria-label={t('Today’s sessions')}>
                    {sessions.map((session) => {
                        const { cls, row } = session;
                        const phase = sessionState(session, today, now);
                        const teacher = teacherOf(session);
                        const name = personName(teacher) || t('No instructor');
                        const roll = rollOf(marks.get(session.key));
                        const readOnly = isReadOnly(cls);
                        const open = row && OPEN_STATUSES.includes(row.status) && !readOnly;
                        const movable = canReschedule(session, today, readOnly);
                        const rollDone = roll.total > 0 && roll.marked === roll.total;
                        const place = placeOf(row, cls);
                        return (
                            <motion.li key={session.key} variants={fadeUp} className={`atTodayRow tone-${phase.tone}`} style={{ '--class': classColor(cls.id) }}>
                                <button
                                    type="button"
                                    className="atTodayOpen"
                                    onClick={() => onOpen(session)}
                                    aria-label={t('Open the session: {name}, {time}', { name: cls.name, time: `${session.start}–${session.end}` })}
                                >
                                    <span className="atTime">
                                        <strong>{session.start || '—'}</strong>
                                        <small>{session.end}</small>
                                    </span>
                                    <img className="atThumb" src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
                                    <span className="atMain">
                                        <span className="atName">
                                            {cls.name}
                                            {session.extra && <MakeUpTag />}
                                        </span>
                                        <span className="atMeta">
                                            <Avatar {...AVATAR_DEFAULTS} size="sm" className="atAvatar" src={avatarUrl(teacher?.avatar_path, teacher?.updated_at) ?? undefined} name={name} />
                                            <span>{name}</span>
                                            {isSubstitute(session) && <span className="atTag">{t('Substitute')}</span>}
                                            {place.name && <span>· {place.name}</span>}
                                        </span>
                                    </span>
                                </button>

                                <span className="atChecks">
                                    {row && row.status !== 'cancelled' ? (
                                        <>
                                            <CheckMini label={t('Check-in')} proofLabel={t('Check-in proof')} at={row.checkin_at} proof={row.checkin_proof_url} onView={onViewProof} />
                                            <CheckMini label={t('Check-out')} proofLabel={t('Check-out proof')} at={row.checkout_at} proof={row.checkout_proof_url} onView={onViewProof} />
                                            {row.checkout_late && <LateTag />}
                                        </>
                                    ) : (
                                        <span className="atStepNone">
                                            {row ? [t('Cancelled'), reasonText(row.cancel_reason, t)].filter(Boolean).join(' · ') : t('No record yet')}
                                        </span>
                                    )}
                                </span>

                                <span className="atRoll">
                                    <small>{t('Roll call')}</small>
                                    {roll.total ? (
                                        <>
                                            <strong>{t('{done}/{total} marked', { done: roll.marked, total: roll.total })}</strong>
                                            <span className={`atBar${rollDone ? ' isDone' : ''}`} role="progressbar" aria-label={t('{name}: roll call marked', { name: cls.name })} aria-valuemin={0} aria-valuemax={roll.total} aria-valuenow={roll.marked}>
                                                <span style={{ width: `${(roll.marked / roll.total) * 100}%` }} />
                                            </span>
                                        </>
                                    ) : (
                                        <strong className="isMuted">{t('Not created yet')}</strong>
                                    )}
                                </span>

                                <span className="atState">
                                    <span className={`phaseBadge tone-${phase.tone}`}>
                                        {phase.tone === 'live' && <span className="livePulse" aria-hidden="true" />}
                                        {t(phase.key, phase.vars)}
                                    </span>
                                </span>

                                <span className="atActions">
                                    {open && phase.kind === 'review' && (
                                        <Button size="sm" variant="flat" color="success" startContent={<LuCheck aria-hidden="true" />} isLoading={busy === session.key} onPress={() => approve(session)}>
                                            {t('Mark completed')}
                                        </Button>
                                    )}
                                    {row?.status !== 'cancelled' && (
                                        <Button
                                            size="sm"
                                            color="danger"
                                            variant={rollDone ? 'light' : 'solid'}
                                            startContent={<LuListChecks aria-hidden="true" />}
                                            aria-label={t('Take the roll call for {name}', { name: cls.name })}
                                            onPress={() => onOpen(session, 'roll')}
                                        >
                                            {t('Take roll call')}
                                        </Button>
                                    )}
                                    {(open || movable) && (
                                        <Tooltip content={movable ? t('Call off / move') : t('Cancel session')}>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                aria-label={movable ? t('Call off or move the session of {name}', { name: cls.name }) : t('Cancel the session of {name}', { name: cls.name })}
                                                isDisabled={busy === session.key}
                                                onPress={() => cancel(session)}
                                            >
                                                {movable ? <LuCalendarClock aria-hidden="true" /> : <LuBan aria-hidden="true" />}
                                            </Button>
                                        </Tooltip>
                                    )}
                                </span>
                            </motion.li>
                        );
                    })}
                </motion.ol>
            </AsyncState>
        </SectionCard>
    );
};

export default TodayBoard;
