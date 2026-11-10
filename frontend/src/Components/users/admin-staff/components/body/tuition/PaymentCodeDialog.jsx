import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuFlaskConical, LuQrCode } from 'react-icons/lu';
import { amountDue, vietQrUrl } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { CopyValue, InvoiceHead } from './TuitionParts';

// The payment code and VietQR for one invoice, to show a student at the desk: any banking app
// scans it with the amount and the code filled in. Without a bank account: the code + cash.
const PaymentCodeDialog = ({ invoice, settings, sandbox, onClose, onSimulate }) => {
    const { t } = useI18n();
    const [loaded, setLoaded] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const url = vietQrUrl(settings, invoice);
    const due = amountDue(invoice);

    const simulate = async () => {
        setSimulating(true);
        const done = await onSimulate();
        setSimulating(false);
        if (done) onClose();
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'tuDialog tuCodeDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader>
                    <InvoiceHead invoice={invoice} title={t('Payment code')} />
                </ModalHeader>
                <ModalBody className="tuDialogBody">
                    <div className={`tuQrBox${url ? '' : ' isEmpty'}`}>
                        {url ? (
                            <>
                                {!loaded && <span className="tuQrLoading" aria-hidden="true" />}
                                <img src={url} alt={t('VietQR code: pay {amount} with code {code}', { amount: formatVnd(due), code: invoice.payment_code })} onLoad={() => setLoaded(true)} />
                            </>
                        ) : (
                            <LuQrCode aria-hidden="true" />
                        )}
                        {sandbox && <span className="tuDemoRibbon">{t('Demo — don’t transfer real money')}</span>}
                    </div>

                    <dl className="tuPayFacts">
                        <div className="isAmount">
                            <dt>{t('Amount to pay')}</dt>
                            <dd>{formatVnd(due)}</dd>
                        </div>
                        <div>
                            <dt>{t('Transfer content')}</dt>
                            <dd>
                                <CopyValue value={invoice.payment_code} mono label={t('the payment code')} className="tuBigCode" />
                            </dd>
                        </div>
                        {settings?.account_no && (
                            <div>
                                <dt>{settings.bank_name || settings.bank_code}</dt>
                                <dd>
                                    <CopyValue value={settings.account_no} mono label={t('the account number')} />
                                    {settings.account_name && <small>{settings.account_name}</small>}
                                </dd>
                            </div>
                        )}
                    </dl>
                    <p className="tuDialogText">
                        {url
                            ? t('Scan with any banking app and keep the code in the transfer content: the invoice is marked paid within seconds.')
                            : t('No bank account is set up yet: take the payment at the desk and record it as cash.')}
                    </p>
                </ModalBody>
                <ModalFooter>
                    {sandbox && url && (
                        <Button variant="flat" startContent={simulating ? null : <LuFlaskConical aria-hidden="true" />} isLoading={simulating} onPress={simulate} className="tuSimulate">
                            {t('Simulate the transfer')}
                        </Button>
                    )}
                    <Button color="danger" onPress={onClose}>
                        {t('Done')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default PaymentCodeDialog;
