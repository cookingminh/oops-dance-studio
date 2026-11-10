import { motion } from 'framer-motion';
import { categoryOf } from '@/lib/expenseCategories';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { SERIES } from '../../common/chartTheme';
import { EASE_OUT } from '../../common/motion';
import { CategoryIcon } from './ExpenseParts';
import { capitalizeFirst, compactVnd } from './expensesModel';

const BAR = SERIES[0];

// Where the month's money went: ranked thin bars, largest first, one hue. A tick on each track
// marks last month's amount on the same scale. Every value is printed beside its bar, so the
// tick's number (in the title / accessible name) is a nicety, not the only way to read it.
const CategoryBreakdown = ({ month, previousMonth, categories, total, active, onPick }) => {
    const { t, tn, monthName, formatDate, intl } = useI18n();
    // Until the studio's month is known (first load) the legend waits.
    const prevShort = previousMonth ? formatDate(previousMonth, 'monthShort') : '';
    const max = Math.max(1, ...categories.map((entry) => Math.max(entry.amount, entry.previous)));
    const prevName = previousMonth ? capitalizeFirst(monthName(previousMonth)) : '';

    return (
        <section className="exPanel exBreakdown" aria-labelledby="ex-breakdown-title">
            <header className="exPanelHead">
                <h3 id="ex-breakdown-title">{t('By category')}</h3>
                {month && (
                    <span className="exLegend" aria-hidden="true">
                        <span>
                            <i className="exKeyBar" style={{ background: BAR }} />
                            {capitalizeFirst(monthName(month))}
                        </span>
                        <span>
                            <i className="exKeyTick" />
                            {prevName}
                        </span>
                    </span>
                )}
            </header>
            {categories.length === 0 ? (
                <p className="exPanelEmpty">{t('No costs recorded this month yet.')}</p>
            ) : (
                <ul className="exBars">
                    {categories.map((entry, index) => {
                        const info = categoryOf(entry.key);
                        const share = total ? Math.round((entry.amount / total) * 100) : 0;
                        const label = t(info.label);
                        const accessible = t('{category}: {amount} ({share}%), {month}: {previous}. Show only these costs.', {
                            category: label,
                            amount: formatVnd(entry.amount),
                            share,
                            month: prevName,
                            previous: formatVnd(entry.previous),
                        });
                        return (
                            <li key={entry.key}>
                                <button
                                    type="button"
                                    className={`exBarRow${active === entry.key ? ' isActive' : ''}`}
                                    aria-label={accessible}
                                    aria-pressed={active === entry.key}
                                    disabled={entry.items === 0}
                                    onClick={() => onPick(active === entry.key ? 'all' : entry.key)}
                                >
                                    <CategoryIcon category={entry.key} size="sm" />
                                    <span className="exBarLabel">
                                        <strong>{label}</strong>
                                        <small>
                                            {entry.items ? tn(entry.items, '{count} cost', '{count} costs') : t('None this month')}
                                            {' · '}
                                            {t('{month}: {amount}', { month: prevShort, amount: entry.previous ? compactVnd(entry.previous, intl) : '0' })}
                                        </small>
                                    </span>
                                    <span className="exBarTrack" title={`${prevName}: ${formatVnd(entry.previous)}`}>
                                        <motion.span
                                            className="exBarFill"
                                            style={{ background: BAR }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(entry.amount / max) * 100}%` }}
                                            transition={{ duration: 0.6, delay: index * 0.04, ease: EASE_OUT }}
                                        />
                                        {entry.previous > 0 && <span className="exBarTick" style={{ left: `${(entry.previous / max) * 100}%` }} />}
                                    </span>
                                    <span className="exBarValue">
                                        <strong>{formatVnd(entry.amount)}</strong>
                                        <small>{entry.amount ? `${share}%` : '—'}</small>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default CategoryBreakdown;
