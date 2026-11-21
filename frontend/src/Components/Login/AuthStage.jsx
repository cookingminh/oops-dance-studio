import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';
import { EASE_OUT, authClock } from './authShared';

// The copy rises in once per visit, not again on every switch between the auth pages.
let introPlayed = false;

const copyStagger = { hidden: {}, show: { transition: { delayChildren: 0.15, staggerChildren: 0.08 } } };
const copyRise = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

// The studio side of the auth pages: drifting brand colours, a big logo (the way home) and one
// headline. A short animated band above the form on tablets and phones.
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
            </motion.div>
        </div>
    );
};

export default AuthStage;
