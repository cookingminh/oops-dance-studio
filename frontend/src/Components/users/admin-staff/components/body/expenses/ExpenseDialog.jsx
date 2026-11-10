import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCheck, LuPlus, LuRepeat } from 'react-icons/lu';
import DateField from '@/ui/DateField';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../common/Segmented';
import AmountField from './AmountField';
import CategoryPicker from './CategoryPicker';
import ClassField from './ClassField';
import ReceiptField from './ReceiptField';

// Add or edit one expense. The receipt is uploaded after the row is saved (it needs the id).
//   expense: the row to edit, or null   receiptUrl: signed link of its receipt (thumbnail)
//   onSave(fields, { file, remove }) → true when saved (the page closes the dialog)
//   preset: { classId } starts a new cost tied to that class (a class page's "Add a class cost")
const ExpenseDialog = ({ expense, today, classes, receiptUrl, onView, onClose, onSave, preset = null }) => {
    const { t } = useI18n();
    const editing = Boolean(expense);
    const [amount, setAmount] = useState(expense ? Number(expense.amount) : null);
    const [category, setCategory] = useState(expense?.category ?? null);
    const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today ?? '');
    const [description, setDescription] = useState(expense?.description ?? '');
    const [vendor, setVendor] = useState(expense?.vendor ?? '');
    const [method, setMethod] = useState(expense?.method ?? 'cash');
    const presetClass = expense ? null : preset?.classId ?? null;
    const [forClass, setForClass] = useState(Boolean(expense?.class_id ?? presetClass));
    const [classId, setClassId] = useState(expense?.class_id ? String(expense.class_id) : presetClass ? String(presetClass) : '');
    const [file, setFile] = useState(null);
    const [removeReceipt, setRemoveReceipt] = useState(false);
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);

    const problems = {
        amount: !(amount > 0),
        category: !category,
        date: !spentOn,
        description: !description.trim(),
        cls: forClass && !classId,
    };
    const valid = !Object.values(problems).some(Boolean);
    const show = (key) => tried && problems[key];

    const submit = async (event) => {
        event?.preventDefault();
        setTried(true);
        if (!valid || saving) return;
        setSaving(true);
        await onSave(
            {
                amount,
                category,
                spent_on: spentOn,
                description,
                vendor,
                method,
                class_id: forClass ? Number(classId) : null,
            },
            { file, remove: removeReceipt },
        );
        setSaving(false);
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" size="4xl" scrollBehavior="inside" classNames={{ base: 'exDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate className="exDialogForm">
                    <ModalHeader className="exDialogHeader">
                        <span className="exDialogKicker">{editing ? t('Edit expense') : t('New expense')}</span>
                        <span className="exDialogTitle">{editing ? expense.description : t('What did the studio pay for?')}</span>
                    </ModalHeader>
                    <ModalBody className="exDialogBody">
                        {expense?.recurring_id && (
                            <p className="exNote">
                                <LuRepeat aria-hidden="true" />
                                <span>{t('Added by a recurring cost. Changes here only change this month’s copy.')}</span>
                            </p>
                        )}

                        <div className="exDialogGrid">
                            <div className="exDialogCol">
                                <AmountField value={amount} onChange={setAmount} isInvalid={show('amount')} autoFocus={!editing} />
                                <CategoryPicker value={category} onChange={setCategory} isInvalid={show('category')} />
                            </div>
                            <div className="exDialogCol">
                                <div className="exFieldRow isDate">
                                    <DateField
                                        label={t('Date')}
                                        value={spentOn}
                                        onChange={setSpentOn}
                                        isInvalid={show('date')}
                                        errorMessage={show('date') ? t('Pick the date it was paid.') : undefined}
                                    />
                                    <div className="exField">
                                        <span className="exFieldLabel">{t('Paid by')}</span>
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
                                </div>
                                <Input
                                    label={t('Description')}
                                    placeholder={t('e.g. Camera crew for the end-of-month shoot')}
                                    value={description}
                                    onValueChange={setDescription}
                                    maxLength={200}
                                    isRequired
                                    isInvalid={show('description')}
                                    errorMessage={show('description') ? t('Say what it was for.') : undefined}
                                />
                                <Input
                                    label={t('Paid to')}
                                    placeholder={t('Optional: a shop, a person or a company')}
                                    value={vendor}
                                    onValueChange={setVendor}
                                    maxLength={100}
                                />
                                <ClassField classes={classes} enabled={forClass} onEnabled={setForClass} classId={classId} onClassId={setClassId} isInvalid={show('cls')} />
                                <ReceiptField
                                    existing={expense?.receipt_path ? { path: expense.receipt_path, url: receiptUrl } : null}
                                    file={file}
                                    removed={removeReceipt}
                                    onFile={setFile}
                                    onRemove={() => setRemoveReceipt(true)}
                                    onRestore={() => setRemoveReceipt(false)}
                                    onView={onView}
                                />
                            </div>
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
                            startContent={saving ? null : editing ? <LuCheck aria-hidden="true" /> : <LuPlus aria-hidden="true" />}
                        >
                            {editing ? t('Save changes') : t('Add expense')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default ExpenseDialog;
