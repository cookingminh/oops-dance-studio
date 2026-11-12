import { Link } from 'react-router-dom';
import { Chip } from '@nextui-org/react';
import { LuCalendarDays, LuCalendarX } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listClasses } from '@/services/classes';
import { listInstructorAttendance } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { classImageUrl } from '@/services/storage';
import { formatTime, isoWeekdayOf } from '@/lib/format';
import { placeOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { statusColorMap } from '../../../../../../Table/utils';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';
import { useStudioClock } from '../../../common/useStudioClock';
import placeholder from '@/assets/images/logo-mark.webp';
import ClassLink from '../../class-hub/ClassLink';

// Today's sessions from the class schedules, with the instructor attendance status when generated.
async function loadTodaysClasses() {
    const today = await getStudioToday();
    const weekday = isoWeekdayOf(today);
    const [classes, attendance] = await Promise.all([listClasses(), listInstructorAttendance({ date: today })]);
    const statusByClass = new Map(attendance.map((row) => [row.class_id, row.status]));
    return classes
        .flatMap((cls) =>
            cls.schedules
                .filter((s) => s.day_of_week === weekday)
                .map((s) => ({
                    key: `${cls.id}-${s.id}`,
                    cls,
                    start: formatTime(s.start_time),
                    end: formatTime(s.end_time),
                    status: statusByClass.get(cls.id),
                }))
        )
        .sort((a, b) => a.start.localeCompare(b.start));
}

const PREVIEW = 4;

const phaseOf = ({ start, end }, now) => (now < start ? 'upcoming' : now < end ? 'live' : 'done');

const TodayClasses = () => {
    const { t, tn } = useI18n();
    const sessions = useAsync(loadTodaysClasses, []);
    const now = useStudioClock();
    const count = sessions.data?.length;

    return (
        <SectionCard
            className="todayCard"
            icon={LuCalendarDays}
            title={t('Today’s Classes')}
            subtitle={count === undefined ? t('Loading the timetable…') : tn(count, '{count} session on the timetable', '{count} sessions on the timetable')}
            footer={
                <CardFooterLink to="/admin/classes">
                    {count > PREVIEW ? t('{count} more today · open the timetable', { count: count - PREVIEW }) : t('Open the full timetable')}
                </CardFooterLink>
            }
        >
            <AsyncState
                state={sessions}
                isEmpty={count === 0}
                emptyText={
                    <span className="emptyState">
                        <LuCalendarX aria-hidden="true" /> {t('No classes scheduled today.')}
                    </span>
                }
            >
                {(list) => (
                    <ol className="timeline">
                        {list.slice(0, PREVIEW).map((session) => {
                            const { key, cls, start, end, status } = session;
                            const phase = phaseOf(session, now);
                            const people = [cls.instructor?.full_name || cls.instructor?.username, placeOf(cls).name].filter(Boolean);
                            return (
                                <li key={key} className={`timelineItem is-${phase}`}>
                                    <div className="timelineTime">
                                        <strong>{start}</strong>
                                        <span>{end}</span>
                                    </div>
                                    <span className="timelineRail" aria-hidden="true">
                                        <span className="timelineDot" />
                                    </span>
                                    <div className="timelineBody">
                                        <img className="timelineThumb" src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
                                        <div className="timelineInfo">
                                            <strong>
                                                <ClassLink id={cls.id}>{cls.name}</ClassLink>
                                            </strong>
                                            <span>{people.join(' · ')}</span>
                                        </div>
                                        {phase === 'live' ? (
                                            <span className="liveBadge">
                                                <span className="livePulse" aria-hidden="true" /> {t('Live now')}
                                            </span>
                                        ) : status ? (
                                            <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[status] ?? 'default'}>
                                                {t(status.replace('_', ' '))}
                                            </Chip>
                                        ) : (
                                            <Link to="/admin/attendance" className="timelineLink">
                                                {t('No record')}
                                            </Link>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default TodayClasses;
