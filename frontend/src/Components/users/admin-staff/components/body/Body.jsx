import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import RequireRole from '@/auth/RequireRole';
import { ROLES } from '@/auth/roles';
import { stagger } from '../common/motion';
import Bookings from './booking-manager/BookingsManager';
import Rooms from './room-manager/RoomManager';
import MainBody from './main-body/MainBody';
import Attendance from './attendance/Attendance';
import UserManager from './user-manager/UserManager';
import Charts from './charts/Charts';
import ProfileSettings from './settings/ProfileSettings';
import Payroll from './payroll/Payroll';
import Tuition from './tuition/Tuition';
import Expenses from './expenses/Expenses';
import ClassHub from './class-hub/ClassHub';
import Reports from './reports/Reports';
import Activity from './activity/Activity';

// Admin and staff share these pages; user management is admin-only.
// Each page fades in and its cards (SectionCard) follow one after another.
const Body = () => {
    const location = useLocation();

    return (
        <main className="mainContentAdmin">
            <motion.div key={location.pathname} className="adminPage" variants={stagger} initial="hidden" animate="show">
                <Routes location={location}>
                    <Route index element={<MainBody />} />
                    <Route path="classes/*" element={<ClassHub />} />
                    <Route path="bookings" element={<Bookings />} />
                    <Route path="rooms" element={<Rooms />} />
                    <Route path="attendance" element={<Attendance />} />
                    {/* Student roll calls and instructor check-ins used to be two pages. */}
                    <Route path="attendance-records" element={<Navigate to="/admin/attendance" replace />} />
                    <Route path="students" element={<Navigate to="/admin/attendance" replace />} />
                    <Route path="charts" element={<Charts />} />
                    <Route path="settings" element={<ProfileSettings />} />
                    <Route path="tuition" element={<Tuition />} />
                    <Route path="expenses" element={<Expenses />} />
                    <Route
                        path="reports"
                        element={
                            <RequireRole roles={[ROLES.admin]}>
                                <Reports />
                            </RequireRole>
                        }
                    />
                    <Route
                        path="activity"
                        element={
                            <RequireRole roles={[ROLES.admin]}>
                                <Activity />
                            </RequireRole>
                        }
                    />
                    <Route
                        path="payroll"
                        element={
                            <RequireRole roles={[ROLES.admin]}>
                                <Payroll />
                            </RequireRole>
                        }
                    />
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
