import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupportStatus } from '@/services/support';

const POLL_MS = 60_000;

// support_status(): the hours now (phase, opens, last_start, closes) and, signed in, the open conversation and
// how many replies are unread. Polled every minute and when the tab comes back; refresh() after every action
// (it resolves to the new status, or null when it couldn't be read).
// `key` (the signed-in user, or 'anon') starts over when someone signs in or out.
export function useSupportStatus(enabled, key) {
    const [status, setStatus] = useState(null);
    const latest = useRef(0);

    const refresh = useCallback(async () => {
        const request = ++latest.current;
        try {
            const next = await getSupportStatus();
            if (request === latest.current) setStatus(next);
            return next;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            latest.current += 1;
            setStatus(null);
            return undefined;
        }
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        const onVisible = () => document.visibilityState === 'visible' && refresh();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            latest.current += 1;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [enabled, key, refresh]);

    return { status, refresh };
}
