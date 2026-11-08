import { useNavigate } from 'react-router-dom';
import { Chip } from '@nextui-org/react';
import { BsArrowRightShort } from 'react-icons/bs';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { listClasses } from '@/services/classes';
import { listInstructorAttendance } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { classImageUrl, roomImageUrls } from '@/services/storage';
import { formatTimeRange, isoWeekdayOf } from '@/lib/format';
import { statusColorMap } from '../../../../../../Table/utils';
import AsyncState from '@/ui/feedback/AsyncState';
import './listing.scss';
import studioPhoto from '@/assets/images/studio.webp';
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
                .map((s) => ({ key: `${cls.id}-${s.id}`, cls, schedule: s, status: statusByClass.get(cls.id) }))
        )
        .sort((a, b) => a.schedule.start_time.localeCompare(b.schedule.start_time));
}

const Listing = () => {
    const navigate = useNavigate();
    const rooms = useAsync(listRooms, []);
    const todays = useAsync(loadTodaysClasses, []);

    return (
        <div className="adminListingSection">
            <div className="cards roomsManagement">
                <div className="heading flex">
                    <h1>Rooms Management</h1>
                    <button type="button" onClick={() => navigate('/admin/rooms')} className="btn flex">
                        See All <BsArrowRightShort className="icon" />
                    </button>
                </div>
                <AsyncState state={rooms} emptyText="No rooms yet.">
                    {(list) => (
                        <div className="secContainer flex">
                            {list.map((room) => (
                                <div className="singleItem" key={room.id}>
                                    <img src={roomImageUrls(room)[0] ?? studioPhoto} alt={room.name} />
                                    <h3>{room.name}</h3>
                                </div>
                            ))}
                        </div>
                    )}
                </AsyncState>
            </div>

            <div className="cards classesManagement flex">
                <div className="schedule">
                    <div className="heading flex">
                        <h3 className="font-bold text-xl">Today’s Classes</h3>
                        <button type="button" onClick={() => navigate('/admin/students')} className="btn flex">
                            See All <BsArrowRightShort className="icon" />
                        </button>
                    </div>
                    <AsyncState state={todays} emptyText="No classes scheduled today.">
                        {(list) =>
                            list.map(({ key, cls, schedule, status }) => (
                                <div className="singleCard flex" key={key}>
                                    <div className="users">
                                        <img src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
                                    </div>
                                    <div className="cardText">
                                        <span>
                                            {cls.name} <br /> {formatTimeRange(schedule.start_time, schedule.end_time)}
                                        </span>
                                    </div>
                                    {status ? (
                                        <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[status] ?? 'default'}>
                                            {status.replace('_', ' ')}
                                        </Chip>
                                    ) : (
                                        <button type="button" className="btn" onClick={() => navigate('/admin/attendance-records')}>
                                            See Status
                                        </button>
                                    )}
                                </div>
                            ))
                        }
                    </AsyncState>
                </div>
            </div>
        </div>
    );
};

export default Listing;
