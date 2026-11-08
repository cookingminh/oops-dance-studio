import { Navigate, Route, Routes } from 'react-router-dom';
import RequireRole from '@/auth/RequireRole';
import { ROLES } from '@/auth/roles';
import './body.scss';
import ClassManager from './class-manager/ClassManager';
import Bookings from './booking-manager/BookingsManager';
import Rooms from './room-manager/RoomManager';
import MainBody from './main-body/MainBody';
import Attendance from './attendance/Attendance';
import Students from './students/Students';
import UserManager from './user-manager/UserManager';
import Charts from './charts/Charts';

// Admin and staff share these pages; user management is admin-only.
const Body = () => (
    <div className="mainContentAdmin">
        <Routes>
            <Route index element={<MainBody />} />
            <Route path="classes" element={<ClassManager />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="attendance-records" element={<Attendance />} />
            <Route path="students" element={<Students />} />
            <Route path="charts" element={<Charts />} />
            <Route
                path="users"
                element={
                    <RequireRole roles={[ROLES.admin]}>
                        <UserManager />
                    </RequireRole>
                }
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
    </div>
);

export default Body;
