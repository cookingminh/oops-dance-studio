import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';
import { EASE_OUT, authClock } from './authShared';

// The studio side plays its entrance once per visit, not again on every switch between the auth pages.
let introPlayed = false;

const copyStagger = { hidden: {}, show: { transition: { delayChildren: 0.1, staggerChildren: 0.1 } } };
const emblemIn = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE_OUT } },
};
const copyRise = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

// The studio side of the auth pages: drifting brand colours and, in the middle, the logo on a
// slowly turning record (the way home), the studio's name, a little equalizer and one headline.
// A short animated band above the form on tablets and phones.
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
            <div className="authGrain" aria-hidden="true" />

            <motion.div className="authStageCopy" variants={copyStagger} initial={intro ? 'hidden' : false} animate="show">
                <motion.div variants={emblemIn}>
                    <Link to="/home" className="authBrand" title={t('Back to home')}>
                        <span className="authEmblem" aria-hidden="true">
                            <svg className="authRings" viewBox="0 0 400 400" focusable="false">
                                <circle cx="200" cy="200" r="198" />
                                <circle cx="200" cy="200" r="172" />
                                <circle className="authRingDash" cx="200" cy="200" r="146" />
                                <circle cx="200" cy="200" r="120" />
                                <circle className="authRingDot" cx="200" cy="28" r="5" />
                            </svg>
                            <span className="authBrandMark">
                                <img src={logoMark} alt="" />
                            </span>
                        </span>
                        <span className="authBrandName">
                            <strong>Oops!</strong> <small>Dance Studio</small>
                        </span>
                    </Link>
                </motion.div>
                <motion.span className="authStageBeat" variants={copyRise} aria-hidden="true">
                    <span className="authEq">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                </motion.span>
                <motion.p className="authStageTitle" variants={copyRise}>
                    {t('Create Slay Memories With Us!')}
                </motion.p>
            </motion.div>
        </div>
    );
};

export default AuthStage;
