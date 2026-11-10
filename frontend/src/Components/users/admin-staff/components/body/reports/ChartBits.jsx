import { useI18n } from '@/i18n/i18nContext';
import { inProgressShade } from './reportChart';

// Explains the lighter bar of the month that is still running.
export const InProgressKey = ({ month }) => {
    const { t } = useI18n();
    return (
        <p className="chartKeyNote">
            <span className="keySwatch isInProgress" style={{ background: inProgressShade('#2a78d6') }} aria-hidden="true" />
            {t('Lighter bars: {month} is still in progress', { month })}
        </p>
    );
};

// A small HTML legend (for charts whose colours aren't one per dataset). keys: [{ label, color }]
export const LegendKeys = ({ keys }) => (
    <ul className="legendKeys">
        {keys.map((key) => (
            <li key={key.label}>
                <span className="keySwatch" style={{ background: key.color }} aria-hidden="true" />
                {key.label}
            </li>
        ))}
    </ul>
);
