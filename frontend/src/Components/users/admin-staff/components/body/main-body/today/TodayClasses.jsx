import { Link } from 'react-router-dom';
import { Chip } from '@nextui-org/react';
import { LuCalendarDays, LuCalendarX } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listClasses } from '@/services/classes';
import { listInstructorAttendance } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { classImageUrl } from '@/services/storage';
import { formatTime, isoWeekdayOf } from '@/lib/format';
import { statusColorMap } from '../../../../../../Table/utils';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';
import { useStudioClock } from '../../../common/useStudioClock';
import placeholder from '@/assets/images/logo-mark.webp';

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
    const sessions = useAsync(loadTodaysClasses, []);
    const now = useStudioClock();
    const count = sessions.data?.length;

    return (
        <SectionCard
            className="todayCard"
            icon={LuCalendarDays}
            title="Today’s Classes"
            subtitle={count === undefined ? 'Loading the timetable…' : `${count} session${count === 1 ? '' : 's'} on the timetable`}
            footer={
                <CardFooterLink to="/admin/classes">
                    {count > PREVIEW ? `${count - PREVIEW} more today · open the timetable` : 'Open the full timetable'}
                </CardFooterLink>
            }
        >
            <AsyncState
                state={sessions}
                isEmpty={count === 0}
                emptyText={
                    <span className="emptyState">
                        <LuCalendarX aria-hidden="true" /> No classes scheduled today.
                    </span>
                }
            >
                {(list) => (
                    <ol className="timeline">
                        {list.slice(0, PREVIEW).map((session) => {
                            const { key, cls, start, end, status } = session;
                            const phase = phaseOf(session, now);
                            const people = [cls.instructor?.full_name || cls.instructor?.username, cls.room?.name].filter(Boolean);
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
                                            <strong>{cls.name}</strong>
                                            <span>{people.join(' · ')}</span>
                                        </div>
                                        {phase === 'live' ? (
                                            <span className="liveBadge">
                                                <span className="livePulse" aria-hidden="true" /> Live now
                                            </span>
                                        ) : status ? (
                                            <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[status] ?? 'default'}>
                                                {status.replace('_', ' ')}
                                            </Chip>
                                        ) : (
                                            <Link to="/admin/attendance-records" className="timelineLink">
                                                No record
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
