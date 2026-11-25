import { LuBadgeCheck, LuFileEdit, LuFileText, LuLightbulb } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { CATEGORY_ICONS, STATUSES } from './knowledgeModel';

export const CategoryIcon = ({ category }) => {
    const Icon = CATEGORY_ICONS[category] ?? LuFileText;
    return (
        <span className="kbIcon" aria-hidden="true">
            <Icon />
        </span>
    );
};

export const StatusPill = ({ status }) => {
    const { t } = useI18n();
    const Icon = status === 'published' ? LuBadgeCheck : LuFileEdit;
    return (
        <span className={`kbPill is-${status}`}>
            <Icon aria-hidden="true" />
            {t(STATUSES[status]?.pill ?? status)}
        </span>
    );
};

const TIPS = [
    'One topic per article.',
    'Short, factual sentences.',
    'Only real prices and real rules.',
    'Customers may read this: nothing private or internal.',
];

// How to write for the assistant.
export const WritingTips = () => {
    const { t } = useI18n();
    return (
        <aside className="kbTips" aria-label={t('Writing for the assistant')}>
            <strong>
                <LuLightbulb aria-hidden="true" />
                {t('Writing for the assistant')}
            </strong>
            <ul>
                {TIPS.map((tip) => (
                    <li key={tip}>{t(tip)}</li>
                ))}
            </ul>
        </aside>
    );
};
