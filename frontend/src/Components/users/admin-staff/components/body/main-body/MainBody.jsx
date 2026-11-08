import { motion } from 'framer-motion';
import { useAsync } from '@/hooks/useAsync';
import { dashboardStats } from '@/services/stats';
import { listPendingBookings } from '@/services/bookings';
import { getStudioToday } from '@/services/studio';
import { stagger } from '../../common/motion';
import { useStaffTasks } from '../../../tasks/staffTasks';
import WelcomeHero from './hero/WelcomeHero';
import StatCards from './stats/StatCards';
import TodayClasses from './today/TodayClasses';
import PendingBookings from './pending/PendingBookings';
import RoomsOverview from './rooms/RoomsOverview';
import Activity from './activity/Activity';
import './dashboard.scss';

const PENDING_PREVIEW = 4;

async function loadPending() {
    return listPendingBookings({ from: await getStudioToday(), limit: PENDING_PREVIEW });
}

// Dashboard: greeting and quick actions, this month's numbers, then four equal panels
// (timetable, booking requests, rooms, instructor activity). Each panel shows a short preview
// and links to its page for the full details.
const MainBody = () => {
    const stats = useAsync(dashboardStats, []);
    const pending = useAsync(loadPending, []);
    const { refresh: refreshTasks } = useStaffTasks();

    const onBookingDecided = () => {
        pending.reload();
        stats.reload();
        refreshTasks();
    };

    return (
        <motion.div className="dashboardGrid" variants={stagger}>
            <WelcomeHero stats={stats.data} pendingTotal={pending.data?.total} />
            <StatCards stats={stats} />
            <motion.div className="dashPanels" variants={stagger}>
                <TodayClasses />
                <PendingBookings pending={pending} onDecided={onBookingDecided} />
                <RoomsOverview />
                <Activity />
            </motion.div>
        </motion.div>
    );
};

export default MainBody;
