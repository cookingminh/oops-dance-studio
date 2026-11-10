import { motion } from 'framer-motion';

// A finished step ("check your inbox"): a big icon, what happens next, the way on and a tip.
const AuthNotice = ({ icon: Icon, children, action, tip }) => (
    <div className="authNotice">
        <motion.span
            className="authNoticeIcon"
            aria-hidden="true"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5, duration: 0.5, delay: 0.1 }}
        >
            <Icon />
        </motion.span>
        <p className="authNoticeText">{children}</p>
        {action}
        {tip && <p className="authNoticeHint">{tip}</p>}
    </div>
);

export default AuthNotice;
