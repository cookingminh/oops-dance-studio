import { motion } from 'framer-motion';
import { LuHeartHandshake, LuMic2, LuTrophy } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { ACHIEVEMENTS } from './aboutContent';
import { revealGroup, revealItem } from './aboutHelpers';
import ChapterHead from './ChapterHead';

const KINDS = {
    competition: { icon: LuTrophy, label: 'Competition' },
    stage: { icon: LuMic2, label: 'Stage' },
    community: { icon: LuHeartHandshake, label: 'Community' },
};

// 03 · Proud moments as a ledger: when, what kind (icon + word), what happened.
const AboutAchievements = () => {
    const { t } = useI18n();
    return (
        <section className="abSection abProud" aria-labelledby="proud-title">
            <div className="abWrap">
                <ChapterHead
                    id="proud-title"
                    number="03"
                    eyebrow={t('Proud moments')}
                    title={t('A few things we’re proud of')}
                    intro={t('Trophies are nice, but the moments we remember most happened with our students.')}
                />

                <motion.ol className="abLedger" {...revealGroup}>
                    {ACHIEVEMENTS.map((item) => {
                        const kind = KINDS[item.kind] ?? KINDS.stage;
                        const Icon = kind.icon;
                        return (
                            <motion.li key={item.title} className={`abLedgerRow kind-${item.kind}`} {...revealItem}>
                                <span className="abLedgerWhen">{item.ongoing ? t('{year}–now', { year: item.year }) : item.year}</span>
                                <span className="abLedgerKind">
                                    <Icon aria-hidden="true" /> {t(kind.label)}
                                </span>
                                <h3>{t(item.title)}</h3>
                                <p>{t(item.text)}</p>
                            </motion.li>
                        );
                    })}
                </motion.ol>
            </div>
        </section>
    );
};

export default AboutAchievements;
