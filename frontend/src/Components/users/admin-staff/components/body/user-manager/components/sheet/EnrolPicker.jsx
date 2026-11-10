import { useState } from 'react';
import { Button, Select, SelectItem } from '@nextui-org/react';
import { addStudent } from '@/services/classes';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { scheduleSummary } from '../../peopleModel';

// Enrols the person in one more class (the same write the Students page uses).
const EnrolPicker = ({ person, classes, nameById, onCancel, onEnrolled }) => {
    const { t, dayName } = useI18n();
    const toast = useToast();
    const [classId, setClassId] = useState('');
    const [saving, setSaving] = useState(false);
    const picked = classes.find((cls) => String(cls.id) === classId);

    const enrol = async () => {
        setSaving(true);
        try {
            await addStudent(picked.id, person.id);
            toast.success(t('{name} joined {className}.', { name: person.name, className: picked.name }));
            onEnrolled();
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'This student is already in the class.' : error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="enrolBox">
            <Select
                label={t('Class')}
                placeholder={t('Select a class')}
                selectedKeys={classId ? [classId] : []}
                onChange={(event) => setClassId(event.target.value)}
                classNames={{ popoverContent: 'adminPortal' }}
                autoFocus
            >
                {classes.map((cls) => (
                    <SelectItem
                        key={String(cls.id)}
                        textValue={cls.name}
                        description={[nameById.get(cls.instructor_id), scheduleSummary(cls.schedules, dayName)].filter(Boolean).join(' · ')}
                    >
                        {cls.name}
                    </SelectItem>
                ))}
            </Select>
            <div className="enrolActions">
                <Button size="sm" variant="light" onPress={onCancel} isDisabled={saving}>
                    {t('Cancel')}
                </Button>
                <Button size="sm" color="danger" onPress={enrol} isDisabled={!picked} isLoading={saving}>
                    {t('Enrol')}
                </Button>
            </div>
        </div>
    );
};

export default EnrolPicker;
