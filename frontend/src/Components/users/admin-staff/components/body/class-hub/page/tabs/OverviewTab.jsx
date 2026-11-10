import { motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuBanknote, LuCalendarCheck, LuCalendarClock, LuChevronRight, LuListTodo, LuMusic, LuPercent, LuPiggyBank, LuSparkles, LuUsers } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getFinanceByClass } from '@/services/finance';
import { avatarUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SectionCard from '../../../../common/SectionCard';
import { fadeUp, stagger } from '../../../../common/motion';
import { useStudioClock } from '../../../../common/useStudioClock';
import { MiniBar } from '../../HubParts';
import { attendanceRate, monthOf, monthSessions, nextSession, percent, personName, routineNow, sessionState, tuitionOf } from '../../hubModel';
import { useClassInvoices, useMonthActivity } from '../useClassActivity';
import { classTodos } from '../overviewModel';
import EndedOverview from './EndedOverview';
import RoutineSummary from './RoutineSummary';

const Tile = ({ icon: Icon, label, value, hint, bar, tone }) => (
    <motion.div variants={fadeUp} className={`hubTile${tone ? ` tone-${tone}` : ''}`}>
        <span className="hubTileIcon" aria-hidden="true">
            <Icon />
        </span>
        <span className="hubTileText">
            <small>{label}</small>
            <strong>{value}</strong>
            {hint && <em>{hint}</em>}
        </span>
        {bar}
    </motion.div>
);

// Overview: this month at a glance, the next session, what needs doing and the current routine.
const OverviewTab = ({ ctx }) => {
    const { cls, today, isAdmin, progress, version, setTab, badge } = ctx;
    const { t, tn, formatDate } = useI18n();
    const now = useStudioClock();
    const month = monthOf(today);
    const ended = badge.phase === 'ended';
    const routine = routineNow(progress);
    const course = routine.current ?? routine.planned ?? null;
    const activity = useMonthActivity(cls.id, ended ? null : month, version);
    const invoices = useClassInvoices(cls.id, version, course?.lesson_id ?? null);
    const finance = useAsync(() => (isAdmin && !ended ? getFinanceByClass(month).catch(() => []) : Promise.resolve([])), [isAdmin, month, version, ended]);

    if (ended) return <EndedOverview ctx={ctx} />;

    const sessions = activity.data?.sessions ?? [];
    const roll = activity.data?.roll ?? [];
    const list = monthSessions(cls, month, sessions);
    const held = list.filter((item) => item.row?.status === 'completed').length;
    const planned = list.filter((item) => item.row?.status !== 'cancelled').length;
    const rate = attendanceRate(roll);
    const tuition = tuitionOf(course ? (invoices.data ?? []).filter((invoice) => invoice.lesson_id === course.lesson_id) : [], today);
    const margin = (finance.data ?? []).find((row) => row.class_id === cls.id);
    const joined = (cls.students ?? []).filter((row) => row.joined_at >= month).length;
    const next = nextSession(cls, today, now, sessions);
    const nextState = next ? sessionState(next, today, now) : null;
    const teacher = next?.row?.instructor ?? cls.instructor;
    const todos = activity.data ? classTodos({ cls, today, now, month, sessions, roll, progress, overdue: tuition.overdue.length }) : [];
    const loading = !activity.data;

    return (
        <>
            <motion.div className="hubTiles" variants={stagger}>
                <Tile
                    icon={LuUsers}
                    label={t('Students')}
                    value={cls.students?.length ?? 0}
                    hint={joined ? tn(joined, '{count} joined this month', '{count} joined this month') : badge.phase === 'upcoming' ? t('signed up') : null}
                />
                <Tile
                    icon={LuBanknote}
                    label={t('This course: paid')}
                    value={tuition.count ? `${tuition.settled} / ${tuition.count}` : '—'}
                    hint={course ? course.title : t('No course yet')}
                    bar={tuition.count ? <MiniBar value={tuition.settled / tuition.count} tone={tuition.settled === tuition.count ? 'good' : 'brand'} label={t('Paid this course')} /> : null}
                    tone={tuition.overdue.length ? 'alert' : undefined}
                />
                <Tile
                    icon={LuCalendarCheck}
                    label={t('Sessions this month')}
                    value={loading ? '…' : `${held} / ${planned}`}
                    hint={t('held / planned')}
                    bar={planned ? <MiniBar value={held / planned} label={t('Sessions held this month')} /> : null}
                />
                <Tile icon={LuPercent} label={t('Attendance this month')} value={loading ? '…' : percent(rate)} hint={t('of marked roll calls')} />
                {isAdmin && (
                    <Tile
                        icon={LuPiggyBank}
                        label={t('Margin this month')}
                        value={margin ? formatVnd(margin.margin) : '—'}
                        hint={margin ? t('{collected} in − {costs} out', { collected: formatVnd(margin.collected), costs: formatVnd(margin.instructor_pay + margin.direct_costs) }) : null}
                        tone={margin && margin.margin < 0 ? 'alert' : undefined}
                    />
                )}
            </motion.div>

            <div className="hubDuo">
                <SectionCard icon={LuCalendarClock} title={t('Next session')} subtitle={next ? formatDate(next.date, 'long') : t('Nothing planned')}>
                    {next ? (
                        <button type="button" className="hubNext" onClick={() => setTab('sessions', { day: next.date })}>
                            <span className="hubNextTime">
                                <strong>{next.start || '—'}</strong>
                                <small>{next.end}</small>
                            </span>
                            <span className="hubNextWho">
                                <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(teacher?.avatar_path, teacher?.updated_at) ?? undefined} name={personName(teacher)} />
                                <span>
                                    <strong>{personName(teacher) || t('No instructor')}</strong>
                                    <small>
                                        {cls.room?.name ?? t('No room')}
                                        {next.row?.is_extra ? ` · ${t('Make-up')}` : ''}
                                    </small>
                                </span>
                            </span>
                            <span className={`phaseBadge tone-${nextState.tone}`}>{t(nextState.key, nextState.vars)}</span>
                            <LuChevronRight className="hubChevron" aria-hidden="true" />
                        </button>
                    ) : (
                        <p className="hubHint">{(cls.schedules ?? []).length ? t('No session in the next three weeks.') : t('This class has no weekly sessions yet.')}</p>
                    )}
                </SectionCard>

                <SectionCard icon={LuListTodo} title={t('To do')} subtitle={loading ? t('Checking…') : todos.length ? tn(todos.length, '{count} thing needs you', '{count} things need you') : t('All caught up')}>
                    {todos.length ? (
                        <ul className="hubTodos">
                            {todos.map((todo) => (
                                <li key={todo.id}>
                                    <button type="button" className={`hubTodo tone-${todo.tone}`} onClick={() => setTab(todo.tab, todo.params)}>
                                        <span className="hubTodoDot" aria-hidden="true" />
                                        <span>{t(todo.key, { ...todo.vars, date: todo.vars?.date ? formatDate(todo.vars.date, 'short') : undefined })}</span>
                                        <LuChevronRight className="hubChevron" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && (
                            <p className="hubAllClear">
                                <LuSparkles aria-hidden="true" />
                                {t('Nothing waiting for this class.')}
                            </p>
                        )
                    )}
                </SectionCard>
            </div>

            <SectionCard icon={LuMusic} title={t('Routine')} subtitle={course ? course.title : t('No routine yet')}>
                <RoutineSummary progress={progress} onOpen={() => setTab('routines')} />
            </SectionCard>
        </>
    );
};

export default OverviewTab;
