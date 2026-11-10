import { Bar } from 'react-chartjs-2';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { SERIES, barDataset, barOptions } from '../../../../common/chartTheme';

// Money in vs money out per month, from the validated palette (same slots as the report: tuition
// blue, payroll green, costs amber). In and out are two bars side by side; out is stacked.
// The running month is lighter (not final). The table under it gives the exact numbers.
const MONEY_COLORS = { collected: SERIES[0], pay: SERIES[2], costs: SERIES[3] };

const shade = (hex, alpha = 0.45) => {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const compact = (value) => (Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(value / 1000)}k`);

const MoneyChart = ({ rows, thisMonth }) => {
    const { t, formatDate } = useI18n();
    const colors = (color) => rows.map((row) => (row.month === thisMonth ? shade(color) : color));
    const dataset = (label, key, color, stack) => ({
        ...barDataset(label, rows.map((row) => row[key]), color, { stacked: stack === 'out' }),
        backgroundColor: colors(color),
        hoverBackgroundColor: colors(color),
        stack,
    });
    const options = barOptions({ stacked: true, formatTick: (value) => (value === 0 ? '0' : compact(value)), formatValue: formatVnd });
    options.plugins.tooltip.callbacks.footer = (items) => {
        const row = rows[items[0]?.dataIndex];
        return row ? t('Margin {amount}', { amount: formatVnd(row.margin) }) : '';
    };

    return (
        <div className="hubChart">
            <Bar
                data={{
                    labels: rows.map((row) => formatDate(row.month, 'monthShort')),
                    datasets: [
                        dataset(t('Collected'), 'collected', MONEY_COLORS.collected, 'in'),
                        dataset(t('Instructor pay'), 'instructor_pay', MONEY_COLORS.pay, 'out'),
                        dataset(t('Class costs'), 'direct_costs', MONEY_COLORS.costs, 'out'),
                    ],
                }}
                options={options}
                role="img"
                aria-label={t('Money in and out of this class over the last months')}
            />
        </div>
    );
};

export default MoneyChart;
