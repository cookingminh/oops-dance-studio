import { useRef, useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuImagePlus, LuRotateCcw, LuTrash2 } from 'react-icons/lu';
import { removeTimetablePhoto, setTimetablePhoto, setTimetablePhotoFrame } from '@/services/classes';
import { classImageUrl } from '@/services/storage';
import { formatTime } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import ImagePicker from '@/ui/ImagePicker';
import TimetableDisc from '@/ui/timetable/TimetableDisc';
import { PHOTO_FRAME } from '@/ui/timetable/timetableFrame';
import { weeklySlots } from '../../hubModel';
import { FrameSlider, FramingDialog, FramingGroup } from './FramingParts';
import { avatarNote, clamp, instructorPhotoOf, sameFrame, timetableFrameFrom, useDrag, useObjectUrl } from './framing';

// The class's round photo on the poster timetable (often a cut-out of the instructor): upload or replace it,
// frame it (zoom, left–right, up–down) or remove it to go back to the instructor's profile photo. Right: the disc
// as the poster shows it, with its time pill; dragging the photo moves it. Nothing is saved before Save.
const TimetablePhotoDialog = ({ cls, onClose, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const hasSaved = Boolean(cls.timetable_photo_path);
    const saved = timetableFrameFrom(cls);
    const [file, setFile] = useState(null);
    const [removed, setRemoved] = useState(false);
    const [frame, setFrame] = useState(saved);
    const [pickerKey, setPickerKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const disc = useRef(null);

    const fileUrl = useObjectUrl(file);
    const ownSrc = fileUrl ?? (hasSaved && !removed ? classImageUrl(cls.timetable_photo_path) : null);
    const photo = ownSrc ? { src: ownSrc, alt: '', frame } : instructorPhotoOf(cls);
    const changed = Boolean(file) || (removed && hasSaved) || (Boolean(ownSrc) && !sameFrame(frame, saved));
    const slot = weeklySlots(cls)[0];

    // A new photo starts centred, as wide as the circle.
    const pick = (next) => {
        setFile(next);
        if (!next) return;
        setRemoved(false);
        setFrame(PHOTO_FRAME);
    };

    const remove = () => {
        setFile(null);
        setRemoved(true);
        setFrame(PHOTO_FRAME);
        setPickerKey((key) => key + 1); // the picker forgets the file it showed
    };

    const set = (key, value, min = 0, max = 100) => setFrame((old) => ({ ...old, [key]: clamp(value, min, max) }));

    // The photo's point under the circle's middle moves against the pointer: dx px is dx / (photo width) of it.
    const { dragging, handlers } = useDrag(
        () => {
            const image = disc.current?.querySelector('.ttPhoto img');
            if (!ownSrc || !image) return null;
            const { width, height } = image.getBoundingClientRect();
            return width && height ? { from: frame, width, height } : null;
        },
        (dx, dy, { from, width, height }) => setFrame({ ...from, x: clamp(from.x - (dx / width) * 100), y: clamp(from.y - (dy / height) * 100) })
    );

    const save = async () => {
        setSaving(true);
        try {
            if (file) await setTimetablePhoto(cls, file, frame);
            else if (removed) await removeTimetablePhoto(cls);
            else await setTimetablePhotoFrame(cls, frame);
            toast.success(removed && !file ? 'The timetable shows the profile photo again.' : 'Timetable photo saved.');
            onSaved();
        } catch (error) {
            toast.error(error);
            setSaving(false);
        }
    };

    const off = saving || !ownSrc;

    return (
        <FramingDialog
            kind="disc"
            kicker={cls.name}
            title={t('Photo on the timetable')}
            saving={saving}
            canSave={changed}
            onSave={save}
            onClose={onClose}
            controls={
                <>
                    <FramingGroup title={t('Picture')}>
                        <ImagePicker
                            key={pickerKey}
                            label={ownSrc ? t('Choose another photo') : t('Choose a photo')}
                            color="default"
                            onChange={pick}
                            isDisabled={saving}
                            startContent={<LuImagePlus aria-hidden="true" />}
                        />
                        <p className="frmNote">{t('Best: a cut-out PNG with a transparent background, the face in the middle.')}</p>
                        {ownSrc && (
                            <Button
                                className="frmRemove"
                                size="sm"
                                variant="light"
                                color="danger"
                                startContent={<LuTrash2 aria-hidden="true" />}
                                onPress={remove}
                                isDisabled={saving}
                            >
                                {t('Remove photo')}
                            </Button>
                        )}
                    </FramingGroup>
                    <FramingGroup
                        title={t('Frame')}
                        actions={
                            <Button
                                size="sm"
                                variant="light"
                                startContent={<LuRotateCcw aria-hidden="true" />}
                                onPress={() => setFrame(PHOTO_FRAME)}
                                isDisabled={off || sameFrame(frame, PHOTO_FRAME)}
                            >
                                {t('Reset')}
                            </Button>
                        }
                    >
                        <FrameSlider label={t('Zoom')} value={frame.zoom} min={50} max={300} onChange={(value) => set('zoom', value, 50, 300)} isDisabled={off} />
                        <FrameSlider label={t('Left – right')} value={frame.x} onChange={(value) => set('x', value)} isDisabled={off} />
                        <FrameSlider label={t('Up – down')} value={frame.y} onChange={(value) => set('y', value)} isDisabled={off} />
                        <p className="frmHint">{ownSrc ? t('Drag the picture in the preview, or use the sliders.') : t('Choose a photo to frame it.')}</p>
                    </FramingGroup>
                </>
            }
            previewTitle={t('Preview on the timetable')}
            preview={
                <div className="frmPoster">
                    {slot && (
                        <span className="frmPosterTime" aria-hidden="true">
                            {formatTime(slot.start_time)}-{formatTime(slot.end_time)}
                        </span>
                    )}
                    <div
                        ref={disc}
                        className={`frmDisc${ownSrc ? ' canDrag' : ''}${dragging ? ' isDragging' : ''}`}
                        data-testid="timetable-photo-drag"
                        {...handlers}
                    >
                        <TimetableDisc name={cls.name} level={cls.level} photo={photo} />
                    </div>
                    {!ownSrc && <p className="frmPosterNote">{avatarNote(cls, t)}</p>}
                </div>
            }
        />
    );
};

export default TimetablePhotoDialog;
