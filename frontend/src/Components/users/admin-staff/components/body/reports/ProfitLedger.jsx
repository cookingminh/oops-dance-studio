import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowUpRight, LuCalculator } from 'react-icons/lu';
import { categoryOf } from '@/lib/expenseCategories';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { COLORS, groupColor } from './reportChart';
import { groupOf } from './reportModel';

// The month's lines, top to bottom, each with where the running total starts and ends
// (a horizontal waterfall). kind: 'step' (adds or takes away), 'total', 'group' (a heading
// for the expense lines), 'none' (no expenses).
function ledgerLines({ cur, expenses, groups, payroll, t }) {
    const lines = [];
    let run = 0;
    const step = (line) => {
        lines.push({ kind: 'step', ...line, from: run, to: run + line.amount });
        run += line.amount;
    };
    step({ key: 'tuition', label: t('Tuition collected'), amount: cur.tuition_collected, color: COLORS.tuition });
    step({ key: 'rooms', label: t('Room bookings'), amount: cur.bookings_revenue, color: COLORS.bookings, plus: true });
    lines.push({ kind: 'total', key: 'revenue', label: t('Revenue'), amount: cur.revenue, from: 0, to: cur.revenue });

    const details = payroll
        ? [
              [t('Instructor sessions'), payroll.sessions],
              [t('Staff salaries'), payroll.salaries],
              [t('Bonuses / deductions'), payroll.adjustments],
          ].filter(([, amount]) => amount !== 0)
        : [];
    step({ key: 'payroll', label: t('Payroll cost'), amount: -cur.payroll_cost, color: COLORS.payroll, href: '/admin/payroll', details });

    lines.push({ kind: 'group', key: 'expenses', label: t('Expenses'), amount: -cur.expenses_total, href: '/admin/expenses' });
    if (expenses.length === 0) lines.push({ kind: 'none', key: 'no-expenses', label: t('No expenses recorded') });
    for (const row of expenses) {
        step({
            key: `cat-${row.category}`,
            label: t(categoryOf(row.category).label),
            amount: -row.amount,
            color: groupColor(groupOf(row.category, groups), groups),
            indent: true,
        });
    }
    lines.push({ kind: 'total', key: 'profit', label: cur.profit < 0 ? t('Loss') : t('Profit'), amount: cur.profit, from: 0, to: cur.profit, isLoss: cur.profit < 0 });
    return lines;
}

// A floating bar on the shared scale [lo, hi].
const Bar = ({ line, lo, span }) => {
    const start = Math.min(line.from, line.to);
    const width = Math.abs(line.to - line.from);
    return (
        <span className="ledgerTrack" aria-hidden="true">
            {width > 0 && (
                <span
                    className={`ledgerBar${line.kind === 'total' ? ' isTotal' : ''}`}
                    style={{ left: `${((start - lo) / span) * 100}%`, width: `${(width / span) * 100}%`, background: line.kind === 'total' ? COLORS.total : line.color }}
                />
            )}
        </span>
    );
};

// "How we got to this profit": revenue, minus payroll, minus each expense category, equals profit,
// as a ledger with a small waterfall beside it. Colours match the revenue and costs charts.
const ProfitLedger = ({ cur, expenses, groups, payroll, fmt }) => {
    const { t } = useI18n();
    const lines = ledgerLines({ cur, expenses, groups, payroll, t });

    // One scale for every bar, wide enough for the highest running total and for a loss below zero.
    const ends = lines.filter((line) => line.from !== undefined).flatMap((line) => [line.from, line.to]);
    const lo = Math.min(0, ...ends);
    const hi = Math.max(0, ...ends);
    const span = hi - lo || 1;
    const zeroAt = ((0 - lo) / span) * 100;

    const amountText = (line) => {
        if (line.kind === 'none') return '';
        if (line.plus && line.amount > 0) return `+${fmt.money(line.amount)}`;
        return fmt.money(line.amount);
    };
    const month = fmt.monthName(cur.month);

    return (
        <SectionCard
            className="ledgerCard"
            icon={LuCalculator}
            title={t('How we got to this profit')}
            subtitle={cur.inProgress ? t('What came in and went out in {month} so far', { month }) : t('What came in and went out in {month}', { month })}
        >
            <motion.ol
                className={`ledger${lo < 0 ? ' hasLoss' : ''}`}
                variants={stagger}
                initial="hidden"
                animate="show"
                key={cur.month}
                style={{ '--ledger-zero': `${zeroAt}%` }}
            >
                {lines.map((line) => (
                    <motion.li
                        variants={fadeUp}
                        key={line.key}
                        className={`ledgerLine is-${line.kind}${line.indent ? ' isIndented' : ''}${line.isLoss ? ' isLoss' : ''}`}
                        data-line={line.key}
                    >
                        <span className="ledgerLabel">
                            {line.color && line.kind === 'step' && <span className="keySwatch" style={{ background: line.color }} aria-hidden="true" />}
                            {line.href ? (
                                <Link to={line.href} className="ledgerLink">
                                    {line.label}
                                    <LuArrowUpRight aria-hidden="true" />
                                </Link>
                            ) : (
                                line.label
                            )}
                        </span>
                        <span className="ledgerAmount">{amountText(line)}</span>
                        {line.from !== undefined ? <Bar line={line} lo={lo} span={span} /> : <span className="ledgerTrack isEmpty" aria-hidden="true" />}
                        {line.details?.length > 0 && (
                            <ul className="ledgerDetails">
                                {line.details.map(([label, amount]) => (
                                    <li key={label}>
                                        <span>{label}</span>
                                        <span>{fmt.money(amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </motion.li>
                ))}
            </motion.ol>
            <p className="ledgerNote">
                {t('Tuition counts in the month it’s for, once paid (unpaid or waived tuition isn’t counted); room bookings by their date; payroll by its month; expenses by the day they were spent.')}
            </p>
        </SectionCard>
    );
};

export default ProfitLedger;
