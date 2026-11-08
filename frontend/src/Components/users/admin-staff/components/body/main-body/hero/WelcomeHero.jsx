import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuClipboardCheck, LuPieChart, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { studioDateLabel, studioHour } from '@/lib/format';
import { fadeUp } from '../../../common/motion';
import video from '@/assets/video/dashboard.mp4';
import poster from '@/assets/images/studio.webp';

const greeting = (hour) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// "Trần Thị Thu Hà" → "Hà" (Vietnamese given name comes last).
const givenName = (fullName) => fullName?.trim().split(/\s+/).pop();

function summaryOf(stats, pendingTotal) {
    if (!stats || pendingTotal === undefined) return 'Here’s what is happening at the studio today.';
    const classes = Number(stats.classes_today ?? 0);
    const classPart = classes ? `${plural(classes, 'class', 'classes')} on today’s timetable` : 'No classes on the timetable today';
    const pendingPart = pendingTotal
        ? `${plural(pendingTotal, 'booking request', 'booking requests')} waiting for you`
        : 'no booking requests waiting';
    return `${classPart} and ${pendingPart}.`;
}

const WelcomeHero = ({ stats, pendingTotal }) => {
    const { user } = useAuth();

    return (
        <motion.section variants={fadeUp} className="welcomeHero">
            <video className="heroVideo" src={video} poster={poster} autoPlay muted loop playsInline aria-hidden="true" />
            <div className="heroOverlay" />
            <div className="heroContent">
                <span className="heroEyebrow">{studioDateLabel()}</span>
                <h2>
                    {greeting(studioHour())}, {givenName(user.full_name) || user.username}
                </h2>
                <p>{summaryOf(stats, pendingTotal)}</p>
                <div className="heroActions">
                    <Link to="/admin/bookings" className="heroBtn isPrimary">
                        <LuTicket aria-hidden="true" /> Manage bookings
                    </Link>
                    <Link to="/admin/students" className="heroBtn">
                        <LuClipboardCheck aria-hidden="true" /> Take attendance
                    </Link>
                    <Link to="/admin/charts" className="heroBtn">
                        <LuPieChart aria-hidden="true" /> View charts
                    </Link>
                </div>
            </div>
        </motion.section>
    );
};

export default WelcomeHero;
