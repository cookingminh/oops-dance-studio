import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuBanknote, LuCheck, LuLandmark } from 'react-icons/lu';
import { bookingBalance, bookingTransferContent, recordBookingPayment } from '@/services/bookingPayments';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';

// Marking a booking completed while money is still due: take it now (cash, or a transfer staff saw with
// the code) and complete, or complete anyway — it then stays owed and shows in the to-do.
// onComplete() sets the status (useBookingActions) → true when it worked.
const CompleteDialog = ({ booking, onClose, onComplete, onChanged }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [busy, setBusy] = useState(null);
    const due = bookingBalance(booking);

    const settle = async (method) => {
        setBusy(method ?? 'anyway');
        try {
            if (method) {
                await recordBookingPayment(booking.id, due, { method });
                onChanged();
            }
            if (await onComplete()) onClose();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'bdMoneyDialog bdCompleteDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="bdMoneyHead">
                    <span>{t('{amount} still unpaid', { amount: formatVnd(due) })}</span>
                    <small>{t('Booking #{id}', { id: booking.id })} · {booking.payment_code}</small>
                </ModalHeader>
                <ModalBody className="bdMoneyBody">
                    <p className="bdMoneyHint">{t('Take the rest before completing the booking, or complete it anyway and it stays on the to-do list.')}</p>
                    <div className="bdCompleteChoices">
                        <Button color="danger" variant="flat" startContent={<LuBanknote aria-hidden="true" />} isLoading={busy === 'cash'} isDisabled={Boolean(busy)} onPress={() => settle('cash')}>
                            {t('Received {amount} in cash', { amount: formatVnd(due) })}
                        </Button>
                        <Button color="danger" variant="flat" startContent={<LuLandmark aria-hidden="true" />} isLoading={busy === 'transfer'} isDisabled={Boolean(busy)} onPress={() => settle('transfer')}>
                            {t('Received {amount} by transfer', { amount: formatVnd(due) })}
                        </Button>
                        <p className="bdMoneyHint">{t('Transfer content to look for: {content}', { content: bookingTransferContent(booking) })}</p>
                        <Button variant="bordered" startContent={<LuCheck aria-hidden="true" />} isLoading={busy === 'anyway'} isDisabled={Boolean(busy)} onPress={() => settle(null)}>
                            {t('Complete anyway')}
                        </Button>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {t('Cancel')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CompleteDialog;
