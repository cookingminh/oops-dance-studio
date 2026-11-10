import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@nextui-org/react';
import { LuCalendarX } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { cancelBooking } from '@/services/bookings';
import { cancelQuote } from '@/services/bookingRefunds';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import PolicyLines from '@/ui/refunds/PolicyLines';
import { noRefundHours, policyLines, quoteSettings, quoteStep } from '@/ui/refunds/refundText';
import '@/ui/payment/payment.scss';

// What comes back if the guest cancels now, said plainly: the amount (big), the step of the policy that
// gives it, what they paid. The server works it out (booking_cancel_quote) and applies the same rule
// when they confirm.
const RefundHero = ({ quote }) => {
    const { t } = useI18n();
    const received = Number(quote.received);
    const refund = Number(quote.refund);
    const step = quoteStep(quote);
    if (received <= 0) {
        return (
            <div className="rfHero isIdle" role="status">
                <strong className="rfHeroText">{t('You haven’t paid anything, so there’s nothing to refund.')}</strong>
            </div>
        );
    }
    if (refund <= 0) {
        return (
            <div className="rfHero isNone" role="status">
                <span className="rfHeroStep">{t(step.key, step.vars)}</span>
                <strong className="rfHeroText">{t('Less than {hours} hours to go, so there’s no refund.', { hours: noRefundHours(quoteSettings(quote)) })}</strong>
                <small>{t('(you paid {amount})', { amount: formatVnd(received) })}</small>
            </div>
        );
    }
    return (
        <div className="rfHero isBack" role="status">
            <span className="rfHeroStep">{t(step.key, step.vars)}</span>
            <strong className="rfHeroAmount">{t('You get {amount} back', { amount: formatVnd(refund) })}</strong>
            <small>{t('(you paid {amount})', { amount: formatVnd(received) })}</small>
        </div>
    );
};

// My bookings → Cancel: the booking, what comes back (and where to send it), the policy; "Keep the
// booking" is the default. onCancelled() reloads the list.
const CancelBookingDialog = ({ booking, settings, onClose, onCancelled }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const quote = useAsync(() => cancelQuote(booking.id), [booking.id]);
    const [refundTo, setRefundTo] = useState('');
    const [saving, setSaving] = useState(false);
    const refund = Number(quote.data?.refund ?? 0);
    // "Keep the booking" is the default: it takes the focus once the dialog has opened (the dialog focuses
    // itself first, so a plain autoFocus would be overridden).
    const keepRef = useRef(null);
    useEffect(() => {
        const timer = setTimeout(() => keepRef.current?.focus(), 80);
        return () => clearTimeout(timer);
    }, []);

    const confirm = async () => {
        setSaving(true);
        try {
            await cancelBooking(booking.id, { refundTo: refund > 0 ? refundTo.trim() || null : null });
            toast.success('Booking cancelled.');
            onCancelled();
            onClose();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const where = [booking.room?.name, formatDate(booking.date, 'long'), formatTimeRange(booking.start_time, booking.end_time), `#${booking.id}`].filter(Boolean);
    // The policy the quote was worked out with (or the one loaded with the page while it comes).
    const lines = quote.data ? policyLines(quoteSettings(quote.data), quote.data) : settings ? policyLines(settings) : [];

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && !saving && onClose()}
            size="lg"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'tuPayModal rfCancelModal adminPortal', closeButton: 'tuModalClose' }}
        >
            <ModalContent>
                <ModalHeader className="tuPayHead">
                    <span className="tuPayHeadIcon" aria-hidden="true">
                        <LuCalendarX />
                    </span>
                    <span>
                        <span className="tuPayTitle">{t('Cancel this booking?')}</span>
                        <span className="tuPaySub">{where.join(' · ')}</span>
                    </span>
                </ModalHeader>
                <ModalBody className="tuPayBody rfCancelBody">
                    {quote.data ? (
                        <RefundHero quote={quote.data} />
                    ) : quote.error ? (
                        <p className="rfHero isIdle" role="status">
                            {t('The refund couldn’t be worked out right now. It still follows the policy below.')}
                        </p>
                    ) : (
                        <div className="rfHero isLoading">
                            <Spinner size="sm" color="danger" />
                            <span>{t('Working out your refund…')}</span>
                        </div>
                    )}

                    {refund > 0 && (
                        <Input
                            label={t('Send the refund to')}
                            placeholder={t('Bank, account number, account name')}
                            value={refundTo}
                            onValueChange={setRefundTo}
                            maxLength={200}
                            description={t('Optional. Leave it empty and the studio will contact you.')}
                        />
                    )}

                    {lines.length > 0 && (
                        <section className="rfPolicyBox" aria-label={t('Cancellation policy')}>
                            <span className="rfPolicyTitle">{t('Cancellation policy')}</span>
                            <PolicyLines lines={lines} />
                        </section>
                    )}
                </ModalBody>
                <ModalFooter className="tuPayFoot rfCancelFoot">
                    <Button ref={keepRef} variant="flat" onPress={onClose} isDisabled={saving}>
                        {t('Keep the booking')}
                    </Button>
                    <Button color="danger" onPress={confirm} isLoading={saving} isDisabled={quote.loading && !quote.data}>
                        {t('Cancel the booking')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CancelBookingDialog;
