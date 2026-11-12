import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuHelpCircle, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { guideFor } from '@/guides';
import GuideModal from './GuideModal';
import { guideSeen, markGuideSeen } from './guideSeen';
import './guide.scss';

const HINT_MS = 9000;

// The (?) in the top bar: opens the current page's guide (one dialog). On a page someone hasn't seen the guide of,
// it pulses and offers it once (a small bubble, gone by itself); nothing opens on its own.
// `pageTo` is the page's path in the menu ('/admin/charts'); pages without a guide get no button.
const PageGuideButton = ({ pageTo }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const { user, role } = useAuth();
    const entry = guideFor(pageTo, role);
    const [open, setOpen] = useState(false);
    const [fresh, setFresh] = useState(false);
    const [hint, setHint] = useState(false);

    useEffect(() => {
        if (!entry) return undefined;
        const isFresh = !guideSeen(user?.id, entry.id);
        setFresh(isFresh);
        setHint(isFresh);
        if (!isFresh) return undefined;
        const timer = setTimeout(() => setHint(false), HINT_MS);
        return () => clearTimeout(timer);
    }, [entry, user?.id]);

    const guide = useMemo(() => (open && entry ? entry.build(i18n, { role }) : null), [open, entry, i18n, role]);
    if (!entry) return null;

    const seen = () => {
        markGuideSeen(user?.id, entry.id);
        setFresh(false);
        setHint(false);
    };

    return (
        <span className="gdHelpWrap">
            <button
                type="button"
                className={`iconButton gdHelp${fresh ? ' isFresh' : ''}`}
                onClick={() => {
                    seen();
                    setOpen(true);
                }}
                aria-label={t('How this page works')}
                title={t('How this page works')}
            >
                <LuHelpCircle />
            </button>
            <AnimatePresence>
                {hint && (
                    <motion.span
                        className="gdHint"
                        role="status"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                    >
                        <span>{t('New to this page? Take the one-minute tour.')}</span>
                        <button type="button" onClick={seen} aria-label={t('Not now')}>
                            <LuX />
                        </button>
                    </motion.span>
                )}
            </AnimatePresence>
            {guide && <GuideModal guide={guide} onClose={() => setOpen(false)} />}
        </span>
    );
};

export default PageGuideButton;
