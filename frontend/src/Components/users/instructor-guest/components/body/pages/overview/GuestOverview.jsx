import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuCalendarCheck, LuCalendarDays, LuFlame, LuGift, LuListChecks, LuMusic, LuPercent, LuPlay, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import { myStats } from '@/services/stats';
import { listMyBookings } from '@/services/bookings';
import { studioHour } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../../../admin-staff/components/common/SectionCard';
import { stagger } from '../../../../../admin-staff/components/common/motion';
import { attendanceSummary, givenName, greetingFor, upcomingSessions, useStudioNow } from '../../profileHelpers';
import { loadStudentClasses } from '../classes/classData';
import { ClassPanel, ClassTabs } from '../classes/ClassSwitcher';
import { LessonCard, NextLine, WeekStrip } from '../classes/ClassParts';
import { StudentProgress } from '../classes/ClassProgress';
import { NoClasses } from '../classes/ClassView';
import TuitionOverviewCard from '../tuition/TuitionOverviewCard';
import CompleteProfileNudge from './CompleteProfileNudge';
import { Hero, StatGrid, UpNext } from './OverviewParts';
import WeekAgenda from './WeekAgenda';

const percent = (value) => `${value}%`;

async function load(userId) {
    const [classData, stats, bookings] = await Promise.all([loadStudentClasses(userId), myStats(), listMyBookings(userId)]);
    return { ...classData, stats, bookings };
}

// Student (or brand-new guest) overview: what's next, how it's going, this month's tuition and
// the week ahead.
const GuestOverview = () => {
    const { user } = useAuth();
    const { t } = useI18n();
    const data = useAsync(() => load(user.id), [user.id]);
    const { now } = useStudioNow();
    const [picked, setPicked] = useState(null);
    const { today, stats, classes = [], attendance = [], bookings = [] } = data.data ?? {};

    const week = today ? upcomingSessions(classes, today, now, 7) : [];
    const next = week[0];
    const selectedId = classes.some((cls) => cls.id === picked) ? picked : (next?.cls.id ?? classes[0]?.id);

    // Progress across every class.
    const overall = attendanceSummary(attendance);
    const month = today?.slice(0, 7);
    const thisMonth = attendance.filter((row) => row.status === 'attend' && row.date.startsWith(month)).length;
    const attended = Number(stats?.attended_count ?? 0);
    const absent = Number(stats?.absent_count ?? 0);

    const isNew = data.data && classes.length === 0;
    let summary = t('Here’s what’s coming up for you.');
    if (isNew) summary = t('Your first class is free. Pick a style you love and come dance with us!');
    else if (next?.isLive) summary = t('Your class is on right now. Have fun!');
    else if (next?.date === today) summary = t('You have class today. Get your dancing shoes ready!');
    else if (data.data && !next) summary = t('No classes in the next 7 days. Book a room and keep practising!');

    const actions = isNew
        ? [
            { to: '/classes', label: 'Find a class', icon: LuGift },
            { to: '/rooms', label: 'Book a room', icon: LuTicket },
        ]
        : [
            { to: `/profile/my-classes${next ? `?class=${next.cls.id}` : ''}`, label: 'Open my class', icon: LuPlay },
            { to: '/rooms', label: 'Book a room', icon: LuTicket },
            { to: '/profile/my-bookings', label: 'My bookings', icon: LuCalendarCheck },
        ];

    return (
        <motion.div className="pfOverview" variants={stagger}>
            <CompleteProfileNudge />
            <Hero
                title={isNew ? t('Welcome, {name}!', { name: givenName(user) }) : `${t(greetingFor(studioHour()))}, ${givenName(user)}`}
                summary={summary}
                upNext={next && <UpNext session={next} today={today} room={next.cls.roomName} />}
                actions={actions}
            />
            <StatGrid
                state={data}
                link={
                    <Link to="/profile/my-attendance" className="pfMiniLink">
                        {t('Attendance history')} <LuArrowRight aria-hidden="true" />
                    </Link>
                }
                stats={[
                    { label: 'Attended', value: attended, icon: LuListChecks, tone: 'emerald', hint: t('sessions, all time'), to: '/profile/my-attendance' },
                    { label: 'Streak', value: overall.streak, icon: LuFlame, tone: 'rose', hint: overall.streak ? t('classes in a row') : t('your next class starts one') },
                    { label: 'This month', value: thisMonth, icon: LuCalendarDays, tone: 'amber', hint: t('sessions attended') },
                    { label: 'Attendance rate', value: attended + absent ? Math.round((attended / (attended + absent)) * 100) : null, icon: LuPercent, tone: 'violet', format: percent, hint: t('all time') },
                ]}
            />

            {!isNew && <TuitionOverviewCard />}

            <SectionCard
                className="pfSnapshotCard"
                icon={LuMusic}
                title={t('My classes')}
                subtitle={t('Your current routine and how you’re doing')}
                footer={selectedId && <CardFooterLink to={`/profile/my-classes?class=${selectedId}`}>{t('Open the full class view')}</CardFooterLink>}
            >
                <AsyncState state={data} isEmpty={false}>
                    {classes.length === 0 ? (
                        <NoClasses />
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
                                        <LessonCard cls={cls} today={today} compact />
                                        <StudentProgress cls={cls} compact />
                                        <WeekStrip cls={cls} today={today} now={now} />
                                    </div>
                                )}
                            </ClassPanel>
                        </>
                    )}
                </AsyncState>
            </SectionCard>

            <WeekAgenda state={data} week={week} bookings={bookings} today={today} />
        </motion.div>
    );
};

export default GuestOverview;
