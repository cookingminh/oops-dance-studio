import { Chip } from '@nextui-org/react';
import { LuClock, LuTicket } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { useI18n } from '@/i18n/i18nContext';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { paymentState } from '@/ui/payment/bookingMoney';
import { bookingBalance } from '@/services/bookingPayments';
import RefundLine from '@/ui/refunds/RefundLine';
import { statusColorMap } from '../../../../../../Table/utils';
import BookingActions from './BookingActions';
import { DEPOSIT_LABELS } from './bookingsCalendarModel';

// Phone layout of My Bookings: one card per booking instead of a wide table. `cancellable(booking)`: the
// guest may still cancel it (onCancel opens the cancel dialog).
const BookingCards = ({ bookings, today, cancellable, onCancel, onPay, onReceipt, empty }) => {
    const { t, intl, formatDate } = useI18n();
    if (bookings.length === 0) return empty;
    return (
        <ul className="pfBookingCards" aria-label={t('My bookings')}>
            {bookings.map((b) => (
                <li key={b.id} className={`pfBookingCard is-${b.status}`}>
                    <span className="pfBookingDate" aria-hidden="true">
                        <strong>{format(parseISO(b.date), 'd')}</strong>
                        <small>{new Intl.DateTimeFormat(intl, { month: 'short' }).format(parseISO(b.date))}</small>
                    </span>
                    <div className="pfBookingBody">
                        <div className="pfBookingHead">
                            <strong>
                                <LuTicket aria-hidden="true" /> {b.room?.name}
                            </strong>
                            <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[b.status] ?? 'default'}>
                                {t(b.status)}
                            </Chip>
                        </div>
                        <span className="pfBookingWhen">
                            <LuClock aria-hidden="true" />
                            <span>
                                {b.date === today ? t('Today') : formatDate(b.date, 'weekday')} · {formatTimeRange(b.start_time, b.end_time)}
                                <span className="sr-only">
                                    {' '}
                                    ({formatDate(b.date, 'shortYear')}, {b.date})
                                </span>
                            </span>
                        </span>
                        <span className="pfBookingPay">
                            <strong>{formatVnd(b.full_payment)}</strong> · {t('Deposit {amount}', { amount: formatVnd(b.deposit) })} ·{' '}
                            <span className={`depositState is-${b.deposit_status}`}>{t(DEPOSIT_LABELS[b.deposit_status] ?? b.deposit_status)}</span>
                        </span>
                        <span className={`payState tone-${paymentState(b).tone}`}>{t(paymentState(b).label)}</span>
                        {bookingBalance(b) > 0 && <span className="payLeft">{t('Still to pay {amount}', { amount: formatVnd(bookingBalance(b)) })}</span>}
                        <RefundLine booking={b} />
                        <div className="pfBookingFoot">
                            <span className="bookingId">#{b.id}</span>
                            <BookingActions booking={b} cancellable={cancellable} onPay={onPay} onReceipt={onReceipt} onCancel={onCancel} compact />
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default BookingCards;
