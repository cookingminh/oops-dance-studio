import { Bar } from 'react-chartjs-2';
import { LuPiggyBank } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import { barDataset } from '../../common/chartTheme';
import { COLORS, focusBandPlugin, focusValuePlugin, inProgressShade, reportBarOptions } from './reportChart';
import { InProgressKey, LegendKeys } from './ChartBits';

const PLUGINS = [focusBandPlugin, focusValuePlugin];

// Profit per month (revenue − payroll − expenses): above the line in blue, a loss below it in red.
// The focused month carries its value as the one direct label.
const ProfitChart = ({ rows, labels, narrowLabels, focusIndex, onPick, thisMonth, fmt }) => {
    const { t } = useI18n();
    const months = rows.map((row) => row.month);
    const colors = rows.map((row) => {
        const color = row.profit < 0 ? COLORS.loss : COLORS.gain;
        return row.month === thisMonth ? inProgressShade(color) : color;
    });
    const dataset = { ...barDataset(t('Profit'), rows.map((row) => row.profit), COLORS.gain), backgroundColor: colors, hoverBackgroundColor: colors };

    const options = reportBarOptions({
        months,
        narrowLabels,
        focusIndex,
        onPick,
        legend: false,
        formatTick: (value) => (value === 0 ? '0' : fmt.short(value)),
        formatValue: fmt.money,
        valueLabel: fmt.short,
        tooltipLabel: (item) => ` ${item.parsed.y < 0 ? t('Loss') : t('Profit')}: ${fmt.money(item.parsed.y)}`,
        footer: (items) => {
            const row = rows[items[0]?.dataIndex];
            if (!row) return '';
            return [
                t('Revenue {amount}', { amount: fmt.money(row.revenue) }),
                t('Costs {amount}', { amount: fmt.money(row.costs_total) }),
                row.margin !== null ? t('Margin {pct}', { pct: fmt.pct(row.margin) }) : null,
            ].filter(Boolean);
        },
    });
    // A month that broke even still gets a tooltip.
    options.plugins.tooltip.filter = () => true;

    const hasLoss = rows.some((row) => row.profit < 0);
    const focused = rows[focusIndex];
    return (
        <SectionCard
            className="reportChartCard"
            icon={LuPiggyBank}
            title={t('Profit')}
            subtitle={focused ? t('{month}: {amount}', { month: fmt.heading(focused.month), amount: fmt.money(focused.profit) }) : t('Revenue − payroll − expenses')}
        >
            {hasLoss && <LegendKeys keys={[{ label: t('Profit'), color: COLORS.gain }, { label: t('Loss'), color: COLORS.loss }]} />}
            <div className="reportCanvas">
                <Bar
                    data={{ labels, datasets: [dataset] }}
                    options={options}
                    plugins={PLUGINS}
                    role="img"
                    aria-label={t('Profit by month: {list}', { list: rows.map((row) => `${fmt.monthName(row.month)} ${fmt.money(row.profit)}`).join(', ') })}
                />
            </div>
            <p className="chartKeyNote">{t('Profit = revenue − payroll − expenses.')}</p>
            {months.includes(thisMonth) && <InProgressKey month={fmt.monthName(thisMonth)} />}
        </SectionCard>
    );
};

export default ProfitChart;
