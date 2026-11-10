import { Button, Modal, ModalBody, ModalContent, ModalFooter } from '@nextui-org/react';
import { LuPrinter } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { bookingDue, bookingReceived, listBookingPayments } from '@/services/bookingPayments';
import { formatClock, formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { ADDRESS, EMAIL, PHONE } from '@/Components/HomePage/Components/NavBar/contactInfo';
import { LEGACY_ENTRY, bookingHours, hourlyRate, paymentState, priceChange } from './bookingMoney';
import './receipt.scss';

const STUDIO = 'Oops! Dance Studio';
const day = (timestamp) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(timestamp));

// A printable receipt (hoá đơn) for one room booking, for its guest or staff: the studio, the guest,
// the booking, the price lines (list price, any agreed change with its reason), every payment (bank
// transfers with their content, cash and transfers recorded by staff, refunds) and what is left.
// Print prints only the receipt (receipt.scss). `guest` = { name, phone, email }; `today` = 'yyyy-MM-dd'.
const BookingReceipt = ({ booking, guest, today, onClose }) => {
    const { t, tn, formatDate } = useI18n();
    const payments = useAsync(() => listBookingPayments(booking.id), [booking.id, booking.bank_transfer, booking.cash]);
    const hours = bookingHours(booking);
    const received = bookingReceived(booking);
    const total = Number(booking.full_payment ?? 0);
    const left = ['rejected', 'cancelled'].includes(booking.status) ? 0 : Math.max(total - received, 0);
    const state = paymentState(booking);
    const due = bookingDue(booking);
    const change = priceChange(booking);
    const duration = Number.isInteger(hours) ? tn(hours, '{count} hour', '{count} hours') : t('{count} hours', { count: hours });

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} size="2xl" placement="center" scrollBehavior="inside" classNames={{ base: 'bkReceiptModal adminPortal' }}>
            <ModalContent>
                <ModalBody className="bkReceiptBody">
                    <article className="bkReceipt" aria-label={t('Receipt for booking #{id}', { id: booking.id })}>
                        <header className="bkReceiptHead">
                            <div>
                                <strong className="bkStudio">{STUDIO}</strong>
                                <span>{ADDRESS}</span>
                                <span>
                                    {PHONE.display} · {EMAIL}
                                </span>
                            </div>
                            <div className="bkReceiptTitle">
                                <h2>{t('Receipt')}</h2>
                                <span>{t('Booking #{id}', { id: booking.id })}</span>
                                <span className="bkMono">{booking.payment_code}</span>
                                {today && <span>{t('Issued {date}', { date: formatDate(today, 'shortYear') })}</span>}
                            </div>
                        </header>

                        <section className="bkReceiptParties">
                            <div>
                                <h3>{t('Billed to')}</h3>
                                <strong>{guest?.name || t('Guest')}</strong>
                                {guest?.phone && <span>{guest.phone}</span>}
                                {guest?.email && <span>{guest.email}</span>}
                            </div>
                            <div>
                                <h3>{t('Booking details')}</h3>
                                <strong>{booking.room?.name}</strong>
                                <span className="bkCap">{formatDate(booking.date, 'full')}</span>
                                <span>
                                    {formatTimeRange(booking.start_time, booking.end_time)} · {duration}
                                </span>
                            </div>
                        </section>

                        <table className="bkReceiptLines">
                            <thead>
                                <tr>
                                    <th scope="col">{t('Item')}</th>
                                    <th scope="col">{t('Amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        {t('Room hire · {room}', { room: booking.room?.name ?? '' })}
                                        <small>{t('{rate} per hour × {hours}', { rate: formatVnd(hourlyRate(booking)), hours: duration })}</small>
                                    </td>
                                    <td>{formatVnd(change ? change.list : total)}</td>
                                </tr>
                                {change && (
                                    <tr className="bkChange">
                                        <td>{[t('Agreed price change'), change.note].filter(Boolean).join(' · ')}</td>
                                        <td>
                                            {change.diff < 0 ? '−' : '+'}
                                            {formatVnd(Math.abs(change.diff))}
                                        </td>
                                    </tr>
                                )}
                                <tr className="isTotal">
                                    <th scope="row">{t('Total')}</th>
                                    <td>{formatVnd(total)}</td>
                                </tr>
                                {Number(booking.deposit) > 0 && (
                                    <tr className="isInfo">
                                        <td>
                                            {t('Deposit')}
                                            <small>{t(booking.deposit_status === 'completed' ? 'paid' : booking.deposit_status === 'cancelled' ? 'cancelled' : 'waiting')}</small>
                                        </td>
                                        <td>{formatVnd(booking.deposit)}</td>
                                    </tr>
                                )}
                            </tbody>
                            <tbody className="bkPayments">
                                <tr className="isGroup">
                                    <th scope="rowgroup" colSpan={2}>
                                        {t('Payments')}
                                    </th>
                                </tr>
                                {(payments.data ?? []).map((payment) => {
                                    const refund = Number(payment.amount) < 0;
                                    const method = payment.method === 'cash' ? t('Cash') : t('Bank transfer');
                                    const note = payment.note === LEGACY_ENTRY ? t(LEGACY_ENTRY) : payment.kind === 'entry' ? payment.note : '';
                                    return (
                                        <tr key={`${payment.kind}-${payment.id}`} className={refund ? 'isRefund' : undefined}>
                                            <td>
                                                {formatDate(day(payment.received_at), 'short')} {formatClock(payment.received_at)} · {refund ? `${t('Refund')} (${method})` : method}
                                                {payment.content && <small className="bkMono">{payment.content}</small>}
                                                {payment.kind === 'entry' && (
                                                    <small>{[payment.recorded_by_name && t('recorded by {name}', { name: payment.recorded_by_name }), note].filter(Boolean).join(' · ')}</small>
                                                )}
                                            </td>
                                            <td>
                                                {refund ? '−' : ''}
                                                {formatVnd(Math.abs(Number(payment.amount)))}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {payments.data && payments.data.length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="bkNone">
                                            {payments.loading ? t('Loading…') : t('No payments yet')}
                                        </td>
                                    </tr>
                                )}
                                <tr className="isTotal">
                                    <th scope="row">{t('Paid so far')}</th>
                                    <td>{formatVnd(received)}</td>
                                </tr>
                                <tr className={`isTotal isBalance${left ? ' isDue' : ''}`}>
                                    <th scope="row">{t('Balance due')}</th>
                                    <td>{formatVnd(left)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <footer className="bkReceiptFoot">
                            <p>
                                {t('Status')}: <strong className="bkCap">{t(booking.status)}</strong> · <strong>{t(state.label)}</strong>
                            </p>
                            {/* The balance is what is left; an open deposit is what to pay first. */}
                            {due.kind === 'deposit' && <p>{t('Deposit to pay first: {amount} ({share}%)', { amount: formatVnd(due.amount), share: total ? Math.round((Number(booking.deposit ?? 0) / total) * 100) : 0 })}</p>}
                            {left > 0 && <p>{t('Pay {amount} by transfer with {code} in the content, or at the studio desk.', { amount: formatVnd(left), code: booking.payment_code })}</p>}
                            <p className="bkThanks">{t('Thank you for dancing with us!')}</p>
                        </footer>
                    </article>
                </ModalBody>
                <ModalFooter className="bkReceiptActions">
                    <Button variant="light" onPress={onClose}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" startContent={<LuPrinter aria-hidden="true" />} onPress={() => window.print()}>
                        {t('Print')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingReceipt;
