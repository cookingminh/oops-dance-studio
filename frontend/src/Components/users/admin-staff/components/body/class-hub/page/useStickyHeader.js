import { useLayoutEffect, useState } from 'react';

// Where the class header sticks: right under the workspace's top bar. On a phone only its tab row
// stays (the photo and name scroll away), so the page keeps most of the screen.
export function useStickyHeader(heroRef) {
    const [top, setTop] = useState(0);
    useLayoutEffect(() => {
        const bar = document.querySelector('.adminTopBar');
        const hero = heroRef.current;
        const wide = window.matchMedia('(min-width: 768px)');
        const update = () => {
            const barHeight = bar?.offsetHeight ?? 0;
            // offsetTop is measured from the sticky header itself (the nearest positioned box).
            setTop(wide.matches ? barHeight : barHeight - ((hero?.offsetTop ?? 0) + (hero?.offsetHeight ?? 0)));
        };
        update();
        const observer = new ResizeObserver(update);
        if (bar) observer.observe(bar);
        if (hero) observer.observe(hero);
        wide.addEventListener('change', update);
        return () => {
            observer.disconnect();
            wide.removeEventListener('change', update);
        };
    }, [heroRef]);
    return top;
}
