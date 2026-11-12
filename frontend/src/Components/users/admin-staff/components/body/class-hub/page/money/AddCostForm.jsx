import { useState } from 'react';
import { Button, Input, ModalBody, ModalFooter } from '@nextui-org/react';
import { LuArrowLeft, LuPlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../../common/Segmented';
import AmountField from '../../../expenses/AmountField';
import CategoryPicker from '../../../expenses/CategoryPicker';
import ReceiptField from '../../../expenses/ReceiptField';

// "Add a cost" inside the day dialog: a cost of this class on this day (water for the class, a speaker cable…).
// The same fields as the expenses page's dialog without the date and the class, which the day gives.
//   onSave(fields, file | null) → true when added · onBack()
const AddCostForm = ({ onSave, onBack }) => {
    const { t } = useI18n();
    const [amount, setAmount] = useState(null);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(null);
    const [method, setMethod] = useState('cash');
    const [file, setFile] = useState(null);
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);

    const problems = { amount: !(amount > 0), description: !description.trim(), category: !category };
    const valid = !Object.values(problems).some(Boolean);
    const show = (key) => tried && problems[key];

    const submit = async (event) => {
        event.preventDefault();
        setTried(true);
        if (!valid || saving) return;
        setSaving(true);
        const done = await onSave({ amount, description, category, method }, file);
        if (!done) setSaving(false);
    };

    return (
        <form className="mcDialogMain" onSubmit={submit} noValidate>
            <ModalBody className="mcDialogBody mcAddBody">
                <AmountField value={amount} onChange={setAmount} isInvalid={show('amount')} autoFocus />
                <div className="mcAddRow">
                    <Input
                        label={t('Description')}
                        placeholder={t('e.g. Water for the class')}
                        value={description}
                        onValueChange={setDescription}
                        maxLength={200}
                        isRequired
                        isInvalid={show('description')}
                        errorMessage={show('description') ? t('Say what it was for.') : undefined}
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
                <CategoryPicker value={category} onChange={setCategory} isInvalid={show('category')} />
                <ReceiptField existing={null} file={file} removed={false} onFile={setFile} onRemove={() => {}} onRestore={() => {}} onView={() => {}} />
            </ModalBody>
            <ModalFooter className="mcDialogFooter">
                <Button variant="light" startContent={<LuArrowLeft aria-hidden="true" />} onPress={onBack} isDisabled={saving}>
                    {t('Back to the day')}
                </Button>
                <Button type="submit" color="danger" isLoading={saving} startContent={saving ? null : <LuPlus aria-hidden="true" />}>
                    {t('Add cost')}
                </Button>
            </ModalFooter>
        </form>
    );
};

export default AddCostForm;
