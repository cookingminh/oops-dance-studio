import { Button } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { paymentState } from '@/ui/payment/bookingMoney';
import { bookingsByDay, chipTimes, defaultPick, inMonth, isOwed, monthGrid, shiftMonth, toneOf } from './bookingsCalendarModel';
import './bookingsCalendar.scss';

const MAX_CHIPS = 3; // a fourth booking turns the third chip into "+2 more"
const MAX_DOTS = 4;

// ‹ month › and Today: the calendar's month, in place of the list's Upcoming / Past / All.
export const MonthNav = ({ month, thisMonth, onChange, onToday }) => {
    const { t, monthName } = useI18n();
    return (
        <div className="mbMonthBar">
            <div className="dayNav mbMonthNav" role="group" aria-label={t('Choose a month')}>
                <button type="button" aria-label={t('Previous month')} onClick={() => onChange(shiftMonth(month, -1))}>
                    <LuChevronLeft aria-hidden="true" />
                </button>
                <span className="mbMonthLabel" aria-live="polite">
                    {monthName(month, { withYear: true })}
                </span>
                <button type="button" aria-label={t('Next month')} onClick={() => onChange(shiftMonth(month, 1))}>
                    <LuChevronRight aria-hidden="true" />
                </button>
            </div>
            <Button variant="flat" className="mbTodayBtn" isDisabled={month === thisMonth} onPress={onToday}>
                {t('Today')}
            </Button>
        </div>
    );
};

// My bookings as a month (Monday first), each booking a chip in its state's colour (a red dot: money still
// to pay). Desktop: a chip, "+N more" or the day itself opens the day dialog (onOpenDay(date, bookingId?)).
// Phones: a compact grid with a dot per booking; the picked day's bookings show under it (renderDay(bookings),
// the list's own cards with their buttons).
//   bookings: already filtered by status   picked / onPick: the phone's picked day ('yyyy-MM-dd' | null)
const BookingsCalendar = ({ month, bookings, today, isPhone, busy, filtered, picked, onPick, onOpenDay, renderDay }) => {
    const { t, tn, dayName, formatDate, monthName } = useI18n();
    const weeks = monthGrid(month);
    const byDay = bookingsByDay(bookings.filter((booking) => inMonth(booking.date, month)));
    const pick = picked && inMonth(picked, month) ? picked : defaultPick(month, byDay, today);

    const describe = (date, items) =>
        [formatDate(date, 'long'), date === today && t('Today'), tn(items.length, '{count} booking', '{count} bookings')].filter(Boolean).join(', ');
    const chipLabel = (booking) => [chipTimes(booking), booking.room?.name, t(booking.status), t(paymentState(booking).label)].filter(Boolean).join(', ');

    const dayClass = (date, items) =>
        ['mbDay', date === today && 'isToday', date < today && 'isPast', items.length > 0 && 'hasBookings', isPhone && date === pick && 'isPicked']
            .filter(Boolean)
            .join(' ');

    const desktopDay = (date, items) => {
        const shown = items.length > MAX_CHIPS ? items.slice(0, MAX_CHIPS - 1) : items;
        return (
            <div key={date} className={dayClass(date, items)} data-date={date}>
                {items.length > 0 && <button type="button" className="mbDayHit" aria-label={describe(date, items)} onClick={() => onOpenDay(date)} />}
                <span className="mbDayNum" aria-hidden="true">
                    {Number(date.slice(8))}
                </span>
                {items.length > 0 && (
                    <span className="mbChips">
                        {shown.map((booking) => (
                            <button
                                key={booking.id}
                                type="button"
                                className={`mbChip tone-${toneOf(booking)}`}
                                aria-label={chipLabel(booking)}
                                onClick={() => onOpenDay(date, booking.id)}
                            >
                                <span className="mbChipTime">{chipTimes(booking)}</span>
                                <span className="mbChipRoom">{booking.room?.name}</span>
                                {isOwed(booking) && <span className="mbOwed" aria-hidden="true" />}
                            </button>
                        ))}
                        {items.length > shown.length && (
                            <button type="button" className="mbMore" onClick={() => onOpenDay(date)}>
                                {t('+{count} more', { count: items.length - shown.length })}
                            </button>
                        )}
                    </span>
                )}
            </div>
        );
    };

    const phoneDay = (date, items) => (
        <button key={date} type="button" className={dayClass(date, items)} data-date={date} aria-pressed={date === pick} aria-label={describe(date, items)} onClick={() => onPick(date)}>
            <span className="mbDayNum">{Number(date.slice(8))}</span>
            <span className="mbDots" aria-hidden="true">
                {items.slice(0, MAX_DOTS).map((booking) => (
                    <span key={booking.id} className={`mbDot tone-${toneOf(booking)}`} />
                ))}
            </span>
            {items.some(isOwed) && <span className="mbOwed" aria-hidden="true" />}
        </button>
    );

    return (
        <div className={`mbCal${isPhone ? ' isCompact' : ''}${busy ? ' isBusy' : ''}`}>
            <div className="mbGrid" role="group" aria-label={t('Bookings in {month}', { month: monthName(month, { withYear: true }) })}>
                <div className="mbWeekdays" aria-hidden="true">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <span key={day}>{dayName(day, isPhone ? 'narrow' : 'short')}</span>
                    ))}
                </div>
                {weeks.map((week) => (
                    <div key={week.find(Boolean)} className="mbWeek">
                        {week.map((date, index) => {
                            if (!date) return <span key={`blank-${index}`} className="mbBlank" aria-hidden="true" />;
                            const items = byDay.get(date) ?? [];
                            return isPhone ? phoneDay(date, items) : desktopDay(date, items);
                        })}
                    </div>
                ))}
            </div>

            {byDay.size === 0 && (
                <p className="mbMonthEmpty">{filtered ? t('No bookings with this status this month.') : t('Nothing booked this month.')}</p>
            )}

            <ul className="mbLegend" aria-label={t('Legend')}>
                <li>
                    <span className="mbKey tone-pending" aria-hidden="true" />
                    {t('Pending')}
                </li>
                <li>
                    <span className="mbKey tone-approved" aria-hidden="true" />
                    {t('Approved')}
                </li>
                <li>
                    <span className="mbKey tone-completed" aria-hidden="true" />
                    {t('Completed')}
                </li>
                <li>
                    <span className="mbKey tone-off" aria-hidden="true" />
                    {t('Cancelled or rejected')}
                </li>
                <li>
                    <span className="mbOwed isKey" aria-hidden="true" />
                    {t('Money still to pay')}
                </li>
            </ul>

            {isPhone && (
                <section className="mbPicked" aria-live="polite">
                    <h4 className="mbPickedTitle">
                        {formatDate(pick, 'long')}
                        {pick === today && <span className="mbTodayTag">{t('Today')}</span>}
                    </h4>
                    {renderDay(byDay.get(pick) ?? [])}
                </section>
            )}
        </div>
    );
};

export default BookingsCalendar;
