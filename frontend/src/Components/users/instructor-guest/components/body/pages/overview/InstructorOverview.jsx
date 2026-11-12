import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuCalendarCheck, LuCalendarDays, LuClipboardCheck, LuCoffee, LuMusic, LuTicket, LuUsers } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import { myStats } from '@/services/stats';
import { listMyInstructorAttendance } from '@/services/attendance';
import { studioHour } from '@/lib/format';
import { placeOf } from '@/lib/place';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../../../admin-staff/components/common/SectionCard';
import { stagger } from '../../../../../admin-staff/components/common/motion';
import { canCheckIn, canCheckOut, givenName, greetingFor, sessionPhase, sessionTimes, upcomingSessions, useStudioNow } from '../../profileHelpers';
import CheckForm from '../check-in/CheckForm';
import { loadInstructorClasses } from '../classes/classData';
import { ClassPanel, ClassTabs } from '../classes/ClassSwitcher';
import { ClassThumb, DayName, LessonCard, NextLine, WeekStrip } from '../classes/ClassParts';
import { CheckAction } from '../classes/ClassNext';
import { AvatarStack } from '../classes/ClassRoster';
import { NoClasses } from '../classes/ClassView';
import MakeUpTag from '../../../../../admin-staff/components/body/class-manager/routines/MakeUpTag';
import LateTag from '../../../../../admin-staff/components/common/checkins/LateTag';
import { reasonText } from '../../../../../admin-staff/components/common/session-changes/changeText';
import { Hero, StatGrid, UpNext } from './OverviewParts';

async function load(userId) {
    const [classData, stats, history] = await Promise.all([loadInstructorClasses(userId), myStats(), listMyInstructorAttendance(userId)]);
    return { ...classData, stats, history };
}

const byStart = (a, b) => sessionTimes(a.class, a.date).start.localeCompare(sessionTimes(b.class, b.date).start);

// Who is in the class and how the last roll call went.
const ClassPeek = ({ cls }) => {
    const { t, tn, formatDate } = useI18n();
    const lastDate = cls.rollCalls.find((row) => row.status !== 'pending')?.date;
    const last = cls.rollCalls.filter((row) => row.date === lastDate);
    const came = last.filter((row) => row.status === 'attend').length;
    return (
        <section className="pfBlock pfPeek" aria-label={t('Students')}>
            <header className="pfBlockHead">
                <h4>
                    <LuUsers aria-hidden="true" /> {tn(cls.students.length, '{count} student', '{count} students')}
                </h4>
            </header>
            {cls.students.length > 0 ? <AvatarStack students={cls.students} /> : <p className="pfMuted">{t('No students yet.')}</p>}
            {lastDate && (
                <p className="pfPeekLine">
                    {t('Last roll call ({date}): {came} of {total} came', { date: formatDate(lastDate, 'short'), came, total: last.length })}
                </p>
            )}
        </section>
    );
};

