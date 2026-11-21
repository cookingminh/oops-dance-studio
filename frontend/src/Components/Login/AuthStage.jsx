import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LuClapperboard, LuGift, LuMusic } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';
import { EASE_OUT, authClock } from './authShared';

// English source text, translated when shown (the same lines as the homepage).
const PERKS = [
    { icon: LuGift, label: 'Your first class is free' },
    { icon: LuMusic, label: 'A new song every course' },
    { icon: LuClapperboard, label: 'End-of-course shoot' },
];

// Class styles at the studio: names, so the same in both languages.
const STYLES = ['K-pop', 'Hip-hop', 'Choreo', 'Girlstyle'];
const STYLE_SECONDS = 2.6;
const styleNow = () => Math.floor(authClock() / STYLE_SECONDS) % STYLES.length;

// The copy rises in once per visit, not again on every switch between the auth pages.
let introPlayed = false;

const copyStagger = { hidden: {}, show: { transition: { delayChildren: 0.15, staggerChildren: 0.08 } } };
const copyRise = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

// "Let's dance K-pop": the style slides up and out for the next one. Every name sits in the same
// grid cell, so the box keeps the width of the longest and the line never jumps. Screen readers
// get the whole list once instead of a word that keeps changing.
const StyleTicker = () => {
    const { t } = useI18n();
    const still = useReducedMotion();
    const [index, setIndex] = useState(styleNow);

    useEffect(() => {
        if (still) return undefined;
        const timer = setInterval(() => setIndex(styleNow()), 250);
        return () => clearInterval(timer);
    }, [still]);

    const style = STYLES[still ? 0 : index];
    return (
        <p className="authTicker">
            <span className="sr-only">
                {t('Let’s dance')} {STYLES.join(', ')}
            </span>
            <span className="authTickerLine" aria-hidden="true">
                <span>{t('Let’s dance')}</span>
                <span className="authTickerSlot">
                    {STYLES.map((name) => (
                        <span key={name} className="authTickerSizer">
                            {name}
                        </span>
                    ))}
                    <AnimatePresence initial={false}>
                        <motion.span
                            key={style}
                            className="authTickerWord"
                            initial={{ y: '105%', opacity: 0 }}
                            animate={{ y: '0%', opacity: 1 }}
                            exit={{ y: '-105%', opacity: 0 }}
                            transition={{ duration: 0.55, ease: EASE_OUT }}
                        >
                            {style}
                        </motion.span>
                    </AnimatePresence>
                </span>
            </span>
        </p>
    );
};

// The studio side of the auth pages: drifting brand colours, the brand (the way home) and what
// Oops! is about. A short animated band above the form on tablets and phones.
const AuthStage = () => {
    const { t } = useI18n();
    // Negative delays put the CSS drift where the clock says, so a redraw doesn't restart it.
    const [clock] = useState(() => `${-authClock().toFixed(2)}s`);
    const [intro] = useState(() => !introPlayed);
    useEffect(() => {
        introPlayed = true;
    }, []);

    return (
        <div className="authStage" style={{ '--au-clock': clock }}>
            <div className="authAurora" aria-hidden="true">
                <span className="authBlob is-coral" />
                <span className="authBlob is-berry" />
                <span className="authBlob is-amber" />
                <span className="authBlob is-ember" />
            </div>
            <svg className="authRings" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
                <circle cx="200" cy="200" r="198" />
                <circle cx="200" cy="200" r="160" />
                <circle className="authRingDash" cx="200" cy="200" r="122" />
                <circle cx="200" cy="200" r="84" />
                <circle className="authRingDot" cx="200" cy="38" r="5" />
            </svg>
            <div className="authGrain" aria-hidden="true" />

            <Link to="/home" className="authBrand" title={t('Back to home')}>
                <span className="authBrandMark" aria-hidden="true">
                    <img src={logoMark} alt="" />
                </span>
                <span className="authBrandName">
                    <strong>Oops!</strong> <small>Dance Studio</small>
                </span>
            </Link>

            <motion.div className="authStageCopy" variants={copyStagger} initial={intro ? 'hidden' : false} animate="show">
                <motion.p className="authEyebrow" variants={copyRise}>
                    <span className="authEq" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                    {t('Dance studio in Hanoi')}
                </motion.p>
                <motion.p className="authStageTitle" variants={copyRise}>
                    {t('Create Slay Memories With Us!')}
                </motion.p>
                <motion.div variants={copyRise}>
                    <StyleTicker />
                </motion.div>
                <motion.ul className="authPerks" variants={copyStagger}>
                    {PERKS.map(({ icon: Icon, label }) => (
                        <motion.li key={label} variants={copyRise}>
                            <span className="authPerkIcon" aria-hidden="true">
                                <Icon />
                            </span>
                            {t(label)}
                        </motion.li>
                    ))}
                </motion.ul>
            </motion.div>
        </div>
    );
};

export default AuthStage;
