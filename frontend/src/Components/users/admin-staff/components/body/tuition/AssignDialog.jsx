import { useMemo, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalHeader } from '@nextui-org/react';
import { LuArrowDownLeft, LuSearch } from 'react-icons/lu';
import { amountDue } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { REASON_LABELS, fold, invoiceSearchText, suggestInvoices } from './tuitionModel';
import { StudentCell } from './TuitionParts';

const SHOWN = 30;

// Pick the invoice an unmatched transfer pays: likely matches first, then every unpaid invoice,
// searchable by student, class or code. Shows how the amount compares with what is due.
const AssignDialog = ({ transfer, unpaid, busy, onClose, onAssign }) => {
    const { t } = useI18n();
    const [query, setQuery] = useState('');
    const amount = Number(transfer.amount);

    const ranked = useMemo(() => {
        const suggested = suggestInvoices(transfer, unpaid, 10);
        const reasonsById = new Map(suggested.map((match) => [match.invoice.id, match.reasons]));
        const rest = unpaid.filter((invoice) => !reasonsById.has(invoice.id));
        return [...suggested.map((match) => match.invoice), ...rest].map((invoice) => ({ invoice, reasons: reasonsById.get(invoice.id) ?? [] }));
    }, [transfer, unpaid]);

    const term = fold(query.trim());
    const visible = (term ? ranked.filter(({ invoice }) => invoiceSearchText(invoice).includes(term)) : ranked).slice(0, SHOWN);

    const compare = (invoice) => {
        const diff = amount - amountDue(invoice);
        if (diff === 0) return { text: t('Exact amount'), tone: 'isExact' };
        return diff < 0
            ? { text: t('{amount} short', { amount: formatVnd(-diff) }), tone: 'isShort' }
            : { text: t('{amount} over', { amount: formatVnd(diff) }), tone: 'isOver' };
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} size="2xl" placement="center" scrollBehavior="inside" classNames={{ base: 'tuDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="tuAssignHead">
                    <span className="tuTransferIcon" aria-hidden="true">
                        <LuArrowDownLeft />
                    </span>
                    <span>
                        <strong>{t('Which invoice does {amount} pay?', { amount: formatVnd(amount) })}</strong>
                        <small className="tuMono">{transfer.content}</small>
                    </span>
                </ModalHeader>
                <ModalBody className="tuDialogBody">
                    <Input
                        autoFocus
                        isClearable
                        aria-label={t('Search unpaid invoices')}
                        placeholder={t('Student, class or code')}
                        startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                        value={query}
                        onValueChange={setQuery}
                        onClear={() => setQuery('')}
                    />
                    {visible.length === 0 ? (
                        <p className="tuFinePrint">{t('No unpaid invoice matches.')}</p>
                    ) : (
                        <ul className="tuAssignList">
                            {visible.map(({ invoice, reasons }) => {
                                const fit = compare(invoice);
                                return (
                                    <li key={invoice.id}>
                                        <StudentCell
                                            invoice={invoice}
                                            detail={<small>{[invoice.class_name, invoice.lesson_title, invoice.payment_code].filter(Boolean).join(' · ')}</small>}
                                        />
                                        <span className="tuAssignFit">
                                            <strong>{formatVnd(amountDue(invoice))}</strong>
                                            <small className={fit.tone}>{fit.text}</small>
                                        </span>
                                        <span className="tuReasons">
                                            {reasons.map((reason) => (
                                                <span key={reason} className={`tuReason is-${reason}`}>
                                                    {t(REASON_LABELS[reason])}
                                                </span>
                                            ))}
                                        </span>
                                        <Button
                                            size="sm"
                                            color="danger"
                                            variant="flat"
                                            isDisabled={busy}
                                            aria-label={t('Assign to {name}, {cls}', { name: invoice.student_name, cls: invoice.class_name })}
                                            onPress={() => onAssign(transfer, invoice)}
                                        >
                                            {t('Assign')}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <p className="tuFinePrint">{t('Less than what is due counts as a part payment.')}</p>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default AssignDialog;
