import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from './motion';

const plain = (value) => String(value);

// Counts from 0 up to `value` once it is known. Pass a module-level `format` (it is an effect dependency).
const CountUp = ({ value, format = plain, duration = 1.2 }) => {
    const reduceMotion = useReducedMotion();
    const [shown, setShown] = useState(() => (reduceMotion ? value : 0));

    useEffect(() => {
        if (reduceMotion) {
            setShown(value);
            return undefined;
        }
        const controls = animate(0, value, { duration, ease: EASE_OUT, onUpdate: (latest) => setShown(Math.round(latest)) });
        return () => controls.stop();
    }, [value, duration, reduceMotion]);

    return <>{format(shown)}</>;
};

export default CountUp;
