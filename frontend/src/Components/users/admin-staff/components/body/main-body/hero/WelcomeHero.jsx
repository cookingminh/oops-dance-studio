import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuClipboardCheck, LuPieChart, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { studioDateLabel, studioHour } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../../common/motion';
import video from '@/assets/video/dashboard.mp4';
import poster from '@/assets/images/studio.webp';

const greeting = (hour) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

// "Trần Thị Thu Hà" → "Hà" (Vietnamese given name comes last).
const givenName = (fullName) => fullName?.trim().split(/\s+/).pop();

function summaryOf(stats, pendingTotal, { t, tn }) {
    if (!stats || pendingTotal === undefined) return t('Here’s what is happening at the studio today.');
    const classes = Number(stats.classes_today ?? 0);
    const classPart = classes
        ? tn(classes, '{count} class on today’s timetable', '{count} classes on today’s timetable')
        : t('No classes on the timetable today');
    const pendingPart = pendingTotal
        ? tn(pendingTotal, '{count} booking request waiting for you', '{count} booking requests waiting for you')
        : t('no booking requests waiting');
    return t('{classPart} and {pendingPart}.', { classPart, pendingPart });
}

const WelcomeHero = ({ stats, pendingTotal }) => {
    const { user } = useAuth();
    const i18n = useI18n();
    const { t, intl } = i18n;

    return (
        <motion.section variants={fadeUp} className="welcomeHero">
            <video className="heroVideo" src={video} poster={poster} autoPlay muted loop playsInline aria-hidden="true" />
            <div className="heroOverlay" />
            <div className="heroContent">
                <span className="heroEyebrow">{studioDateLabel(intl)}</span>
                <h2>
                    {t(greeting(studioHour()))}, {givenName(user.full_name) || user.username}
                </h2>
                <p>{summaryOf(stats, pendingTotal, i18n)}</p>
                <div className="heroActions">
                    <Link to="/admin/bookings" className="heroBtn isPrimary">
                        <LuTicket aria-hidden="true" /> {t('Manage bookings')}
                    </Link>
                    <Link to="/admin/attendance" className="heroBtn">
                        <LuClipboardCheck aria-hidden="true" /> {t('Take attendance')}
                    </Link>
                    <Link to="/admin/charts" className="heroBtn">
                        <LuPieChart aria-hidden="true" /> {t('View charts')}
                    </Link>
                </div>
            </div>
        </motion.section>
    );
};

export default WelcomeHero;
