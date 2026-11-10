import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuArrowDownLeft, LuArrowUpRight, LuBanknote, LuCheck, LuLandmark, LuQrCode, LuReceipt, LuTag, LuTrash2, LuUndo2, LuWallet } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { bookingBalance, bookingDue, bookingReceived, bookingTransferContent, deleteBookingPayment, listBookingPayments, unassignBookingTransfer } from '@/services/bookingPayments';
import Segmented from '../../../../common/Segmented';
import { formatClock, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { LEGACY_ENTRY, bookingHours, hourlyRate, paymentState, priceChange } from '@/ui/payment/bookingMoney';
import { transferNote } from '../../../tuition/tuitionModel';
import { DEPOSIT_LABELS } from '../../useBookingActions';
import RefundBlock from '../refunds/RefundBlock';
import PriceDialog from './PriceDialog';
import RecordPaymentDialog from './RecordPaymentDialog';

const day = (timestamp) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(timestamp));
const signed = (amount) => `${Number(amount) < 0 ? '−' : '+'}${formatVnd(Math.abs(Number(amount)))}`;

// One line of the payment history: a matched bank transfer (with its content; "Take back") or an
// amount staff recorded by hand (cash or transfer, negative = refund; "Remove").
const HistoryLine = ({ payment, busy, onTakeBack, onRemove }) => {
    const { t, formatDate } = useI18n();
    const isBank = payment.kind === 'bank';
    const refund = Number(payment.amount) < 0;
    const how = refund ? t('Refund') : payment.method === 'cash' ? t('Cash') : t('Bank transfer');
    const note = payment.note === LEGACY_ENTRY ? t(LEGACY_ENTRY) : isBank ? transferNote(payment.note, t, formatVnd) : payment.note;
    const by = !isBank && payment.recorded_by_name ? t('recorded by {name}', { name: payment.recorded_by_name }) : '';
    return (
        <li data-payment={`${payment.kind}-${payment.id}`} data-transfer={isBank ? payment.id : undefined} className={refund ? 'isRefund' : undefined}>
            <span className={`bdHistIcon${payment.method === 'cash' ? ' isCash' : ''}${refund ? ' isRefund' : ''}`} aria-hidden="true">
                {refund ? <LuArrowUpRight /> : payment.method === 'cash' ? <LuBanknote /> : <LuArrowDownLeft />}
            </span>
            <span className="bdHistText">
                <strong>
                    {signed(payment.amount)} · {how}
                    {refund && ` (${payment.method === 'cash' ? t('Cash') : t('Bank transfer')})`}
                </strong>
                <small>{[`${formatDate(day(payment.received_at), 'short')} ${formatClock(payment.received_at)}`, by, note].filter(Boolean).join(' · ')}</small>
                {payment.content && <code>{payment.content}</code>}
            </span>
            {isBank ? (
                <Button size="sm" variant="light" startContent={<LuUndo2 aria-hidden="true" />} isLoading={busy} aria-label={t('Take back {amount}', { amount: formatVnd(payment.amount) })} onPress={onTakeBack}>
                    {t('Take back')}
                </Button>
            ) : (
                <Button size="sm" variant="light" startContent={<LuTrash2 aria-hidden="true" />} isLoading={busy} aria-label={t('Remove {amount}', { amount: signed(payment.amount) })} onPress={onRemove}>
                    {t('Remove')}
                </Button>
            )}
        </li>
    );
};

