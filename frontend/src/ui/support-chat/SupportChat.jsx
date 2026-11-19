import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useAnimationControls } from 'framer-motion';
import { LuMessageCircle, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { PROFILE_ROLES } from '@/auth/roles';
import { useI18n } from '@/i18n/i18nContext';
import { subscribeToThread } from '@/services/support';
import SupportPreview from './SupportPreview';
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

const SPRING = { type: 'spring', stiffness: 460, damping: 24 };
// A reply arrived while the chat is closed: the bubble gives a little wiggle.
const BUBBLE_VARIANTS = {
    nudge: { rotate: [0, -14, 11, -7, 4, 0], scale: [1, 1.12, 1.05, 1], transition: { duration: 0.7, ease: 'easeOut' } },
};

// Chat with the studio: the bubble in the bottom-right corner and its panel.
//   * signed-in students, room guests and instructors: on every page (not the login pages);
//   * visitors: on the public pages, where the panel asks them to log in (and lists the hotline / fanpage);
//   * staff and admins: never (they answer from the Inbox).
// While the panel is closed, a studio reply in the open conversation arrives live: the badge goes up, the bubble
// wiggles and the reply shows next to it (SupportPreview). Motion follows the OS "reduce motion" setting.
const SupportChat = () => {
    const { t } = useI18n();
    const { user, role, loading, isAuthenticated } = useAuth();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({ category: null, body: '' });
    const [preview, setPreview] = useState(null); // the latest studio message while the panel is closed
    const bubbleRef = useRef(null);
    const bubbleMotion = useAnimationControls();

    const member = Boolean(user) && PROFILE_ROLES.includes(role);
    const visible = !loading && !under(pathname, AUTH_PAGES) && (member || (!isAuthenticated && under(pathname, PUBLIC_PAGES)));
    const { status, refresh } = useSupportStatus(visible, member ? user.id : 'anon');

    // Live while closed: the person's open conversation.
    const liveThreadId = visible && member && !open ? (status?.thread?.id ?? null) : null;
    useEffect(() => {
        if (!liveThreadId) return undefined;
        return subscribeToThread(liveThreadId, {
            onMessage: (message) => {
                if (message.sender_kind === 'customer') return;
                refresh();
                if (message.sender_kind === 'staff' || message.sender_kind === 'ai') {
                    setPreview(message);
                    bubbleMotion.start('nudge');
                }
            },
        });
    }, [liveThreadId, refresh, bubbleMotion]);

    const openChat = useCallback(() => {
        setPreview(null);
        setOpen(true);
    }, []);
    const close = useCallback(() => {
        setOpen(false);
        bubbleRef.current?.focus();
    }, []);

    if (!visible) return null;

    const unread = member ? (status?.unread ?? 0) : 0;
    const online = isOnline(status);
    const label = open
        ? t('Close the chat')
        : unread > 0
          ? t('Chat with the studio, {count} unread', { count: unread })
          : t('Chat with the studio');
    // Invite them to chat only when a new question can be asked and they have nothing going on already.
    const tease = !open && !preview && status?.phase === 'open' && !status?.thread && unread === 0;

    return (
        <MotionConfig reducedMotion="user">
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
                                firstName={member ? givenName(user) : ''}
                                role={role}
                                draft={draft}
                                setDraft={setDraft}
                            />
                        </Suspense>
                    )}
                </AnimatePresence>
                <SupportTeaser enabled={tease} name={member ? givenName(user) : null} onOpen={openChat} />
                <SupportPreview message={open ? null : preview} onOpen={openChat} onDismiss={() => setPreview(null)} />
                <motion.button
                    ref={bubbleRef}
                    type="button"
                    className={`supportBubble${online && !open ? ' isLive' : ''}`}
                    onClick={() => (open ? close() : openChat())}
                    aria-label={label}
                    title={label}
                    aria-expanded={open}
                    aria-controls={open ? PANEL_ID : undefined}
                    variants={BUBBLE_VARIANTS}
                    animate={bubbleMotion}
                    whileHover={{ y: -2, scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    transition={SPRING}
                >
                    {online && !open && <span className="supportHalo" aria-hidden="true" />}
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                            key={open ? 'close' : 'chat'}
                            className="supportBubbleIcon"
                            aria-hidden="true"
                            initial={{ rotate: open ? -90 : 90, scale: 0.4, opacity: 0 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1 }}
                            exit={{ rotate: open ? 90 : -90, scale: 0.4, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                        >
                            {open ? <LuX /> : <LuMessageCircle />}
                        </motion.span>
                    </AnimatePresence>
                    {status && <span className={`supportDot ${online ? 'is-online' : 'is-offline'}`} aria-hidden="true" />}
                    {unread > 0 && !open && (
                        // A new count mounts a new badge: it pops in.
                        <motion.span
                            key={`badge-${unread}`}
                            className="supportBadge"
                            aria-hidden="true"
                            initial={{ scale: 0.3 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 640, damping: 16 }}
                        >
                            {unread > 9 ? '9+' : unread}
                        </motion.span>
                    )}
                </motion.button>
            </div>
        </MotionConfig>
    );
};

export default SupportChat;
