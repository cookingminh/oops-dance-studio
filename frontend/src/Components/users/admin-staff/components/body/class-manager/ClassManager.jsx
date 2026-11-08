import { useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { deleteClass, listClasses } from '@/services/classes';
import { deleteSchedule } from '@/services/schedules';
import { listInstructors } from '@/services/users';
import { listRooms } from '@/services/rooms';
import { getStudioToday } from '@/services/studio';
import { formatTime, weekdayLabel } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { roomColorMap } from '../../common/chartTheme';
import { useStaffTasks } from '../../../tasks/staffTasks';
import ClassesBoard from './components/classes/ClassesBoard';
import ClassForm from './components/classes/ClassForm';
import ChangeClassImageForm from './components/classes/ChangeClassImageForm';
import WeeklyTimetable from './components/timetable/WeeklyTimetable';
import ScheduleForm from './components/schedules/ScheduleForm';
import LessonDialog from './components/lessons/LessonDialog';

// Classes (cards with this month's lesson) and the weekly timetable, from one class list.
const ClassManager = () => {
    const toast = useToast();
    const { refresh: refreshTasks } = useStaffTasks();
    const classes = useAsync(listClasses, []);
    const instructors = useAsync(listInstructors, []);
    const rooms = useAsync(listRooms, []);
    const today = useAsync(getStudioToday, []);

    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new class
    const [changingImage, setChangingImage] = useState(null);
    const [lessonClassId, setLessonClassId] = useState(null);
    const [session, setSession] = useState(undefined); // undefined = closed, { schedule, classId }

    const roomColor = roomColorMap(rooms.data);
    const lessonClass = (classes.data ?? []).find((cls) => cls.id === lessonClassId);

    const changed = () => {
        classes.reload();
        refreshTasks();
    };

    const removeClass = async (cls) => {
        if (!window.confirm(`Delete “${cls.name}”? Its schedules, lessons, enrolments and attendance records are deleted too.`)) return;
        try {
            await deleteClass(cls);
            toast.success('Class deleted.');
            changed();
        } catch (error) {
            toast.error(error);
        }
    };

    const removeSession = async (s) => {
        if (!window.confirm(`Delete ${s.cls.name}’s ${weekdayLabel(s.day_of_week)} ${formatTime(s.start_time)} session?`)) return;
        try {
            await deleteSchedule(s.id);
            toast.success('Schedule deleted.');
            changed();
        } catch (error) {
            toast.error(error);
        }
    };

    return (
        <>
            <ClassesBoard
                state={classes}
                today={today.data}
                roomColor={roomColor}
                actions={{
                    create: () => setEditing(null),
                    edit: setEditing,
                    image: setChangingImage,
                    lesson: (cls) => setLessonClassId(cls.id),
                    addSession: (cls) => setSession({ schedule: null, classId: cls.id }),
                    remove: removeClass,
                }}
            />
            <WeeklyTimetable
                state={classes}
                today={today.data}
                rooms={rooms.data}
                roomColor={roomColor}
                actions={{
                    add: () => setSession({ schedule: null, classId: null }),
                    edit: (s) => setSession({ schedule: s, classId: s.class_id }),
                    remove: removeSession,
                }}
            />

            {editing !== undefined && (
                <ClassForm
                    classRow={editing}
                    instructors={instructors.data ?? []}
                    rooms={rooms.data ?? []}
                    onClose={() => setEditing(undefined)}
                    onSaved={() => {
                        setEditing(undefined);
                        changed();
                    }}
                />
            )}
            {changingImage && (
                <ChangeClassImageForm
                    classRow={changingImage}
                    onClose={() => setChangingImage(null)}
                    onSaved={() => {
                        setChangingImage(null);
                        changed();
                    }}
                />
            )}
            {session !== undefined && (
                <ScheduleForm
                    schedule={session.schedule}
                    defaultClassId={session.classId}
                    classes={classes.data ?? []}
                    onClose={() => setSession(undefined)}
                    onSaved={() => {
                        setSession(undefined);
                        changed();
                    }}
                />
            )}
            {lessonClass && today.data && (
                <LessonDialog
                    key={lessonClass.id}
                    cls={lessonClass}
                    today={today.data}
                    onClose={() => setLessonClassId(null)}
                    onSaved={({ keepOpen = false } = {}) => {
                        if (!keepOpen) setLessonClassId(null);
                        changed();
                    }}
                />
            )}
        </>
    );
};

export default ClassManager;
