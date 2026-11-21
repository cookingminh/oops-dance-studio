import { Button } from '@nextui-org/react';
import { LuQrCode, LuReceipt } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { payLabel } from '@/ui/payment/bookingMoney';

// A booking's buttons on My bookings (table row, phone card, calendar day dialog): Pay deposit / Pay the rest
// while money is due, the receipt, and Cancel while the guest may still cancel. Each opens the page's dialog
// (onPay / onReceipt / onCancel with the booking id). `compact`: the receipt as an icon (phone cards).
const BookingActions = ({ booking: b, cancellable, onPay, onReceipt, onCancel, compact = false }) => {
    const { t } = useI18n();
    const pay = payLabel(b);
    const receiptName = t('Receipt for booking #{id}', { id: b.id });
    return (
        <span className="myBookingActions">
            {pay && (
                <Button size="sm" color="danger" startContent={<LuQrCode aria-hidden="true" />} onPress={() => onPay(b.id)} aria-label={compact ? undefined : `${t(pay)} · #${b.id}`}>
                    {t(pay)}
                </Button>
            )}
            {compact ? (
                <Button size="sm" variant="light" isIconOnly aria-label={receiptName} onPress={() => onReceipt(b.id)}>
                    <LuReceipt aria-hidden="true" />
                </Button>
            ) : (
                <Button size="sm" variant="light" startContent={<LuReceipt aria-hidden="true" />} onPress={() => onReceipt(b.id)} aria-label={receiptName}>
                    {t('Receipt')}
                </Button>
            )}
            {cancellable(b) && (
                <Button size="sm" color="danger" variant="flat" onPress={() => onCancel(b.id)}>
                    {t('Cancel')}
                </Button>
            )}
        </span>
    );
};

export default BookingActions;