// Instructor overview: today's sessions with one-tap check-in, and each class's song and students.
const InstructorOverview = () => {
    const { user } = useAuth();
    const { t, tn, formatDate } = useI18n();
    const data = useAsync(() => load(user.id), [user.id]);
    const { now } = useStudioNow();
    const [picked, setPicked] = useState(null);
    const [checking, setChecking] = useState(null); // { kind, attendance }
    const { today, stats, classes = [], sessions = [], history = [] } = data.data ?? {};

    const todayRows = [...sessions].sort(byStart);
    const open = todayRows.filter((row) => !['completed', 'cancelled'].includes(row.status));
    const next = today ? upcomingSessions(classes, today, now, 8)[0] : null;
    const selectedId = classes.some((cls) => cls.id === picked) ? picked : (next?.cls.id ?? classes[0]?.id);
    // The rest of the week, sessions called off included (greyed, with why).
    const later = today ? upcomingSessions(classes, today, now, 7, { withCancelled: true }).filter((session) => session.date !== today).slice(0, 4) : [];
    const month = today?.slice(0, 7);
    const taughtThisMonth = history.filter((row) => row.status === 'completed' && row.date.startsWith(month)).length;

    let summary = t('Here’s your teaching day.');
    if (data.data) {
        if (!todayRows.length) summary = t('No sessions today. Enjoy your day off!');
        else if (!open.length) summary = `${tn(todayRows.length, '{count} session today', '{count} sessions today')} · ${t('all done, great work!')}`;
        else summary = `${tn(todayRows.length, '{count} session today', '{count} sessions today')} · ${t('check in with a photo when you arrive.')}`;
    }

    return (
        <motion.div className="pfOverview isInstructor" variants={stagger}>
            <Hero
                title={`${t(greetingFor(studioHour()))}, ${givenName(user)}`}
                summary={summary}
                upNext={next && <UpNext session={next} today={today} place={next.cls.place} />}
                actions={[
                    { to: '/profile/attendance', label: 'Check in', icon: LuClipboardCheck },
                    { to: '/profile/my-classes', label: 'My classes', icon: LuCalendarDays },
                    { to: '/profile/my-bookings', label: 'My bookings', icon: LuTicket },
                ]}
            />
            <StatGrid
                state={data}
                link={
                    <Link to="/profile/attendance" className="pfMiniLink">
                        {t('Check-in history')} <LuArrowRight aria-hidden="true" />
                    </Link>
                }
                stats={[
                    { label: 'Sessions taught', value: Number(stats?.completed_sessions ?? 0), icon: LuClipboardCheck, tone: 'emerald', hint: t('all time'), to: '/profile/attendance' },
                    { label: 'Taught this month', value: taughtThisMonth, icon: LuCalendarCheck, tone: 'amber', hint: month ? formatDate(`${month}-01`, 'monthYear') : null },
                    { label: 'Students', value: classes.reduce((sum, cls) => sum + cls.students.length, 0), icon: LuUsers, tone: 'violet', hint: t('across your classes') },
                    { label: 'Classes', value: classes.length, icon: LuMusic, tone: 'rose', hint: tn(classes.reduce((sum, cls) => sum + cls.schedules.length, 0), '{count} session a week', '{count} sessions a week'), to: '/profile/my-classes' },
                ]}
            />


            <SectionCard
                className="pfTodayCard"
                icon={LuClipboardCheck}
                title={t('Today’s sessions')}
                subtitle={today ? formatDate(today, 'long') : t('Loading…')}
                footer={<CardFooterLink to="/profile/attendance">{t('Check in and out')}</CardFooterLink>}
            >
                <AsyncState state={data} isEmpty={false}>
                    {todayRows.length === 0 ? (
                        <div className="pfEmptyLine">
                            <LuCoffee aria-hidden="true" />
                            <span>{t('No sessions today. Enjoy your day off!')}</span>
                        </div>
                    ) : (
                        <ol className="pfTodayList">
                            {todayRows.map((row) => {
                                const { start, end } = sessionTimes(row.class, row.date);
                                const phase = sessionPhase(row, now);
                                return (
                                    <li key={row.id} className={`pfTodayItem tone-${phase.tone}`}>
                                        <span className="pfTodayTime">
                                            <strong>{start}</strong>
                                            <small>{end}</small>
                                        </span>
                                        <ClassThumb cls={row.class} />
                                        <span className="pfTodayText">
                                            <strong>{row.class?.name}</strong>
                                            <span>{placeOf(row, row.class).name ?? t('No room')}</span>
                                        </span>
                                        <span className={`pfPhase tone-${phase.tone}`}>
                                            {phase.tone === 'live' && <span className="pfPulse" aria-hidden="true" />}
                                            {t(phase.key, phase.vars)}
                                        </span>
                                        {row.checkout_late && <LateTag />}
                                        {(canCheckIn(row) || canCheckOut(row)) && (
                                            <span className="pfTodayAction">
                                                <CheckAction record={row} now={now} onCheck={setChecking} size="sm" />
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                    {later.length > 0 && (
                        <div className="pfLater">
                            <h4 className="pfAgendaDay">{t('Coming up')}</h4>
                            <ul>
                                {later.map((session) => (
                                    <li key={`${session.cls.id}-${session.date}-${session.start}`} className={session.calledOff ? 'isOff' : undefined}>
                                        <span className="pfLaterDay">
                                            <DayName date={session.date} today={today} style="weekdayShort" />
                                        </span>
                                        <span className="pfLaterTime">{session.start}</span>
                                        <ClassThumb cls={session.cls} />
                                        <span className="pfLaterText">
                                            <strong>{session.cls.name}</strong>
                                            <span>
                                                {session.calledOff
                                                    ? [t('Called off'), reasonText(session.calledOff.reason, t)].filter(Boolean).join(' · ')
                                                    : session.cls.place.name ?? t('No room')}
                                            </span>
                                        </span>
                                        {session.isMakeUp && <MakeUpTag />}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </AsyncState>
            </SectionCard>

            <SectionCard
                className="pfSnapshotCard"
                icon={LuMusic}
                title={t('My classes')}
                subtitle={t('The current routine and who’s dancing')}
                footer={selectedId && <CardFooterLink to={`/profile/my-classes?class=${selectedId}`}>{t('Open the full class view')}</CardFooterLink>}
            >
                <AsyncState state={data} isEmpty={false}>
                    {classes.length === 0 ? (
                        <NoClasses isInstructor />
                    ) : (
                        <>
                            <ClassTabs
                                classes={classes}
                                selectedId={selectedId}
                                onSelect={setPicked}
                                idPrefix="overview-classes"
                                variant="chips"
                                renderMeta={(cls) => <NextLine cls={cls} today={today} now={now} />}
                            />
                            <ClassPanel classes={classes} selectedId={selectedId} idPrefix="overview-classes">
                                {(cls) => (
                                    <div className="pfSnapshot">
                                        <LessonCard cls={cls} today={today} isInstructor compact />
                                        <ClassPeek cls={cls} />
                                        <WeekStrip cls={cls} today={today} now={now} />
                                    </div>
                                )}
                            </ClassPanel>
                        </>
                    )}
                </AsyncState>
            </SectionCard>

            {checking && (
                <CheckForm
                    kind={checking.kind}
                    attendance={checking.attendance}
                    onClose={() => setChecking(null)}
                    onDone={() => {
                        setChecking(null);
                        data.reload();
                    }}
                />
            )}
        </motion.div>
    );
};

export default InstructorOverview;
