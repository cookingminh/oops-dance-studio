import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { listMyEnrolledClasses } from '@/services/classes';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatDate, formatTimeRange, formatVnd, weekdayLabel } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import './MyClasses.scss';
import classImagePlaceHolder from '@/assets/images/logo-mark.webp';

// Classes the signed-in guest is enrolled in (class details come from the public listing).
const MyClasses = () => {
    const { user } = useAuth();
    const classes = useAsync(() => listMyEnrolledClasses(user.id), [user.id]);

    return (
        <div className="myClasses sectionContainer flex flex-col gap-4">
            <div className="header text-center font-bold">
                <h2 className="text-4xl">Your Classes</h2>
            </div>
            <AsyncState state={classes} emptyText="You have not enrolled in any class yet. Contact the studio to join one.">
                {(list) =>
                    list.map((classItem) => (
                        <div key={classItem.id} className="singleItem flex gap-4">
                            <div className="classImgDiv flex">
                                <div className="img">
                                    <img src={classImageUrl(classItem.image_path) ?? classImagePlaceHolder} alt={classItem.name} />
                                </div>
                                <h2>{classItem.name}</h2>
                            </div>

                            <div className="classDetails cards flex">
                                <div className="heading1">
                                    <h2>DETAILS</h2>
                                </div>
                                <div className="singleContent flex">
                                    <div className="heading2">
                                        <h3>Instructor</h3>
                                    </div>
                                    <div className="cards flex items-center gap-2">
                                        {classItem.instructor_avatar_path && (
                                            <img src={avatarUrl(classItem.instructor_avatar_path)} alt="" className="w-10 h-10 rounded-full object-cover" />
                                        )}
                                        <h3>{classItem.instructor_name}</h3>
                                    </div>
                                </div>
                                <div className="singleContent flex">
                                    <div className="heading2">
                                        <h3>Schedule</h3>
                                    </div>
                                    <div className="cards">
                                        {(classItem.schedules ?? []).map((s) => (
                                            <h3 key={`${s.day_of_week}-${s.start_time}`}>
                                                {weekdayLabel(s.day_of_week)}: <span>{formatTimeRange(s.start_time, s.end_time)}</span>
                                            </h3>
                                        ))}
                                    </div>
                                </div>
                                <div className="singleContent flex">
                                    <div className="heading2">
                                        <h3>Room</h3>
                                    </div>
                                    <div className="cards">
                                        <h3>{classItem.room_name ?? '—'}</h3>
                                    </div>
                                </div>
                                <div className="singleContent flex">
                                    <div className="heading2">
                                        <h3>Lesson’s Detail</h3>
                                    </div>
                                    <div className="cards">
                                        <h3>{classItem.lesson || '—'}</h3>
                                    </div>
                                </div>
                                <div className="singleContent flex">
                                    <div className="heading2">
                                        <h3>Fee · Joined</h3>
                                    </div>
                                    <div className="cards">
                                        <h3>{formatVnd(classItem.price)} · since {formatDate(classItem.joined_at)}</h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </AsyncState>
            <p className="text-center">
                <Link to="/profile/my-attendance" className="underline">See my attendance</Link>
            </p>
        </div>
    );
};

export default MyClasses;
