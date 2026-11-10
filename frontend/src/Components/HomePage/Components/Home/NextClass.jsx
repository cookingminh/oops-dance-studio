import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuCalendarClock } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { nextSession, studioNow } from './nextSession';

// Glass card on the hero: the class on right now, or the next one on the timetable (studio time).
const NextClass = ({ classes }) => {
    const { t, dayName } = useI18n();
    const [now, setNow] = useState(studioNow);

    useEffect(() => {
        const timer = setInterval(() => setNow(studioNow()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const next = useMemo(() => (classes.data ? nextSession(classes.data, now) : null), [classes.data, now]);
    if (!next) return null;

    let when = dayName(next.day);
    if (next.inDays === 0) when = t('Today');
    if (next.inDays === 1) when = t('Tomorrow');
    const avatar = avatarUrl(next.cls.instructor_avatar_path);

    return (
        <motion.div
            className="hpNextWrap"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
            <Link to="/classes#timetable" className="hpNextClass">
                <span className={`hpNextTag${next.live ? ' isLive' : ''}`}>
                    {next.live && <span className="hpLiveDot" aria-hidden="true" />}
                    {next.live ? t('Happening now') : t('Up next')}
                </span>
                <span className="hpNextWhen">
                    <LuCalendarClock aria-hidden="true" /> {when} · {next.start} – {next.end}
                </span>
                <strong className="hpNextName">{next.cls.name}</strong>
                <span className="hpNextCoach">
                    {avatar && <img src={avatar} alt="" />}
                    <span>
                        {t('with')} <b>{next.cls.instructor_name}</b>
                    </span>
                </span>
                <span className="hpNextGo">
                    {t('See the timetable')} <LuArrowRight aria-hidden="true" />
                </span>
            </Link>
        </motion.div>
    );
};

export default NextClass;
