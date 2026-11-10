import { Link } from 'react-router-dom';
import { Button } from '@nextui-org/react';
import { LuArrowRight, LuBanknote, LuEqual, LuInfo, LuPlus, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import CountUp from '../../common/CountUp';
import { MonthNav } from './ExpenseParts';
import CategoryBreakdown from './CategoryBreakdown';
import ClassSplit from './ClassSplit';
import { capitalizeFirst, prevMonth, sameDayLastMonth } from './expensesModel';

const vnd = (value) => formatVnd(value);

// The month against last month. A running month is compared with last month up to the same
// day, so the 9th isn't measured against a whole month.
const Delta = ({ total, base, running, previousMonth }) => {
    const { t, monthName } = useI18n();
    const month = monthName(previousMonth);
    if (!base && !total) return null;
    const diff = total - base;
    const amount = formatVnd(Math.abs(diff));
    const Icon = diff > 0 ? LuTrendingUp : diff < 0 ? LuTrendingDown : LuEqual;
    let text;
    if (diff === 0) text = running ? t('The same as by this day in {month}', { month }) : t('The same as in {month}', { month });
    else if (diff > 0) text = running ? t('{amount} more than by this day in {month}', { amount, month }) : t('{amount} more than in {month}', { amount, month });
    else text = running ? t('{amount} less than by this day in {month}', { amount, month }) : t('{amount} less than in {month}', { amount, month });
    return (
        <span className="exDelta">
            <Icon aria-hidden="true" />
            {text}
        </span>
    );
};

// How the page's numbers reach the monthly report.
const ReportNote = ({ isAdmin }) => {
    const { t } = useI18n();
    return (
        <aside className="exReportNote" aria-labelledby="ex-report-title">
            <span className="exReportIcon" aria-hidden="true">
                <LuInfo />
            </span>
            <p>
                <strong id="ex-report-title">{t('How this feeds the report')}</strong>
                <span>
                    {t('Expenses lower the studio’s profit (revenue − payroll − expenses). A cost tied to a class also lowers that class’s margin; shared costs stay at studio level.')}
                </span>
                {!isAdmin && <span>{t('Admins see your costs in the monthly report.')}</span>}
            </p>
            {isAdmin && (
                <Link to="/admin/reports" className="exReportLink">
                    <span>{t('Open reports')}</span>
                    <LuArrowRight aria-hidden="true" />
                </Link>
            )}
        </aside>
    );
};

// Header card: the month (switcher), its total against last month, the split between
// class-tied and shared costs and where the money went by category.
const ExpenseOverview = ({ month, thisMonth, today, maxMonth, summary, loading, isAdmin, classImages, filters, onPickMonth, onFilter, onAdd }) => {
    const { t, tn, monthName, formatDate } = useI18n();
    const previousMonth = month ? prevMonth(month) : null;
    const running = Boolean(month) && month === thisMonth;
    const cutoff = running && today ? sameDayLastMonth(today) : null;
    const base = running ? summary.previousToDate ?? 0 : summary.previousTotal;
    const name = month ? monthName(month) : '';
    const prevName = previousMonth ? capitalizeFirst(monthName(previousMonth)) : '';

    return (
        <SectionCard
            className="exOverview"
            icon={LuBanknote}
            title={isAdmin ? t('Expenses') : t('Your costs')}
            subtitle={
                isAdmin
                    ? t('Every cost that isn’t payroll: rent, the monthly shoot, costumes, repairs…')
                    : t('The petty costs you paid for the studio. Only you and the admins see them.')
            }
            actions={
                <>
                    <MonthNav month={month} thisMonth={thisMonth} maxMonth={maxMonth} onPick={onPickMonth} />
                    {month && month !== thisMonth && (
                        <Button variant="light" onPress={() => onPickMonth(thisMonth)}>
                            {t('Back to this month')}
                        </Button>
                    )}
                    <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={onAdd} isDisabled={!month}>
                        {t('Add expense')}
                    </Button>
                </>
            }
        >
            <div className={`exKpis${loading ? ' isLoading' : ''}`}>
                <div className="exKpi isHero">
                    <span>{isAdmin ? t('Spent in {month}', { month: name }) : t('Your costs in {month}', { month: name })}</span>
                    <strong>
                        <CountUp key={month} value={summary.total} format={vnd} />
                    </strong>
                    <small>{tn(summary.count, '{count} cost', '{count} costs')}</small>
                    {previousMonth && <Delta total={summary.total} base={base} running={running} previousMonth={previousMonth} />}
                </div>
                <div className="exKpi">
                    <span>{prevName}</span>
                    <strong>{vnd(summary.previousTotal)}</strong>
                    <small>
                        {cutoff
                            ? t('{amount} by {date}', { amount: vnd(summary.previousToDate), date: formatDate(cutoff, 'dayMonth') })
                            : t('The whole month')}
                    </small>
                </div>
                <div className={`exKpi${summary.tied ? ' isTied' : ''}`}>
                    <span>{t('Tied to classes')}</span>
                    <strong>{vnd(summary.tied)}</strong>
                    <small>
                        {summary.classes.length
                            ? tn(summary.classes.length, '{count} class · lowers its margin', '{count} classes · lowers their margins')
                            : t('Nothing tied to a class')}
                    </small>
                </div>
                <div className="exKpi">
                    <span>{t('Shared costs')}</span>
                    <strong>{vnd(summary.shared)}</strong>
                    <small>{t('Rent, utilities… for the whole studio')}</small>
                </div>
            </div>

            <div className="exInsight">
                <CategoryBreakdown
                    month={month}
                    previousMonth={previousMonth}
                    categories={summary.categories}
                    total={summary.total}
                    active={filters.category}
                    onPick={(category) => onFilter({ category })}
                />
                <div className="exSide">
                    <ClassSplit
                        total={summary.total}
                        tied={summary.tied}
                        shared={summary.shared}
                        classes={summary.classes}
                        classImages={classImages}
                        active={filters.classKey}
                        onPick={(classKey) => onFilter({ classKey })}
                    />
                    <ReportNote isAdmin={isAdmin} />
                </div>
            </div>
        </SectionCard>
    );
};

export default ExpenseOverview;
