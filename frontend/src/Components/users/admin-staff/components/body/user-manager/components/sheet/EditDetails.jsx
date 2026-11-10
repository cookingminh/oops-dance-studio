import { useState } from 'react';
import { Button, Input } from '@nextui-org/react';
import { LuArrowLeft, LuInfo } from 'react-icons/lu';
import { updateProfile, updateUserEmail } from '@/services/users';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import DateField from '@/ui/DateField';

const FIELDS = ['full_name', 'username', 'email', 'contact_number', 'date_of_birth'];

// Edit a person's details. The login email changes through the admin-users function (auth.users is
// the source); everything else is a profile update.
const EditDetails = ({ person, lockedDemo, focusField, onCancel, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const initial = Object.fromEntries(FIELDS.map((key) => [key, person[key] ?? '']));
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    const emailChanged = form.email.trim().toLowerCase() !== (person.email ?? '').toLowerCase();
    const profileChanged = FIELDS.some((key) => key !== 'email' && (form[key] ?? '').trim() !== (initial[key] ?? '').trim());
    const canSave = (emailChanged || profileChanged) && form.email.trim() !== '';

    const save = async (event) => {
        event.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            if (profileChanged) await updateProfile(person.id, form);
            if (emailChanged) await updateUserEmail(person.id, form.email);
            toast.success('Details saved.');
            onSaved();
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'That username is already taken.' : error);
            setSaving(false);
        }
    };

    return (
        <form className="sheetForm" onSubmit={save}>
            <div className="sheetBody">
                <div className="viewTitle">
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Back')} onPress={onCancel}>
                        <LuArrowLeft />
                    </Button>
                    <h3>{t('Edit details')}</h3>
                </div>
                <Input label={t('Full name')} value={form.full_name} onValueChange={set('full_name')} autoFocus={focusField === 'name'} />
                <Input
                    label={t('Username')}
                    value={form.username}
                    onValueChange={set('username')}
                    startContent={<span className="text-default-400 text-small">@</span>}
                />
                <Input
                    label={t('Email')}
                    type="email"
                    value={form.email}
                    onValueChange={set('email')}
                    isReadOnly={lockedDemo}
                    description={lockedDemo ? t('Demo accounts keep their email in the public demo.') : t('They sign in with this email.')}
                />
                {emailChanged && (
                    <p className="inlineNote">
                        <LuInfo aria-hidden="true" />
                        <span>{t('The login email changes as soon as you save. Let them know.')}</span>
                    </p>
                )}
                <Input label={t('Phone')} type="tel" value={form.contact_number} onValueChange={set('contact_number')} autoFocus={focusField === 'phone'} />
                <DateField label={t('Date of birth')} value={form.date_of_birth} onChange={set('date_of_birth')} autoFocus={focusField === 'birthday'} />
            </div>
            <div className="sheetFoot">
                <Button variant="light" onPress={onCancel} isDisabled={saving}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" color="danger" isLoading={saving} isDisabled={!canSave}>
                    {t('Save changes')}
                </Button>
            </div>
        </form>
    );
};

export default EditDetails;
