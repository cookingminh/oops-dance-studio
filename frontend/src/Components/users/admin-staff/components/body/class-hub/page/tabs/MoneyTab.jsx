import { useState } from 'react';
import { Button, Input } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight, LuCoins, LuPiggyBank, LuPlus, LuReceipt } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getFinanceByClass } from '@/services/finance';
import { getClassRates, getDefaultSessionRate, setClassRate } from '@/services/payroll';
import { attachReceipt, createExpense, listExpenses } from '@/services/expenses';
import { categoryOf, expenseTitle, isAutomaticRent } from '@/lib/expenseCategories';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../../common/SectionCard';
import ExpenseDialog from '../../../expenses/ExpenseDialog';
import { AutoRentBadge } from '../../../expenses/ExpenseParts';
import { monthOf, nextMonth, prevMonth } from '../../hubModel';
import MoneyChart from './MoneyChart';
import '../../../expenses/expenses.scss';

const KEYS = ['collected', 'instructor_pay', 'direct_costs', 'margin', 'sessions'];

// The last six months and this one for the class, from the finance report (admin only).
async function loadMonths(classId, thisMonth) {
    const months = [thisMonth];
    for (let i = 0; i < 6; i += 1) months.unshift(prevMonth(months[0]));
    const reports = await Promise.all(months.map((month) => getFinanceByClass(month).catch(() => [])));
    return months.map((month, index) => {
        const row = reports[index].find((item) => item.class_id === classId);
        return { month, ...Object.fromEntries(KEYS.map((key) => [key, Number(row?.[key] ?? 0)])) };
    });
}

