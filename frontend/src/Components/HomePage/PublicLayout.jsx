import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useDisclosure } from '@nextui-org/react';
import Aos from 'aos';
import 'aos/dist/aos.css';
import { Loading } from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import Navbar from './Components/NavBar/Navbar';
import Footer from './Components/Footer/Footer';
import ContactModal from './Components/NavBar/ContactModal';
import { PublicChromeContext } from './Components/NavBar/publicChrome';
import './homeSections.scss';

const EASE = [0.22, 1, 0.36, 1];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lands on #section once the new page has rendered it (pages load their chunk and data first).
function scrollToHash(hash) {
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const attempt = () => {
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        else if (tries++ < 40) setTimeout(attempt, 50);
    };
    attempt();
}

// Shell of the public site (/home, /classes, /rooms, /about): navbar, the page, footer and the
// contact dialog. Pages cross-fade on route change and start at the top (or at their #section).
const PublicLayout = () => {
    const location = useLocation();
    const outlet = useOutlet();
    const { t } = useI18n();
    const [darkHero, setDarkHero] = useState(false);
    const { isOpen: contactOpen, onOpen: openContact, onOpenChange: onContactChange } = useDisclosure();
    const latest = useRef(location);
    latest.current = location;

    useEffect(() => {
        Aos.init({ duration: 600, easing: 'ease-out-cubic', once: true, offset: 40, disable: reducedMotion });
        // First load straight onto a section (e.g. a shared /rooms#book link).
        if (latest.current.hash) scrollToHash(latest.current.hash);
    }, []);

    // Runs when the old page has faded out, before the new one fades in.
    const onPageSwap = useCallback(() => {
        const { hash } = latest.current;
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (hash) scrollToHash(hash);
        // Let the new page render, then pick up its data-aos elements.
        setTimeout(() => Aos.refreshHard(), 60);
    }, []);

    // Same page, new #section (footer links while already on that page).
    const previous = useRef(location);
    useEffect(() => {
        if (previous.current.pathname === location.pathname && location.hash && previous.current.hash !== location.hash) {
            scrollToHash(location.hash);
        }
        previous.current = location;
    }, [location]);

    const chrome = useMemo(() => ({ darkHero, setDarkHero, openContact }), [darkHero, openContact]);

    return (
        <PublicChromeContext.Provider value={chrome}>
            <MotionConfig reducedMotion="user">
                <div className="homePage">
                    <a className="pubSkip" href="#main">
                        {t('Skip to content')}
                    </a>
                    <Navbar />
                    <AnimatePresence mode="wait" initial={false} onExitComplete={onPageSwap}>
                        <motion.main
                            key={location.pathname}
                            id="main"
                            className="publicMain"
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
                            exit={{ opacity: 0, y: -6, transition: { duration: 0.16, ease: 'easeIn' } }}
                        >
                            <Suspense fallback={<div className="pubPageLoading"><Loading /></div>}>{outlet}</Suspense>
                        </motion.main>
                    </AnimatePresence>
                    <Footer />
                </div>
                <ContactModal isOpen={contactOpen} onOpenChange={onContactChange} />
            </MotionConfig>
        </PublicChromeContext.Provider>
    );
};

export default PublicLayout;
