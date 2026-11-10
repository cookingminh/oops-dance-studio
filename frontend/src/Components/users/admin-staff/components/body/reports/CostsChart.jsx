import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { LuLayers } from 'react-icons/lu';
import { categoryOf } from '@/lib/expenseCategories';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard, { CardFooterLink } from '../../common/SectionCard';
import { barDataset } from '../../common/chartTheme';
import { ChartTable, ViewToggle } from '../../common/ChartViews';
import { COLORS, barColors, focusBandPlugin, groupColor, reportBarOptions } from './reportChart';
import { OTHER_GROUP, groupAmounts, groupLabel } from './reportModel';
import { InProgressKey, LegendKeys } from './ChartBits';

const PLUGINS = [focusBandPlugin];

// Where the money goes: payroll, then each big expense category, then Other, stacked per month
// in that fixed order (colours from reportChart). Same scale as the revenue chart. The table view
// gives every number; the tooltip names what Other holds that month. HTML legend (see RevenueChart).
const CostsChart = ({ rows, labels, narrowLabels, focusIndex, onPick, thisMonth, fmt, scaleMax, expenses, groups }) => {
    const { t } = useI18n();
    const [view, setView] = useState('chart');
    const months = rows.map((row) => row.month);
    const amounts = rows.map((row) => groupAmounts(expenses.get(row.month), groups));
    const hasOther = amounts.some((month) => month[OTHER_GROUP] > 0);

    const series = [
        { key: 'payroll', label: t('Payroll cost'), color: COLORS.payroll, data: rows.map((row) => row.payroll_cost) },
        ...groups.named.map((group) => ({ key: group, label: t(groupLabel(group)), color: groupColor(group, groups), data: amounts.map((month) => month[group] ?? 0) })),
        ...(hasOther ? [{ key: OTHER_GROUP, label: t('Other'), color: COLORS.other, data: amounts.map((month) => month[OTHER_GROUP] ?? 0) }] : []),
    ];
    const datasets = series.map(({ label, color, data }) => {
        const shaded = barColors(color, months, thisMonth);
        return { ...barDataset(label, data, color, { stacked: true }), backgroundColor: shaded, hoverBackgroundColor: shaded };
    });

    // What "Other" holds in a month, biggest first: "Costumes 1.2M ₫, Supplies 360K ₫".
    const otherList = (month) =>
        (expenses.get(month) ?? [])
            .filter((row) => !groups.named.includes(row.category))
            .map((row) => `${t(categoryOf(row.category).label)} ${fmt.short(row.amount)}`)
            .join(', ');

    const options = reportBarOptions({
        months,
        narrowLabels,
        focusIndex,
        onPick,
        stacked: true,
        legend: false,
        suggestedMax: scaleMax,
        formatTick: (value) => (value === 0 ? '0' : fmt.short(value)),
        formatValue: fmt.money,
        footer: (items) => {
            const row = rows[items[0]?.dataIndex];
            if (!row) return '';
            const other = amounts[items[0].dataIndex][OTHER_GROUP] > 0 ? t('Other: {list}', { list: otherList(row.month) }) : null;
            return [t('Costs {amount}', { amount: fmt.money(row.costs_total) }), other].filter(Boolean);
        },
    });

    const focused = rows[focusIndex];
    const tableData = {
        labels: rows.map((row) => fmt.heading(row.month)),
        datasets: series.map(({ label, color, data }) => ({ label, data, backgroundColor: color })),
    };

    return (
        <SectionCard
            className="reportChartCard costsCard"
            icon={LuLayers}
            title={t('Costs')}
            subtitle={
                focused
                    ? t('{month}: payroll {payroll}, expenses {expenses}', {
                          month: fmt.heading(focused.month),
                          payroll: fmt.short(focused.payroll_cost),
                          expenses: fmt.short(focused.expenses_total),
                      })
                    : t('Payroll and expenses by month')
            }
            actions={
                <div className="noPrint">
                    <ViewToggle view={view} onChange={setView} label={t('Costs')} />
                </div>
            }
            footer={<CardFooterLink to="/admin/expenses">{t('See every expense on the Expenses page')}</CardFooterLink>}
        >
            {view === 'chart' ? (
                <>
                    <LegendKeys keys={series.map(({ label, color }) => ({ label, color }))} />
                    <div className="reportCanvas isTall">
                        <Bar
                            data={{ labels, datasets }}
                            options={options}
                            plugins={PLUGINS}
                            role="img"
                            aria-label={
                                focused
                                    ? t('Costs by month. {month}: {list}.', {
                                          month: fmt.monthName(focused.month),
                                          list: series
                                              .filter((item) => item.data[focusIndex] > 0)
                                              .map((item) => `${item.label} ${fmt.money(item.data[focusIndex])}`)
                                              .join(', '),
                                      })
                                    : t('Costs by month')
                            }
                        />
                    </div>
                    <p className="chartKeyNote">
                        {t('Same scale as the revenue chart, so the bars compare.')}
                        {hasOther && ` ${t('Smaller categories are grouped as Other.')}`}
                    </p>
                    {months.includes(thisMonth) && <InProgressKey month={fmt.monthName(thisMonth)} />}
                </>
            ) : (
                <ChartTable data={tableData} rowHeader={t('Month')} format={fmt.money} />
            )}
        </SectionCard>
    );
};

export default CostsChart;
