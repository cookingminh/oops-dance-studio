import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { SLOGAN, VALUES } from './aboutContent';
import { revealGroup, revealItem } from './aboutHelpers';
import ChapterHead from './ChapterHead';

// 05 · What we believe: the slogan is the headline of a dark spread, then four values.
const AboutBeliefs = () => {
    const { t } = useI18n();
    return (
        <section className="abSection abBeliefs" aria-labelledby="beliefs-title">
            <div className="abWrap">
                <ChapterHead
                    id="beliefs-title"
                    number="05"
                    eyebrow={t('What we believe')}
                    tone="dark"
                    className="isSlogan"
                    title={
                        <>
                            <span>{t(SLOGAN.first)}</span> <em>{t(SLOGAN.second)}</em>
                        </>
                    }
                />

                <motion.ol className="abValues" {...revealGroup}>
                    {VALUES.map((value, index) => (
                        <motion.li key={value.title} className="abValue" {...revealItem}>
                            <span className="abValueNo" aria-hidden="true">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <h3>{t(value.title)}</h3>
                            <p>{t(value.text)}</p>
                        </motion.li>
                    ))}
                </motion.ol>
            </div>
        </section>
    );
};

export default AboutBeliefs;
