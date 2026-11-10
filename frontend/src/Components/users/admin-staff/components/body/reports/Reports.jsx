import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { Chart as ChartJS } from 'chart.js';
import { LuCalendarRange, LuChevronLeft, LuChevronRight, LuPrinter } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getFinanceByClass, getFinanceExpenses, getFinanceMonthly } from '@/services/finance';
import { countOpenInvoices } from '@/services/financeExtra';
import { getPayrollMonth } from '@/services/payroll';
import { getStudioToday } from '@/services/studio';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { stagger } from '../../common/motion';
import {
    PERIODS,
    costGroups,
    defaultFocus,
    hasActivity,
    indexExpenses,
    indexMonths,
    monthOfDay,
    monthProgress,
    payrollParts,
    shiftMonth,
    windowMonths,
} from './reportModel';
import { useReportFormat } from './reportFormat';
import { buildInsights } from './buildInsights';
import KpiTiles from './KpiTiles';
import Insights from './Insights';
import PaymentSplit from './PaymentSplit';
import ProfitLedger from './ProfitLedger';
import RevenueChart from './RevenueChart';
import CostsChart from './CostsChart';
import ProfitChart from './ProfitChart';
import MovementChart from './MovementChart';
import ClassTable from './ClassTable';
import MonthlyTable from './MonthlyTable';
import './reports.scss';

// Twelve months, the one before them (so the first has a comparison) and next month (its
// renewal opens early), with their expenses by category: switching 6 ↔ 12 months needs no reload.
async function loadMonths(thisMonth) {
    if (!thisMonth) return undefined;
    const [from, to] = [shiftMonth(thisMonth, -12), shiftMonth(thisMonth, 1)];
    const [rows, expenses] = await Promise.all([getFinanceMonthly(from, to), getFinanceExpenses(from, to)]);
    return { rows, expenses };
}

// Charts are drawn on canvases: redraw them at the paper's width when printing.
function useChartsFitPrint() {
    useEffect(() => {
        const resize = () => Object.values(ChartJS.instances).forEach((chart) => chart.resize());
        window.addEventListener('beforeprint', resize);
        window.addEventListener('afterprint', resize);
        return () => {
            window.removeEventListener('beforeprint', resize);
            window.removeEventListener('afterprint', resize);
        };
    }, []);
}

