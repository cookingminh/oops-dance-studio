import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuArrowRight, LuCalendarDays, LuDoorOpen, LuGift } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import video from '@/assets/video/hero.mp4';
import poster from '@/assets/images/studio.webp';
import { useDarkHero } from '../NavBar/publicChrome';
import NextClass from './NextClass';
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

// /home hero: the studio video full-bleed under the navbar, the pitch, two ways in, and the next class.
const Home = ({ classes }) => {
    const { t } = useI18n();
    const { isAuthenticated } = useAuth();
    const reduceMotion = useReducedMotion();
    useDarkHero();

    const title = t('Create Slay Memories With Us!');

    return (
        <section className="hpHero" aria-labelledby="hpHeroTitle">
            <div className="hpHeroMedia" aria-hidden="true">
                <video
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
                <motion.div className="hpHeroText" variants={stagger} initial="hidden" animate="show">
                    <motion.span className="hpHeroEyebrow" variants={rise}>
                        <span className="hpLiveDot" aria-hidden="true" /> {t('Dance studio in Hanoi')}
                    </motion.span>
                    <motion.h1 id="hpHeroTitle" variants={words}>
                        {/* Word by word; the spaces stay outside the inline-block words so they don't collapse. */}
                        {title.split(' ').map((part, index) => (
                            <Fragment key={`${part}-${index}`}>
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
        </section>
    );
};

export default Home;
