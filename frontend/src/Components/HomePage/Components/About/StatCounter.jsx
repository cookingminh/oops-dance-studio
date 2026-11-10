import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT } from './aboutHelpers';

// Counts up to `value` the first time it scrolls into view. Screen readers get the final number
// straight away instead of every step.
const StatCounter = ({ value, suffix = '' }) => {
    const { intl } = useI18n();
    const ref = useRef(null);
    // Starts as soon as any of it shows: the strip can sit right at the bottom of the first screen.
    const inView = useInView(ref, { once: true });
    const reduceMotion = useReducedMotion();
    const [shown, setShown] = useState(0);

    useEffect(() => {
        if (!inView) return undefined;
        if (reduceMotion) {
            setShown(value);
            return undefined;
        }
        const controls = animate(0, value, { duration: 1.3, ease: EASE_OUT, onUpdate: (latest) => setShown(Math.round(latest)) });
        return () => controls.stop();
    }, [inView, value, reduceMotion]);

    const format = (number) => `${new Intl.NumberFormat(intl).format(number)}${suffix}`;

    // The hidden final value holds the width, so the line doesn't jump while counting.
    return (
        <span ref={ref} className="abCounter">
            <span className="abCounterGhost" aria-hidden="true">
                {format(value)}
            </span>
            <span className="abCounterLive" aria-hidden="true">
                {format(shown)}
            </span>
            <span className="sr-only">{format(value)}</span>
        </span>
    );
};

export default StatCounter;
