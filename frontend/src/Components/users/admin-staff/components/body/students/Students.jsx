import { useState } from 'react';
import StudentList from './components/StudentList';
import StudentAttendance from './components/StudentAttendance';

// Roll calls on top, class members (with attendance history) below. Marking a roll call bumps
// `version` so the history table refetches.
const Students = () => {
    const [version, setVersion] = useState(0);
    return (
        <>
            <StudentAttendance onChanged={() => setVersion((value) => value + 1)} />
            <StudentList historyVersion={version} />
        </>
    );
};

export default Students;
