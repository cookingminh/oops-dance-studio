import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';

// The invitation next to the chat bubble: "Got a question? Chat with us live!", a few seconds after a page opens.
//   * shown only when SupportChat says so (`enabled`: the studio takes new questions now, the chat is closed and
//     the person has no open conversation or unread reply);
//   * once per browser tab session (navigating or reloading doesn't bring it back);
//   * × hides it for a week in this browser; clicking it opens the chat.
const DELAY_MS = 4000;
const HIDE_FOR_MS = 7 * 24 * 60 * 60 * 1000;
export const TEASER_HIDDEN_UNTIL = 'oops.chatTeaser.hiddenUntil';
const SHOWN_THIS_SESSION = 'oops.chatTeaser.shown';

// Storage can be blocked (private windows, strict settings): then the teaser simply shows once per page load.
function hiddenNow() {
    try {
        return Number(localStorage.getItem(TEASER_HIDDEN_UNTIL) || 0) > Date.now() || sessionStorage.getItem(SHOWN_THIS_SESSION) === '1';
    } catch {
        return false;
    }
}
function remember(store, key, value) {
    try {
        store.setItem(key, value);
    } catch {
        // Not remembered: it may show again next time.
    }
}

const SupportTeaser = ({ enabled, name, onOpen }) => {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const [shown, setShown] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setShown(false);
            return undefined;
        }
        if (hiddenNow()) return undefined;
        const timer = setTimeout(() => {
            if (hiddenNow()) return;
            remember(sessionStorage, SHOWN_THIS_SESSION, '1');
            setShown(true);
        }, DELAY_MS);
        return () => clearTimeout(timer);
    }, [enabled]);

    const dismiss = () => {
        remember(localStorage, TEASER_HIDDEN_UNTIL, String(Date.now() + HIDE_FOR_MS));
        setShown(false);
    };
    const open = () => {
        setShown(false);
        onOpen();
    };

    return (
        <AnimatePresence>
            {shown && enabled && (
                <motion.div
                    className="supportTeaser"
                    role="status"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 14, scale: 0.94 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 10, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                >
                    <button type="button" className="supportTeaserBody" onClick={open}>
                        <span className="supportTeaserMark" aria-hidden="true">
                            <img src={logoMark} alt="" />
                        </span>
                        <span className="supportTeaserText">
                            <span className="supportTeaserFrom">Oops! Studio</span>
                            <span className="supportTeaserLine">
                                {name
                                    ? t('Hi {name}! Got a question? Chat with us live.', { name })
                                    : t('Got a question? Chat with us live!')}
                            </span>
                        </span>
                    </button>
                    <button type="button" className="supportTeaserClose" onClick={dismiss} aria-label={t('Hide this message')} title={t('Hide this message')}>
                        <LuX aria-hidden="true" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SupportTeaser;
