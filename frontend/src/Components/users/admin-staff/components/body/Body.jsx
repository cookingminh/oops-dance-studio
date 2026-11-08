import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import RequireRole from '@/auth/RequireRole';
import { ROLES } from '@/auth/roles';
import { stagger } from '../common/motion';
import ClassManager from './class-manager/ClassManager';
import Bookings from './booking-manager/BookingsManager';
import Rooms from './room-manager/RoomManager';
import MainBody from './main-body/MainBody';
import Attendance from './attendance/Attendance';
import Students from './students/Students';
import UserManager from './user-manager/UserManager';
import Charts from './charts/Charts';
import ProfileSettings from './settings/ProfileSettings';

// Admin and staff share these pages; user management is admin-only.
// Each page fades in and its cards (SectionCard) follow one after another.
const Body = () => {
    const location = useLocation();

    return (
        <main className="mainContentAdmin">
            <motion.div key={location.pathname} className="adminPage" variants={stagger} initial="hidden" animate="show">
                <Routes location={location}>
                    <Route index element={<MainBody />} />
                    <Route path="classes" element={<ClassManager />} />
                    <Route path="bookings" element={<Bookings />} />
                    <Route path="rooms" element={<Rooms />} />
                    <Route path="attendance-records" element={<Attendance />} />
                    <Route path="students" element={<Students />} />
                    <Route path="charts" element={<Charts />} />
                    <Route path="settings" element={<ProfileSettings />} />
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
            </motion.div>
        </main>
    );
};

export default Body;
