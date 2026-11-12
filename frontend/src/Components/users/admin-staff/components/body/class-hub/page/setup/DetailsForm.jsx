import { useState } from 'react';
import { Avatar, Button, Input, Select, SelectItem } from '@nextui-org/react';
import { LuCheck } from 'react-icons/lu';
import { updateClass } from '@/services/classes';
import { avatarUrl } from '@/services/storage';
import { placeColumns, placeKeyOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import DateField from '@/ui/DateField';
import PlaceField from '../../../../common/PlaceField';
import { personName } from '../../hubModel';

const POPOVER = { popoverContent: 'adminPortal' };

const fromClass = (cls) => ({
    name: cls.name,
    instructorId: cls.instructor_id,
    place: placeKeyOf(cls),
    price: String(cls.price),
    startsOn: cls.starts_on,
});

// The class's details in place. The start date can only move while the class hasn't started. Moving the
// class to another room or rented studio moves its sessions not started yet (the server does it).
const DetailsForm = ({ cls, today, instructors, rooms, venues, readOnly, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [form, setForm] = useState(() => fromClass(cls));
    const [saving, setSaving] = useState(false);
    const initial = fromClass(cls);
    const notStarted = cls.starts_on > today;
    const set = (field) => (value) => setForm((old) => ({ ...old, [field]: value }));
    const price = Number(form.price);
    const problems = {
        name: !form.name.trim(),
        price: form.price === '' || Number.isNaN(price) || price < 0,
        startsOn: notStarted && (!form.startsOn || form.startsOn < today),
    };
    const dirty = Object.keys(initial).some((key) => String(initial[key] ?? '') !== String(form[key] ?? ''));
    const valid = !Object.values(problems).some(Boolean) && form.instructorId;

    const save = async (event) => {
        event?.preventDefault();
        if (!valid || !dirty) return;
        setSaving(true);
        try {
            await updateClass(cls.id, {
                ...form,
                ...placeColumns(form.place),
                startsOn: notStarted ? form.startsOn : undefined,
            });
            toast.success('Class updated.');
            onSaved();
        } catch (error) {
            if (error.code === 'DUPLICATE') toast.error('A class with this name already exists.');
            else if (error.code === 'SLOT_TAKEN' && error.detail) toast.error(t('That room isn’t free at this class’s times: {detail}.', { detail: error.detail }));
            else toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="hubForm" onSubmit={save} noValidate>
            <Input label={t('Class Name')} value={form.name} onValueChange={set('name')} isReadOnly={readOnly} isInvalid={problems.name} maxLength={80} className="isWide" />
            <Select
                label={t('Instructor')}
                classNames={POPOVER}
                isDisabled={readOnly}
                selectedKeys={form.instructorId ? [form.instructorId] : []}
                onChange={(event) => event.target.value && set('instructorId')(event.target.value)}
                description={t('For one session only, use “Substitute instructor” in Sessions.')}
            >
                {instructors.map((person) => (
                    <SelectItem
                        key={person.id}
                        textValue={personName(person)}
                        startContent={<Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={personName(person)} />}
                    >
                        {personName(person)}
                    </SelectItem>
                ))}
            </Select>
            <PlaceField value={form.place} onChange={set('place')} rooms={rooms} venues={venues} isDisabled={readOnly} />
            <Input
                label={t('Price (VND)')}
                type="number"
                min={0}
                step={1000}
                value={form.price}
                onValueChange={set('price')}
                isReadOnly={readOnly}
                isInvalid={problems.price}
                description={t('The fee of a course unless the routine sets its own.')}
            />
            <DateField
                label={t('Starts on')}
                value={form.startsOn}
                onChange={set('startsOn')}
                isReadOnly={readOnly || !notStarted}
                isInvalid={problems.startsOn}
                description={notStarted ? t('Still upcoming: you can move the first day.') : t('The class has started; its first day stays.')}
            />
            {!readOnly && (
                <div className="hubFormActions isWide">
                    <Button variant="light" isDisabled={!dirty || saving} onPress={() => setForm(fromClass(cls))}>
                        {t('Undo changes')}
                    </Button>
                    <Button type="submit" color="danger" isLoading={saving} isDisabled={!dirty || !valid} startContent={saving ? null : <LuCheck aria-hidden="true" />}>
                        {t('Save details')}
                    </Button>
                </div>
            )}
        </form>
    );
};

export default DetailsForm;
