import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuArrowRight, LuSparkles, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../../../../admin-staff/components/common/motion';
import './completeProfileNudge.scss';

const dismissKey = (userId) => `oops-profile-nudge-dismissed:${userId}`;

function wasDismissed(userId) {
    try {
        return localStorage.getItem(dismissKey(userId)) === '1';
    } catch {
        return false;
    }
}

// After a Google / Facebook sign-up the profile has no username or phone yet: a one-time banner
// points to the settings page. It goes away once both are filled in or the user closes it.
const CompleteProfileNudge = () => {
    const { session, user } = useAuth();
    const { t } = useI18n();
    const [dismissed, setDismissed] = useState(() => wasDismissed(user.id));

    const viaProvider = (session?.user?.app_metadata?.providers ?? []).some((provider) => provider !== 'email');
    const missingUsername = !user.username?.trim();
    const missingPhone = !user.contact_number?.trim();
    const show = viaProvider && (missingUsername || missingPhone) && !dismissed;

    let text = t('Add a username and your phone number so the studio can reach you about classes.');
    if (!missingUsername) text = t('Add your phone number so the studio can reach you about classes.');
    else if (!missingPhone) text = t('Pick a username for your account.');

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(dismissKey(user.id), '1');
        } catch {
            // Storage blocked: it stays closed until the page reloads.
        }
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.aside
                    className="pfNudge"
                    variants={fadeUp}
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                    aria-labelledby="profile-nudge-title"
                >
                    <span className="pfNudgeIcon" aria-hidden="true">
                        <LuSparkles />
                    </span>
                    <span className="pfNudgeText">
                        <strong id="profile-nudge-title">{t('Finish setting up your profile')}</strong>
                        <span>{text}</span>
                    </span>
                    <Link to="/profile/my-profile" className="pfNudgeGo">
                        {t('Complete my profile')} <LuArrowRight aria-hidden="true" />
                    </Link>
                    <button type="button" className="pfNudgeClose" onClick={dismiss}>
                        <LuX aria-hidden="true" />
                        <span className="sr-only">{t('Dismiss')}</span>
                    </button>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default CompleteProfileNudge;
