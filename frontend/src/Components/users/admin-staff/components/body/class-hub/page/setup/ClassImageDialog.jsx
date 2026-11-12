import { useRef, useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuImagePlus, LuRotateCcw } from 'react-icons/lu';
import { setClassImage } from '@/services/classes';
import { classImageUrl } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import ImagePicker from '@/ui/ImagePicker';
import ClassCard from '@/Components/HomePage/Components/Classes/Components/ClassCard';
import { FrameSlider, FramingDialog, FramingGroup } from './FramingParts';
import { CENTRE, clamp, coverOverflow, coverRoom, imagePositionFrom, publicRowOf, sameFrame, useDrag, useNaturalSize, useObjectUrl } from './framing';

// The class image and the part of it the website's class card shows (the image is a tall poster; the card a
// 16 : 10 crop of it). Left: a new image and the position sliders; right: the real card of the Classes page with
// this class, where dragging the picture moves it too. Save uploads the new image (if any) and the position.
const ClassImageDialog = ({ cls, onClose, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const saved = imagePositionFrom(cls);
    const [file, setFile] = useState(null);
    const [position, setPosition] = useState(saved);
    const [saving, setSaving] = useState(false);
    const media = useRef(null);

    const fileUrl = useObjectUrl(file);
    const src = fileUrl ?? classImageUrl(cls.image_path);
    const size = useNaturalSize(src);
    const room = coverRoom(size);
    const changed = Boolean(file) || !sameFrame(position, saved);

    const move = (axis, value) => setPosition((old) => ({ ...old, [axis]: clamp(value) }));

    // Dragging the picture one way shows more of the other side: the position moves against the pointer, by
    // the share of the picture's hidden part the pointer covered.
    const { dragging, handlers } = useDrag(
        () => {
            if (!size || !media.current || (!room.x && !room.y)) return null;
            return { from: position, overflow: coverOverflow(size, media.current.getBoundingClientRect()) };
        },
        (dx, dy, { from, overflow }) =>
            setPosition({
                x: overflow.x > 0.5 ? clamp(from.x - (dx / overflow.x) * 100) : from.x,
                y: overflow.y > 0.5 ? clamp(from.y - (dy / overflow.y) * 100) : from.y,
            })
    );

    const save = async () => {
        setSaving(true);
        try {
            await setClassImage(cls, file, position);
            toast.success('Class image updated.');
            onSaved();
        } catch (error) {
            toast.error(error);
            setSaving(false);
        }
    };

    const canMove = Boolean(src) && (room.x || room.y);

    return (
        <FramingDialog
            kind="card"
            kicker={cls.name}
            title={t('Class image')}
            size="5xl"
            saving={saving}
            canSave={changed}
            onSave={save}
            onClose={onClose}
            controls={
                <>
                    <FramingGroup title={t('Image')}>
                        <ImagePicker
                            label={cls.image_path ? t('Choose a new image') : t('Choose an image')}
                            color="default"
                            onChange={setFile}
                            isDisabled={saving}
                            startContent={<LuImagePlus aria-hidden="true" />}
                        />
                    </FramingGroup>
                    <FramingGroup
                        title={t('Position')}
                        actions={
                            <Button
                                size="sm"
                                variant="light"
                                startContent={<LuRotateCcw aria-hidden="true" />}
                                onPress={() => setPosition(CENTRE)}
                                isDisabled={saving || sameFrame(position, CENTRE)}
                            >
                                {t('Reset')}
                            </Button>
                        }
                    >
                        <FrameSlider
                            label={t('Left – right')}
                            value={position.x}
                            onChange={(value) => move('x', value)}
                            isDisabled={saving || !src || !room.x}
                            note={src && size && !room.x ? t('The whole width already shows.') : null}
                        />
                        <FrameSlider
                            label={t('Up – down')}
                            value={position.y}
                            onChange={(value) => move('y', value)}
                            isDisabled={saving || !src || !room.y}
                            note={src && size && !room.y ? t('The whole height already shows.') : null}
                        />
                        <p className="frmHint">{src ? t('Drag the picture in the preview, or use the sliders.') : t('Choose an image first.')}</p>
                    </FramingGroup>
                </>
            }
            previewTitle={t('Preview on the Classes page')}
            preview={
                <div className="frmCardStage">
                    <div className="frmCard">
                        <div inert="">
                            <ClassCard item={publicRowOf(cls, position)} imageSrc={fileUrl ?? undefined} />
                        </div>
                        {canMove && (
                            <div
                                ref={media}
                                className={`frmCardDrag${dragging ? ' isDragging' : ''}`}
                                aria-hidden="true"
                                data-testid="class-image-drag"
                                {...handlers}
                            />
                        )}
                    </div>
                </div>
            }
        />
    );
};

export default ClassImageDialog;