// Money (admin): what the class brought in and cost (instructor pay = sessions × its rate, costs
// tied to it), its pay rate per session, and the costs recorded for it.
const MoneyTab = ({ ctx }) => {
    const { cls, today, version, changed } = ctx;
    const { t, monthName, formatDate } = useI18n();
    const toast = useToast();
    const thisMonth = monthOf(today);
    const [local, setLocal] = useState(0);
    const months = useAsync(() => loadMonths(cls.id, thisMonth), [cls.id, thisMonth, version, local]);
    const rates = useAsync(async () => {
        const [classRates, fallback] = await Promise.all([getClassRates(), getDefaultSessionRate()]);
        return { own: classRates[cls.id] ?? null, fallback };
    }, [cls.id, local]);
    const [month, setMonth] = useState(thisMonth);
    const costs = useAsync(() => listExpenses(month, { classId: cls.id }), [cls.id, month, version, local]);
    const [rateDraft, setRateDraft] = useState(null);
    const [savingRate, setSavingRate] = useState(false);
    const [adding, setAdding] = useState(false);

    // Months before the class started stay out of the chart.
    const rows = (months.data ?? []).filter((row) => row.month >= monthOf(cls.starts_on));
    const total = rows.reduce((sum, row) => sum + row.margin, 0);
    const rateText = rateDraft ?? (rates.data?.own === null || rates.data?.own === undefined ? '' : String(rates.data.own));
    const rateValue = rateText.trim() === '' ? null : Number(rateText);
    const rateValid = rateValue === null || (Number.isInteger(rateValue) && rateValue >= 0);
    const rateChanged = rates.data && rateValue !== rates.data.own;

    const saveRate = async (value) => {
        setSavingRate(true);
        try {
            await setClassRate(cls.id, value);
            toast.success(value === null ? t('{name} uses the default rate again.', { name: cls.name }) : t('Pay rate saved: {amount} per session.', { amount: formatVnd(value) }));
            setRateDraft(null);
            setLocal((value_) => value_ + 1);
        } catch (error) {
            toast.error(error);
        } finally {
            setSavingRate(false);
        }
    };

    const saveCost = async (fields, receipt) => {
        try {
            let row = await createExpense(fields);
            if (receipt.file) row = await attachReceipt(row, receipt.file);
            toast.success(t('{amount} added.', { amount: formatVnd(row.amount) }));
            setAdding(false);
            if (row.month !== month) setMonth(row.month);
            setLocal((value) => value + 1);
            changed();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        }
    };

    const monthCosts = (costs.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

    return (
        <>
            <SectionCard
                icon={LuPiggyBank}
                title={t('Money')}
                subtitle={months.data ? t('Margin over these months: {amount}', { amount: formatVnd(total) }) : t('Loading…')}
            >
                <AsyncState state={months} isEmpty={false}>
                    <MoneyChart rows={rows} thisMonth={thisMonth} />
                    <div className="hubTableScroll">
                        <table className="hubMoneyTable">
                            <caption className="sr-only">{t('Money in and out of this class over the last months')}</caption>
                            <thead>
                                <tr>
                                    <th scope="col">{t('Month')}</th>
                                    <th scope="col">{t('Collected')}</th>
                                    <th scope="col">{t('Sessions')}</th>
                                    <th scope="col">{t('Instructor pay')}</th>
                                    <th scope="col">{t('Class costs')}</th>
                                    <th scope="col">{t('Margin')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...rows].reverse().map((row) => (
                                    <tr key={row.month} className={row.month === thisMonth ? 'isRunning' : ''}>
                                        <th scope="row">
                                            {monthName(row.month, { withYear: true })}
                                            {row.month === thisMonth && <small> · {t('so far')}</small>}
                                        </th>
                                        <td>{formatVnd(row.collected)}</td>
                                        <td>{row.sessions}</td>
                                        <td>{formatVnd(row.instructor_pay)}</td>
                                        <td>{formatVnd(row.direct_costs)}</td>
                                        <td className={row.margin < 0 ? 'isLoss' : ''}>{formatVnd(row.margin)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="hubFootnote">{t('Margin = tuition collected − instructor pay − costs tied to this class. Shared costs (rent, utilities…) are not split per class.')}</p>
                </AsyncState>
            </SectionCard>

            <div className="hubDuo">
                <SectionCard icon={LuCoins} title={t('Instructor pay rate')} subtitle={t('What one taught session of this class pays')}>
                    <AsyncState state={rates} isEmpty={false}>
                        <div className="hubRate">
                            <Input
                                type="number"
                                min={0}
                                step={10000}
                                label={t('Per session (VND)')}
                                placeholder={String(rates.data?.fallback ?? '')}
                                value={rateText}
                                onValueChange={setRateDraft}
                                isInvalid={!rateValid}
                                errorMessage={rateValid ? undefined : t('Enter a whole amount of 0 or more.')}
                                description={
                                    rateValue === null
                                        ? t('Uses the default rate: {amount}.', { amount: formatVnd(rates.data?.fallback) })
                                        : t('The default rate is {amount}.', { amount: formatVnd(rates.data?.fallback) })
                                }
                            />
                            <div className="hubRateActions">
                                {rates.data?.own !== null && rates.data?.own !== undefined && (
                                    <Button variant="light" isDisabled={savingRate} onPress={() => saveRate(null)}>
                                        {t('Use the default')}
                                    </Button>
                                )}
                                <Button color="danger" isLoading={savingRate} isDisabled={!rateChanged || !rateValid} onPress={() => saveRate(rateValue)}>
                                    {t('Save rate')}
                                </Button>
                            </div>
                            <p className="hubFootnote">{t('Applies to months whose payslips aren’t finalized yet.')}</p>
                        </div>
                    </AsyncState>
                </SectionCard>

                <SectionCard
                    icon={LuReceipt}
                    title={t('Class costs')}
                    subtitle={costs.data ? t('{month}: {amount}', { month: monthName(month, { withYear: true }), amount: formatVnd(monthCosts) }) : t('Loading…')}
                    actions={
                        <>
                            <div className="dayNav hubMonthNav" role="group" aria-label={t('Choose a month')}>
                                <button type="button" aria-label={t('Previous month')} onClick={() => setMonth(prevMonth(month))}>
                                    <LuChevronLeft />
                                </button>
                                <span className="hubMonthLabel">{monthName(month)}</span>
                                <button type="button" aria-label={t('Next month')} disabled={month >= thisMonth} onClick={() => setMonth(nextMonth(month))}>
                                    <LuChevronRight />
                                </button>
                            </div>
                            <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} onPress={() => setAdding(true)}>
                                {t('Add a class cost')}
                            </Button>
                        </>
                    }
                >
                    <AsyncState state={costs} emptyText="No costs recorded for this class this month.">
                        <ul className="hubCosts">
                            {(costs.data ?? []).map((row) => (
                                <li key={row.id}>
                                    <span className="hubCostWhen">{formatDate(row.spent_on, 'dayMonth')}</span>
                                    <span className="hubCostWhat">
                                        <strong>{expenseTitle(row, t)}</strong>
                                        <small>
                                            {t(categoryOf(row.category).label)}
                                            {row.vendor ? ` · ${row.vendor}` : ''}
                                            {isAutomaticRent(row) && <AutoRentBadge />}
                                        </small>
                                    </span>
                                    <span className="hubMoney">{formatVnd(row.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    </AsyncState>
                </SectionCard>
            </div>

            {adding && (
                <ExpenseDialog
                    expense={null}
                    today={today}
                    classes={[{ id: cls.id, name: cls.name, image_path: cls.image_path }]}
                    receiptUrl={null}
                    onView={() => {}}
                    preset={{ classId: cls.id }}
                    onClose={() => setAdding(false)}
                    onSave={saveCost}
                />
            )}
        </>
    );
};

export default MoneyTab;
