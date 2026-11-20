import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuArrowRight, LuCalendarDays, LuDoorOpen, LuGift } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { listLiveBanners } from '@/services/banners';
import BannerPoster from '@/ui/banners/BannerPoster';
import video from '@/assets/video/hero.mp4';
import poster from '@/assets/images/studio.webp';
import { useDarkHero } from '../NavBar/publicChrome';
import NextClass from './NextClass';
import HeroControls from './HeroControls';
import { useHeroCarousel } from './useHeroCarousel';
import './Hero.scss';

// hero.mp4 opens on a black logo card and ends on a title card; loop the studio tour and dancing in between.
const CLIP = { from: 3.4, to: 29.4 };
const keepInClip = (event) => {
    const v = event.currentTarget;
    if (v.currentTime < CLIP.from || v.currentTime > CLIP.to) v.currentTime = CLIP.from;
};

const EASE = [0.22, 1, 0.36, 1];
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } };
const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };
const words = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const word = { hidden: { opacity: 0, y: '0.45em' }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

// The portrait poster under 641 px (bannerPoster.scss uses the same breakpoint). Only that poster loads.
const PHONE = '(max-width: 640px)';
function usePhone() {
    const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
    useEffect(() => {
        const query = window.matchMedia(PHONE);
        const update = () => setPhone(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return phone;
}

// The banners that show today (services/banners.js); none, or the request failed → just the studio's slide.
function useLiveBanners() {
    const [banners, setBanners] = useState([]);
    useEffect(() => {
        let alive = true;
        listLiveBanners()
            .then((rows) => alive && setBanners(Array.isArray(rows) ? rows : []))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);
    return banners;
}

// /home hero: the studio video full-bleed under the navbar, the pitch, two ways in, and the next class. With banners
// posted from /admin/banners it becomes a slideshow: this studio slide first (it keeps the hero's height), then each
// banner's poster laid over it, cross-fading every 6 seconds, with the slide bar at the bottom.
const Home = ({ classes }) => {
    const { t, lang } = useI18n();
    const { isAuthenticated } = useAuth();
    const reduceMotion = useReducedMotion();
    const phone = usePhone();
    const banners = useLiveBanners();
    const slides = banners.length + 1;
    const hasBanners = banners.length > 0;
    const { index, go, paused, togglePaused, fills, bind } = useHeroCarousel({ count: slides, reduceMotion });
    const studioShows = index === 0;
    const videoRef = useRef(null);
    useDarkHero();

    // Posters load when needed: the first banner shortly after the page, then each one before its turn.
    const [loadedUpTo, setLoadedUpTo] = useState(0);
    useEffect(() => {
        if (!hasBanners) return undefined;
        const timer = setTimeout(() => setLoadedUpTo((n) => Math.max(n, 1)), 1200);
        return () => clearTimeout(timer);
    }, [hasBanners]);
    useEffect(() => {
        setLoadedUpTo((n) => Math.max(n, Math.min(index + 1, banners.length)));
    }, [index, banners.length]);

    // The video plays only while its slide shows.
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        if (studioShows && !reduceMotion) v.play?.()?.catch?.(() => {});
        else v.pause?.();
    }, [studioShows, reduceMotion]);

    const title = t('Create Slay Memories With Us!');
    const slideProps = (n) =>
        hasBanners
            ? {
                  role: 'group',
                  'aria-roledescription': 'slide',
                  'aria-label': t('{n} of {total}', { n: n + 1, total: slides }),
                  'aria-hidden': n === index ? undefined : true,
                  inert: n === index ? undefined : '',
              }
            : {};

    return (
        <section
            className={`hpHero${hasBanners ? ' hasSlides' : ''}`}
            {...(hasBanners
                ? { 'aria-roledescription': 'carousel', 'aria-label': t('What’s on at Oops! Dance Studio'), ...bind }
                : { 'aria-labelledby': 'hpHeroTitle' })}
        >
            <div className={`hpStudioSlide${studioShows ? ' isActive' : ''}`} {...slideProps(0)}>
                <div className="hpHeroMedia" aria-hidden="true">
                    <video
                        ref={videoRef}
                        src={video}
                        poster={poster}
                        autoPlay={!reduceMotion}
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onLoadedMetadata={(event) => {
                            event.currentTarget.currentTime = CLIP.from;
                        }}
                        onTimeUpdate={keepInClip}
                    />
                    <div className="hpHeroShade" />
                </div>

                <div className="hpHeroInner">
                    <motion.div className="hpHeroText" variants={stagger} initial="hidden" animate={studioShows ? 'show' : 'hidden'}>
                        <motion.span className="hpHeroEyebrow" variants={rise}>
                            <span className="hpLiveDot" aria-hidden="true" /> {t('Dance studio in Hanoi')}
                        </motion.span>
                        <motion.h1 id="hpHeroTitle" variants={words}>
                            {/* Word by word; the spaces stay outside the inline-block words so they don't collapse. */}
                            {title.split(' ').map((part, i) => (
                                <Fragment key={`${part}-${i}`}>
                                    <motion.span className="hpHeroWord" variants={word}>
                                        {part}
                                    </motion.span>{' '}
                                </Fragment>
                            ))}
                        </motion.h1>
                        <motion.p variants={rise}>
                            {t('New routines coached by Oops! Crew, a video shoot at the end of every course, and mirrored rooms you can book online.')}
                        </motion.p>
                        <motion.div className="hpHeroCtas" variants={rise}>
                            {isAuthenticated ? (
                                <>
                                    <Link to="/rooms" className="hpHeroBtn isPrimary">
                                        <LuDoorOpen aria-hidden="true" /> {t('Book a room')}
                                    </Link>
                                    <Link to="/classes#timetable" className="hpHeroBtn isGhost">
                                        <LuCalendarDays aria-hidden="true" /> {t('See the timetable')}
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link to="/register" className="hpHeroBtn isPrimary">
                                        <LuGift aria-hidden="true" /> {t('Claim my free class')} <LuArrowRight className="hpHeroBtnGo" aria-hidden="true" />
                                    </Link>
                                    <Link to="/rooms" className="hpHeroBtn isGhost">
                                        <LuDoorOpen aria-hidden="true" /> {t('Book a room')}
                                    </Link>
                                </>
                            )}
                        </motion.div>
                    </motion.div>

                    <NextClass classes={classes} />
                </div>
            </div>

            {banners.map((banner, i) => {
                const n = i + 1;
                return (
                    <div key={banner.id} className={`hpBannerSlide${n === index ? ' isActive' : ''}`} data-banner={banner.id} {...slideProps(n)}>
                        {n <= loadedUpTo && <BannerPoster banner={banner} lang={lang} device={phone ? 'phone' : 'desktop'} />}
                        <p className="sr-only">{banner.alt_text}</p>
                    </div>
                );
            })}

            {hasBanners && (
                <HeroControls
                    labels={[t('Oops! Dance Studio'), ...banners.map((banner) => banner.name)]}
                    index={index}
                    go={go}
                    paused={paused}
                    onTogglePause={togglePaused}
                    fills={fills}
                />
            )}
        </section>
    );
};

export default Home;
