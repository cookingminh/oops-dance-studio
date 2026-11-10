import { motion } from 'framer-motion';
import AsyncState from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import ClassCard from './ClassCard';

const EASE = [0.22, 1, 0.36, 1];
const grid = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const card = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

// /classes: every class at once. A session picked in the timetable scrolls here and pulses its card.
const ClassGrid = ({ classes, picked }) => {
    const { t } = useI18n();
    return (
        <section id="all-classes" className="hpClassGrid">
            <header className="hpSectionHead" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('All classes')}</span>
                    <h2>{t('Pick your class')}</h2>
                    <p>{t('Each class learns one routine a month, with the song, the coach and the weekly times right here.')}</p>
                </div>
            </header>

            <AsyncState state={classes} emptyText="New classes are coming soon.">
                {(list) => (
                    <motion.div className="hpClassGridList" variants={grid} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
                        {list.map((item) => (
                            <motion.div key={item.id} variants={card}>
                                <ClassCard item={item} anchor flash={picked.id === item.id ? picked.nonce : 0} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AsyncState>
        </section>
    );
};

export default ClassGrid;
