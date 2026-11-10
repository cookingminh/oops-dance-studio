import { createContext, useContext, useEffect } from 'react';

// Shared by the public site's shell (PublicLayout) and its pages: whether the page opens on a dark
// photo/video (the navbar then floats over it with light text) and a way to open the contact dialog.
export const PublicChromeContext = createContext({
    darkHero: false,
    setDarkHero: () => {},
    openContact: () => {},
});

export const usePublicChrome = () => useContext(PublicChromeContext);

// Call from a page whose top section is dark (e.g. the home video): the navbar turns transparent
// with light text until the visitor scrolls.
export function useDarkHero() {
    const { setDarkHero } = usePublicChrome();
    useEffect(() => {
        setDarkHero(true);
        return () => setDarkHero(false);
    }, [setDarkHero]);
}

// Public pages and their in-page sections, shared by the navbar, footer and page headers.
export const PUBLIC_PAGES = [
    { to: '/home', label: 'Home' },
    { to: '/classes', label: 'Classes' },
    { to: '/rooms', label: 'Rooms' },
    { to: '/about', label: 'About us' },
];
