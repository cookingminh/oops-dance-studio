import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuArrowDown, LuArrowRight } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { CLIPS, FOUNDED, HERO, STATS } from './aboutContent';
import { EASE_OUT, revealGroup, revealItem } from './aboutHelpers';
import LoopClip from './LoopClip';
import StatCounter from './StatCounter';

// Entrance on page load (the hero is always in view): text first, then the pictures.
const enter = (delay) => ({
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: EASE_OUT },
});

const AboutHero = () => {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();

    // In-page jump that clears the fixed navbar (scroll-margin) and moves focus with the reader.
    const toStory = (event) => {
        event.preventDefault();
        const target = document.getElementById('story');
        if (!target) return;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
    };

    return (
        <section className="abHero" aria-labelledby="about-title">
            <div className="abHeroInner">
                <div className="abHeroText">
                    <motion.p className="abHeroTags" {...enter(0)}>
                        <span className="abHeroTag isRed">{t('About us')}</span>
                        {HERO.tags.map((tag) => (
                            <span key={tag} className="abHeroTag">
                                {t(tag)}
                            </span>
                        ))}
                    </motion.p>

                    <motion.h1 id="about-title" className="abHeroTitle" {...enter(0.06)}>
                        <span className="abHeroKicker">{t(HERO.kicker)}</span>{' '}
                        <span className="abHeroName">
                            Oops! Crew
                            <svg className="abHeroSwoosh" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                                <motion.path
                                    d="M4 17 C 70 6, 150 4, 296 12"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.7, delay: 0.45, ease: EASE_OUT }}
                                />
                            </svg>
                        </span>
                    </motion.h1>

                    <motion.p className="abHeroLede" {...enter(0.12)}>
                        {t(HERO.lede)}
                    </motion.p>

                    <motion.div className="abHeroActions" {...enter(0.18)}>
                        <Link to="/classes" className="abBtn isPrimary">
                            {t('Try a free class')} <LuArrowRight aria-hidden="true" />
                        </Link>
                        <a href="#story" className="abBtn isGhost" onClick={toStory}>
                            {t('Read our story')} <LuArrowDown aria-hidden="true" />
                        </a>
                    </motion.div>
                </div>

                <div className="abHeroMedia">
                    <motion.div className="abHeroVideo" {...enter(0.15)}>
                        <LoopClip clip={CLIPS.dance} className="abHeroClip" />
                        <span className="abHeroLive">
                            <span className="abHeroLiveDot" aria-hidden="true" /> {t('Class in session')}
                        </span>
                    </motion.div>

                    <motion.figure className="abHeroPolaroid" {...enter(0.3)}>
                        <img src={HERO.photo.src} alt={t(HERO.photo.alt)} width="1070" height="716" />
                        <figcaption>{t('Shoot day, every month')}</figcaption>
                    </motion.figure>

                    <motion.div className="abHeroStamp" aria-hidden="true" {...enter(0.36)}>
                        <svg viewBox="0 0 200 200" className="abHeroStampRing">
                            <defs>
                                <path id="abStampPath" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
                            </defs>
                            <text>
                                <textPath href="#abStampPath" textLength="488" lengthAdjust="spacing">
                                    {t(HERO.stamp).toUpperCase()}
                                </textPath>
                            </text>
                        </svg>
                        <span className="abHeroStampYear">
                            <small>{t('Since')}</small>
                            {FOUNDED}
                        </span>
                    </motion.div>
                </div>
            </div>

            {/* Any visible part triggers it: the strip often peeks in at the bottom of the first screen. */}
            <motion.dl className="abStats" {...revealGroup} viewport={{ once: true }}>
                {STATS.map((stat) => (
                    <motion.div key={stat.label} className="abStat" {...revealItem}>
                        <dt>{t(stat.label)}</dt>
                        <dd>
                            <StatCounter value={stat.value} suffix={stat.suffix} />
                        </dd>
                    </motion.div>
                ))}
            </motion.dl>
        </section>
    );
};

export default AboutHero;
