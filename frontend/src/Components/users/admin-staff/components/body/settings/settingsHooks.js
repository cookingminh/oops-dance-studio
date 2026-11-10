import { useCallback, useEffect, useRef, useState } from 'react';
import { isUsernameAvailable } from '@/services/users';

// The workspace page scrolls inside .adminMain (WorkspaceShell), not the window.
const scrollerOf = (element) => element?.closest('.adminMain') ?? null;

// Which of `ids` (in page order) the reader is looking at: the last section whose top has passed
// a line just below the sticky top bar. At the very bottom the last section wins, since a short
// final section never reaches that line.
export function useScrollSpy(ids, line = 160) {
    const [active, setActive] = useState(ids[0]);

    useEffect(() => {
        const scroller = scrollerOf(document.getElementById(ids[0]));
        if (!scroller) return undefined;
        let frame = 0;

        const update = () => {
            frame = 0;
            const top = scroller.getBoundingClientRect().top;
            let current = ids[0];
            for (const id of ids) {
                const element = document.getElementById(id);
                if (element && element.getBoundingClientRect().top - top <= line) current = id;
            }
            const atBottom = scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
            setActive(atBottom ? ids[ids.length - 1] : current);
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        update();
        scroller.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(frame);
            scroller.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [ids, line]);

    return [active, setActive];
}

// Ask before closing or reloading the tab while there are unsaved changes.
export function useUnsavedWarning(when) {
    useEffect(() => {
        if (!when) return undefined;
        const onBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = ''; // older browsers need it set
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [when]);
}

// A flag that turns itself off again after `ms` (for "Saved ✓" moments).
export function useFlash(ms = 2600) {
    const [on, setOn] = useState(false);
    const timer = useRef(0);
    useEffect(() => () => clearTimeout(timer.current), []);
    const flash = useCallback(() => {
        clearTimeout(timer.current);
        setOn(true);
        timer.current = setTimeout(() => setOn(false), ms);
    }, [ms]);
    return [on, flash];
}

// Whether a changed username is free, checked shortly after typing stops:
// 'idle' (unchanged or blank) | 'checking' | 'available' | 'taken' | 'unknown' (check failed;
// the save itself still guards against duplicates).
export function useUsernameCheck(username, savedUsername) {
    const value = String(username ?? '').trim();
    const changed = value !== '' && value !== String(savedUsername ?? '').trim();
    const [result, setResult] = useState({ value: '', status: 'idle' });

    useEffect(() => {
        if (!changed) return undefined;
        let active = true;
        const timer = setTimeout(() => {
            isUsernameAvailable(value)
                .then((free) => active && setResult({ value, status: free ? 'available' : 'taken' }))
                .catch(() => active && setResult({ value, status: 'unknown' }));
        }, 400);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [value, changed]);

    if (!changed) return 'idle';
    return result.value === value ? result.status : 'checking';
}
