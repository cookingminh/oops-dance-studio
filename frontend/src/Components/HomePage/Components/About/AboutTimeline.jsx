import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { TIMELINE } from './aboutContent';
import { EASE_OUT } from './aboutHelpers';
import ChapterHead from './ChapterHead';

const LAST = TIMELINE.length - 1;

// The chosen year slides in from the side it was picked from.
const slide = {
    enter: (direction) => ({ opacity: 0, x: direction * 36 }),
    show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE_OUT } },
    leave: (direction) => ({ opacity: 0, x: direction * -24, transition: { duration: 0.16, ease: 'easeIn' } }),
};

// 02 · 2017 → today as a year picker (tabs): a rail of years with a progress line, and one
// chapter of the story at a time. Arrow keys, Home and End move along the rail.
const AboutTimeline = () => {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const [[index, direction], setState] = useState([0, 1]);
    const sectionRef = useRef(null);
    const railRef = useRef(null);
    const tabRefs = useRef([]);
    const nearby = useInView(sectionRef, { once: true, margin: '400px 0px' });
    const entry = TIMELINE[index];

    const select = (next, { focus = false } = {}) => {
        const clamped = Math.min(LAST, Math.max(0, next));
        if (clamped === index) return;
        setState([clamped, clamped > index ? 1 : -1]);
        if (focus) tabRefs.current[clamped]?.focus();
    };

    const onKeyDown = (event) => {
        const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: LAST };
        if (!(event.key in moves)) return;
        event.preventDefault();
        select(moves[event.key], { focus: true });
    };

    // Keep the chosen year visible when the rail scrolls sideways (phones).
    useEffect(() => {
        const rail = railRef.current;
        const tab = tabRefs.current[index];
        if (!rail || !tab || rail.scrollWidth <= rail.clientWidth) return;
        const tabBox = tab.getBoundingClientRect();
        const offset = tabBox.left - rail.getBoundingClientRect().left;
        rail.scrollTo({
            left: rail.scrollLeft + offset - (rail.clientWidth - tabBox.width) / 2,
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    }, [index, reduceMotion]);

    // Fetch every year's photo once the section is close, so switching years is instant.
    useEffect(() => {
        if (!nearby) return;
        TIMELINE.forEach(({ image }) => {
            const img = new Image();
            img.src = image;
        });
    }, [nearby]);

    return (
        <section ref={sectionRef} className="abSection abJourney" aria-labelledby="journey-title">
            <div className="abWrap">
                <ChapterHead
                    id="journey-title"
                    number="02"
                    eyebrow={t('Our journey')}
                    title={t('From a borrowed room to a studio of our own')}
                    intro={t('Pick a year to see what the crew was up to.')}
                />

                <div className="abRail" ref={railRef}>
                    <div
                        className="abRailList"
                        role="tablist"
                        aria-label={t('Years')}
                        onKeyDown={onKeyDown}
                        style={{ '--count': TIMELINE.length }}
                    >
                        <span className="abRailLine" aria-hidden="true">
                            <span className="abRailFill" style={{ transform: `scaleX(${index / LAST})` }} />
                        </span>
                        {TIMELINE.map((item, i) => (
                            <button
                                key={item.year}
                                ref={(node) => {
                                    tabRefs.current[i] = node;
                                }}
                                type="button"
                                role="tab"
                                id={`journey-tab-${item.year}`}
                                aria-selected={i === index}
                                aria-controls="journey-panel"
                                tabIndex={i === index ? 0 : -1}
                                className={`abRailTab${i === index ? ' isActive' : ''}${i < index ? ' isPast' : ''}`}
                                onClick={() => select(i)}
                            >
                                <span className="abRailDot" aria-hidden="true" />
                                <span className="abRailYear">{item.year}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="abJourneyStage" id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${entry.year}`} aria-live="polite">
                    <AnimatePresence mode="wait" initial={false} custom={direction}>
                        <motion.article
                            key={entry.year}
                            className="abJourneyCard"
                            custom={direction}
                            variants={slide}
                            initial="enter"
                            animate="show"
                            exit="leave"
                        >
                            <div className="abJourneyPhoto">
                                <img src={entry.image} alt={t(entry.alt)} />
                                <span className="abJourneyTag">{t(entry.tag)}</span>
                            </div>
                            <div className="abJourneyText">
                                <span className="abJourneyYear" aria-hidden="true">
                                    {entry.year}
                                </span>
                                <h3>{t(entry.title)}</h3>
                                <p>{t(entry.text)}</p>
                            </div>
                        </motion.article>
                    </AnimatePresence>

                    <div className="abJourneyNav">
                        <span className="abJourneyCount">
                            {String(index + 1).padStart(2, '0')}
                            <small> / {String(TIMELINE.length).padStart(2, '0')}</small>
                        </span>
                        <button type="button" className="abRoundBtn" onClick={() => select(index - 1)} disabled={index === 0} aria-label={t('Previous year')}>
                            <LuArrowLeft aria-hidden="true" />
                        </button>
                        <button type="button" className="abRoundBtn" onClick={() => select(index + 1)} disabled={index === LAST} aria-label={t('Next year')}>
                            <LuArrowRight aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutTimeline;
