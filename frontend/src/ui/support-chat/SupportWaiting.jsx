import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LuHourglass } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { countdown } from './supportText';

const RING_RADIUS = 19;
const RING = 2 * Math.PI * RING_RADIUS;

// While nobody from the studio has taken the conversation: "Waiting for someone to join… usually within
// 5 minutes", counting down from when the person asked (support_status().reply_minutes) on a ring that empties
// and warms from blue to amber. Past that, a friendly "taking a little longer" (the hourglass wiggles) instead of
// a negative clock. Gone as soon as someone joins. `serverNow` (support_status().now) corrects a device clock
// that is off.
const SupportWaiting = ({ since, minutes, serverNow }) => {
    const { t, tn } = useI18n();
    const skew = useMemo(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0), [serverNow]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const total = minutes * 60_000;
    const left = Date.parse(since) + total - (now + skew);
    const late = left <= 0;
    const share = Math.min(1, Math.max(0, left / total)); // 1 → 0 as time runs out
    const colour = `color-mix(in oklab, hsl(212 62% 46%) ${Math.round(share * 100)}%, hsl(34 88% 50%))`;

    return (
        <motion.div
            className={`supportWaiting${late ? ' is-late' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
            <span className="supportWaitingIcon" aria-hidden="true">
                <LuHourglass />
            </span>
            <div className="supportWaitingText">
                <p role="status">
                    {late ? t('Taking a little longer than usual. Someone will join soon.') : t('Waiting for someone from the studio to join…')}
                </p>
                {!late && <small>{tn(minutes, 'Usually within {count} minute', 'Usually within {count} minutes')}</small>}
            </div>
            {!late && (
                <span className="supportCountdownRing" aria-hidden="true">
                    <svg viewBox="0 0 44 44">
                        <circle className="supportRingTrack" cx="22" cy="22" r={RING_RADIUS} />
                        <circle
                            className="supportRingBar"
                            cx="22"
                            cy="22"
                            r={RING_RADIUS}
                            strokeDasharray={RING}
                            strokeDashoffset={RING * (1 - share)}
                            style={{ stroke: colour }}
                        />
                    </svg>
                    <span className="supportCountdown">{countdown(left)}</span>
                </span>
            )}
        </motion.div>
    );
};

export default SupportWaiting;
