import { Bar } from 'react-chartjs-2';
import { LuArrowRightLeft, LuUsers } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import { barDataset } from '../../common/chartTheme';
import { COLORS, barColors, focusBandPlugin, reportBarOptions } from './reportChart';
import { InProgressKey } from './ChartBits';

const PLUGINS = [focusBandPlugin];

// People, not class enrolments: who stayed from last month, who is new, who came back after a
// break (above the line) and who left (below it). A student who moves to another class stays
// "continuing", so switches are shown on their own and never count as leaving.
// The figures beside the chart are the focused month and double as its legend.
const MovementChart = ({ rows, labels, narrowLabels, focusIndex, onPick, thisMonth, fmt }) => {
    const { t, tn } = useI18n();
    const months = rows.map((row) => row.month);
    const series = [
        { key: 'continuing', label: t('Continuing'), color: COLORS.continuing, data: rows.map((row) => row.students_continuing) },
        { key: 'new', label: t('New'), color: COLORS.joined, data: rows.map((row) => row.students_new) },
        { key: 'returning', label: t('Returning'), color: COLORS.returning, data: rows.map((row) => row.students_returning) },
        { key: 'left', label: t('Left'), color: COLORS.left, data: rows.map((row) => -row.students_left) },
    ];
    const datasets = series.map(({ label, color, data }) => {
        const shaded = barColors(color, months, thisMonth);
        return { ...barDataset(label, data, color, { stacked: true }), backgroundColor: shaded, hoverBackgroundColor: shaded };
    });

    const options = reportBarOptions({
        months,
        narrowLabels,
        focusIndex,
        onPick,
        stacked: true,
        legend: false,
        formatTick: (value) => fmt.count(Math.abs(value)),
        formatValue: (value) => fmt.count(Math.abs(value)),
        footer: (items) => {
            const row = rows[items[0]?.dataIndex];
            if (!row) return '';
            return [
                row.retention !== null ? t('Retention {rate}', { rate: fmt.pct(row.retention) }) : null,
                row.class_switches > 0 ? tn(row.class_switches, '{count} class switch', '{count} class switches') : null,
            ].filter(Boolean);
        },
    });

    const focused = rows[focusIndex];
    const subtitle =
        focused?.retention !== null && focused?.retention !== undefined
            ? t('Retention {rate} in {month}', { rate: fmt.pct(focused.retention), month: fmt.monthName(focused.month) })
            : t('Students who stayed, joined, came back or left');

    return (
        <SectionCard className="reportChartCard movementCard" icon={LuUsers} title={t('Student movement')} subtitle={subtitle}>
            <div className="movementLayout">
                <div className="movementSide">
                    {focused && (
                        <dl className="movementFigures" aria-label={t('{month} in people', { month: fmt.monthName(focused.month) })}>
                            <div className="movementFigure isActive" data-figure="active">
                                <dt>{t('Active')}</dt>
                                <dd>{fmt.count(focused.students_active)}</dd>
                            </div>
                            {series.map((item) => (
                                <div className="movementFigure" data-figure={item.key} key={item.key}>
                                    <dt>
                                        <span className="keySwatch" style={{ background: item.color }} aria-hidden="true" />
                                        {item.label}
                                    </dt>
                                    <dd>{fmt.count(Math.abs(item.data[focusIndex]))}</dd>
                                </div>
                            ))}
                            <div className="movementFigure isSwitch" data-figure="switches">
                                <dt>
                                    <LuArrowRightLeft aria-hidden="true" />
                                    {t('Class switches')}
                                </dt>
                                <dd>{fmt.count(focused.class_switches)}</dd>
                            </div>
                        </dl>
                    )}
                    <p className="chartKeyNote">
                        {t('Counted per person: retention = continuing ÷ last month’s active students. A class switch isn’t counted as leaving.')}
                    </p>
                </div>
                <div className="movementPlot">
                    <div className="reportCanvas">
                        <Bar
                            data={{ labels, datasets }}
                            options={options}
                            plugins={PLUGINS}
                            role="img"
                            aria-label={
                                focused
                                    ? t('Students by month. {month}: {continuing} continuing, {joined} new, {returning} returning, {left} left.', {
                                          month: fmt.monthName(focused.month),
                                          continuing: focused.students_continuing,
                                          joined: focused.students_new,
                                          returning: focused.students_returning,
                                          left: focused.students_left,
                                      })
                                    : t('Students by month')
                            }
                        />
                    </div>
                    {months.includes(thisMonth) && <InProgressKey month={fmt.monthName(thisMonth)} />}
                </div>
            </div>
        </SectionCard>
    );
};

export default MovementChart;
