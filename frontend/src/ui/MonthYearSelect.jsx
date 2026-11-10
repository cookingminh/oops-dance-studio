import { useI18n } from '@/i18n/i18nContext';

// Month (1–12) and year selects used by the charts.
const MonthYearSelect = ({ month, year, onChange, years = 5, className = 'flex gap-4 mb-4 justify-center', selectClassName = 'p-2 border rounded' }) => {
    const { t, monthName } = useI18n();
    const currentYear = new Date().getFullYear();
    return (
        <div className={className}>
            <select
                aria-label={t('Month')}
                className={selectClassName}
                value={month}
                onChange={(event) => onChange({ month: Number(event.target.value), year })}
            >
                {Array.from({ length: 12 }, (_, index) => (
                    <option key={index} value={index + 1}>
                        {monthName(`2026-${String(index + 1).padStart(2, '0')}-01`)}
                    </option>
                ))}
            </select>
            <select
                aria-label={t('Year')}
                className={selectClassName}
                value={year}
                onChange={(event) => onChange({ month, year: Number(event.target.value) })}
            >
                {Array.from({ length: years }, (_, index) => currentYear - index).map((value) => (
                    <option key={value} value={value}>{value}</option>
                ))}
            </select>
        </div>
    );
};

export default MonthYearSelect;
