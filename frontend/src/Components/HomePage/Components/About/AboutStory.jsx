import { motion } from 'framer-motion';
import { LuQuote } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { STORY } from './aboutContent';
import { reveal } from './aboutHelpers';
import ChapterHead from './ChapterHead';

// 01 · The story as a short long-read: the heading and a fact file stay in view (desktop) while
// the paragraphs, a photo and a pull quote scroll past.
const AboutStory = () => {
    const { t } = useI18n();
    const [first, second, third, fourth] = STORY.paragraphs;

    return (
        <section id="story" tabIndex={-1} className="abSection abStory" aria-labelledby="story-title">
            <div className="abWrap abStoryGrid">
                <div className="abStoryAside">
                    <ChapterHead id="story-title" number="01" eyebrow={t('Our story')} title={t(STORY.title)} />
                    <motion.aside className="abFacts" aria-labelledby="facts-title" {...reveal}>
                        <h3 id="facts-title">{t('At a glance')}</h3>
                        <dl>
                            {STORY.facts.map((fact) => (
                                <div key={fact.label}>
                                    <dt>{t(fact.label)}</dt>
                                    <dd>{t(fact.value)}</dd>
                                </div>
                            ))}
                        </dl>
                    </motion.aside>
                </div>

                <div className="abStoryBody">
                    <motion.p className="abStoryLead" {...reveal}>
                        {t(first)}
                    </motion.p>
                    <motion.p {...reveal}>{t(second)}</motion.p>

                    <motion.figure className="abStoryPhoto" {...reveal}>
                        <img src={STORY.photo.src} alt={t(STORY.photo.alt)} width="1070" height="716" loading="lazy" />
                        <figcaption>{t(STORY.photo.caption)}</figcaption>
                    </motion.figure>

                    <motion.p {...reveal}>{t(third)}</motion.p>

                    <motion.blockquote className="abQuote" {...reveal}>
                        <LuQuote className="abQuoteMark" aria-hidden="true" />
                        <p>{t(STORY.quote)}</p>
                        <footer>{t(STORY.quoteBy)}</footer>
                    </motion.blockquote>

                    <motion.p {...reveal}>{t(fourth)}</motion.p>
                </div>
            </div>
        </section>
    );
};

export default AboutStory;
