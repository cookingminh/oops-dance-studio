import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuUserCircle } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import TimetableDisc from '@/ui/timetable/TimetableDisc';
import SectionCard from '../../../../common/SectionCard';
import { avatarNote, timetablePhotoOf } from './framing';
import TimetablePhotoDialog from './TimetablePhotoDialog';
import './framing.scss';

// Setup tab: the class's round photo on the website's poster timetable, as the poster shows it, and the dialog
// that uploads and frames it.
const TimetablePhotoCard = ({ cls, onChanged }) => {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const own = Boolean(cls.timetable_photo_path);
    return (
        <SectionCard
            icon={LuUserCircle}
            title={t('Photo on the timetable')}
            subtitle={t('The round photo on the website’s poster timetable')}
            actions={
                <Button variant="flat" startContent={<LuUserCircle aria-hidden="true" />} onPress={() => setOpen(true)}>
                    {own ? t('Change the round photo') : t('Upload a photo')}
                </Button>
            }
        >
            <div className="hubTtPhoto">
                <span className="hubTtStage">
                    <TimetableDisc name={cls.name} level={cls.level} photo={timetablePhotoOf(cls)} />
                </span>
                <p className="hubHint">{own ? t('This class has a photo of its own, framed for the circle.') : avatarNote(cls, t)}</p>
            </div>
            {open && (
                <TimetablePhotoDialog
                    cls={cls}
                    onClose={() => setOpen(false)}
                    onSaved={() => {
                        setOpen(false);
                        onChanged();
                    }}
                />
            )}
        </SectionCard>
    );
};

export default TimetablePhotoCard;
