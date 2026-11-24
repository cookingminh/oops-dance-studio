import { Input, Select, SelectItem } from '@nextui-org/react';
import { TIME_OPTIONS, formatVnd, toMinutes } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../../common/Segmented';
import { capitalized, listPriceFor } from '../../bookingsModel';
import { RUNS } from './seriesPlan';

const WEEK = [1, 2, 3, 4, 5, 6, 7];
const POPOVER = { popoverContent: 'adminPortal' };

// One weekday's times when each weekday has its own: start, end, and what a session comes to in the room.
const WeekdayTimes = ({ weekday, times, first, room, onChange }) => {
    const { t, tn, dayName } = useI18n();
    const name = dayName(weekday, 'long');
    const invalid = times.start && times.end && toMinutes(times.end) <= toMinutes(times.start);
    const minutes = times.start && times.end && !invalid ? toMinutes(times.end) - toMinutes(times.start) : null;
    const price = invalid ? null : listPriceFor(room, times.start, times.end);
    return (
        <li className={invalid ? 'isInvalid' : ''} data-weekday={weekday}>
            <span className="rfTimesDay">
                <strong>{name}</strong>
                {first && <small>{t('the first day')}</small>}
            </span>
            <Select
                size="sm"
                aria-label={t('{day} starts', { day: name })}
                classNames={POPOVER}
                selectedKeys={times.start ? [times.start] : []}
                onChange={(event) => event.target.value && onChange({ start: event.target.value })}
                className="rfTimesStart"
            >
                {TIME_OPTIONS.slice(0, -1).map((time) => (
                    <SelectItem key={time}>{time}</SelectItem>
                ))}
            </Select>
            <span aria-hidden="true">–</span>
            <Select
                size="sm"
                aria-label={t('{day} ends', { day: name })}
                classNames={POPOVER}
                selectedKeys={times.end ? [times.end] : []}
                onChange={(event) => event.target.value && onChange({ end: event.target.value })}
                className="rfTimesEnd"
                isInvalid={Boolean(invalid)}
            >
                {TIME_OPTIONS.slice(1).map((time) => (
                    <SelectItem key={time}>{time}</SelectItem>
                ))}
            </Select>
            <span className="rfTimesNote">
                {invalid
                    ? t('Ends before it starts')
                    : minutes !== null && [tn(minutes / 60, '{count} hour', '{count} hours'), price !== null ? formatVnd(price) : null].filter(Boolean).join(' · ')}
            </span>
        </li>
    );
};

// The repeat of a regular rental (useSeriesPlan): the weekdays, their times (the same for all, or each its own), how
// long it runs (4 / 8 / 12 weeks or up to a day), a discount for the whole series with its reason, and what each month
// comes to — one QR code per month.
const RepeatFields = ({ series, date, room }) => {
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

            {series.weekdays.length > 1 && (
                <div className="bfField">
                    <span className="bfLabel">{t('Times')}</span>
                    <Segmented
                        label={t('Times')}
                        options={[
                            { key: 'same', label: t('Same times every day') },
                            { key: 'own', label: t('Each weekday its own') },
                        ]}
                        value={series.perDay ? 'own' : 'same'}
                        onChange={(key) => series.setPerDay(key === 'own')}
                    />
                    {series.byWeekday && (
                        <ul className="rfTimes" aria-label={t('Times per weekday')}>
                            {series.weekdays.map((weekday) => (
                                <WeekdayTimes
                                    key={weekday}
                                    weekday={weekday}
                                    times={series.timesOf(weekday)}
                                    first={weekday === series.firstWeekday}
                                    room={room}
                                    onChange={(patch) => series.setTimesOf(weekday, patch)}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            )}

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
