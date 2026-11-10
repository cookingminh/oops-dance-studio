import { useI18n } from '@/i18n/i18nContext';
import { priceReasons } from '../bookingsModel';

// Quick reasons for another price, as "Discounts" and "Surcharges"; only the group that matches the change
// (both while the total is still the list price). onPick({ label, amount? }) with the label translated.
const PriceReasonChips = ({ list, total, rate, onPick, onBack }) => {
    const { t } = useI18n();
    const groups = priceReasons({ list, total: Number.isFinite(total) ? total : list, rate });
    const group = (title, options) =>
        options.length > 0 && (
            <div className="tuQuick" role="group" aria-label={t(title)}>
                <span className="bfQuickTitle">{t(title)}</span>
                {options.map((option) => (
                    <button key={option.label} type="button" onClick={() => onPick({ ...option, label: t(option.label) })}>
                        {t(option.label)}
                    </button>
                ))}
            </div>
        );
    return (
        <div className="bfReasons">
            {group('Discounts', groups.discounts)}
            {group('Surcharges', groups.surcharges)}
            {onBack && total !== list && (
                <div className="tuQuick">
                    <button type="button" onClick={onBack}>
                        {t('Back to the list price')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PriceReasonChips;
