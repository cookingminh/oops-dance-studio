import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuBadgePercent, LuGift } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { InvoiceHead } from './TuitionParts';

const WAIVE_REASONS = ['Scholarship', 'Injury', 'Staff family', 'Free trial course'];
const DISCOUNT_REASONS = ['Sibling discount', 'Joined mid-course', 'Loyal student'];
const DISCOUNTS = [10, 20, 50];

// Round to the nearest 1.000 ₫, the smallest amount people actually pay.
const round = (amount) => Math.max(1000, Math.round(amount / 1000) * 1000);

// Waive a course (mode 'waive') or change what it asks for (mode 'amount': a discount, a pro-rated
// late join…). The reason is kept as the invoice's note.
const AdjustDialog = ({ invoice, mode, onClose, onSubmit }) => {
    const { t } = useI18n();
    const isWaive = mode === 'waive';
    // The list price: the course's own fee, else the class price.
    const base = Number(invoice.course?.price ?? invoice.class?.price ?? invoice.amount) || Number(invoice.amount);
    const [amount, setAmount] = useState(String(invoice.amount));
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const value = Number(amount);
    const paid = Number(invoice.paid_amount);
    const valid = isWaive || (Number.isInteger(value) && value > 0 && value !== Number(invoice.amount));

    const submit = async (event) => {
        event?.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        const done = await onSubmit(isWaive ? { note: note.trim() || null } : { amount: value, note: note.trim() || null });
        setSaving(false);
        if (done) onClose();
    };

    const reasons = isWaive ? WAIVE_REASONS : DISCOUNT_REASONS;

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'tuDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader>
                        <InvoiceHead invoice={invoice} title={isWaive ? t('Waive this course') : t('Change amount')} />
                    </ModalHeader>
                    <ModalBody className="tuDialogBody">
                        {isWaive ? (
                            <p className="tuDialogText">
                                {t('{name} won’t pay for {course}, and stays in the class. You can reopen it later.', {
                                    name: invoice.student_name,
                                    course: invoice.lesson_title || invoice.class_name,
                                })}
                            </p>
                        ) : (
                            <>
                                <Input
                                    type="number"
                                    label={t('New amount (VND)')}
                                    value={amount}
                                    onValueChange={setAmount}
                                    step={1000}
                                    autoFocus
                                    description={t('Was {amount}', { amount: formatVnd(invoice.amount) }) + (paid > 0 ? ` · ${t('{amount} already paid', { amount: formatVnd(paid) })}` : '')}
                                />
                                <div className="tuQuick" role="group" aria-label={t('Quick discounts')}>
                                    {DISCOUNTS.map((pct) => (
                                        <button key={pct} type="button" onClick={() => setAmount(String(round(base * (1 - pct / 100))))}>
                                            −{pct}%
                                        </button>
                                    ))}
                                    {base !== Number(invoice.amount) && (
                                        <button type="button" onClick={() => setAmount(String(base))}>
                                            {t('List price {amount}', { amount: formatVnd(base) })}
                                        </button>
                                    )}
                                </div>
                                {paid > 0 && value > 0 && value <= paid && <p className="tuDialogText">{t('That is no more than what was paid: the invoice will count as paid.')}</p>}
                            </>
                        )}
                        <Input label={isWaive ? t('Reason') : t('Note')} placeholder={t('Optional')} value={note} onValueChange={setNote} maxLength={300} autoFocus={isWaive} />
                        <div className="tuQuick" role="group" aria-label={t('Common reasons')}>
                            {reasons.map((reason) => (
                                <button key={reason} type="button" onClick={() => setNote(t(reason))}>
                                    {t(reason)}
                                </button>
                            ))}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            color="danger"
                            isLoading={saving}
                            isDisabled={!valid}
                            startContent={saving ? null : isWaive ? <LuGift aria-hidden="true" /> : <LuBadgePercent aria-hidden="true" />}
                        >
                            {isWaive ? t('Waive this course') : t('Change amount')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default AdjustDialog;
