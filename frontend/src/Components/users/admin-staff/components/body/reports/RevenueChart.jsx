import { Bar } from 'react-chartjs-2';
import { LuBarChart3 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard, { CardFooterLink } from '../../common/SectionCard';
import { barDataset } from '../../common/chartTheme';
import { COLORS, barColors, focusBandPlugin, reportBarOptions } from './reportChart';
import { InProgressKey, LegendKeys } from './ChartBits';

const PLUGINS = [focusBandPlugin];

// Money in by source (tuition + room bookings, stacked). It shares its scale with the costs
// chart beside it (`scaleMax`), so a revenue bar and a costs bar of the same height are equal.
// The legend is HTML, outside the canvas: both plots then get the same height, whatever the
// number of legend rows.
const RevenueChart = ({ rows, labels, narrowLabels, focusIndex, onPick, thisMonth, fmt, scaleMax }) => {
    const { t } = useI18n();
    const months = rows.map((row) => row.month);
    const shade = (color) => barColors(color, months, thisMonth);

    const datasets = [
        barDataset(t('Tuition'), rows.map((row) => row.tuition_collected), COLORS.tuition, { stacked: true }),
        barDataset(t('Room bookings'), rows.map((row) => row.bookings_revenue), COLORS.bookings, { stacked: true }),
    ].map((dataset) => ({ ...dataset, backgroundColor: shade(dataset.backgroundColor), hoverBackgroundColor: shade(dataset.backgroundColor) }));

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
            return row ? t('Revenue {amount}', { amount: fmt.money(row.revenue) }) : '';
        },
    });

    const focused = rows[focusIndex];
    return (
        <SectionCard
            className="reportChartCard"
            icon={LuBarChart3}
            title={t('Revenue')}
            subtitle={
                focused
                    ? t('{month}: {amount} in', { month: fmt.heading(focused.month), amount: fmt.money(focused.revenue) })
                    : t('Money in by source, on the same scale as costs')
            }
            footer={<CardFooterLink to="/admin/charts">{t('Room bookings by room on the Charts page')}</CardFooterLink>}
        >
            <LegendKeys keys={[{ label: t('Tuition'), color: COLORS.tuition }, { label: t('Room bookings'), color: COLORS.bookings }]} />
            <div className="reportCanvas isTall">
                <Bar
                    data={{ labels, datasets }}
                    options={options}
                    plugins={PLUGINS}
                    role="img"
                    aria-label={
                        focused
                            ? t('Revenue by month. {month}: tuition {tuition}, room bookings {rooms}.', {
                                  month: fmt.monthName(focused.month),
                                  tuition: fmt.money(focused.tuition_collected),
                                  rooms: fmt.money(focused.bookings_revenue),
                              })
                            : t('Revenue by month')
                    }
                />
            </div>
            <p className="chartKeyNote">{t('Same scale as the costs chart, so the bars compare.')}</p>
            {months.includes(thisMonth) && <InProgressKey month={fmt.monthName(thisMonth)} />}
        </SectionCard>
    );
};

export default RevenueChart;
