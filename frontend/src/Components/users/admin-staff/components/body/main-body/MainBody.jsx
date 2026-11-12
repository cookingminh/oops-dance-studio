import { motion } from 'framer-motion';
import { useAsync } from '@/hooks/useAsync';
import { dashboardStats } from '@/services/stats';
import { listPendingBookings } from '@/services/bookings';
import { getStudioToday } from '@/services/studio';
import { stagger } from '../../common/motion';
import WelcomeHero from './hero/WelcomeHero';
import StatCards from './stats/StatCards';
import TodayClasses from './today/TodayClasses';
import PendingBookings from './pending/PendingBookings';
import RoomsOverview from './rooms/RoomsOverview';
import Activity from './activity/Activity';
import './dashboard.scss';

// Only the count of waiting requests is shown (the dashboard links to them).
async function loadPending() {
    return listPendingBookings({ from: await getStudioToday(), limit: 1 });
}

// Dashboard: greeting and quick actions, this month's numbers, then four panels: today's timetable
// beside the count of booking requests (a row as tall as the timetable), then rooms and instructor
// activity. Each panel shows a short preview and links to its page for the full details.
const MainBody = () => {
    const stats = useAsync(dashboardStats, []);
    const pending = useAsync(loadPending, []);

    return (
        <motion.div className="dashboardGrid" variants={stagger}>
            <WelcomeHero stats={stats.data} pendingTotal={pending.data?.total} />
            <StatCards stats={stats} />
            <motion.div className="dashPanels" variants={stagger}>
                <TodayClasses />
                <PendingBookings pending={pending} />
                <RoomsOverview />
                <Activity />
            </motion.div>
        </motion.div>
    );
};

export default MainBody;
