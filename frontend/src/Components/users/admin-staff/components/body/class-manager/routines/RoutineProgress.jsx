import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import './routines.scss';

const MAX_PIPS = 24; // beyond this a routine is drawn as one bar

// Held / total sessions of a routine: one pip per session (the next one pulses), or a bar for long
// routines. `size` 'md' | 'sm'. The colour comes from --rt-fill (brand red by default).
const RoutineProgress = ({ held, total, size = 'md', className = '' }) => {
    const { t } = useI18n();
    const done = Math.min(held, total);
    const label = t('{held} of {total} sessions held', { held: done, total });
    const common = {
        className: `rtProgress size-${size} ${className}`,
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': total,
        'aria-valuenow': done,
    };

    if (total > MAX_PIPS) {
        return (
            <span {...common}>
                <span className="rtBar">
                    <motion.span
                        className="rtBarFill"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: total ? done / total : 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    />
                </span>
            </span>
        );
    }

    return (
        <span {...common}>
            {Array.from({ length: total }, (_, index) => (
                <motion.span
                    key={index}
                    className={`rtPip${index < done ? ' isHeld' : ''}${index === done ? ' isNext' : ''}`}
                    initial={{ opacity: 0, scaleY: 0.4 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.03 }}
                />
            ))}
        </span>
    );
};

export default RoutineProgress;
