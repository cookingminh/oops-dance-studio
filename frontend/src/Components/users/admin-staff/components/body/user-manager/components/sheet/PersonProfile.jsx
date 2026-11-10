import { Button } from '@nextui-org/react';
import { LuAlertTriangle } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import ContactSection from './ContactSection';
import ClassesSection from './ClassesSection';
import ActivitySection from './ActivitySection';
import TuitionSection from './TuitionSection';
import DeleteZone from './DeleteZone';

const MISSING_LABELS = { name: 'full name', phone: 'phone number' };

// The sheet's main view: what's missing, how to reach them, their classes, tuition and what they've done.
const PersonProfile = ({ person, people, isSelf, lockedDemo, today, activity, startEnrolling, onEdit, onChanged, onDeleted }) => {
    const { t } = useI18n();
    const missing = person.missing.map((key) => t(MISSING_LABELS[key]));

    return (
        <div className="sheetBody">
            {missing.length > 0 && (
                <div className="attentionNote" role="note">
                    <LuAlertTriangle aria-hidden="true" />
                    <p>
                        <strong>{t('Missing: {fields}', { fields: missing.join(t(' and ')) })}</strong>
                        <span>{t('Add it so the studio can reach them.')}</span>
                    </p>
                    <Button size="sm" variant="flat" onPress={() => onEdit(person.missing[0])}>
                        {t('Add now')}
                    </Button>
                </div>
            )}
            <ContactSection person={person} today={today} onEdit={onEdit} />
            <ClassesSection person={person} people={people} today={today} activity={activity} startEnrolling={startEnrolling} onChanged={onChanged} />
            <TuitionSection person={person} today={today} />
            <ActivitySection person={person} activity={activity} />
            <DeleteZone person={person} isSelf={isSelf} lockedDemo={lockedDemo} activity={activity} onDeleted={onDeleted} />
        </div>
    );
};

export default PersonProfile;
