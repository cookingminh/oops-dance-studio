import { useState } from 'react';
import { Button, Input, Select, SelectItem } from '@nextui-org/react';
import { LuCheck, LuPencil, LuTrash2 } from 'react-icons/lu';
import { EXPENSE_CATEGORIES, categoryOf, expenseTitle, isAutomaticRent } from '@/lib/expenseCategories';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AutoRentBadge, CategoryIcon, RecurringBadge } from '../../../expenses/ExpenseParts';
import { groupDigits, parseAmountInput } from '../../../expenses/expensesModel';

// One cost of the day, edited where it stands: the amount (digits grouped as you type, "50k" works), what it
// was for and, unless the server added it (the automatic studio rent), its category.
//   onSave(row, fields) → true when saved · onDelete(row) · busy: a write on this row is running
const DayCostRow = ({ row, busy, onSave, onDelete }) => {
    const { t } = useI18n();
    const automatic = isAutomaticRent(row);
    const title = expenseTitle(row, t);
    // The automatic rent's text is the server's English: it is edited as it reads in the user's language, and
    // kept as it is unless it was changed.
    const shownDescription = automatic ? title ?? '' : row.description ?? '';
    const [editing, setEditing] = useState(false);
    const [amount, setAmount] = useState(Number(row.amount));
    const [description, setDescription] = useState(shownDescription);
    const [category, setCategory] = useState(row.category);
    const [tried, setTried] = useState(false);

    const start = () => {
        setAmount(Number(row.amount));
        setDescription(shownDescription);
        setCategory(row.category);
        setTried(false);
        setEditing(true);
    };

    const problems = { amount: !(amount > 0), description: !description.trim() };
    const valid = !problems.amount && !problems.description;

    const submit = async (event) => {
        event.preventDefault();
        setTried(true);
        if (!valid || busy) return;
        const fields = { amount };
        if (description.trim() !== shownDescription.trim()) fields.description = description;
        if (!automatic) fields.category = category;
        if (await onSave(row, fields)) setEditing(false);
    };

    if (editing) {
        return (
            <li className="mcCost isEditing">
                <form className="mcCostForm" onSubmit={submit} noValidate aria-label={t('Edit {name}', { name: title })}>
                    <div className="mcCostFields">
                        <Input
                            label={t('Amount')}
                            inputMode="numeric"
                            autoComplete="off"
                            value={groupDigits(amount)}
                            onValueChange={(text) => setAmount(parseAmountInput(text))}
                            endContent={<span className="mcUnit">₫</span>}
                            isInvalid={tried && problems.amount}
                            errorMessage={tried && problems.amount ? t('Enter an amount above 0.') : undefined}
                            autoFocus
                            className="mcCostAmount"
                        />
                        <Input
                            label={t('Description')}
                            value={description}
                            onValueChange={setDescription}
                            maxLength={200}
                            isInvalid={tried && problems.description}
                            errorMessage={tried && problems.description ? t('Say what it was for.') : undefined}
                            className="mcCostWhat"
                        />
                        {!automatic && (
                            <Select
                                label={t('Category')}
                                selectedKeys={[categoryOf(category).key]}
                                disallowEmptySelection
                                onSelectionChange={(keys) => setCategory([...keys][0] ?? category)}
                                className="mcCostCategory"
                                classNames={{ popoverContent: 'adminPortal' }}
                            >
                                {EXPENSE_CATEGORIES.map((item) => (
                                    <SelectItem key={item.key}>{t(item.label)}</SelectItem>
                                ))}
                            </Select>
                        )}
                    </div>
                    {automatic && <p className="mcFine">{t('Lowered or raised by hand, the rent stays as you set it — unless the session moves to another room.')}</p>}
                    <div className="mcCostActions">
                        <Button size="sm" variant="light" onPress={() => setEditing(false)} isDisabled={busy}>
                            {t('Cancel')}
                        </Button>
                        <Button size="sm" type="submit" color="danger" isLoading={busy} startContent={busy ? null : <LuCheck aria-hidden="true" />}>
                            {t('Save')}
                        </Button>
                    </div>
                </form>
            </li>
        );
    }

    return (
        <li className="mcCost">
            <CategoryIcon category={row.category} size="sm" />
            <span className="mcCostMain">
                <strong>{title}</strong>
                <small>
                    {t(categoryOf(row.category).label)}
                    {row.vendor ? ` · ${row.vendor}` : ''}
                    {automatic && <AutoRentBadge />}
                    {row.recurring_id && <RecurringBadge />}
                </small>
            </span>
            <span className="mcMoney isOut">{formatVnd(row.amount)}</span>
            <span className="mcRowActions">
                <Button size="sm" variant="light" isIconOnly aria-label={t('Edit {name}', { name: title })} onPress={start} isDisabled={busy}>
                    <LuPencil />
                </Button>
                <Button size="sm" variant="light" isIconOnly className="mcDanger" aria-label={t('Delete {name}', { name: title })} onPress={() => onDelete(row)} isDisabled={busy}>
                    <LuTrash2 />
                </Button>
            </span>
        </li>
    );
};

export default DayCostRow;
