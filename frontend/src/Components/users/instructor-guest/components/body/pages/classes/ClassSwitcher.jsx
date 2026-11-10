import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { ClassThumb } from './ClassParts';

const EASE = [0.22, 1, 0.36, 1];

// Tabs to switch between classes (arrow keys move between them). The highlight slides from the
// old tab to the new one. `renderMeta(cls)` adds a line under each name.
//   variant  'cards' (My Classes) | 'chips' (overview)
export const ClassTabs = ({ classes, selectedId, onSelect, idPrefix, variant = 'cards', itemClassName = '', renderMeta }) => {
    const { t } = useI18n();
    const refs = useRef({});

    const onKeyDown = (event, index) => {
        const moves = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: classes.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const target = classes[(moves[event.key] + classes.length) % classes.length];
        onSelect(target.id);
        refs.current[target.id]?.focus();
    };

    return (
        <div className={`pfTabs is-${variant}`} role="tablist" aria-label={t('Choose a class')}>
            {classes.map((cls, index) => {
                const active = cls.id === selectedId;
                return (
                    <button
                        key={cls.id}
                        ref={(node) => {
                            refs.current[cls.id] = node;
                        }}
                        type="button"
                        role="tab"
                        id={`${idPrefix}-tab-${cls.id}`}
                        aria-selected={active}
                        aria-controls={`${idPrefix}-panel`}
                        tabIndex={active ? 0 : -1}
                        className={`pfTab ${itemClassName}${active ? ' isActive' : ''}`}
                        onClick={() => onSelect(cls.id)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                    >
                        {active && <motion.span layoutId={`${idPrefix}-tab-bg`} className="pfTabBg" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                        <ClassThumb cls={cls} />
                        <span className="pfTabText">
                            <strong>{cls.name}</strong>
                            {renderMeta && <small>{renderMeta(cls)}</small>}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

const slide = {
    enter: (direction) => ({ opacity: 0, x: direction * 28 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: (direction) => ({ opacity: 0, x: direction * -20, transition: { duration: 0.16, ease: 'easeIn' } }),
};

// The selected class's view; it slides in from the side of the tab that was picked.
export const ClassPanel = ({ classes, selectedId, idPrefix, className = '', children }) => {
    const index = classes.findIndex((cls) => cls.id === selectedId);
    // Remember which way the selection moved (adjusting state while rendering, as React suggests).
    const [track, setTrack] = useState({ index, direction: 1 });
    if (track.index !== index) setTrack({ index, direction: index > track.index ? 1 : -1 });
    const direction = track.index !== index ? (index > track.index ? 1 : -1) : track.direction;
    const cls = classes[index];
    if (!cls) return null;

    return (
        <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${cls.id}`} className={`pfPanelWrap ${className}`}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div key={cls.id} custom={direction} variants={slide} initial="enter" animate="center" exit="exit">
                    {children(cls)}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
