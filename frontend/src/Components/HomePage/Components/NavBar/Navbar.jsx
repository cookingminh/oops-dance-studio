import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuMenu, LuPhone, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import LanguageSwitch from '@/ui/LanguageSwitch';
import AvatarUser from './AvatarUser';
import BrandMark from './BrandMark';
import MobileMenu from './MobileMenu';
import { PUBLIC_PAGES, usePublicChrome } from './publicChrome';
import './Navbar.scss';

const DESKTOP = '(min-width: 900px)';

const Navbar = () => {
    const { isAuthenticated } = useAuth();
    const { darkHero, openContact } = usePublicChrome();
    const { t } = useI18n();
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { pathname } = useLocation();

    // A new page closes the mobile menu.
    useEffect(() => setMenuOpen(false), [pathname]);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY >= 10);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Escape closes the menu; so does widening the window past the phone layout.
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (event) => event.key === 'Escape' && setMenuOpen(false);
        const desktop = window.matchMedia(DESKTOP);
        const onWide = (event) => event.matches && setMenuOpen(false);
        window.addEventListener('keydown', onKey);
        desktop.addEventListener('change', onWide);
        return () => {
            window.removeEventListener('keydown', onKey);
            desktop.removeEventListener('change', onWide);
        };
    }, [menuOpen]);

    // At the top of a page the bar is clear: light text over a dark hero (pages opt in with useDarkHero),
    // dark text over the light page headers. Once the page scrolls (or the phone menu opens) it turns
    // into a frosted light bar.
    const overHero = darkHero && !scrolled && !menuOpen;
    let tone = scrolled || menuOpen ? 'isSolid' : 'isClear';
    if (overHero) tone = 'isOverHero';

    const contact = () => {
        setMenuOpen(false);
        openContact();
    };

    return (
        <header className={`navBar pubNav ${tone}${scrolled ? ' isScrolled' : ''}`}>
            <div className="pubNavBar">
                <Link to="/home" className="pubNavLogo" aria-label="Oops! Dance Studio">
                    <BrandMark />
                </Link>

                <nav className="pubNavLinks" aria-label={t('Pages')}>
                    <ul>
                        {PUBLIC_PAGES.map((page) => (
                            <li key={page.to}>
                                <NavLink to={page.to} className="navPageLink">
                                    {({ isActive }) => (
                                        <>
                                            {isActive && (
                                                <motion.span
                                                    layoutId="pubNavPill"
                                                    className="pubNavPill"
                                                    transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
                                                />
                                            )}
                                            <span className="pubNavLabel">{t(page.label)}</span>
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="pubNavActions">
                    <LanguageSwitch tone={overHero ? 'dark' : 'light'} />
                    <button type="button" className="pubNavContact" onClick={contact}>
                        <LuPhone aria-hidden="true" />
                        <span>{t('Contact')}</span>
                    </button>
                    {isAuthenticated ? (
                        <AvatarUser />
                    ) : (
                        <Link to="/login" className="pubNavSignIn">
                            {t('Sign In')}
                        </Link>
                    )}
                    <button
                        type="button"
                        className="pubNavBurger"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-expanded={menuOpen}
                        aria-controls="pubMobileMenu"
                        aria-label={menuOpen ? t('Close menu') : t('Open menu')}
                    >
                        <motion.span key={menuOpen ? 'close' : 'open'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
                            {menuOpen ? <LuX /> : <LuMenu />}
                        </motion.span>
                    </button>
                </div>
            </div>

            <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onContact={contact} />
        </header>
    );
};

export default Navbar;
