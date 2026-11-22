// Shared bits for the About us sections (kept out of the .jsx files for react-refresh).
import { useCallback } from 'react';
import { useI18n } from '@/i18n/i18nContext';

export const EASE_OUT = [0.22, 1, 0.36, 1];
export const VIEWPORT = { once: true, margin: '0px 0px -12% 0px' };

// The page's copy (src/content/about.js) is either a plain string or an { en, vi } pair: pick the
// visitor's language, falling back to English.
export function useLocalize() {
    const { lang } = useI18n();
    return useCallback((text) => (text && typeof text === 'object' ? (text[lang] ?? text.en) : (text ?? '')), [lang]);
}

// "2014–2021" / "2022–now".
export const yearRange = (from, to, now) => `${from}–${to ?? now}`;

// Spread on a motion element: it fades in (and slides from x / y) once it scrolls into view.
// With reduced motion it renders as is: no hidden first frame.
export const reveal = (reduce, { x = 0, y = 24, delay = 0, duration = 0.55 } = {}) =>
    reduce
        ? {}
        : {
              initial: { opacity: 0, x, y },
              whileInView: { opacity: 1, x: 0, y: 0 },
              viewport: VIEWPORT,
              transition: { duration, delay, ease: EASE_OUT },
          };

// A container whose `staggerItem` children come in one after another.
export const stagger = (reduce, gap = 0.08) =>
    reduce
        ? {}
        : {
              initial: 'hidden',
              whileInView: 'show',
              viewport: VIEWPORT,
              variants: { hidden: {}, show: { transition: { staggerChildren: gap } } },
          };

export const staggerItem = {
    variants: {
        hidden: { opacity: 0, y: 22 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
    },
};
