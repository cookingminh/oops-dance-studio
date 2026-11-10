import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuBanknote, LuUndo2 } from 'react-icons/lu';
import { bookingDue, bookingReceived, bookingTransferContent, recordBookingPayment } from '@/services/bookingPayments';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import CopyRow from '@/ui/payment/CopyRow';
import Segmented from '../../../../common/Segmented';

const PAYMENT_NOTES = ['Paid the rest at the desk', 'Transfer the bank sync missed'];
const REFUND_NOTES = ['Booking cancelled', 'Overpaid', 'Session cut short'];

// Money taken by hand on a booking: cash (default) or a transfer the bank sync didn't see, prefilled
// with what is due now; or a refund (money back to the guest, a note is required). Every one becomes a
// line in the booking's payment history (booking_record_payment). onDone() after it is saved.
// `fixedMethod` ('cash' | 'transfer'): the quick "Received … in cash / by transfer" confirm — a payment of
// what is due now by that method, amount still editable; a transfer shows the code to match it against.
const RecordPaymentDialog = ({ booking, fixedMethod = null, presetAmount = null, onClose, onDone }) => {
    const { t } = useI18n();
    const toast = useToast();
    const due = bookingDue(booking);
    const left = Math.max(Number(booking.full_payment ?? 0) - bookingReceived(booking), 0);
    const [kind, setKind] = useState('payment');
    const [method, setMethod] = useState(fixedMethod ?? 'cash');
    const [amount, setAmount] = useState(presetAmount ? String(presetAmount) : due.amount ? String(due.amount) : '');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const isRefund = kind === 'refund';
    const value = Number(amount);
    // A refund gives back at most what came in that way.
    const have = Number((method === 'cash' ? booking.cash : booking.bank_transfer) ?? 0);
    const problem =
        !amount || !Number.isInteger(value) || value <= 0
            ? t('Enter an amount in VND.')
            : isRefund && value > have
              ? t('Only {amount} came in by {method}.', { amount: formatVnd(have), method: t(method === 'cash' ? 'Cash' : 'Bank transfer') })
              : isRefund && !note.trim()
                ? t('Say why the money goes back.')
                : '';

    const pickKind = (next) => {
        setKind(next);
        setAmount(next === 'refund' ? '' : due.amount ? String(due.amount) : '');
        setNote('');
    };

    const submit = async (event) => {
        event?.preventDefault();
        if (problem || saving) return;
        setSaving(true);
        try {
            await recordBookingPayment(booking.id, isRefund ? -value : value, { method, note: note.trim() || null });
            toast.success(isRefund ? 'Refund recorded.' : 'Payment recorded.');
            onDone();
            onClose();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const quick = isRefund
        ? []
        : [
              due.kind === 'deposit' && { label: t('Deposit {amount}', { amount: formatVnd(due.amount) }), amount: due.amount },
              left > 0 && { label: t('Everything left {amount}', { amount: formatVnd(left) }), amount: left },
          ].filter(Boolean);

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'bdMoneyDialog tuPayModal adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader className="bdMoneyHead">
                        <span>{fixedMethod ? (fixedMethod === 'cash' ? t('Received in cash') : t('Received by transfer')) : isRefund ? t('Refund') : t('Record payment')}</span>
                        <small>
                            {t('Booking #{id}', { id: booking.id })} ·{' '}
                            {t('{received} received of {total}', { received: formatVnd(bookingReceived(booking)), total: formatVnd(booking.full_payment) })}
                        </small>
                    </ModalHeader>
                    <ModalBody className="bdMoneyBody">
                        {!fixedMethod && (
                            <div className="bdMoneyRow">
                                <Segmented
                                    label={t('Payment or refund')}
                                    options={[
                                        { key: 'payment', label: t('Payment') },
                                        { key: 'refund', label: t('Refund') },
                                    ]}
                                    value={kind}
                                    onChange={pickKind}
                                />
                                <Segmented
                                    label={t('Method')}
                                    options={[
                                        { key: 'cash', label: t('Cash') },
                                        { key: 'transfer', label: t('Bank transfer') },
                                    ]}
                                    value={method}
                                    onChange={setMethod}
                                />
                            </div>
                        )}
                        {fixedMethod === 'transfer' && (
                            <dl className="tuCopyList bdMatch">
                                <CopyRow label={t('Payment code')} value={booking.payment_code} mono />
                                <CopyRow label={t('Transfer content')} value={bookingTransferContent(booking)} />
                            </dl>
                        )}
                        <Input
                            type="number"
                            label={isRefund ? t('Amount given back (VND)') : t('Amount received (VND)')}
                            value={amount}
                            onValueChange={setAmount}
                            min={0}
                            step={1000}
                            autoFocus
                            description={!isRefund && due.amount ? t('Due now: {amount}', { amount: formatVnd(due.amount) }) : undefined}
                        />
                        {quick.length > 0 && (
                            <div className="tuQuick" role="group" aria-label={t('Quick amounts')}>
                                {quick.map((option) => (
                                    <button key={option.label} type="button" onClick={() => setAmount(String(option.amount))}>
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {method === 'transfer' && !isRefund && !fixedMethod && (
                            <p className="bdMoneyHint">{t('For a transfer the bank sync didn’t record. Matched transfers are added by themselves.')}</p>
                        )}
                        <Input
                            label={isRefund ? t('Why it goes back') : t('Note')}
                            placeholder={isRefund ? undefined : t('Optional')}
                            value={note}
                            onValueChange={setNote}
                            maxLength={300}
                            isRequired={isRefund}
                        />
                        {fixedMethod === 'transfer' && <p className="bdMoneyHint">{t('Check that the transfer you see carries this code, then confirm.')}</p>}
                        <div className="tuQuick" role="group" aria-label={t('Common reasons')}>
                            {(isRefund ? REFUND_NOTES : PAYMENT_NOTES).map((text) => (
                                <button key={text} type="button" onClick={() => setNote(t(text))}>
                                    {t(text)}
                                </button>
                            ))}
                        </div>
                        {amount && problem && <p className="bdMoneyHint isError">{problem}</p>}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            color="danger"
                            isLoading={saving}
                            isDisabled={Boolean(problem)}
                            startContent={saving ? null : isRefund ? <LuUndo2 aria-hidden="true" /> : <LuBanknote aria-hidden="true" />}
                        >
                            {isRefund ? t('Record refund') : fixedMethod ? t('Confirm') : t('Record payment')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default RecordPaymentDialog;
