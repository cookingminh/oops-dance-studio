import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@nextui-org/react';
import { LuCheck, LuInfo, LuPlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../common/Segmented';
import AmountField from './AmountField';
import CategoryPicker from './CategoryPicker';
import ClassField from './ClassField';
import { capitalizeFirst, monthRange, shiftMonth } from './expensesModel';

const DAYS = Array.from({ length: 28 }, (_, index) => String(index + 1));

// Add or edit a recurring cost (admin): what, how much, on which day, from / until which month.
const RecurringDialog = ({ item, thisMonth, today, classes, onClose, onSave }) => {
    const { t, monthName } = useI18n();
    const editing = Boolean(item);
    const [amount, setAmount] = useState(item ? Number(item.amount) : null);
    const [category, setCategory] = useState(item?.category ?? null);
    const [description, setDescription] = useState(item?.description ?? '');
    const [vendor, setVendor] = useState(item?.vendor ?? '');
    const [method, setMethod] = useState(item?.method ?? 'transfer');
    const [day, setDay] = useState(String(item?.day_of_month ?? 1));
    const [startsOn, setStartsOn] = useState(item?.starts_on ?? thisMonth);
    const [endsOn, setEndsOn] = useState(item?.ends_on ?? 'none');
    const [forClass, setForClass] = useState(Boolean(item?.class_id));
    const [classId, setClassId] = useState(item?.class_id ? String(item.class_id) : '');
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);

    const first = item?.starts_on && item.starts_on < shiftMonth(thisMonth, -12) ? item.starts_on : shiftMonth(thisMonth, -12);
    const startOptions = monthRange(first, shiftMonth(thisMonth, 12));
    const endOptions = monthRange(startsOn, shiftMonth(thisMonth, 24));
    const label = (month) => capitalizeFirst(monthName(month, { withYear: true }));

    const problems = {
        amount: !(amount > 0),
        category: !category,
        description: !description.trim(),
        cls: forClass && !classId,
    };
    const valid = !Object.values(problems).some(Boolean);
    const show = (key) => tried && problems[key];

    const dayDate = `${thisMonth.slice(0, 8)}${day.padStart(2, '0')}`;
    let note = null;
    if (startsOn < thisMonth && !editing) note = t('Earlier months aren’t added back: add those by hand if you need them.');
    else if (startsOn <= thisMonth && today && dayDate <= today && (endsOn === 'none' || endsOn >= thisMonth)) {
        note = t('Its day has already come this month: it is added tonight, or straight away with “Add this month’s now”.');
    }

    const submit = async (event) => {
        event?.preventDefault();
        setTried(true);
        if (!valid || saving) return;
        setSaving(true);
        await onSave({
            amount,
            category,
            description,
            vendor,
            method,
            day_of_month: Number(day),
            starts_on: startsOn,
            ends_on: endsOn === 'none' || endsOn < startsOn ? null : endsOn,
            class_id: forClass ? Number(classId) : null,
        });
        setSaving(false);
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" size="4xl" scrollBehavior="inside" classNames={{ base: 'exDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate className="exDialogForm">
                    <ModalHeader className="exDialogHeader">
                        <span className="exDialogKicker">{editing ? t('Edit recurring cost') : t('New recurring cost')}</span>
                        <span className="exDialogTitle">{editing ? item.description : t('A cost that comes back every month')}</span>
                    </ModalHeader>
                    <ModalBody className="exDialogBody">
                        <div className="exDialogGrid">
                            <div className="exDialogCol">
                                <AmountField value={amount} onChange={setAmount} isInvalid={show('amount')} autoFocus={!editing} />
                                <CategoryPicker value={category} onChange={setCategory} isInvalid={show('category')} />
                            </div>
                            <div className="exDialogCol">
                                <Input
                                    label={t('Description')}
                                    placeholder={t('e.g. Studio rent, 7th floor')}
                                    value={description}
                                    onValueChange={setDescription}
                                    maxLength={200}
                                    isRequired
                                    isInvalid={show('description')}
                                    errorMessage={show('description') ? t('Say what it is for.') : undefined}
                                />
                                <Input label={t('Paid to')} placeholder={t('Optional: a shop, a person or a company')} value={vendor} onValueChange={setVendor} maxLength={100} />
                                <div className="exFieldRow isDate">
                                    <Select
                                        label={t('Day of the month')}
                                        selectedKeys={[day]}
                                        disallowEmptySelection
                                        onChange={(event) => setDay(event.target.value || '1')}
                                        classNames={{ popoverContent: 'adminPortal' }}
                                    >
                                        {DAYS.map((value) => (
                                            <SelectItem key={value}>{value}</SelectItem>
                                        ))}
                                    </Select>
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
                                <div className="exFieldRow">
                                    <Select
                                        label={t('First month')}
                                        selectedKeys={[startsOn]}
                                        disallowEmptySelection
                                        onChange={(event) => setStartsOn(event.target.value || thisMonth)}
                                        classNames={{ popoverContent: 'adminPortal' }}
                                    >
                                        {startOptions.map((month) => (
                                            <SelectItem key={month}>{label(month)}</SelectItem>
                                        ))}
                                    </Select>
                                    <Select
                                        label={t('Final month')}
                                        selectedKeys={[endsOn === 'none' || endsOn < startsOn ? 'none' : endsOn]}
                                        disallowEmptySelection
                                        onChange={(event) => setEndsOn(event.target.value || 'none')}
                                        classNames={{ popoverContent: 'adminPortal' }}
                                    >
                                        {[
                                            <SelectItem key="none">{t('No end date')}</SelectItem>,
                                            ...endOptions.map((month) => <SelectItem key={month}>{label(month)}</SelectItem>),
                                        ]}
                                    </Select>
                                </div>
                                {note && (
                                    <p className="exNote">
                                        <LuInfo aria-hidden="true" />
                                        <span>{note}</span>
                                    </p>
                                )}
                                <ClassField classes={classes} enabled={forClass} onEnabled={setForClass} classId={classId} onClassId={setClassId} isInvalid={show('cls')} />
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} startContent={saving ? null : editing ? <LuCheck aria-hidden="true" /> : <LuPlus aria-hidden="true" />}>
                            {editing ? t('Save changes') : t('Add recurring cost')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default RecurringDialog;
