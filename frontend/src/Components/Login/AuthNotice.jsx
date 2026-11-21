import { motion } from 'framer-motion';
import { EASE_OUT } from './authShared';

const draw = (delay, duration = 0.6) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { delay, duration, ease: EASE_OUT }, opacity: { delay, duration: 0.01 } },
});

// The "email sent" mark: an envelope draws itself, then a tick pops onto its corner.
const SentMark = () => (
    <span className="authSent" aria-hidden="true">
        <svg viewBox="0 0 72 72" focusable="false">
            <motion.path
                className="authSentPaper"
                d="M18 21h36a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V26a5 5 0 0 1 5-5z"
                {...draw(0.1, 0.7)}
            />
            <motion.path className="authSentFlap" d="M14.5 24.5 36 40l21.5-15.5" {...draw(0.45, 0.45)} />
            <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.55, duration: 0.5, delay: 0.75 }}
                style={{ transformOrigin: '56px 52px' }}
            >
                <circle className="authSentBadge" cx="56" cy="52" r="11" />
                <motion.path className="authSentTick" d="M51 52.5l3.6 3.6 6.6-7" {...draw(0.95, 0.35)} />
            </motion.g>
        </svg>
    </span>
);

// A finished step ("check your inbox"): the sent mark, what happens next, the way on and a tip.
const AuthNotice = ({ children, action, tip }) => (
    <div className="authNotice">
        <SentMark />
        <p className="authNoticeText">{children}</p>
        {action}
        {tip && <p className="authNoticeHint">{tip}</p>}
    </div>
);

export default AuthNotice;
