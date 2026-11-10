import { Button, Chip } from '@nextui-org/react';
import { LuClock, LuQrCode, LuReceipt, LuTicket } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { useI18n } from '@/i18n/i18nContext';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { payLabel, paymentState } from '@/ui/payment/bookingMoney';
import { bookingBalance } from '@/services/bookingPayments';
import { statusColorMap } from '../../../../../../Table/utils';

const DEPOSIT_LABELS = { waiting: 'waiting', completed: 'paid', cancelled: 'cancelled' }; // English, translated where shown

// Phone layout of My Bookings: one card per booking instead of a wide table.
const BookingCards = ({ bookings, today, busyId, onCancel, onPay, onReceipt, empty }) => {
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
                        <div className="pfBookingFoot">
                            <span className="bookingId">#{b.id}</span>
                            <span className="myBookingActions">
                                {payLabel(b) && (
                                    <Button size="sm" color="danger" startContent={<LuQrCode aria-hidden="true" />} onPress={() => onPay(b.id)}>
                                        {t(payLabel(b))}
                                    </Button>
                                )}
                                <Button size="sm" variant="light" isIconOnly aria-label={t('Receipt for booking #{id}', { id: b.id })} onPress={() => onReceipt(b.id)}>
                                    <LuReceipt aria-hidden="true" />
                                </Button>
                                {b.status === 'pending' && (
                                    <Button size="sm" color="danger" variant="flat" isLoading={busyId === b.id} onPress={() => onCancel(b.id)}>
                                        {t('Cancel')}
                                    </Button>
                                )}
                            </span>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default BookingCards;
