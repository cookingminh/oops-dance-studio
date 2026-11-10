import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuUserPlus } from 'react-icons/lu';
import { addStudent } from '@/services/classes';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import PersonAutocomplete from '@/ui/PersonAutocomplete';
import { routineNow } from '../hubModel';

// Add a student. With a course running and the next one planned, staff choose where they start:
// now (they pay for the sessions left of the running course) or from the next course (paid in
// full, no roll calls before it). Guests already in the class aren't offered.
const EnrolDialog = ({ cls, guests, progress, onClose, onSaved }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const { current, planned } = routineNow(progress);
    const choices = current && planned;
    const [studentId, setStudentId] = useState(null);
    const [from, setFrom] = useState('now');
    const [saving, setSaving] = useState(false);
    const enrolled = new Set((cls.students ?? []).map((row) => row.student?.id));
    const candidates = guests.filter((guest) => !enrolled.has(guest.id));
    const left = current ? current.session_count - current.sessions_held : 0;

    const submit = async () => {
        setSaving(true);
        try {
            // From the next course: they join on its first day; the database bills that course in full.
            await addStudent(cls.id, studentId, choices && from === 'next' ? { joinedAt: planned.starts_on } : undefined);
            toast.success('Student added to the class.');
            onSaved();
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'This student is already in the class.' : error);
        } finally {
            setSaving(false);
        }
    };

    const options = choices
        ? [
            {
                key: 'now',
                title: t('From the running course'),
                detail: t('“{title}”: pays for the {count} sessions left.', { title: current.title, count: left }),
            },
            {
                key: 'next',
                title: t('From the next course'),
                detail: t('“{title}”, starting {date}: pays the full course.', { title: planned.title, date: formatDate(planned.starts_on, 'dayMonth') }),
            },
        ]
        : [];

    let hint = null;
    if (!choices && current) hint = t('They join “{title}” now and pay for the {count} sessions left.', { title: current.title, count: left });
    else if (!choices && planned) hint = t('They are billed for “{title}”, starting {date}.', { title: planned.title, date: formatDate(planned.starts_on, 'dayMonth') });
    else if (!choices) hint = t('This class has no course yet: they are billed when its first routine is planned.');

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'hubDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader>{t('Add a student to {name}', { name: cls.name })}</ModalHeader>
                <ModalBody>
                    <PersonAutocomplete label={t('Student')} people={candidates} value={studentId} onChange={setStudentId} isRequired />
                    {candidates.length === 0 && <p className="hubHint">{t('Every guest is already enrolled.')}</p>}
                    {choices ? (
                        <div className="hubChoices" role="radiogroup" aria-label={t('Starts')}>
                            {options.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={from === option.key}
                                    className={`hubChoice${from === option.key ? ' isSelected' : ''}`}
                                    onClick={() => setFrom(option.key)}
                                >
                                    <span className="hubChoiceDot" aria-hidden="true" />
                                    <span>
                                        <strong>{option.title}</strong>
                                        <small>{option.detail}</small>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="hubHint">{hint}</p>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" startContent={saving ? null : <LuUserPlus aria-hidden="true" />} onPress={submit} isLoading={saving} isDisabled={!studentId}>
                        {t('Add Student')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default EnrolDialog;
