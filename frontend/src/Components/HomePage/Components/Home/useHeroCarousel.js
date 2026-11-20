import { useCallback, useEffect, useRef, useState } from 'react';

const SWIPE_PX = 50;

// The hero's slideshow: which slide shows, autoplay (`duration` per slide, looping), and the progress of the slide
// on screen, painted straight onto the segment fills (`fills.current[i]`, no re-render per frame).
// Autoplay waits while the mouse is over the hero, while keyboard focus is inside it, while the tab is hidden, and
// while the visitor paused it (reduced motion: paused from the start). ← → move between slides when focus is inside;
// a swipe does on touch screens. `bind` goes on the hero's section.
export function useHeroCarousel({ count, duration = 6000, reduceMotion = false }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(Boolean(reduceMotion));
    const fills = useRef([]);
    const progress = useRef(0);
    const hover = useRef(false);
    const focused = useRef(false);
    const swipeX = useRef(null);
    const live = useRef({ index, paused, count });
    live.current = { index, paused, count };

    const paint = useCallback(() => {
        const current = live.current.index;
        fills.current.forEach((el, i) => {
            if (el) el.style.transform = `scaleX(${i < current ? 1 : i === current ? progress.current : 0})`;
        });
    }, []);

    const go = useCallback((next) => {
        const total = live.current.count;
        if (total < 2) return;
        progress.current = 0;
        setIndex(((next % total) + total) % total);
    }, []);

    // A slide that no longer exists (banners changed): back to the first.
    useEffect(() => {
        if (index >= count) setIndex(0);
    }, [index, count]);

    useEffect(() => {
        paint();
    }, [index, count, paint]);

    useEffect(() => {
        if (count < 2) return undefined;
        let frame;
        let last = performance.now();
        const tick = (now) => {
            const dt = Math.min(now - last, 100);
            last = now;
            const running = !live.current.paused && !hover.current && !focused.current && document.visibilityState === 'visible';
            if (running) {
                progress.current += dt / duration;
                if (progress.current >= 1) {
                    progress.current = 0;
                    setIndex((i) => (i + 1) % live.current.count);
                }
            }
            paint();
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [count, duration, paint]);

    const bind = {
        onPointerEnter: (event) => {
            if (event.pointerType === 'mouse') hover.current = true;
        },
        onPointerLeave: () => {
            hover.current = false;
        },
        // Keyboard focus only: a mouse click on a control shouldn't freeze the show until the next click elsewhere.
        onFocus: (event) => {
            if (event.target.matches?.(':focus-visible')) focused.current = true;
        },
        onBlur: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) focused.current = false;
        },
        onKeyDown: (event) => {
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                go(live.current.index + 1);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                go(live.current.index - 1);
            }
        },
        onPointerDown: (event) => {
            swipeX.current = event.pointerType === 'mouse' ? null : event.clientX;
        },
        onPointerUp: (event) => {
            if (swipeX.current === null) return;
            const dx = event.clientX - swipeX.current;
            swipeX.current = null;
            if (Math.abs(dx) > SWIPE_PX) go(live.current.index + (dx < 0 ? 1 : -1));
        },
    };

    return { index, go, paused, togglePaused: () => setPaused((value) => !value), fills, bind };
}
