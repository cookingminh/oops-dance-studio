import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LuHistory, LuLoader2, LuPhone, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { listMyThreads } from '@/services/support';
import { PHONE } from '@/Components/HomePage/Components/NavBar/contactInfo';
import logoMark from '@/assets/images/logo-mark.webp';
import SupportThread from './SupportThread';
import { HistoryView, NewQuestionView, OfflineView, SignedOutView } from './SupportViews';
import { isOnline, statusLine } from './supportText';

export const PANEL_ID = 'support-panel';

// The chat panel above the bubble (full screen on phones). Views: signed out, a new question (or "offline"
// when the studio isn't taking new ones), a conversation, past chats.
const SupportPanel = ({ status, refresh, onClose, signedIn, userId, role, draft, setDraft }) => {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const panelRef = useRef(null);
    // { name: 'loading' | 'signedOut' | 'home' | 'thread' | 'history', threadId? }
    const [view, setView] = useState({ name: signedIn ? 'loading' : 'signedOut' });

    // Where to start: the open chat; else the latest one with an unread answer (e.g. closed by the system);
    // else a new question.
    useEffect(() => {
        if (!signedIn) {
            setView({ name: 'signedOut' });
            return undefined;
        }
        let alive = true;
        (async () => {
            const now = await refresh();
            if (!alive) return;
            if (now?.thread) {
                setView({ name: 'thread', threadId: now.thread.id });
                return;
            }
            if (now?.unread > 0) {
                const unread = (await listMyThreads().catch(() => [])).find((item) => item.unread > 0);
                if (!alive) return;
                if (unread) {
                    setView({ name: 'thread', threadId: unread.id });
                    return;
                }
            }
            setView({ name: 'home' });
        })();
        return () => {
            alive = false;
        };
    }, [signedIn, refresh]);

    // A chat opened elsewhere (another tab) while this one shows the new-question form: show it.
    const openThreadId = status?.thread?.id ?? null;
    useEffect(() => {
        if (openThreadId && view.name === 'home') setView({ name: 'thread', threadId: openThreadId });
    }, [openThreadId, view.name]);

    // Focus moves into the panel when it opens.
    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    const home = () => setView(openThreadId ? { name: 'thread', threadId: openThreadId } : { name: 'home' });
    const history = () => setView({ name: 'history' });

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
        }
    };

    let body;
    if (view.name === 'loading') {
        body = (
            <div className="supportBody supportLoading" aria-busy="true">
                <LuLoader2 className="supportSpin" aria-hidden="true" />
            </div>
        );
    } else if (view.name === 'signedOut') {
        body = <SignedOutView status={status} />;
    } else if (view.name === 'history') {
        body = <HistoryView status={status} onOpen={(threadId) => setView({ name: 'thread', threadId })} onBack={home} />;
    } else if (view.name === 'thread') {
        body = (
            <SupportThread
                key={view.threadId}
                threadId={view.threadId}
                status={status}
                userId={userId}
                onChanged={refresh}
                onNewQuestion={() => setView({ name: 'home' })}
            />
        );
    } else if (status && status.phase !== 'open') {
        body = <OfflineView status={status} onHistory={history} />;
    } else {
        body = (
            <NewQuestionView
                status={status}
                role={role}
                userId={userId}
                draft={draft}
                setDraft={setDraft}
                onChanged={refresh}
                onStarted={(threadId) => {
                    setView({ name: 'thread', threadId });
                    refresh();
                }}
            />
        );
    }

    return (
        <motion.section
            id={PANEL_ID}
            ref={panelRef}
            className="supportPanel"
            role="dialog"
            aria-labelledby="support-panel-title"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
            <header className="supportHead">
                <span className="supportMark" aria-hidden="true">
                    <img src={logoMark} alt="" />
                </span>
                <div className="supportHeadText">
                    <h2 id="support-panel-title">Oops! Studio</h2>
                    <p className="supportStatusLine">
                        <span className={`supportDotInline ${isOnline(status) ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
                        {statusLine(t, status)}
                    </p>
                </div>
                {signedIn && view.name !== 'history' && view.name !== 'loading' && (
                    <button type="button" className="supportIconBtn onDark" onClick={history} aria-label={t('Past chats')} title={t('Past chats')}>
                        <LuHistory />
                    </button>
                )}
                <button type="button" className="supportIconBtn onDark" onClick={onClose} aria-label={t('Close the chat')} title={t('Close the chat')}>
                    <LuX />
                </button>
            </header>
            <a className="supportUrgent" href={PHONE.tel}>
                <LuPhone aria-hidden="true" /> {t('Urgent? Call {phone}', { phone: PHONE.display })}
            </a>
            {body}
        </motion.section>
    );
};

export default SupportPanel;
