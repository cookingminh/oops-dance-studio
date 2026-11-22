import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { LuFlag, LuSparkles, LuTrophy } from 'react-icons/lu';
import { eras, sections, timeline } from '@/content/about';
import { reveal, useLocalize, yearRange } from './aboutHelpers';

const TYPE_ICONS = { award: LuTrophy, milestone: LuFlag, project: LuSparkles };
const TYPES = Object.keys(TYPE_ICONS);

// One entry: a compact card (year and prize on one line, then the title) with its type's dot on the line.
// On wide screens the cards alternate sides and the right column starts half a card lower, so the two
// columns interlock instead of each entry taking a full row. `row` places it in that grid.
const Entry = ({ item, side, row, reduce, L }) => {
    const type = TYPE_ICONS[item.type] ? item.type : 'milestone';
    const Icon = TYPE_ICONS[type];
    return (
        <motion.li
            className={`abTlItem is-${side} type-${type}`}
            style={{ '--row': row }}
            {...reveal(reduce, { x: side === 'left' ? -28 : 28, y: 0, duration: 0.5 })}
        >
            <span className="abTlDot">
                <Icon aria-hidden="true" />
                <span className="sr-only">{L(sections.timeline.types[type])}</span>
            </span>
            <p className="abTlMeta">
                <span className="abTlYear">{item.year ?? L(sections.timeline.now)}</span>
                {item.prize && <span className="abTlPrize">{L(item.prize)}</span>}
            </p>
            <h4>{L(item.title)}</h4>
            {item.description && <p className="abTlText">{L(item.description)}</p>}
        </motion.li>
    );
};

// Vertical timeline in two chapters (the eras), with a REBORN divider between them. The red line fills
// as the reader scrolls. Phones get one column with the line on the left.
const AboutTimeline = () => {
    const L = useLocalize();
    const reduce = useReducedMotion();
    const trackRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start 75%', 'end 60%'] });
    const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
    const groups = eras.map((era) => ({ ...era, items: timeline.filter((item) => item.era === era.id) })).filter((era) => era.items.length);

    return (
        <section className="abSection abTimeline" aria-labelledby="timeline-title">
            <div className="abWrap">
                <div className="abTlHead">
                    <motion.h2 id="timeline-title" className="abTitle" {...reveal(reduce)}>
                        {L(sections.timeline.title)}
                    </motion.h2>
                    <motion.ul className="abTlLegend" {...reveal(reduce, { delay: 0.1 })}>
                        {TYPES.map((type) => {
                            const Icon = TYPE_ICONS[type];
                            return (
                                <li key={type} className={`type-${type}`}>
                                    <span className="abTlLegendIcon" aria-hidden="true">
                                        <Icon />
                                    </span>
                                    {L(sections.timeline.types[type])}
                                </li>
                            );
                        })}
                    </motion.ul>
                </div>

                <div className="abTl" ref={trackRef}>
                    <span className="abTlLine" aria-hidden="true">
                        <motion.span className="abTlFill" style={{ scaleY: reduce ? 1 : fill }} />
                    </span>

                    {groups.map((era, index) => (
                        <div key={era.id} className={`abTlEra${index > 0 ? ' isTurn' : ''}`}>
                            <motion.div className="abTlChapter" {...reveal(reduce, { y: 14 })}>
                                {index > 0 && (
                                    <span className="abTlChapterTurn" aria-hidden="true">
                                        {sections.timeline.turn}
                                    </span>
                                )}
                                <span className="abTlChapterLabel">
                                    <h3>{L(era.name)}</h3>
                                    <span className="abTlChapterYears">{yearRange(era.from, era.to, L(sections.timeline.untilNow))}</span>
                                </span>
                            </motion.div>
                            <ol className="abTlList">
                                {era.items.map((item, i) => (
                                    <Entry key={item.id} item={item} side={i % 2 ? 'right' : 'left'} row={i + 1} reduce={reduce} L={L} />
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AboutTimeline;
