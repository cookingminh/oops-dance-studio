import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuAlarmClock, LuQrCode, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { duesText } from './duesText';
import { useMyDues } from './myDuesContext';
import DuePay from './DuePay';
import './dues.scss';

const SHOW_AFTER_MS = 1200;
const keyFor = (userId) => `oops-pay-nudge:${userId}`;

// Remembered per person and day, in this browser only: "Later" means "not again today".
function seenToday(userId, today) {
    try {
        return localStorage.getItem(keyFor(userId)) === today;
    } catch {
        return false;
    }
}
function markSeen(userId, today) {
    try {
        localStorage.setItem(keyFor(userId), today);
    } catch {
        // private mode: it may show again, that's fine
    }
}

// Once a day, a friendly card in the corner of the Dashboard (/profile, where people land after signing in)
// when something is overdue or due within a few days: the most urgent item in one sentence, a QR button that
// opens the payment, and "Later" (not again today). Only there, so it never sits on a form's buttons; the
// bell and the menu badges carry it on every other page.
const PayNudge = () => {
    const i18n = useI18n();
    const { t, tn } = i18n;
    const { user } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { data, refresh } = useMyDues();
    const [visible, setVisible] = useState(false);
    const [paying, setPaying] = useState(null);

    const pressing = (data?.items ?? []).filter((item) => item.tone !== 'due');
    const item = pressing[0];
    const onDashboard = pathname.replace(/\/+$/, '') === '/profile';
    const today = data?.today;
    const eligible = Boolean(item && today && user && onDashboard && !seenToday(user.id, today));

    useEffect(() => {
        if (!eligible) return undefined;
        const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
        return () => clearTimeout(timer);
    }, [eligible]);

    const close = () => {
        markSeen(user.id, today);
        setVisible(false);
    };

    const act = (words) => {
        close();
        if (words.action.pay) setPaying(item);
        else navigate(item.to);
    };

    const words = item ? duesText(item, i18n) : null;
    const others = pressing.length - 1;

    return (
        <>
            <AnimatePresence>
                {visible && eligible && words && (
                    <motion.aside
                        className={`duesNudge adminPortal tone-${item.tone}`}
                        role="status"
                        aria-label={t('Payment reminder')}
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <span className="duesNudgeIcon" aria-hidden="true">
                            <LuAlarmClock />
                        </span>
                        <div className="duesNudgeBody">
                            <strong>{item.tone === 'late' ? t('A friendly reminder') : t('Don’t forget')}</strong>
                            <p>{words.nudge}</p>
                            {others > 0 && (
                                <button type="button" className="duesNudgeMore" onClick={() => act({ action: { pay: false } })}>
                                    {tn(others, 'and {count} more thing to pay', 'and {count} more things to pay')}
                                </button>
                            )}
                            <div className="duesNudgeActions">
                                <button type="button" className="pfBtn isPrimary duesNudgeGo" onClick={() => act(words)}>
                                    {words.action.pay && <LuQrCode aria-hidden="true" />} {words.action.label}
                                </button>
                                <button type="button" className="duesNudgeLater" onClick={close}>
                                    {t('Later')}
                                </button>
                            </div>
                        </div>
                        <button type="button" className="duesNudgeClose" onClick={close} aria-label={t('Close the reminder')}>
                            <LuX />
                        </button>
                    </motion.aside>
                )}
            </AnimatePresence>

            {paying && (
                <DuePay
                    item={paying}
                    settings={data?.settings}
                    sandbox={data?.sandbox}
                    onClose={() => {
                        setPaying(null);
                        refresh(true);
                    }}
                />
            )}
        </>
    );
};

export default PayNudge;
