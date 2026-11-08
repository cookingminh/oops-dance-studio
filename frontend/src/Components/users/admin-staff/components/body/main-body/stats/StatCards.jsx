import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowUpRight, LuCalendarDays, LuGraduationCap, LuTicket, LuWallet } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import CountUp from '../../../common/CountUp';
import { fadeUp, stagger } from '../../../common/motion';

const STATS = [
    { key: 'monthly_booking_count', label: 'Bookings this month', icon: LuTicket, tone: 'rose', to: '/admin/bookings' },
    { key: 'total_students', label: 'Enrolled students', icon: LuGraduationCap, tone: 'violet', to: '/admin/students' },
    { key: 'classes_today', label: 'Classes today', icon: LuCalendarDays, tone: 'amber', to: '/admin/classes' },
    { key: 'revenue_this_month', label: 'Revenue this month', icon: LuWallet, tone: 'emerald', to: '/admin/charts', format: formatVnd },
];

// dashboard_stats as four cards. While loading the value is a shimmer (its text "…" is hidden).
const StatCards = ({ stats }) => {
    const valueOf = (stat) => {
        if (stats.error) return '—';
        if (stats.data === undefined) return <span className="statSkeleton">…</span>;
        return <CountUp value={Number(stats.data[stat.key] ?? 0)} format={stat.format} />;
    };

    return (
        <motion.section variants={fadeUp} className="statsBlock" aria-labelledby="studio-stats-title">
            <div className="blockHeader">
                <h2 id="studio-stats-title">Studio Stats</h2>
                <span>This month</span>
            </div>
            <motion.div className="studioStats" variants={stagger}>
                {STATS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div variants={fadeUp} key={stat.key} className={`statCard tone-${stat.tone}`}>
                            <div className="statTop">
                                <span className="statIcon" aria-hidden="true">
                                    <Icon />
                                </span>
                                <Link to={stat.to} className="statLink" aria-label={`Open ${stat.label.toLowerCase()}`}>
                                    <LuArrowUpRight />
                                </Link>
                            </div>
                            <span className="statValue">{valueOf(stat)}</span>
                            <span className="statLabel">{stat.label}</span>
                        </motion.div>
                    );
                })}
            </motion.div>
        </motion.section>
    );
};

export default StatCards;
