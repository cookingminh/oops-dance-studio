import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT } from './aboutHelpers';

// Counts up to `value` the first time it scrolls into view (a year counts from its century: 2000 → 2014).
// The number is a motion value, so counting doesn't re-render React. Screen readers get the final
// number straight away; with reduced motion everyone does.
const StatCounter = ({ value, suffix = '', kind, delay = 0 }) => {
    const { intl } = useI18n();
    const ref = useRef(null);
    // Any visible part starts it: the stats sit at the bottom of the first screen.
    const inView = useInView(ref, { once: true });
    const reduce = useReducedMotion();
    const from = kind === 'year' ? Math.floor(value / 100) * 100 : 0;
    const count = useMotionValue(reduce ? value : from);

    const format = (number) => `${kind === 'year' ? number : new Intl.NumberFormat(intl).format(number)}${suffix}`;
    const shown = useTransform(count, (latest) => format(Math.round(latest)));

    useEffect(() => {
        if (!inView) return undefined;
        if (reduce) {
            count.set(value);
            return undefined;
        }
        const controls = animate(count, value, { duration: 1.6, delay, ease: EASE_OUT });
        return () => controls.stop();
    }, [inView, reduce, value, count, delay]);

    // The hidden final value holds the width, so the row doesn't jump while counting.
    return (
        <span ref={ref} className="abCounter">
            <span className="abCounterGhost" aria-hidden="true">
                {format(value)}
            </span>
            <motion.span className="abCounterLive" aria-hidden="true">
                {shown}
            </motion.span>
            <span className="sr-only">{format(value)}</span>
        </span>
    );
};

export default StatCounter;
