import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuPencil } from 'react-icons/lu';
import { setBookingRefund } from '@/services/bookingRefunds';
import { bookingReceived } from '@/services/bookingPayments';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { REFUND_REASONS, refundProblem } from './refundModel';
import './refunds.scss';

// Change what is still due back on a cancelled or rejected booking (0 … what the studio still holds), always
// with a reason — e.g. the guest moved the money to another booking (booking_set_refund).
const RefundAmountDialog = ({ booking, onClose, onDone }) => {
    const { t } = useI18n();
    const toast = useToast();
    const received = bookingReceived(booking);
    const current = Number(booking.refund_due ?? 0);
    const [typed, setTyped] = useState(String(current));
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const problem = refundProblem({ typed, received, changed: true, note }, t, 'Say why the refund changes.');
    const quick = [
        { label: t('All of it: {amount}', { amount: formatVnd(received) }), amount: received },
        { label: t('Half: {amount}', { amount: formatVnd(Math.round(received / 2)) }), amount: Math.round(received / 2) },
        { label: t('No refund'), amount: 0 },
    ];

    const submit = async (event) => {
        event?.preventDefault();
        if (problem || saving) return;
        setSaving(true);
        try {
            await setBookingRefund(booking.id, Number(typed), note.trim());
            toast.success('Refund changed.');
            onDone();
            onClose();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()} placement="center" classNames={{ base: 'bdMoneyDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader className="bdMoneyHead">
                        <span>{t('Change the refund')}</span>
                        <small>
                            {t('Booking #{id}', { id: booking.id })} · {t('The studio holds {amount}', { amount: formatVnd(received) })}
                        </small>
                    </ModalHeader>
                    <ModalBody className="bdMoneyBody">
                        <Input type="number" label={t('Refund (VND)')} value={typed} onValueChange={setTyped} min={0} max={received} step={1000} autoFocus />
                        <div className="tuQuick" role="group" aria-label={t('Quick amounts')}>
                            {quick.map((option) => (
                                <button key={option.label} type="button" onClick={() => setTyped(String(option.amount))}>
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <Input label={t('Reason')} value={note} onValueChange={setNote} maxLength={300} isRequired />
                        <div className="tuQuick" role="group" aria-label={t('Common reasons')}>
                            {REFUND_REASONS.map((text) => (
                                <button key={text} type="button" onClick={() => setNote(t(text))}>
                                    {t(text)}
                                </button>
                            ))}
                        </div>
                        {problem && (typed !== String(current) || note) && <p className="bdMoneyHint isError">{problem}</p>}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={saving}>
                            {t('Close')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={Boolean(problem)} startContent={saving ? null : <LuPencil aria-hidden="true" />}>
                            {t('Save refund')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default RefundAmountDialog;
