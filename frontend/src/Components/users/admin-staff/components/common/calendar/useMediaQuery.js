import { useEffect, useState } from 'react';

// True while the CSS media query matches (re-renders when it changes).
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const list = window.matchMedia(query);
        const update = () => setMatches(list.matches);
        update();
        list.addEventListener('change', update);
        return () => list.removeEventListener('change', update);
    }, [query]);
    return matches;
}

// The calendar's phone layout (agenda instead of the time grid).
export const PHONE_QUERY = '(max-width: 640px)';