// The money of one booking (staff): the list price and any agreed change, the deposit, what came in, what
// is due now (or, once cancelled, what goes back); the actions (QR, record a payment or refund, change the
// price, receipt); then every payment.
// Money only changes through these actions, so every amount has a line. onChanged reloads the booking.
const BookingPayment = ({ booking, onPay, onReceipt, onChanged }) => {
    const { t, tn } = useI18n();
    const toast = useToast();
    const [busy, setBusy] = useState(null);
    const [dialog, setDialog] = useState(null); // 'record' | 'cash' | 'transfer' | 'price'
    const [pick, setPick] = useState('deposit'); // while the deposit is open: settle the deposit or everything
    const history = useAsync(() => listBookingPayments(booking.id), [booking.id, booking.bank_transfer, booking.cash]);
    const hours = bookingHours(booking);
    const received = bookingReceived(booking);
    const due = bookingDue(booking);
    const balance = bookingBalance(booking);
    // "Still to pay" is the whole balance; an open deposit is what to pay first (and the default pick).
    const depositOpen = due.kind === 'deposit';
    const amount = depositOpen && pick === 'deposit' ? due.amount : balance;
    const depositShare = Number(booking.full_payment) ? Math.round((Number(booking.deposit ?? 0) / Number(booking.full_payment)) * 100) : 0;
    const state = paymentState(booking);
    const change = priceChange(booking);
    const closed = ['rejected', 'cancelled'].includes(booking.status);
    const list = Number(booking.list_price ?? booking.full_payment ?? 0);

    const act = async (payment, question, work, message) => {
        if (!window.confirm(question)) return;
        setBusy(`${payment.kind}-${payment.id}`);
        try {
            await work();
            toast.success(message);
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };
    const takeBack = (payment) =>
        act(
            payment,
            t('Take {amount} back off booking #{id}? The transfer goes back to the inbox.', { amount: formatVnd(payment.amount), id: booking.id }),
            () => unassignBookingTransfer(payment.id),
            'Transfer taken back. It is in the inbox again.',
        );
    const remove = (payment) =>
        act(payment, t('Remove this {amount} entry from booking #{id}?', { amount: signed(payment.amount), id: booking.id }), () => deleteBookingPayment(payment.id), 'Payment entry removed.');

    return (
        <section className="bdPay" aria-labelledby={`bd-pay-${booking.id}`}>
            <header className="bdPayHead">
                <h3 id={`bd-pay-${booking.id}`}>
                    <LuWallet aria-hidden="true" /> {t('Payment')}
                </h3>
                <span className={`bdPill tone-${state.tone}`}>{t(state.label)}</span>
            </header>


            {/* The balance is the number that matters; an open deposit is what to pay first. Three ways to settle it.
                A cancelled or rejected booking shows its refund instead. */}
            {closed ? (
                <RefundBlock booking={booking} onChanged={onChanged} />
            ) : balance > 0 ? (
                <div className="bdDueHero isDue">
                    <span className="bdDueLabel">{t('Still to pay')}</span>
                    <strong className="bdDueAmount">{formatVnd(balance)}</strong>
                    {depositOpen ? (
                        <small className="bdDepositLine">{t('Deposit to pay first: {amount} ({share}%)', { amount: formatVnd(due.amount), share: depositShare })}</small>
                    ) : (
                        Number(booking.deposit) > 0 &&
                        booking.deposit_status === 'completed' && (
                            <small className="bdDepositLine isPaid">
                                <LuCheck aria-hidden="true" /> {t('Deposit paid')}
                            </small>
                        )
                    )}
                    {depositOpen && (
                        <Segmented
                            label={t('Amount to settle')}
                            className="bdPick"
                            options={[
                                { key: 'deposit', label: t('Deposit'), count: formatVnd(due.amount) },
                                { key: 'full', label: t('Full'), count: formatVnd(balance) },
                            ]}
                            value={pick}
                            onChange={setPick}
                        />
                    )}
                    <div className="bdQuickPay">
                        <Button size="sm" color="danger" variant="flat" startContent={<LuBanknote aria-hidden="true" />} onPress={() => setDialog('cash')}>
                            {t('Received {amount} in cash', { amount: formatVnd(amount) })}
                        </Button>
                        <Button size="sm" color="danger" variant="flat" startContent={<LuLandmark aria-hidden="true" />} onPress={() => setDialog('transfer')}>
                            {t('Received {amount} by transfer', { amount: formatVnd(amount) })}
                        </Button>
                        <Button size="sm" color="danger" startContent={<LuQrCode aria-hidden="true" />} onPress={() => onPay(depositOpen && pick === 'deposit' ? 'deposit' : depositOpen ? 'full' : 'rest')}>
                            {t('Show QR for {amount}', { amount: formatVnd(amount) })}
                        </Button>
                    </div>
                    <p className="bdMatchLine">
                        {t('Code')} <code>{booking.payment_code}</code> · {t('transfer content')} <code>{bookingTransferContent(booking)}</code>
                    </p>
                </div>
            ) : (
                <p className="bdDueHero isPaid">
                    <LuCheck aria-hidden="true" /> <strong>{t('Fully paid')}</strong>
                    <button type="button" className="bdLink" onClick={onReceipt}>
                        {t('See the receipt')}
                    </button>
                </p>
            )}

            <dl className="bdPayLines">
                <div className={change ? 'isList' : undefined}>
                    <dt>
                        {change ? t('List price') : t('Room hire')}
                        <small>{t('{rate} per hour × {hours}', { rate: formatVnd(hourlyRate(booking)), hours: Number.isInteger(hours) ? tn(hours, '{count} hour', '{count} hours') : t('{count} hours', { count: hours }) })}</small>
                    </dt>
                    <dd>{formatVnd(list)}</dd>
                </div>
                {change && (
                    <>
                        <div className="bdPriceNote">
                            <dt>{[t('Agreed price change'), change.note].filter(Boolean).join(' · ')}</dt>
                            <dd>
                                {change.diff < 0 ? '−' : '+'}
                                {formatVnd(Math.abs(change.diff))}
                            </dd>
                        </div>
                        <div className="isTotal">
                            <dt>{t('Agreed price')}</dt>
                            <dd>{formatVnd(change.total)}</dd>
                        </div>
                    </>
                )}
                <div>
                    <dt>
                        {t('Deposit')}
                        <small>
                            <span className={`depositState is-${booking.deposit_status}`}>{t(DEPOSIT_LABELS[booking.deposit_status] ?? booking.deposit_status)}</span>
                        </small>
                    </dt>
                    <dd>{formatVnd(booking.deposit)}</dd>
                </div>
                <div>
                    <dt>
                        {t('Received')}
                        <small>{t('Transfer {transfer} · cash {cash}', { transfer: formatVnd(booking.bank_transfer ?? 0), cash: formatVnd(booking.cash ?? 0) })}</small>
                    </dt>
                    <dd>{formatVnd(received)}</dd>
                </div>
            </dl>

            <div className="bdPayActions">
                <Button size="sm" variant="flat" startContent={<LuBanknote aria-hidden="true" />} onPress={() => setDialog('record')}>
                    {t('Record payment')}
                </Button>
                <Button size="sm" variant="flat" startContent={<LuTag aria-hidden="true" />} onPress={() => setDialog('price')}>
                    {t('Change price')}
                </Button>
                <Button size="sm" variant="light" startContent={<LuReceipt aria-hidden="true" />} onPress={onReceipt}>
                    {t('Receipt')}
                </Button>
            </div>

            <div className="bdHistory">
                <h4>{t('Payments received')}</h4>
                {history.loading && !history.data ? (
                    <p className="bdMuted">{t('Loading…')}</p>
                ) : (history.data ?? []).length === 0 ? (
                    <p className="bdMuted">{t('No payments yet')}</p>
                ) : (
                    <ul>
                        {history.data.map((payment) => (
                            <HistoryLine
                                key={`${payment.kind}-${payment.id}`}
                                payment={payment}
                                busy={busy === `${payment.kind}-${payment.id}`}
                                onTakeBack={() => takeBack(payment)}
                                onRemove={() => remove(payment)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {dialog === 'record' && <RecordPaymentDialog booking={booking} onClose={() => setDialog(null)} onDone={onChanged} />}
            {(dialog === 'cash' || dialog === 'transfer') && (
                <RecordPaymentDialog booking={booking} fixedMethod={dialog} presetAmount={amount} onClose={() => setDialog(null)} onDone={onChanged} />
            )}
            {dialog === 'price' && <PriceDialog booking={booking} onClose={() => setDialog(null)} onDone={onChanged} />}
        </section>
    );
};

export default BookingPayment;
