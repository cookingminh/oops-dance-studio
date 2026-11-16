import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError } from '@/services/errors';
import { getThread, listMessages, markRead, signSupportImages, subscribeToThread } from '@/services/support';
import { withMessage } from './inboxModel';

const FALLBACK_MS = 30_000;
const EMPTY = { thread: null, messages: [], loading: false, error: null, missing: false };

// One open conversation: the thread row and its messages, live (Realtime) with a 30 s refetch as a
// fallback. Opening it, and every new message from the person while it is open, counts as read by the studio.
// → { thread, messages, images: { [path]: url }, loading, error, missing, reload, addMessage, setThread }
export function useInboxThread(threadId) {
    const [state, setState] = useState(EMPTY);
    const [images, setImages] = useState({});
    const current = useRef(threadId);
    current.current = threadId;

    const load = useCallback(
        async ({ quiet = false } = {}) => {
            if (!threadId) return;
            if (!quiet) setState((prev) => ({ ...(prev.thread?.id === threadId ? prev : EMPTY), loading: true, error: null }));
            try {
                const [thread, messages] = await Promise.all([getThread(threadId), listMessages(threadId)]);
                if (current.current !== threadId) return;
                setState({ thread, messages: messages ?? [], loading: false, error: null, missing: !thread });
            } catch (error) {
                if (current.current !== threadId) return;
                setState((prev) => ({ ...prev, loading: false, error: toAppError(error) }));
            }
        },
        [threadId]
    );

    useEffect(() => {
        if (!threadId) {
            setState(EMPTY);
            return undefined;
        }
        load();
        markRead(threadId).catch(() => {});
        const stop = subscribeToThread(threadId, {
            onMessage: (message) => {
                setState((prev) => (prev.thread?.id === threadId ? { ...prev, messages: withMessage(prev.messages, message) } : prev));
                if (message.sender_kind === 'customer') markRead(threadId).catch(() => {});
            },
            onThread: (row) => setState((prev) => (prev.thread?.id === threadId ? { ...prev, thread: { ...prev.thread, ...row } } : prev)),
        });
        const timer = setInterval(() => load({ quiet: true }), FALLBACK_MS);
        return () => {
            stop();
            clearInterval(timer);
        };
    }, [threadId, load]);

    // Photos: sign the ones not signed yet.
    const paths = state.messages.map((message) => message.image_path).filter(Boolean);
    const unsigned = paths.filter((path) => !(path in images)).join('|');
    useEffect(() => {
        if (!unsigned) return;
        let alive = true;
        signSupportImages(unsigned.split('|'))
            .then((urls) => alive && setImages((prev) => ({ ...prev, ...urls })))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [unsigned]);

    const addMessage = useCallback((message) => setState((prev) => ({ ...prev, messages: withMessage(prev.messages, message) })), []);
    const setThread = useCallback((row) => setState((prev) => ({ ...prev, thread: prev.thread ? { ...prev.thread, ...row } : row })), []);
    const reload = useCallback(() => load({ quiet: true }), [load]);

    return { ...state, images, reload, addMessage, setThread };
}

// Date.now(), refreshed every `ms` (the "waiting 25 min" labels tick).
export function useNow(ms = 30_000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(timer);
    }, [ms]);
    return now;
}
