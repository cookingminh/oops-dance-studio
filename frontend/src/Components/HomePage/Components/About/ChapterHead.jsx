import { motion } from 'framer-motion';
import { reveal } from './aboutHelpers';

// Section heading of the long read: chapter number, eyebrow, title and an optional intro.
// Texts arrive already translated. `id` labels the section (aria-labelledby).
const ChapterHead = ({ id, number, eyebrow, title, intro, tone = 'light', className = '' }) => (
    <motion.header className={`abChapter tone-${tone} ${className}`} {...reveal}>
        <p className="abChapterMark">
            <span className="abChapterNo" aria-hidden="true">
                {number}
            </span>
            <span className="abChapterEyebrow">{eyebrow}</span>
        </p>
        <h2 id={id}>{title}</h2>
        {intro && <p className="abChapterIntro">{intro}</p>}
    </motion.header>
);

export default ChapterHead;
