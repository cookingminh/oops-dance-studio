import { useState } from 'react';
import { Button, Input } from '@nextui-org/react';
import { LuArrowUpRight, LuClapperboard, LuPencil, LuPlus, LuX } from 'react-icons/lu';
import { setLessonVideo } from '@/services/classes';
import { cleanVideoUrl, isVideoUrl, youtubeId, youtubeWatch } from '@/lib/youtube';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import VideoThumb from '@/ui/VideoThumb';
import './lessons.scss';

// A routine's class video, filmed on its shoot day: add, change or remove its YouTube link.
// `lesson` is { id, title, video_url }. Saved videos appear in the "on camera" section of /classes.
const LessonVideo = ({ lesson, onSaved }) => {
    const toast = useToast();
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(lesson.video_url ?? '');
    const [saving, setSaving] = useState(false);

    const cleaned = cleanVideoUrl(value);
    const invalid = cleaned !== '' && !isVideoUrl(cleaned);
    const id = youtubeId(lesson.video_url);
    const title = lesson.title;

    const save = async (url) => {
        setSaving(true);
        try {
            await setLessonVideo(lesson.id, url);
            toast.success(url ? t('Video saved for “{title}”.', { title }) : t('Video removed.'));
            setEditing(false);
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const cancel = () => {
        setValue(lesson.video_url ?? '');
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="lessonVideoEdit">
                <Input
                    autoFocus
                    size="sm"
                    label={t('YouTube link')}
                    placeholder="https://youtu.be/…"
                    startContent={<LuClapperboard className="text-default-400" aria-hidden="true" />}
                    value={value}
                    onValueChange={setValue}
                    isInvalid={invalid}
                    errorMessage={invalid ? t('Paste a YouTube video link (youtube.com or youtu.be).') : undefined}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && cleaned && !invalid) save(cleaned);
                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            cancel();
                        }
                    }}
                />
                <div className="lessonVideoEditActions">
                    <Button size="sm" variant="light" onPress={cancel} isDisabled={saving}>
                        {t('Cancel')}
                    </Button>
                    <Button size="sm" color="danger" onPress={() => save(cleaned)} isLoading={saving} isDisabled={!cleaned || invalid || cleaned === lesson.video_url}>
                        {t('Save video')}
                    </Button>
                </div>
            </div>
        );
    }

    if (!id) {
        return (
            <button type="button" className="lessonVideoAdd" aria-label={t('Add the class video of “{title}”', { title })} onClick={() => setEditing(true)}>
                <LuPlus aria-hidden="true" />
                {t('Add the class video')}
            </button>
        );
    }

    return (
        <div className="lessonVideo">
            <a className="lessonVideoThumb" href={youtubeWatch(id)} target="_blank" rel="noreferrer" aria-label={t('Watch the class video of “{title}”', { title })}>
                <VideoThumb id={id} />
            </a>
            <span className="lessonVideoText">
                <strong>{t('Class video')}</strong>
                <a href={youtubeWatch(id)} target="_blank" rel="noreferrer">
                    {t('Watch on YouTube')} <LuArrowUpRight aria-hidden="true" />
                </a>
            </span>
            <Button isIconOnly size="sm" variant="light" aria-label={t('Change the class video of “{title}”', { title })} onPress={() => setEditing(true)}>
                <LuPencil className="text-default-400" />
            </Button>
            <Button isIconOnly size="sm" variant="light" aria-label={t('Remove the class video of “{title}”', { title })} isLoading={saving} onPress={() => save(null)}>
                <LuX className="text-default-400" />
            </Button>
        </div>
    );
};

export default LessonVideo;
