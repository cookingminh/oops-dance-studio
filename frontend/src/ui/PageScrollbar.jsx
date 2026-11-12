import { useEffect, useRef } from 'react';
import './pageScrollbar.scss';

// The scrollbar of pages that scroll the whole window (the public site, sign-in, profiles). The browser's
// own bar is hidden (main.scss), so it no longer cuts a light strip down the side of a dark page; this slim
// thumb floats over the content instead. It shows while the page moves or the pointer is at the right edge,
// and it can be dragged; a click above / below it moves a screen. Wheel, trackpad and keyboard scrolling
// stay the browser's. Mouse / trackpad screens only: touch screens keep their own overlay bar.
const MIN_THUMB = 36;
const SLEEP_AFTER = 1000;

const PageScrollbar = () => {
    const railRef = useRef(null);
    const thumbRef = useRef(null);

    useEffect(() => {
        const rail = railRef.current;
        const thumb = thumbRef.current;
        const root = document.documentElement;
        let frame = 0;
        let sleepTimer = 0;
        let drag = null;

        const measure = () => {
            const view = window.innerHeight;
            const full = root.scrollHeight;
            const track = rail.clientHeight;
            return {
                range: full - view,
                track,
                size: Math.min(track, Math.max(MIN_THUMB, (view / Math.max(full, 1)) * track)),
            };
        };

        const draw = () => {
            frame = 0;
            const { range, track, size } = measure();
            rail.classList.toggle('isIdle', range < 2);
            if (range < 2) return;
            const at = Math.min(Math.max(window.scrollY / range, 0), 1);
            thumb.style.height = `${size}px`;
            thumb.style.transform = `translateY(${at * (track - size)}px)`;
        };
        const redraw = () => {
            if (!frame) frame = requestAnimationFrame(draw);
        };

        const wake = () => {
            rail.classList.add('isAwake');
            clearTimeout(sleepTimer);
            sleepTimer = setTimeout(() => {
                if (!drag) rail.classList.remove('isAwake');
            }, SLEEP_AFTER);
        };
        const onScroll = () => {
            redraw();
            wake();
        };

        const onThumbDown = (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            thumb.setPointerCapture(event.pointerId);
            drag = { y: event.clientY, from: window.scrollY };
            rail.classList.add('isDragging');
        };
        const onThumbMove = (event) => {
            if (!drag) return;
            const { range, track, size } = measure();
            const perPixel = range / Math.max(track - size, 1);
            window.scrollTo({ top: drag.from + (event.clientY - drag.y) * perPixel, behavior: 'instant' });
        };
        const onThumbUp = () => {
            if (!drag) return;
            drag = null;
            rail.classList.remove('isDragging');
            wake();
        };
        const onRailDown = (event) => {
            if (event.button !== 0 || event.target !== rail) return;
            const step = window.innerHeight * 0.85;
            const above = event.clientY < thumb.getBoundingClientRect().top;
            window.scrollBy({ top: above ? -step : step, behavior: 'smooth' });
        };

        draw();
        wake();
        const resize = new ResizeObserver(redraw);
        resize.observe(document.body);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', redraw);
        thumb.addEventListener('pointerdown', onThumbDown);
        thumb.addEventListener('pointermove', onThumbMove);
        thumb.addEventListener('pointerup', onThumbUp);
        thumb.addEventListener('pointercancel', onThumbUp);
        rail.addEventListener('pointerdown', onRailDown);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(sleepTimer);
            resize.disconnect();
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', redraw);
            thumb.removeEventListener('pointerdown', onThumbDown);
            thumb.removeEventListener('pointermove', onThumbMove);
            thumb.removeEventListener('pointerup', onThumbUp);
            thumb.removeEventListener('pointercancel', onThumbUp);
            rail.removeEventListener('pointerdown', onRailDown);
        };
    }, []);

    return (
        <div ref={railRef} className="pageScroll isIdle" aria-hidden="true">
            <span ref={thumbRef} className="pageScrollThumb" />
        </div>
    );
};

export default PageScrollbar;
