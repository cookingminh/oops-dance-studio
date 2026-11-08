import { useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { listClasses } from '@/services/classes';
import { listInstructors } from '@/services/users';
import { listRooms } from '@/services/rooms';
import './ClassManager.scss';
import ClassList from './components/classes/ClassList';
import Schedule from './components/schedules/Schedule';

const ClassManager = () => {
    const classes = useAsync(listClasses, []);
    const instructors = useAsync(listInstructors, []);
    const rooms = useAsync(listRooms, []);
    // Bumped when classes change so the schedule list (which shows class names) refreshes too.
    const [classesVersion, setClassesVersion] = useState(0);

    const onClassesChanged = () => {
        classes.reload();
        setClassesVersion((v) => v + 1);
    };

    return (
        <div className="classManager">
            <ClassList classes={classes} instructors={instructors} rooms={rooms} onChanged={onClassesChanged} />
            <Schedule classes={classes} refreshKey={classesVersion} onChanged={classes.reload} />
        </div>
    );
};

export default ClassManager;
