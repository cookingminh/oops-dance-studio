import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import RequireRole from '@/auth/RequireRole';
import { ROLES } from '@/auth/roles';
import { stagger } from '../../../admin-staff/components/common/motion';
import ProfileSettings from '../../../admin-staff/components/body/settings/ProfileSettings';
import Overview from './pages/overview/Overview';
import CheckIn from './pages/check-in/CheckIn';
import MyClasses from './pages/classes/MyClasses';
import MyAttendance from './pages/attendance/MyAttendance';
import MyBookings from './pages/bookings/MyBookings';
import MyTuition from './pages/tuition/MyTuition';
import './profile.scss';

// Each page fades in and its cards follow one after another (same as /admin).
const Body = () => {
    const location = useLocation();

    return (
        <main className="mainContentAdmin">
            <motion.div key={location.pathname} className="adminPage" variants={stagger} initial="hidden" animate="show">
                <Routes location={location}>
                    <Route index element={<Overview />} />
                    <Route path="my-profile" element={<ProfileSettings />} />
                    <Route path="my-bookings" element={<MyBookings />} />
                    <Route path="my-classes" element={<MyClasses />} />
                    <Route
                        path="attendance"
                        element={
                            <RequireRole roles={[ROLES.instructor]}>
                                <CheckIn />
                            </RequireRole>
                        }
                    />
                    <Route
                        path="my-attendance"
                        element={
                            <RequireRole roles={[ROLES.guest]}>
                                <MyAttendance />
                            </RequireRole>
                        }
                    />
                    <Route
                        path="tuition"
                        element={
                            <RequireRole roles={[ROLES.guest]}>
                                <MyTuition />
                            </RequireRole>
                        }
                    />
                    <Route path="*" element={<Navigate to="/profile" replace />} />
                </Routes>
            </motion.div>
        </main>
    );
};

export default Body;
