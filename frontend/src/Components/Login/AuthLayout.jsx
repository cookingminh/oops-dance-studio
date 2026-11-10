import { Link } from 'react-router-dom';
import { MotionConfig, motion } from 'framer-motion';
import { LuArrowLeft } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import LanguageSwitch from '@/ui/LanguageSwitch';
import AuthStage from './AuthStage';
import { authRise, authStagger } from './authShared';
import './auth.scss';

// Shared shell of the login / sign-up / reset-password pages: the studio video beside the form
// (a banner above it on phones). `step` names the page's current state: when it changes (e.g.
// "email sent"), the column plays its entrance again.
const AuthLayout = ({ title, subtitle, footer, step = 'form', children }) => {
    const { t } = useI18n();
    return (
        <MotionConfig reducedMotion="user">
            <div className="authScreen">
                <AuthStage />
                <main className="authPane">
                    <div className="authTopBar">
                        <Link to="/home" className="authBack">
                            <LuArrowLeft aria-hidden="true" /> {t('Back to home')}
                        </Link>
                        <LanguageSwitch />
                    </div>
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
                </main>
            </div>
        </MotionConfig>
    );
};

export default AuthLayout;
