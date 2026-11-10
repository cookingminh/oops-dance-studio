import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuQrCode, LuZap } from 'react-icons/lu';
import { bookingDue, bookingQrUrl, bookingReceived, bookingTransferContent, findBooking, simulateBookingTransfer } from '@/services/bookingPayments';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import Segmented from '@/Components/users/admin-staff/components/common/Segmented';
import CopyRow from './CopyRow';
import { DeskPanel, QrPanel } from './QrPanel';
import { PaidCelebration, SandboxBox, WaitingNote } from './PayExtras';
import { payChoices } from './bookingMoney';
import './payment.scss';
import './bookingPay.scss';

const POLL_MS = 3000;

// Pay a room booking by bank transfer (staff showing it to a guest, or the guest from My bookings):
// the VietQR code for the deposit, the rest or the full amount, the bank details and the transfer
// content with its code, each with a copy button. It asks the server every few seconds while open, so
// the bank's confirmation shows by itself; in the sandbox a button pretends to be the bank.
// onChanged(fresh) whenever money came in (the page reloads its bookings).
const BookingPayDialog = ({ booking: initial, initialChoice = null, settings, sandbox, onClose, onChanged }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [booking, setBooking] = useState(initial);
    const [choiceKey, setChoiceKey] = useState(initialChoice);
    const [other, setOther] = useState('');
    const [simulating, setSimulating] = useState(false);
    const received = useRef(bookingReceived(initial));
    const onChangedRef = useRef(onChanged);
    useEffect(() => {
        onChangedRef.current = onChanged;
    }, [onChanged]);

    const accept = useCallback(
        (fresh) => {
            if (!fresh) return;
            setBooking((previous) => ({ ...previous, ...fresh }));
            const now = bookingReceived(fresh);
            if (now === received.current) return;
            if (now > received.current) toast.success('Transfer received. Thank you!');
            received.current = now;
            onChangedRef.current?.(fresh);
        },
        [toast],
    );

    const due = bookingDue(booking);
    const waiting = due.amount > 0;
    useEffect(() => {
        if (!waiting) return undefined;
        let alive = true;
        const timer = setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const fresh = await findBooking(String(initial.id));
                if (alive) accept(fresh);
            } catch {
                // A missed beat; the next one tries again.
            }
        }, POLL_MS);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [waiting, initial.id, accept]);

    // The deposit (while open) or everything left, or another amount typed in.
    const choices = [...payChoices(booking), { key: 'other', label: 'Other' }];
    const choice = choices.find((option) => option.key === choiceKey) ?? choices[0];
    const amount = choice.key === 'other' ? Math.max(Math.round(Number(other) || 0), 0) : choice.amount ?? 0;
    const qr = bookingQrUrl(settings, booking, amount);
    const content = bookingTransferContent(booking);
    const paid = bookingReceived(booking);

    const simulate = async () => {
        setSimulating(true);
        try {
            await simulateBookingTransfer(booking.id, amount);
            accept(await findBooking(String(booking.id)));
        } catch (error) {
            toast.error(error);
        } finally {
            setSimulating(false);
        }
    };

    const where = [
        t('Booking #{id}', { id: booking.id }),
        booking.room?.name,
        `${formatDate(booking.date, 'short')} ${formatTimeRange(booking.start_time, booking.end_time)}`,
    ].filter(Boolean);

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="3xl"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'tuPayModal bkPayModal adminPortal', closeButton: 'tuModalClose' }}
        >
            <ModalContent>
                <ModalHeader className="tuPayHead">
                    <span className="tuPayHeadIcon" aria-hidden="true">
                        <LuQrCode />
                    </span>
                    <span>
                        <span className="tuPayTitle">{qr || !waiting ? t('Pay by bank transfer') : t('Pay at the studio desk')}</span>
                        <span className="tuPaySub">{where.join(' · ')}</span>
                    </span>
                </ModalHeader>
                <ModalBody className="tuPayBody">
                    {!waiting ? (
                        <PaidCelebration
                            title={t('Paid in full. Thank you!')}
                            text={t('Everything for this booking has come in. See you in {room}!', { room: booking.room?.name ?? t('the studio') })}
                            amount={formatVnd(paid)}
                            onDone={onClose}
                        />
                    ) : (
                        <div className="tuPayGrid">
                            <div className="tuPayLeft">
                                {qr ? <QrPanel qr={qr} due={amount} sandbox={sandbox} /> : <DeskPanel code={booking.payment_code} due={amount} />}
                                <WaitingNote
                                    title={qr ? t('Waiting for the transfer…') : t('Waiting for the studio…')}
                                    text={qr ? t('This updates by itself a few seconds after the bank confirms.') : t('This updates by itself once the studio records it.')}
                                />
                            </div>
                            <div className="tuPayInfo">
                                <div className="bkPayChoice">
                                    <span>{t('What to pay')}</span>
                                    <Segmented
                                        label={t('What to pay')}
                                        options={choices.map((option) => ({ key: option.key, label: t(option.label), count: option.amount !== undefined ? formatVnd(option.amount) : undefined }))}
                                        value={choice.key}
                                        onChange={setChoiceKey}
                                    />
                                    {choice.key === 'other' && (
                                        <Input type="number" size="sm" label={t('Amount (VND)')} value={other} onValueChange={setOther} min={0} step={1000} autoFocus />
                                    )}
                                </div>
                                {paid > 0 && (
                                    <p className="tuPartial">
                                        {t('{paid} of {total} received. {left} left.', {
                                            paid: formatVnd(paid),
                                            total: formatVnd(booking.full_payment),
                                            left: formatVnd(Math.max(Number(booking.full_payment ?? 0) - paid, 0)),
                                        })}
                                    </p>
                                )}
                                {qr && (
                                    <dl className="tuCopyList">
                                        <CopyRow label={t('Bank')} value={settings.bank_name || settings.bank_code} />
                                        <CopyRow label={t('Account number')} value={settings.account_no} mono />
                                        {settings.account_name && <CopyRow label={t('Account name')} value={settings.account_name} />}
                                        <CopyRow label={t(choice?.label ?? 'Amount')} value={formatVnd(amount)} copyText={String(amount)} />
                                        <CopyRow label={t('Transfer content')} value={content} isKey />
                                    </dl>
                                )}
                                <p className="bkAutoNote">
                                    <LuZap aria-hidden="true" />
                                    <span>
                                        <strong>{t('Recorded automatically when the transfer arrives')}</strong>
                                        <small>{t('Keep {code} in the transfer content: it tells the studio which booking you are paying.', { code: booking.payment_code })}</small>
                                    </span>
                                </p>
                                {sandbox && (
                                    <SandboxBox
                                        text={t('No real money moves here. Pretend the guest sent this transfer and watch the booking update by itself.')}
                                        label={t('Simulate the transfer')}
                                        busy={simulating}
                                        onSimulate={simulate}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </ModalBody>
                {waiting && (
                    <ModalFooter className="tuPayFoot">
                        <Button variant="light" onPress={onClose}>
                            {t('Close')}
                        </Button>
                    </ModalFooter>
                )}
            </ModalContent>
        </Modal>
    );
};

export default BookingPayDialog;
