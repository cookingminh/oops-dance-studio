import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink } from 'react-router-dom';
import { LuChevronRight, LuDoorOpen, LuGift, LuHome, LuLogIn, LuMusic, LuPhone, LuSparkles, LuUserPlus } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { PUBLIC_PAGES } from './publicChrome';

const ICONS = { '/home': LuHome, '/classes': LuMusic, '/rooms': LuDoorOpen, '/about': LuSparkles };
const EASE = [0.22, 1, 0.36, 1];

const list = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE } } };

// Phone menu: drops down under the bar. Closes on a link (the route change), the backdrop or Escape.
const MobileMenu = ({ open, onClose, onContact }) => {
    const { isAuthenticated } = useAuth();
    const { t } = useI18n();

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="backdrop"
                        className="pubMenuBackdrop"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />
                    <motion.div
                        key="menu"
                        id="pubMobileMenu"
                        className="pubMenu"
                        initial={{ opacity: 0, y: -14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        <motion.ul className="pubMenuLinks" variants={list} initial="hidden" animate="show">
                            {PUBLIC_PAGES.map((page) => {
                                const Icon = ICONS[page.to];
                                return (
                                    <motion.li key={page.to} variants={item}>
                                        <NavLink to={page.to} className="pubMenuLink" onClick={onClose}>
                                            <span className="pubMenuIcon" aria-hidden="true">
                                                <Icon />
                                            </span>
                                            <span>{t(page.label)}</span>
                                            <LuChevronRight className="pubMenuGo" aria-hidden="true" />
                                        </NavLink>
                                    </motion.li>
                                );
                            })}
                        </motion.ul>

                        <div className="pubMenuActions">
                            <button type="button" className="pubMenuBtn" onClick={onContact}>
                                <LuPhone aria-hidden="true" /> {t('Contact')}
                            </button>
                            {!isAuthenticated && (
                                <Link to="/login" className="pubMenuBtn isPrimary" onClick={onClose}>
                                    <LuLogIn aria-hidden="true" /> {t('Sign In')}
                                </Link>
                            )}
                        </div>

                        {!isAuthenticated && (
                            <Link to="/register" className="pubMenuPromo" onClick={onClose}>
                                <span className="pubMenuPromoIcon" aria-hidden="true">
                                    <LuGift />
                                </span>
                                <span>
                                    <strong>{t('Your first class is free')}</strong>
                                    <small>
                                        <LuUserPlus aria-hidden="true" /> {t('Sign Up')}
                                    </small>
                                </span>
                            </Link>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default MobileMenu;
