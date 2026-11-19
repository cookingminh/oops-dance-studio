import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';

const COLOURS = ['hsl(0 66% 45%)', 'hsl(40 95% 58%)', 'hsl(145 52% 44%)', 'hsl(350 82% 70%)', 'hsl(20 90% 60%)'];
// A dozen pieces thrown around the tick, each its own way.
const PIECES = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2 + (index % 2 ? 0.22 : -0.12);
    const distance = 44 + (index % 3) * 14;
    return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 8,
        rotate: (index * 67) % 360,
        colour: COLOURS[index % COLOURS.length],
        round: index % 3 === 0,
    };
});

// "Yes, close the chat": a tick drawn in a green disc, a small confetti burst and a thank-you, then `onDone`
// (the closed note takes its place). Without motion: the tick and the words, briefly.
const SupportCelebration = ({ onDone }) => {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const done = useRef(onDone);
    done.current = onDone;

    useEffect(() => {
        const timer = setTimeout(() => done.current(), reduceMotion ? 900 : 1700);
        return () => clearTimeout(timer);
    }, [reduceMotion]);

    return (
        <div className="supportCelebrate" role="status">
            <span className="supportCelebrateMark" aria-hidden="true">
                {!reduceMotion &&
                    PIECES.map((piece, index) => (
                        <motion.span
                            key={index}
                            className={`supportConfetti${piece.round ? ' isRound' : ''}`}
                            style={{ background: piece.colour }}
                            // Out fast, then a little fall while it fades.
                            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
                            animate={{
                                x: [0, piece.x * 0.9, piece.x],
                                y: [0, piece.y, piece.y + 22],
                                opacity: [1, 1, 0],
                                scale: [0.4, 1, 0.85],
                                rotate: [0, piece.rotate / 2, piece.rotate],
                            }}
                            transition={{ duration: 1.25, delay: 0.15, times: [0, 0.5, 1], ease: 'easeOut' }}
                        />
                    ))}
                <motion.svg viewBox="0 0 52 52" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}>
                    <circle cx="26" cy="26" r="24" className="supportCelebrateDisc" />
                    <motion.path
                        d="M15 27 l7 7 l15 -16"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
                    />
                </motion.svg>
            </span>
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
                {t('Thanks for chatting with us.')}
            </motion.p>
        </div>
    );
};

export default SupportCelebration;
