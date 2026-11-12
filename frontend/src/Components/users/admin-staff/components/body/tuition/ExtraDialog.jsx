import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuArrowRightLeft, LuCoins, LuUndo2 } from 'react-icons/lu';
import { amountDue, extraOf, listStudentInvoices } from '@/services/tuition';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../common/Segmented';
import { InvoiceHead } from './TuitionParts';

// An invoice paid more than it costs: move the extra onto one of the student's unpaid invoices, or record
// that it went back to them. A transfer put on the wrong course is better undone (onUndo): it goes back to
// the inbox and can be assigned again.
//   onMove({ to, amount }) · onRefund({ amount, method, note }) · onUndo() — each → true when it worked.
const ExtraDialog = ({ invoice, onClose, onMove, onRefund, onUndo }) => {
    const { t, monthName } = useI18n();
    const extra = extraOf(invoice);
    const [mode, setMode] = useState('move');
    const [targets, setTargets] = useState(null); // the student's other unpaid invoices
    const [to, setTo] = useState(null);
    const [amount, setAmount] = useState(String(extra));
    const [method, setMethod] = useState('cash');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let live = true;
        (invoice.student_id ? listStudentInvoices(invoice.student_id) : Promise.resolve([]))
            .then((rows) => {
                if (!live) return;
                const open = rows.filter((row) => row.status === 'unpaid' && row.id !== invoice.id);
                setTargets(open);
                if (open.length) {
                    setTo(open[0]);
                    setAmount(String(Math.min(extra, amountDue(open[0]))));
                } else {
                    setMode('refund');
                }
            })
            .catch(() => live && setTargets([]));
        return () => {
            live = false;
        };
    }, [invoice.id, invoice.student_id, extra]);

    const pick = (target) => {
        setTo(target);
        setAmount(String(Math.min(extra, amountDue(target))));
    };
    const switchMode = (next) => {
        setMode(next);
        setAmount(String(next === 'move' && to ? Math.min(extra, amountDue(to)) : extra));
    };

    const value = Number(amount);
    const limit = mode === 'move' && to ? Math.min(extra, amountDue(to)) : extra;
    const valid = Number.isInteger(value) && value > 0 && value <= limit && (mode === 'refund' || Boolean(to));
    const course = (row) => row.lesson_title || monthName(row.month, { withYear: true });

    const submit = async (event) => {
        event?.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        const done = mode === 'move' ? await onMove({ to, amount: value }) : await onRefund({ amount: value, method, note: note.trim() || null });
        setSaving(false);
        if (done) onClose();
    };

    let hint;
    if (!Number.isInteger(value) || value <= 0) hint = t('Enter a whole amount above 0.');
    else if (value > limit)
        hint = mode === 'move' && to && amountDue(to) < extra
            ? t('That course only needs {amount}.', { amount: formatVnd(amountDue(to)) })
            : t('Only {amount} is extra.', { amount: formatVnd(extra) });
    else if (value < extra) hint = t('{amount} stays extra on this invoice.', { amount: formatVnd(extra - value) });

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} size="lg" placement="center" scrollBehavior="inside" classNames={{ base: 'tuDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader>
                        <InvoiceHead invoice={invoice} title={t('Extra money')} />
                    </ModalHeader>
                    <ModalBody className="tuDialogBody">
                        <dl className="tuSums">
                            <div>
                                <dt>{t('Amount')}</dt>
                                <dd>{formatVnd(invoice.amount)}</dd>
                            </div>
                            <div>
                                <dt>{t('Received')}</dt>
                                <dd>{formatVnd(invoice.paid_amount)}</dd>
                            </div>
                            <div className="isTotal">
                                <dt>{t('Extra')}</dt>
                                <dd>{formatVnd(extra)}</dd>
                            </div>
                        </dl>

                        <div className="tuField">
                            <span className="tuFieldLabel">{t('What happens to it')}</span>
                            <Segmented
                                label={t('What happens to it')}
                                options={[
                                    { key: 'move', label: t('Pay another course') },
                                    { key: 'refund', label: t('Give it back') },
                                ]}
                                value={mode}
                                onChange={switchMode}
                            />
                        </div>

                        {mode === 'move' &&
                            (targets === null ? (
                                <p className="tuFinePrint">{t('Loading…')}</p>
                            ) : targets.length === 0 ? (
                                <p className="tuFinePrint">
                                    {t('{name} has no unpaid course to put it on. Leave it here and move it once the next course is billed, or give it back.', { name: invoice.student_name })}
                                </p>
                            ) : (
                                <div className="tuField">
                                    <span className="tuFieldLabel">{t('Put it on')}</span>
                                    <ul className="tuExtraTargets" role="radiogroup" aria-label={t('Put it on')}>
                                        {targets.map((target) => (
                                            <li key={target.id}>
                                                <button type="button" role="radio" aria-checked={to?.id === target.id} className={to?.id === target.id ? 'isOn' : undefined} onClick={() => pick(target)}>
                                                    <span>
                                                        <strong>{target.class_name}</strong>
                                                        <small>{course(target)}</small>
                                                    </span>
                                                    <span className="tuExtraDue">{t('{amount} due', { amount: formatVnd(amountDue(target)) })}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}

                        {mode === 'refund' && (
                            <div className="tuField">
                                <span className="tuFieldLabel">{t('Given back by')}</span>
                                <Segmented
                                    label={t('Given back by')}
                                    options={[
                                        { key: 'cash', label: t('Cash') },
                                        { key: 'transfer', label: t('Bank transfer') },
                                    ]}
                                    value={method}
                                    onChange={setMethod}
                                />
                            </div>
                        )}

                        {(mode === 'refund' || to) && (
                            <Input
                                type="number"
                                label={t('Amount (VND)')}
                                value={amount}
                                onValueChange={setAmount}
                                step={1000}
                                isInvalid={!valid && amount !== ''}
                                description={valid ? hint : undefined}
                                errorMessage={valid ? undefined : hint}
                            />
                        )}
                        {mode === 'refund' && (
                            <Input label={t('Note')} placeholder={t('Optional, e.g. handed back at the desk')} value={note} onValueChange={setNote} maxLength={300} />
                        )}

                        <p className="tuExtraUndo">
                            <span>{t('Put on the wrong course by mistake? Undo the payment: the transfer goes back to the inbox to be assigned again.')}</span>
                            <Button size="sm" variant="flat" startContent={<LuUndo2 aria-hidden="true" />} onPress={onUndo} isDisabled={saving}>
                                {t('Undo payment')}
                            </Button>
                        </p>
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
                            startContent={saving ? null : mode === 'move' ? <LuArrowRightLeft aria-hidden="true" /> : <LuCoins aria-hidden="true" />}
                        >
                            {mode === 'move' ? t('Move {amount}', { amount: formatVnd(valid ? value : 0) }) : t('Record {amount} given back', { amount: formatVnd(valid ? value : 0) })}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default ExtraDialog;
