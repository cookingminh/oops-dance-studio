import { Input } from '@nextui-org/react';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../../common/Segmented';
import { capitalized } from '../../bookingsModel';
import { RUNS } from './seriesPlan';

const WEEK = [1, 2, 3, 4, 5, 6, 7];

// The repeat of a regular rental (useSeriesPlan): the weekdays, how long it runs (4 / 8 / 12 weeks or up to a day),
// a discount for the whole series with its reason, and what each month comes to — one QR code per month.
const RepeatFields = ({ series, date }) => {
    const { t, tn, dayName, monthName } = useI18n();
    const { discount } = series;
    return (
        <div className="rfBox">
            <div className="bfField">
                <span className="bfLabel">{t('Repeat on')}</span>
                <div className="rfWeekdays" role="group" aria-label={t('Weekdays')}>
                    {WEEK.map((day) => (
                        <button key={day} type="button" aria-pressed={series.weekdays.includes(day)} onClick={() => series.toggleDay(day)}>
                            {dayName(day, 'short')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bfField">
                <span className="bfLabel">{t('Runs for')}</span>
                <div className="rfRun">
                    <div className="bfChips" role="group" aria-label={t('How long it runs')}>
                        {RUNS.map((weeks) => (
                            <button key={weeks} type="button" disabled={!date} aria-pressed={series.weeks === weeks} onClick={() => series.setWeeks(weeks)}>
                                {t('{count} weeks', { count: weeks })}
                            </button>
                        ))}
                    </div>
                    <Input type="date" label={t('Until')} value={series.until} min={date || undefined} onValueChange={series.setUntil} className="rfUntil" />
                </div>
            </div>

            <div className="bfField">
                <span className="bfLabel">{t('Discount for the series')}</span>
                <Segmented
                    label={t('Discount for the series')}
                    options={[
                        { key: 'none', label: t('None') },
                        { key: 'percent', label: '%' },
                        { key: 'amount', label: t('VND off each session') },
                    ]}
                    value={discount.kind}
                    onChange={(kind) => series.setDiscount({ kind })}
                />
            </div>
            {discount.kind !== 'none' && (
                <div className="rfDiscount">
                    <Input
                        type="number"
                        size="sm"
                        label={discount.kind === 'percent' ? t('Percent off') : t('Amount off each session (VND)')}
                        value={discount.value}
                        onValueChange={(value) => series.setDiscount({ value })}
                        min={0}
                        step={discount.kind === 'percent' ? 1 : 1000}
                    />
                    <Input size="sm" label={t('Reason')} value={discount.note} onValueChange={(note) => series.setDiscount({ note })} maxLength={300} isRequired />
                    {series.discountProblem && <p className="bfError">{series.discountProblem}</p>}
                </div>
            )}

            {series.months.size > 0 && (
                <div className="rfMonths">
                    <span className="bfLabel">{t('Paid by month')}</span>
                    <ul>
                        {[...series.months.entries()].map(([key, row]) => (
                            <li key={key}>
                                <strong>{capitalized(monthName(`${key}-01`, { withYear: true }))}</strong>
                                <span>{tn(row.sessions, '{count} session', '{count} sessions')}</span>
                                <span className="rfMoney">
                                    {row.total !== row.list && <s>{formatVnd(row.list)}</s>} {formatVnd(row.total)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="bfMuted">{t('Each month gets its own QR code to send the renter once the series is booked.')}</p>
                </div>
            )}
        </div>
    );
};

export default RepeatFields;
