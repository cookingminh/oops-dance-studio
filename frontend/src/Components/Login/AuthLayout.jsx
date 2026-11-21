import { motion } from 'framer-motion';
import { authRise, authStagger } from './authShared';

// One auth page's column inside AuthShell: title, subtitle, the form and an optional footer line.
// `step` names the page's current state: when it changes (e.g. "email sent"), the column plays
// its entrance again.
const AuthLayout = ({ title, subtitle, footer, step = 'form', children }) => (
    <motion.div key={step} className="authBody" variants={authStagger} initial="hidden" animate="show">
        <motion.header className="authHeader" variants={authRise}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
        </motion.header>
        <motion.div className="authContent" variants={authRise}>
            {children}
        </motion.div>
        {footer && (
            <motion.p className="authSwitch" variants={authRise}>
                {footer}
            </motion.p>
        )}
    </motion.div>
);

export default AuthLayout;
