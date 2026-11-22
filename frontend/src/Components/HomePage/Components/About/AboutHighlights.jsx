import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { LuTrophy } from 'react-icons/lu';
import { highlights, sections, timeline } from '@/content/about';
import { reveal, stagger, staggerItem, useLocalize } from './aboutHelpers';

const SPRING = { stiffness: 220, damping: 22, mass: 0.6 };

// A highlight card: lifts and tilts a little towards a mouse pointer, with a soft glow under it.
// Touch and reduced motion get the plain card.
const HighlightCard = ({ item, tone, wide, reduce, L }) => {
    const ref = useRef(null);
    const px = useMotionValue(0.5);
    const py = useMotionValue(0.5);
    const rotateX = useSpring(useTransform(py, [0, 1], [5, -5]), SPRING);
    const rotateY = useSpring(useTransform(px, [0, 1], [-6, 6]), SPRING);
    const glowX = useTransform(px, (value) => `${value * 100}%`);
    const glowY = useTransform(py, (value) => `${value * 100}%`);
    const glow = useMotionTemplate`radial-gradient(420px circle at ${glowX} ${glowY}, var(--hl-glow), transparent 45%)`;

    const onPointerMove = (event) => {
        if (reduce || event.pointerType !== 'mouse' || !ref.current) return;
        const box = ref.current.getBoundingClientRect();
        px.set((event.clientX - box.left) / box.width);
        py.set((event.clientY - box.top) / box.height);
    };
    const onPointerLeave = () => {
        px.set(0.5);
        py.set(0.5);
    };

    return (
        <motion.li className={`abHl tone-${tone}${wide ? ' isWide' : ''}`} {...(reduce ? {} : staggerItem)}>
            <motion.article
                ref={ref}
                className="abHlCard"
                style={reduce ? undefined : { rotateX, rotateY }}
                whileHover={reduce ? undefined : { y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
            >
                <motion.span className="abHlGlow" style={{ background: glow }} aria-hidden="true" />
                <LuTrophy className="abHlMark" aria-hidden="true" />
                <div className="abHlTop">
                    <span className="abHlYear">{item.year}</span>
                    <LuTrophy className="abHlTrophy" aria-hidden="true" />
                </div>
                <p className="abHlPrize">{L(item.prize)}</p>
                <h3>{L(item.title)}</h3>
                {item.description && <p className="abHlText">{L(item.description)}</p>}
            </motion.article>
        </motion.li>
    );
};

// The biggest wins as a card grid. The cards read their text from the timeline entries they point at;
// the first and last are wide (dark and red), the rest light.
const AboutHighlights = () => {
    const L = useLocalize();
    const reduce = useReducedMotion();
    const byId = new Map(timeline.map((item) => [item.id, item]));
    const cards = highlights.map((highlight) => ({ ...highlight, item: byId.get(highlight.timelineId) })).filter((card) => card.item);
    if (!cards.length) return null;
    const last = cards.length - 1;

    return (
        <section className="abSection abHighlights" aria-labelledby="highlights-title">
            <div className="abWrap">
                <motion.h2 id="highlights-title" className="abTitle" {...reveal(reduce)}>
                    {L(sections.highlights.title)}
                </motion.h2>
                <motion.ul className="abHlGrid" {...stagger(reduce)}>
                    {cards.map((card, index) => {
                        let tone = 'light';
                        if (index === 0) tone = 'dark';
                        else if (index === last) tone = 'red';
                        return (
                            <HighlightCard key={card.id} item={card.item} tone={tone} wide={index === 0 || (index === last && last > 1)} reduce={reduce} L={L} />
                        );
                    })}
                </motion.ul>
            </div>
        </section>
    );
};

export default AboutHighlights;
