import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuQrCode } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { amountDue, getInvoice, simulateTransfer, vietQrUrl } from '@/services/tuition';
import { forgetMyTuition } from '@/services/tuitionStudent';
import { EASE_OUT } from '../../../../../admin-staff/components/common/motion';
import { SandboxBox } from '@/ui/payment/PayExtras';
import { DeskPanel, PaidMoment, PayInfo, QrPanel, Waiting } from './PayParts';

const POLL_MS = 3000;

// Pay one invoice: the VietQR code with everything filled in, each detail with a copy button
// and three steps. While it is open it asks the server every few seconds, so the bank's
// confirmation (the webhook) turns it into a little "paid" moment by itself. In the sandbox a
// button pretends to be the bank. Without a bank account it says to pay at the desk.
const PayDialog = ({ invoice: initial, settings, sandbox, onClose, onPaid }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [invoice, setInvoice] = useState(initial);
    const [simulating, setSimulating] = useState(false);
    const announced = useRef(initial.status === 'paid');
    // The latest onPaid without restarting the polling each time the parent renders.
    const onPaidRef = useRef(onPaid);
    useEffect(() => {
        onPaidRef.current = onPaid;
    }, [onPaid]);

    const accept = useCallback(
        (fresh) => {
            setInvoice(fresh);
            if (fresh.status === 'paid' && !announced.current) {
                announced.current = true;
                forgetMyTuition();
                toast.success('Payment received. Thank you!');
                onPaidRef.current?.(fresh);
            }
        },
        [toast],
    );

    // Ask again every few seconds while it waits (not while the tab is in the background).
    const waiting = invoice.status === 'unpaid';
    useEffect(() => {
        if (!waiting) return undefined;
        let alive = true;
        const timer = setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const fresh = await getInvoice(initial.id);
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

    const simulate = async () => {
        setSimulating(true);
        try {
            await simulateTransfer(invoice.id);
            accept(await getInvoice(invoice.id));
        } catch (error) {
            toast.error(error);
        } finally {
            setSimulating(false);
        }
    };

    const qr = vietQrUrl(settings, invoice);
    const due = amountDue(invoice);

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="3xl"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'tuPayModal adminPortal', closeButton: 'tuModalClose' }}
        >
            <ModalContent>
                <ModalHeader className="tuPayHead">
                    <span className="tuPayHeadIcon" aria-hidden="true">
                        <LuQrCode />
                    </span>
                    <span>
                        <span className="tuPayTitle">{qr ? t('Pay by bank transfer') : t('Pay at the studio desk')}</span>
                        <span className="tuPaySub">
                            {invoice.class_name}
                            {invoice.lesson_title && ` · ${invoice.lesson_title}`}
                        </span>
                    </span>
                </ModalHeader>
                <ModalBody className="tuPayBody">
                    <AnimatePresence mode="wait" initial={false}>
                        {invoice.status === 'paid' ? (
                            <PaidMoment key="paid" invoice={invoice} onDone={onClose} />
                        ) : (
                            <motion.div
                                key="pay"
                                className="tuPayGrid"
                                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                                transition={{ duration: 0.3, ease: EASE_OUT }}
                            >
                                <div className="tuPayLeft">
                                    {qr ? <QrPanel qr={qr} due={due} sandbox={sandbox} /> : <DeskPanel invoice={invoice} due={due} />}
                                    <Waiting invoice={invoice} hasQr={Boolean(qr)} />
                                </div>
                                <PayInfo invoice={invoice} settings={settings} hasQr={Boolean(qr)} due={due}>
                                    {sandbox && invoice.status === 'unpaid' && (
                                        <SandboxBox
                                            text={t('No real money moves here. Pretend you sent the transfer and watch this page update by itself.')}
                                            label={t('Simulate the bank transfer')}
                                            busy={simulating}
                                            onSimulate={simulate}
                                        />
                                    )}
                                </PayInfo>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </ModalBody>
                {invoice.status !== 'paid' && (
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

export default PayDialog;
