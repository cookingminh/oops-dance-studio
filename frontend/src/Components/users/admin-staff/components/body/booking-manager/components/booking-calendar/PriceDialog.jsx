import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuChevronDown, LuTag } from 'react-icons/lu';
import { setBookingPrice } from '@/services/bookingPayments';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { bookingHours, hourlyRate } from '@/ui/payment/bookingMoney';
import PriceReasonChips from '../PriceReasonChips';

// Agree another price for a booking (a discount, extra time, a surcharge…). The list price (room price ×
// hours) stays as it is; the reason is required unless the total goes back to it. An open deposit becomes
// half of the new total unless "Deposit" is set; a paid deposit stays (booking_set_price).
const PriceDialog = ({ booking, onClose, onDone }) => {
    const { t } = useI18n();
    const toast = useToast();
    const list = Number(booking.list_price ?? booking.full_payment ?? 0);
    const rate = hourlyRate(booking);
    const [amount, setAmount] = useState(String(Number(booking.full_payment ?? list)));
    const [note, setNote] = useState(booking.price_note ?? '');
    const [deposit, setDeposit] = useState('');
    const [advanced, setAdvanced] = useState(false);
    const [saving, setSaving] = useState(false);

    const total = Number(amount);
    const isList = total === list;
    const diff = total - list;
    const problem = amount === '' || !Number.isInteger(total) || total < 0
        ? t('Enter the new total in VND.')
        : !isList && !note.trim()
            ? t('Say why the price changes.')
            : deposit !== '' && (!Number.isInteger(Number(deposit)) || Number(deposit) < 0)
                ? t('Enter the deposit in VND.')
                : '';
    const unchanged = total === Number(booking.full_payment) && (note.trim() || null) === (booking.price_note || null) && deposit === '';

    const submit = async (event) => {
        event?.preventDefault();
        if (problem || unchanged || saving) return;
        setSaving(true);
        try {
            await setBookingPrice(booking.id, total, { note: isList ? null : note.trim(), deposit: deposit === '' ? null : Number(deposit) });
            toast.success('Price changed.');
            onDone();
            onClose();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'bdMoneyDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader className="bdMoneyHead">
                        <span>{t('Change price')}</span>
                        <small>
                            {t('List price {amount}', { amount: formatVnd(list) })} · {t('{rate} per hour × {hours}', { rate: formatVnd(rate), hours: t('{count} hours', { count: bookingHours(booking) }) })}
                        </small>
                    </ModalHeader>
                    <ModalBody className="bdMoneyBody">
                        <Input type="number" label={t('New total (VND)')} value={amount} onValueChange={setAmount} min={0} step={1000} autoFocus />
                        <PriceReasonChips
                            list={list}
                            total={total}
                            rate={rate}
                            onPick={(option) => {
                                if (option.amount !== undefined) setAmount(String(option.amount));
                                setNote(option.label);
                            }}
                            onBack={() => {
                                setAmount(String(list));
                                setNote('');
                            }}
                        />
                        <Input
                            label={t('Reason')}
                            value={note}
                            onValueChange={setNote}
                            maxLength={300}
                            isRequired={!isList}
                            isDisabled={isList}
                            description={isList ? t('The list price needs no reason.') : t('Shown on the booking and its receipt.')}
                        />
                        {Number.isInteger(total) && amount !== '' && (
                            <p className="bdPriceFlow" aria-live="polite">
                                <span>{t('List price')} {formatVnd(list)}</span>
                                {!isList && (
                                    <>
                                        <span aria-hidden="true">→</span>
                                        <span className={diff < 0 ? 'isLess' : 'isMore'}>
                                            {note.trim() || t('Reason?')} {diff < 0 ? '−' : '+'}
                                            {formatVnd(Math.abs(diff))}
                                        </span>
                                        <span aria-hidden="true">→</span>
                                        <strong>{formatVnd(total)}</strong>
                                    </>
                                )}
                            </p>
                        )}
                        <button type="button" className={`bdAdvanced${advanced ? ' isOpen' : ''}`} aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
                            {t('Advanced')} <LuChevronDown aria-hidden="true" />
                        </button>
                        {advanced && (
                            <Input
                                type="number"
                                label={t('Deposit (VND)')}
                                // The server makes an open deposit exactly half (booking_set_price).
                                placeholder={String(booking.deposit_status === 'waiting' ? Math.round(total * 0.5) : Number(booking.deposit ?? 0))}
                                value={deposit}
                                onValueChange={setDeposit}
                                min={0}
                                step={1000}
                                description={t('Empty: an open deposit becomes half of the new total; a paid deposit stays.')}
                            />
                        )}
                        {problem && amount !== '' && <p className="bdMoneyHint isError">{problem}</p>}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={Boolean(problem) || unchanged} startContent={saving ? null : <LuTag aria-hidden="true" />}>
                            {t('Save price')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default PriceDialog;
