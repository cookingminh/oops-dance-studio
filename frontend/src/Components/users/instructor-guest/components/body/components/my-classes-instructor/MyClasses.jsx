import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { listInstructorClasses } from '@/services/classes';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatDate, formatTimeRange, weekdayLabel } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import SmallTableTemplate from '../../../../../../SmallTable/SmallTableTemplate';
import './MyClasses.scss';
import classImagePlaceHolder from '@/assets/images/logo-mark.webp';

const memberColumns = [
    { name: 'No.', uid: 'no' },
    { name: 'Student', uid: 'user' },
    { name: 'Contact', uid: 'contact' },
    { name: 'DOB', uid: 'dob' },
];

// Classes taught by the signed-in instructor, with their students (RLS: own classes only).
const MyClasses = () => {
    const { user } = useAuth();
    const classes = useAsync(() => listInstructorClasses(user.id), [user.id]);

    return (
        <div className="myClasses">
            <AsyncState state={classes} emptyText="You are not teaching any class yet.">
                {(list) =>
                    list.map((classItem) => (
                        <div key={classItem.id} className="sectionContainer singleItem flex">
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
                                        <h3>Schedule</h3>
                                    </div>
                                    <div className="cards">
                                        {classItem.schedules.length === 0 && <h3>No schedule yet</h3>}
                                        {classItem.schedules.map((s) => (
                                            <h3 key={s.id}>
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
                                        <h3>{classItem.room ? `${classItem.room.name}${classItem.room.size ? ` – ${classItem.room.size}` : ''}` : '—'}</h3>
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
                                        <h3>Class’s members</h3>
                                    </div>
                                    <div className="studentTable cards">
                                        <SmallTableTemplate
                                            data={classItem.students.map(({ student }, index) => ({
                                                id: student.id,
                                                no: index + 1,
                                                name: student.full_name,
                                                username: student.username,
                                                email: student.email,
                                                avatar: avatarUrl(student.avatar_path, student.updated_at),
                                                contact: student.contact_number ?? '',
                                                dob: formatDate(student.date_of_birth),
                                            }))}
                                            columns={memberColumns}
                                            rowsPerPage={4}
                                            emptyContent="No students yet"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </AsyncState>
        </div>
    );
};

export default MyClasses;
