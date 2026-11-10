import { motion } from 'framer-motion';
import { LuAlertTriangle, LuCheckCircle2, LuInfo, LuLightbulb } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard, { CardFooterLink } from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';

const TONES = {
    good: { icon: LuCheckCircle2, label: 'Good news' },
    bad: { icon: LuAlertTriangle, label: 'Needs a look' },
    neutral: { icon: LuInfo, label: 'For the record' },
};

// The month in a few sentences, generated from the numbers (see buildInsights.js).
const Insights = ({ items, monthLabel, inProgress, hasOpen }) => {
    const { t } = useI18n();
    return (
        <SectionCard
            className="insightsCard"
            icon={LuLightbulb}
            title={t('What stands out')}
            subtitle={inProgress ? t('{month} so far, in a few lines', { month: monthLabel }) : t('{month} in a few lines', { month: monthLabel })}
            footer={hasOpen && <CardFooterLink to="/admin/tuition">{t('See who still has to pay on the Tuition page')}</CardFooterLink>}
        >
            {items.length === 0 ? (
                <p className="insightEmpty">{t('Nothing to report for this month yet.')}</p>
            ) : (
                <motion.ul className="insightList" variants={stagger} initial="hidden" animate="show" key={monthLabel}>
                    {items.map((item) => {
                        const tone = TONES[item.tone];
                        const Icon = tone.icon;
                        return (
                            <motion.li variants={fadeUp} key={item.key} className={`insight tone-${item.tone}`}>
                                <span className="insightIcon" title={t(tone.label)}>
                                    <Icon aria-hidden="true" />
                                    <span className="sr-only">{t(tone.label)}: </span>
                                </span>
                                <span className="insightText">{item.text}</span>
                            </motion.li>
                        );
                    })}
                </motion.ul>
            )}
        </SectionCard>
    );
};

export default Insights;
