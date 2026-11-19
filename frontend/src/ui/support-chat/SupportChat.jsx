import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LuMessageCircle, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { PROFILE_ROLES } from '@/auth/roles';
import { useI18n } from '@/i18n/i18nContext';
import SupportTeaser from './SupportTeaser';
import { useSupportStatus } from './useSupportStatus';
import { isOnline } from './supportText';
import './supportChat.scss';

// The panel's code loads the first time someone opens the chat.
const SupportPanel = lazy(() => import('./SupportPanel'));

const PANEL_ID = 'support-panel';
const PUBLIC_PAGES = ['/home', '/classes', '/rooms', '/about'];
const AUTH_PAGES = ['/login', '/register', '/reset-password'];
const under = (pathname, pages) => pages.some((page) => pathname === page || pathname.startsWith(`${page}/`));
const givenName = (user) => user?.full_name?.trim().split(/\s+/).pop() || user?.username || '';

// Chat with the studio: the bubble in the bottom-right corner and its panel.
//   * signed-in students, room guests and instructors: on every page (not the login pages);
//   * visitors: on the public pages, where the panel asks them to log in (and lists the hotline / fanpage);
//   * staff and admins: never (they answer from the Inbox).
const SupportChat = () => {
    const { t } = useI18n();
    const { user, role, loading, isAuthenticated } = useAuth();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({ category: null, body: '' });
    const bubbleRef = useRef(null);

    const member = Boolean(user) && PROFILE_ROLES.includes(role);
    const visible = !loading && !under(pathname, AUTH_PAGES) && (member || (!isAuthenticated && under(pathname, PUBLIC_PAGES)));
    const { status, refresh } = useSupportStatus(visible, member ? user.id : 'anon');

    const close = useCallback(() => {
        setOpen(false);
        bubbleRef.current?.focus();
    }, []);

    if (!visible) return null;

    const unread = member ? (status?.unread ?? 0) : 0;
    const online = isOnline(status);
    // Invite them to chat only when a new question can be asked and they have nothing going on already.
    const tease = !open && status?.phase === 'open' && !status?.thread && unread === 0;
    const label = open
        ? t('Close the chat')
        : unread > 0
          ? t('Chat with the studio, {count} unread', { count: unread })
          : t('Chat with the studio');

    return (
        <div className={`supportChat${open ? ' isOpen' : ''}`}>
            <AnimatePresence>
                {open && (
                    <Suspense fallback={null}>
                        <SupportPanel
                            status={status}
                            refresh={refresh}
                            onClose={close}
                            signedIn={member}
                            userId={user?.id ?? null}
                            role={role}
                            draft={draft}
                            setDraft={setDraft}
                        />
                    </Suspense>
                )}
            </AnimatePresence>
            <SupportTeaser enabled={tease} name={member ? givenName(user) : null} onOpen={() => setOpen(true)} />
            <button
                ref={bubbleRef}
                type="button"
                className="supportBubble"
                onClick={() => (open ? close() : setOpen(true))}
                aria-label={label}
                title={label}
                aria-expanded={open}
                aria-controls={open ? PANEL_ID : undefined}
            >
                {open ? <LuX aria-hidden="true" /> : <LuMessageCircle aria-hidden="true" />}
                {status && <span className={`supportDot ${online ? 'is-online' : 'is-offline'}`} aria-hidden="true" />}
                {unread > 0 && !open && (
                    <span className="supportBadge" aria-hidden="true">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
        </div>
    );
};

export default SupportChat;
