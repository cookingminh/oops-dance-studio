import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { LuArrowLeft } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import LanguageSwitch from '@/ui/LanguageSwitch';
import Register from '../Register/Register';
import ResetPassword from '../ResetPassword/ResetPassword';
import AuthStage from './AuthStage';
import Login from './Login';
import { EASE_OUT } from './authShared';
import './auth.scss';

const PAGES = { login: Login, register: Register, reset: ResetPassword };

// The two pages of the Log in | Sign up switch, left to right.
const TABS = [
    { page: 'login', to: '/login', label: 'Log in' },
    { page: 'register', to: '/register', label: 'Sign up' },
];
const ORDER = { login: 0, register: 1, reset: 0 };

// The form slides the way the switch moved: in from the right on the way to sign-up.
const pageSwap = {
    enter: (direction) => ({ opacity: 0, x: 24 * direction }),
    show: { opacity: 1, x: 0, transition: { duration: 0.34, ease: EASE_OUT } },
    exit: (direction) => ({ opacity: 0, x: -24 * direction, transition: { duration: 0.14, ease: 'easeIn' } }),
};

// Log in | Sign up: links to the two routes, with a pill that slides to the current one. Both
// keep location.state, so a visitor sent here from "Join this class" still goes back there.
const AuthTabs = ({ page }) => {
    const { t } = useI18n();
    const location = useLocation();
    return (
        <nav className="authTabs" aria-label={t('Log in or sign up')}>
            {TABS.map((tab) => {
                const current = tab.page === page;
                return (
                    <Link
                        key={tab.page}
                        to={tab.to}
                        state={location.state}
                        className={`authTab${current ? ' is-current' : ''}`}
                        aria-current={current ? 'page' : undefined}
                    >
                        {current && (
                            <motion.span layoutId="authTabPill" className="authTabPill" transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }} />
                        )}
                        <span className="authTabLabel">{t(tab.label)}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

// The login, sign-up and reset-password pages (App.jsx routes all three here, `page` naming
// which). Moving between /login and /register keeps this shell mounted: the studio side keeps
// moving, the switch's pill slides and only the form changes.
const AuthShell = ({ page }) => {
    const { t } = useI18n();
    const Page = PAGES[page] ?? Login;
    const tabs = page !== 'reset';
    // Which way the last switch went (stored with the page it went to, React's "previous props" way).
    // `moved` stays false until the first switch: the page that opened the shell doesn't slide in.
    const [swap, setSwap] = useState({ page, direction: 1, moved: false });
    if (swap.page !== page) setSwap({ page, direction: ORDER[page] >= ORDER[swap.page] ? 1 : -1, moved: true });

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
                    <div className={`authColumn${tabs ? ' has-tabs' : ''}`}>
                        {tabs && <AuthTabs page={page} />}
                        {/* No initial={false} here: AnimatePresence would pass it down for good and stop the
                            entrances inside the first page (its alerts, the "email sent" mark). */}
                        <AnimatePresence mode="wait" custom={swap.direction}>
                            <motion.div
                                key={page}
                                className="authView"
                                custom={swap.direction}
                                variants={pageSwap}
                                initial={swap.moved ? 'enter' : false}
                                animate="show"
                                exit="exit"
                            >
                                <Page />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </MotionConfig>
    );
};

export default AuthShell;
