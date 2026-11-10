import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuBanknote } from 'react-icons/lu';
import { amountDue } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../common/Segmented';
import { InvoiceHead } from './TuitionParts';

// Record a payment at the desk (cash) or one seen in the bank app (transfer).
// The amount starts at what is still due; less is a part payment.
const PaymentDialog = ({ invoice, onClose, onSubmit }) => {
    const { t } = useI18n();
    const due = amountDue(invoice);
    const [amount, setAmount] = useState(String(due));
    const [method, setMethod] = useState('cash');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const value = Number(amount);
    const valid = Number.isInteger(value) && value > 0;
    const paid = Number(invoice.paid_amount);

    const submit = async (event) => {
        event?.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        const done = await onSubmit({ method, amount: value, note: note.trim() || null });
        setSaving(false);
        if (done) onClose();
    };

    const hint = !valid
        ? t('Enter a whole amount above 0.')
        : value < due
            ? t('Part payment: {amount} will still be due.', { amount: formatVnd(due - value) })
            : value > due
                ? t('That’s {amount} more than what is due.', { amount: formatVnd(value - due) })
                : t('Pays the invoice in full.');

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'tuDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader>
                        <InvoiceHead invoice={invoice} title={t('Record payment')} />
                    </ModalHeader>
                    <ModalBody className="tuDialogBody">
                        <dl className="tuSums">
                            <div>
                                <dt>{t('Amount')}</dt>
                                <dd>{formatVnd(invoice.amount)}</dd>
                            </div>
                            {paid > 0 && (
                                <div>
                                    <dt>{t('Already paid')}</dt>
                                    <dd>{formatVnd(paid)}</dd>
                                </div>
                            )}
                            <div className="isTotal">
                                <dt>{t('Still due')}</dt>
                                <dd>{formatVnd(due)}</dd>
                            </div>
                        </dl>
                        <div className="tuField">
                            <span className="tuFieldLabel" id="tu-method">{t('Paid by')}</span>
                            <Segmented
                                label={t('Paid by')}
                                options={[
                                    { key: 'cash', label: t('Cash') },
                                    { key: 'transfer', label: t('Bank transfer') },
                                ]}
                                value={method}
                                onChange={setMethod}
                            />
                        </div>
                        <Input
                            type="number"
                            label={t('Amount (VND)')}
                            value={amount}
                            onValueChange={setAmount}
                            step={1000}
                            isInvalid={!valid}
                            description={valid ? hint : undefined}
                            errorMessage={valid ? undefined : hint}
                            endContent={
                                value !== due && (
                                    <button type="button" className="tuInlineLink" onClick={() => setAmount(String(due))}>
                                        {t('Full amount')}
                                    </button>
                                )
                            }
                        />
                        <Input label={t('Note')} placeholder={t('Optional, e.g. paid by her mother')} value={note} onValueChange={setNote} maxLength={300} />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={!valid} startContent={saving ? null : <LuBanknote aria-hidden="true" />}>
                            {t('Record payment')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default PaymentDialog;
