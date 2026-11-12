import { categoryOf, expenseTitle, isAutomaticRent } from '@/lib/expenseCategories';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AutoRentBadge } from '../../../expenses/ExpenseParts';
import { monthEntries } from './moneyDays';

// The month as a list, newest day first: tuition received (green) and costs (red). A row opens its day.
const MoneyList = ({ days, onOpen }) => {
    const { t, formatDate } = useI18n();
    const entries = monthEntries(days);
    if (!entries.length) return <p className="mcEmpty isCentered">{t('Nothing came in or went out this month.')}</p>;

    return (
        <ul className="mcList">
            {entries.map((entry) => (
                <li key={entry.key}>
                    <button type="button" className="mcListRow" onClick={() => onOpen(entry.date)}>
                        <span className="mcListWhen">{formatDate(entry.date, 'dayMonth')}</span>
                        {entry.kind === 'in' ? (
                            <>
                                <span className="mcCostMain">
                                    <strong>{entry.payment.student_name || t('A former student')}</strong>
                                    <small>{[t('Tuition'), entry.payment.lesson_title].filter(Boolean).join(' · ')}</small>
                                </span>
                                <span className="mcMoney isIn">+{formatVnd(entry.payment.paid_amount)}</span>
                            </>
                        ) : (
                            <>
                                <span className="mcCostMain">
                                    <strong>{expenseTitle(entry.cost, t)}</strong>
                                    <small>
                                        {t(categoryOf(entry.cost.category).label)}
                                        {entry.cost.vendor ? ` · ${entry.cost.vendor}` : ''}
                                        {isAutomaticRent(entry.cost) && <AutoRentBadge />}
                                    </small>
                                </span>
                                <span className="mcMoney isOut">−{formatVnd(entry.cost.amount)}</span>
                            </>
                        )}
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default MoneyList;
