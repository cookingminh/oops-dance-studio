import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuClapperboard, LuRefreshCw, LuUploadCloud, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { promoKind, promoOf, removePromo } from '@/services/promos';
import PromoUploader from '@/ui/promo/PromoUploader';
import PromoDialog from '@/ui/promo/PromoDialog';
import { PromoThumb } from '@/ui/promo/PromoPlayer';

// A routine's promo in the routines panel: the clip the instructor filmed of it (watch, replace,
// remove), or — for a planned routine — that it's still missing, with an upload for staff.
// `routine` is a routine row with promo_* (routineData.withLesson); `teacher` the class's instructor.
const RoutinePromo = ({ routine, teacher, onSaved }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [uploading, setUploading] = useState(false);
    const [watching, setWatching] = useState(false);
    const [removing, setRemoving] = useState(false);
    const promo = promoOf(routine);
    const title = routine.title;
    const lesson = { id: routine.lesson_id ?? routine.id, class_id: routine.class_id, title };

    if (uploading) {
        return (
            <div className="rtPromo isUploading">
                <PromoUploader
                    lesson={lesson}
                    initialCaption={promo?.caption ?? ''}
                    initialUrl={promo?.url ?? ''}
                    withTips={false}
                    onDone={() => {
                        setUploading(false);
                        onSaved();
                    }}
                    onCancel={() => setUploading(false)}
                />
            </div>
        );
    }

    if (!promo) {
        if (routine.status !== 'planned') return null;
        return (
            <div className="rtPromo isMissing">
                <LuClapperboard aria-hidden="true" />
                <span className="rtPromoText">
                    <strong>{t('No promo yet')}</strong>
                    <small>{teacher ? t('{teacher} films a short clip of it for students.', { teacher }) : t('The instructor films a short clip of it for students.')}</small>
                </span>
                <Button size="sm" variant="flat" startContent={<LuUploadCloud aria-hidden="true" />} onPress={() => setUploading(true)} aria-label={t('Upload the promo of “{title}”', { title })}>
                    {t('Upload')}
                </Button>
            </div>
        );
    }

    const remove = async () => {
        if (!window.confirm(t('Remove the promo of “{title}”? Students and visitors won’t see it any more.', { title }))) return;
        setRemoving(true);
        try {
            await removePromo(lesson.id);
            toast.success(t('Promo removed.'));
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setRemoving(false);
        }
    };

    const by = [promo.author && t(promo.ytId ? 'Added by {name}' : 'Uploaded by {name}', { name: promo.author }), promo.at && formatDate(new Date(promo.at), 'short')].filter(Boolean).join(' · ');

    return (
        <div className="rtPromo">
            <PromoThumb promo={promo} size="sm" onPlay={() => setWatching(true)} label={t('Watch the promo of “{title}”', { title })} />
            <span className="rtPromoText">
                <strong>{[t('Promo'), promoKind(promo, t)].filter(Boolean).join(' · ')}</strong>
                {by && <small>{by}</small>}
                {promo.caption && <small className="rtPromoCaption">“{promo.caption}”</small>}
            </span>
            <Button isIconOnly size="sm" variant="light" aria-label={t('Replace the promo of “{title}”', { title })} onPress={() => setUploading(true)}>
                <LuRefreshCw className="text-default-400" />
            </Button>
            <Button isIconOnly size="sm" variant="light" aria-label={t('Remove the promo of “{title}”', { title })} isLoading={removing} onPress={remove}>
                <LuX className="text-default-400" />
            </Button>
            {watching && (
                <PromoDialog
                    promo={promo}
                    portalClass="adminPortal"
                    eyebrow={t('Promo')}
                    title={title}
                    meta={t('From {date}', { date: formatDate(routine.next_session ?? routine.starts_on, 'short') })}
                    onClose={() => setWatching(false)}
                />
            )}
        </div>
    );
};

export default RoutinePromo;
