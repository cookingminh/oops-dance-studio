import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { LuClapperboard, LuGift, LuMusic } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';
import { useStageVideo } from './stageVideo';

// English source text, translated when shown (the same lines as the homepage).
const PERKS = [
    { icon: LuGift, label: 'Your first class is free' },
    { icon: LuMusic, label: 'A new song every course' },
    { icon: LuClapperboard, label: 'End-of-course shoot' },
];

// The studio side of the auth pages: crew video, brand (the way home) and what Oops! is about.
const AuthStage = () => {
    const { t } = useI18n();
    const mediaRef = useRef(null);
    useStageVideo(mediaRef);

    return (
        <div className="authStage">
            <div className="authStageMedia" ref={mediaRef} aria-hidden="true" />
            <div className="authStageShade" aria-hidden="true" />
            <Link to="/home" className="authBrand" title={t('Back to home')}>
                <span className="authBrandMark" aria-hidden="true">
                    <img src={logoMark} alt="" />
                </span>
                <span className="authBrandName">
                    <strong>Oops!</strong> <small>Dance Studio</small>
                </span>
            </Link>
            <div className="authStageCopy">
                <span className="authEyebrow">
                    <span className="authLiveDot" aria-hidden="true" />
                    {t('Dance studio in Hanoi')}
                </span>
                <p className="authStageTitle">{t('Create Slay Memories With Us!')}</p>
                <ul className="authPerks">
                    {PERKS.map(({ icon: Icon, label }) => (
                        <li key={label}>
                            <Icon aria-hidden="true" />
                            {t(label)}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default AuthStage;
