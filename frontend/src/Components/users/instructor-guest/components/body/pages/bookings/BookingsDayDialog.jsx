import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCalendarDays, LuClock } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { bookingBalance } from '@/services/bookingPayments';
import { paymentState } from '@/ui/payment/bookingMoney';
import RefundLine from '@/ui/refunds/RefundLine';
import { statusColorMap } from '../../../../../../Table/utils';
import BookingActions from './BookingActions';
import { DEPOSIT_LABELS, toneOf } from './bookingsCalendarModel';
import '@/ui/payment/payment.scss';

// One day of My bookings → Calendar: each booking with its room, times, status, price, deposit and what is
// left to pay, and the list's own buttons (onPay / onReceipt / onCancel open the page's dialogs; the page
// hides this one meanwhile with isOpen, and shows it again, reloaded, when they close).
//   bookings: that day's, by start time   highlight: the booking whose chip was clicked
const BookingsDayDialog = ({ date, bookings, today, highlight, isOpen, cancellable, onPay, onReceipt, onCancel, onClose }) => {
    const { t, tn, formatDate } = useI18n();
    const sub = [date === today && t('Today'), tn(bookings.length, '{count} booking', '{count} bookings')].filter(Boolean).join(' · ');

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'tuPayModal mbDayDialog adminPortal', closeButton: 'tuModalClose' }}
        >
            <ModalContent>
                <ModalHeader className="tuPayHead">
                    <span className="tuPayHeadIcon" aria-hidden="true">
                        <LuCalendarDays />
                    </span>
                    <span>
                        <span className="tuPayTitle mbDayTitle">{formatDate(date, 'full')}</span>
                        <span className="tuPaySub">{sub}</span>
                    </span>
                </ModalHeader>
                <ModalBody className="tuPayBody mbDayBody">
                    {bookings.length === 0 ? (
                        <p className="mbDayEmpty">{t('No bookings with this status on this day.')}</p>
                    ) : (
                        <ul className="mbDayList" aria-label={t('My bookings')}>
                            {bookings.map((b) => {
                                const balance = bookingBalance(b);
                                const state = paymentState(b);
                                return (
                                    <li key={b.id} className={`mbDayItem tone-${toneOf(b)}${b.id === highlight ? ' isPicked' : ''}`}>
                                        <div className="mbDayItemHead">
                                            <strong className="mbDayRoom">{b.room?.name}</strong>
                                            <span className="mbDayTimes">
                                                <LuClock aria-hidden="true" />
                                                {formatTimeRange(b.start_time, b.end_time)}
                                            </span>
                                            <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[b.status] ?? 'default'}>
                                                {t(b.status)}
                                            </Chip>
                                        </div>
                                        <dl className="mbDayMoney">
                                            <div>
                                                <dt>{t('Room price')}</dt>
                                                <dd>{formatVnd(b.full_payment)}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('Deposit')}</dt>
                                                <dd>
                                                    {formatVnd(b.deposit)}{' '}
                                                    <span className={`mbDeposit is-${b.deposit_status}`}>{t(DEPOSIT_LABELS[b.deposit_status] ?? b.deposit_status)}</span>
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>{t('Still to pay')}</dt>
                                                <dd className={balance > 0 ? 'isDue' : undefined}>{formatVnd(balance)}</dd>
                                            </div>
                                        </dl>
                                        <span className={`payState tone-${state.tone}`}>{t(state.label)}</span>
                                        <RefundLine booking={b} />
                                        <div className="mbDayItemFoot">
                                            <span className="mbDayId">#{b.id}</span>
                                            <BookingActions booking={b} cancellable={cancellable} onPay={onPay} onReceipt={onReceipt} onCancel={onCancel} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </ModalBody>
                <ModalFooter className="tuPayFoot">
                    <Button variant="flat" onPress={onClose}>
                        {t('Close')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingsDayDialog;
