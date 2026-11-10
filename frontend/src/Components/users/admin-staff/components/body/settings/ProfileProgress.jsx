import { motion } from 'framer-motion';
import { LuCheck, LuPlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT } from '../../common/motion';
import { profileCompleteness } from './settingsModel';

const RADIUS = 22;

// How complete the saved profile is, as a ring, plus a button for each missing piece that jumps
// to its field. It counts saved values only, so the ring fills up when a save goes through.
const ProfileProgress = ({ user, onFix }) => {
    const { t } = useI18n();
    const { missing, percent } = profileCompleteness(user);
    const complete = missing.length === 0;

    return (
        <div className={`profileProgress${complete ? ' isComplete' : ''}`}>
            <span className="progressRing" aria-hidden="true">
                <svg viewBox="0 0 56 56">
                    <circle className="ringTrack" cx="28" cy="28" r={RADIUS} />
                    <motion.circle
                        className="ringValue"
                        cx="28"
                        cy="28"
                        r={RADIUS}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: percent / 100 }}
                        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }}
                    />
                </svg>
                <span className="ringLabel">{complete ? <LuCheck /> : `${percent}%`}</span>
            </span>
            <div className="progressText">
                <strong>{complete ? t('Your profile is complete') : t('Profile {percent}% complete', { percent })}</strong>
                {complete ? (
                    <p>{t('Thanks! The studio has everything it needs.')}</p>
                ) : (
                    <div className="progressTodo">
                        {missing.map((check) => (
                            <button key={check.field} type="button" onClick={() => onFix(check.field)}>
                                <LuPlus aria-hidden="true" />
                                {t(check.label)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileProgress;
