import { useI18n } from '@/i18n/i18nContext';
import './sessionLegend.scss';

// What the session calendar's colours and outlines mean. `byState`: items are coloured by their
// state (one class's calendar); otherwise each class has its own colour and the outline tells.
const SessionLegend = ({ byState = false }) => {
    const { t } = useI18n();
    const entries = byState
        ? [
            { key: 'done', label: 'Done' },
            { key: 'review', label: 'Needs review' },
            { key: 'live', label: 'Today' },
            { key: 'planned', label: 'Planned' },
            { key: 'cancelled', label: 'Cancelled' },
        ]
        : [
            { key: 'solid', label: 'Done or under way' },
            { key: 'review', label: 'Needs review' },
            { key: 'planned', label: 'Planned' },
            { key: 'cancelled', label: 'Cancelled or no record' },
        ];
    return (
        <ul className={`sessionLegend${byState ? ' isByState' : ''}`} aria-label={t('Legend')}>
            {entries.map((entry) => (
                <li key={entry.key} className={`is-${entry.key}`}>
                    <span className="sessionLegendSwatch" aria-hidden="true" />
                    {t(entry.label)}
                </li>
            ))}
        </ul>
    );
};

export default SessionLegend;
