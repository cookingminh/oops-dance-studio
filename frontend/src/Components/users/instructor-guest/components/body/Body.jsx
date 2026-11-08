import { Navigate, Route, Routes } from 'react-router-dom';
import RequireRole from '@/auth/RequireRole';
import { ROLES } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import './body.scss';

import MainBody from './components/main-body/MainBody';
import Attendance from './components/attendance/Attendance';
import InstructorClasses from './components/my-classes-instructor/MyClasses';
import GuestClasses from './components/my-classes-guest/MyClasses';
import StudentChart from './components/my-classes-guest/StudentChart';
import MyBookings from './components/my-bookings/MyBookings';
import Setting from './components/setting/Setting';

const Body = () => {
    const { role } = useAuth();

    return (
        <div className="mainContentInstructor">
            <Routes>
                <Route index element={<MainBody />} />
                <Route path="my-profile" element={<Setting />} />
                <Route path="my-bookings" element={<MyBookings />} />
                <Route
                    path="my-classes"
                    element={role === ROLES.instructor ? <InstructorClasses /> : <GuestClasses />}
                />
                <Route
                    path="attendance"
                    element={
                        <RequireRole roles={[ROLES.instructor]}>
                            <Attendance />
                        </RequireRole>
                    }
                />
                <Route
                    path="my-attendance"
                    element={
                        <RequireRole roles={[ROLES.guest]}>
                            <StudentChart />
                        </RequireRole>
                    }
                />
                <Route path="*" element={<Navigate to="/profile" replace />} />
            </Routes>
        </div>
    );
};

export default Body;