// /admin/reports (admin): the month-end report. Pick a month (default: the last full one) and
// a period; the tiles compare the month with the one before, the charts show the period.
const Reports = () => {
    const { t, tn } = useI18n();
    const fmt = useReportFormat();
    const today = useAsync(getStudioToday, []);
    const thisMonth = today.data ? monthOfDay(today.data) : null;
    const monthly = useAsync(() => loadMonths(thisMonth), [thisMonth]);
    const [period, setPeriod] = useState(PERIODS[0]);
    const [picked, setPicked] = useState(null);
    useChartsFitPrint();

    const index = useMemo(() => (monthly.data && thisMonth ? indexMonths(monthly.data.rows, thisMonth) : null), [monthly.data, thisMonth]);
    // Expenses by month, and which categories get their own colour (stable for the page).
    const expenses = useMemo(() => indexExpenses(monthly.data?.expenses), [monthly.data]);
    const groups = useMemo(() => costGroups(monthly.data?.expenses), [monthly.data]);
    const months = useMemo(() => (index ? windowMonths(period, thisMonth, index.recordsStart) : []), [index, period, thisMonth]);
    const focus = months.includes(picked) ? picked : defaultFocus(months, thisMonth);

    const classes = useAsync(() => (focus ? getFinanceByClass(focus) : Promise.resolve(undefined)), [focus]);
    const openCount = useAsync(() => (focus ? countOpenInvoices(focus) : Promise.resolve(undefined)), [focus]);
    const payroll = useAsync(() => (focus ? getPayrollMonth(focus) : Promise.resolve(undefined)), [focus]);

    // While another month loads, its sentences wait rather than mix in the old month's numbers.
    const readyClasses = classes.loading ? [] : classes.data ?? [];
    const readyOpen = openCount.loading ? undefined : openCount.data;
    const rows = months.map((month) => index.byMonth.get(month));
    const cur = focus ? index?.byMonth.get(focus) : null;
    const prev = focus ? index?.byMonth.get(shiftMonth(focus, -1)) : null;
    const curExpenses = focus ? expenses.get(focus) ?? [] : [];
    const prevExpenses = prev ? expenses.get(prev.month) ?? [] : [];
    const parts = cur && !payroll.loading ? payrollParts(payroll.data, cur.payroll_cost) : null;
    const focusIndex = months.indexOf(focus);
    const soFar = (month, label) => (month === thisMonth ? [label, t('so far')] : label);
    const labels = months.map((month, i) => soFar(month, fmt.axisMonth(month, i)));
    const narrowLabels = months.map((month) => soFar(month, fmt.axisMonthNarrow(month)));
    const insights = cur
        ? buildInsights({ cur, prev, classes: readyClasses, openCount: readyOpen, next: index.next, expenses: curExpenses, prevExpenses, t, tn, fmt })
        : [];

    const progress = today.data ? monthProgress(today.data) : null;
    // The month itself is in the month switcher; on paper (no switcher) the subtitle names it.
    const subtitle = !cur ? (
        t('Revenue, costs and profit by month')
    ) : (
        <>
            <span className="printOnly">{fmt.heading(focus)} · </span>
            {cur.inProgress
                ? t('Day {day} of {days}, numbers so far', progress)
                : hasActivity(prev)
                  ? t('Compared with {month}', { month: fmt.monthName(prev.month) })
                  : t('The first month with records')}
        </>
    );
    const pageState = {
        data: monthly.data,
        error: today.error ?? monthly.error,
        loading: today.loading || monthly.loading || !thisMonth,
        reload: today.error ? today.reload : monthly.reload,
    };
    const windowStart = thisMonth ? shiftMonth(thisMonth, 1 - period) : null;
    // Revenue and costs share one scale, so the two charts compare bar for bar.
    const moneyMax = Math.max(0, ...rows.map((row) => Math.max(row.revenue, row.costs_total)));
    const chartProps = { rows, labels, narrowLabels, focusIndex, onPick: setPicked, thisMonth, fmt };

    const monthNav = (
        <div className="reportMonthNav" role="group" aria-label={t('Month')}>
            <button type="button" aria-label={t('Previous month')} disabled={!focus || focusIndex <= 0} onClick={() => setPicked(months[focusIndex - 1])}>
                <LuChevronLeft />
            </button>
            <span className="reportMonthName" aria-live="polite">
                {focus ? fmt.heading(focus) : '…'}
            </span>
            <button type="button" aria-label={t('Next month')} disabled={!focus || focusIndex >= months.length - 1} onClick={() => setPicked(months[focusIndex + 1])}>
                <LuChevronRight />
            </button>
        </div>
    );

    return (
        <motion.div className="reportsPage" variants={stagger}>
            <SectionCard
                className="reportHeadCard"
                icon={LuCalendarRange}
                title={
                    <>
                        {t('Finance report')}
                        {cur && <span className={`monthState${cur.inProgress ? ' isLive' : ''}`}>{cur.inProgress ? t('In progress') : t('Full month')}</span>}
                    </>
                }
                subtitle={subtitle}
                actions={
                    <div className="reportControls noPrint">
                        {monthNav}
                        <Segmented label={t('Period')} options={PERIODS.map((count) => ({ key: count, label: t('{count} months', { count }) }))} value={period} onChange={setPeriod} />
                        <Button variant="flat" isIconOnly aria-label={t('Print the report')} title={t('Print the report')} onPress={() => window.print()}>
                            <LuPrinter aria-hidden="true" />
                        </Button>
                    </div>
                }
            >
                <AsyncState state={pageState} isEmpty={Boolean(index) && months.length === 0} emptyText={t('No tuition or room bookings recorded yet.')}>
                    {cur && <KpiTiles cur={cur} prev={prev} openCount={readyOpen} fmt={fmt} />}
                    {index?.recordsStart && windowStart < index.recordsStart && (
                        <p className="recordsNote">{t('Records start in {month}: earlier months have no tuition or room bookings, so the charts begin there.', { month: fmt.monthYear(index.recordsStart) })}</p>
                    )}
                </AsyncState>
            </SectionCard>

            {cur && (
                <div className="reportsGrid">
                    <ProfitLedger cur={cur} expenses={curExpenses} groups={groups} payroll={parts} fmt={fmt} />
                    <Insights items={insights} monthLabel={fmt.heading(focus)} inProgress={cur.inProgress} hasOpen={cur.tuition_outstanding > 0} />
                    <RevenueChart {...chartProps} scaleMax={moneyMax} />
                    <CostsChart {...chartProps} scaleMax={moneyMax} expenses={expenses} groups={groups} />
                    <ProfitChart {...chartProps} />
                    <PaymentSplit rows={rows} focusMonth={focus} onPick={setPicked} fmt={fmt} />
                    <MovementChart {...chartProps} />
                    <ClassTable state={classes} month={focus} inProgress={cur.inProgress} fmt={fmt} />
                    <MonthlyTable rows={rows} expenses={expenses} focusMonth={focus} onPick={setPicked} fmt={fmt} />
                </div>
            )}
        </motion.div>
    );
};

export default Reports;
