import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Textarea } from '@nextui-org/react';
import { LuCalendarClock, LuClapperboard, LuEye, LuPencil, LuPlay, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { routineState, splitSong } from '@/lib/lessons';
import { PROMO_CAPTION_MAX, promoKind, promoOf, removePromo, setPromoCaption } from '@/services/promos';
import PromoUploader from '@/ui/promo/PromoUploader';
import PromoDialog from '@/ui/promo/PromoDialog';
import { PromoPlayer, PromoThumb } from '@/ui/promo/PromoPlayer';
import { classHue } from '../../profileHelpers';
import { promoDeadline } from './promoModel';
import './promoCard.scss';

// Brings the card into view when the overview's nudge links here (?promo=1).
function useScrollHere(ref) {
    const [params] = useSearchParams();
    const wanted = params.get('promo');
    useEffect(() => {
        if (!wanted) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, [wanted, ref]);
}

// The instructor's promo for their class's next routine: upload it, then watch, replace, edit the line
// for students or remove it. onChanged() reloads the class.
const InstructorPromo = ({ cls, state, onChanged }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const ref = useRef(null);
    const [mode, setMode] = useState('view'); // view | replace | caption
    const [caption, setCaption] = useState('');
    const [busy, setBusy] = useState(false);
    useScrollHere(ref);

    const next = state.next;
    if (!next) {
        return (
            <section ref={ref} id="promo" className="pfBlock pfPromo isQuiet" aria-label={t('Promo for the next routine')}>
                <span className="pfPromoIcon" aria-hidden="true">
                    <LuClapperboard />
                </span>
                <div>
                    <strong>{t('Promo for the next routine')}</strong>
                    <p className="pfMuted">{t('Once the studio plans the next routine, you upload its promo here: a short clip that shows students what they’ll learn.')}</p>
                </div>
            </section>
        );
    }

    const lesson = { id: next.lesson_id, class_id: cls.id, title: next.title };
    const promo = promoOf(next);
    const { song, artist } = splitSong(next.title);
    const deadline = promoDeadline(cls, state);
    const starts = formatDate(next.next_session ?? next.starts_on, 'short');

    const run = async (action, done) => {
        setBusy(true);
        try {
            await action();
            toast.success(done);
            setMode('view');
            onChanged?.();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
        }
    };

    const remove = () => {
        if (!window.confirm(t('Remove the promo of “{title}”? Students and visitors won’t see it any more.', { title: next.title }))) return;
        run(() => removePromo(lesson.id), t('Promo removed.'));
    };

    const head = (
        <header className="pfPromoHead">
            <div>
                <small className="pfEyebrow">{t('Promo for the next routine')}</small>
                <strong className="pfSong">{song}</strong>
                <span className="pfPromoWhen">
                    {artist && `${artist} · `}
                    {t('starts {date}', { date: starts })}
                </span>
            </div>
            {promo ? (
                <span className="pfPromoChip tone-good">
                    <LuEye aria-hidden="true" /> {t('Published')}
                </span>
            ) : (
                <span className={`pfPromoChip ${deadline.soon ? 'tone-urgent' : 'tone-due'}`}>
                    <LuCalendarClock aria-hidden="true" /> {deadline.soon ? t('Needed now') : t('Due {date}', { date: formatDate(deadline.date, 'short') })}
                </span>
            )}
        </header>
    );

    if (!promo || mode === 'replace') {
        return (
            <section ref={ref} id="promo" className="pfBlock pfPromo" style={{ '--hue': classHue(cls.id) }} aria-label={t('Promo for the next routine')}>
                {head}
                {!promo && (
                    <p className="pfPromoLead">
                        {deadline.soon
                            ? t('Students are deciding whether to continue now. Film a short clip of the new routine and upload it as soon as you can: it helps them say yes.')
                            : t('Film a short clip of the new routine and upload it before {date}: that’s when students are asked whether they continue.', {
                                date: formatDate(deadline.date, 'short'),
                            })}
                    </p>
                )}
                <PromoUploader
                    lesson={lesson}
                    initialCaption={promo?.caption ?? ''}
                    initialUrl={promo?.url ?? ''}
                    onDone={() => {
                        setMode('view');
                        onChanged?.();
                    }}
                    onCancel={promo ? () => setMode('view') : undefined}
                />
            </section>
        );
    }

    return (
        <section ref={ref} id="promo" className="pfBlock pfPromo hasPromo" style={{ '--hue': classHue(cls.id) }} aria-label={t('Promo for the next routine')}>
            {head}
            <div className={`pfPromoBody${promo.ytId && !promo.isShort ? ' isWide' : ''}`}>
                <PromoPlayer promo={promo} title={t('Promo of “{title}”', { title: next.title })} className="pfPromoPlayer" />
                <div className="pfPromoSide">
                    <p className="pfPromoMeta">
                        {[promo.at && t(promo.ytId ? 'Added {date}' : 'Uploaded {date}', { date: formatDate(new Date(promo.at), 'short') }), promoKind(promo, t)].filter(Boolean).join(' · ')}
                    </p>
                    {mode === 'caption' ? (
                        <div className="pfPromoCaptionEdit">
                            <Textarea
                                autoFocus
                                label={t('A line for students (optional)')}
                                value={caption}
                                onValueChange={(value) => setCaption(value.slice(0, PROMO_CAPTION_MAX))}
                                maxLength={PROMO_CAPTION_MAX}
                                minRows={2}
                                description={t('{count} of {max} characters', { count: caption.length, max: PROMO_CAPTION_MAX })}
                            />
                            <div className="prActions">
                                <Button size="sm" color="danger" isLoading={busy} onPress={() => run(() => setPromoCaption(next, caption), t('Saved.'))}>
                                    {t('Save')}
                                </Button>
                                <Button size="sm" variant="light" onPress={() => setMode('view')} isDisabled={busy}>
                                    {t('Cancel')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className={`pfPromoCaption${promo.caption ? '' : ' isEmpty'}`}>{promo.caption || t('No line for students yet.')}</p>
                    )}
                    <p className="pfPromoWho">{t('Your students see it in their class and when they renew. Visitors see it on the Classes page.')}</p>
                    {mode === 'view' && (
                        <div className="prActions">
                            <Button size="sm" variant="flat" startContent={<LuRefreshCw aria-hidden="true" />} onPress={() => setMode('replace')}>
                                {t('Replace clip')}
                            </Button>
                            <Button
                                size="sm"
                                variant="flat"
                                startContent={<LuPencil aria-hidden="true" />}
                                onPress={() => {
                                    setCaption(promo.caption);
                                    setMode('caption');
                                }}
                            >
                                {t('Edit line')}
                            </Button>
                            <Button size="sm" variant="light" color="danger" startContent={<LuTrash2 aria-hidden="true" />} onPress={remove} isLoading={busy}>
                                {t('Remove')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

// A student's view: the teacher's promo of the routine coming next, if there is one.
const StudentPromo = ({ cls, state }) => {
    const { t, tn, formatDate } = useI18n();
    const [watching, setWatching] = useState(false);
    const ref = useRef(null);
    useScrollHere(ref);
    const next = state.next;
    const promo = promoOf(next);
    if (!promo) return null;

    const { song, artist } = splitSong(next.title);
    const starts = formatDate(next.next_session ?? next.starts_on, 'short');
    const label = t('Watch the promo of “{title}”', { title: next.title });

    return (
        <section ref={ref} id="promo" className="pfBlock pfPromo isStudent" style={{ '--hue': classHue(cls.id) }} aria-label={t('Coming next')}>
            <PromoThumb promo={promo} label={label} onPlay={() => setWatching(true)} hue={classHue(cls.id)} />
            <div className="pfPromoSide">
                <small className="pfEyebrow">{t('Coming next')}</small>
                <strong className="pfSong">{song}</strong>
                <span className="pfPromoWhen">
                    {artist && `${artist} · `}
                    {tn(next.session_count, 'from {date} · {count} session', 'from {date} · {count} sessions', { date: starts })}
                </span>
                {promo.caption && (
                    <p className="pfPromoQuote">
                        “{promo.caption}”{cls.instructorName && <span> — {cls.instructorName}</span>}
                    </p>
                )}
                <button type="button" className="pfBtn isPrimary isSmall" onClick={() => setWatching(true)}>
                    <LuPlay aria-hidden="true" /> {t('Watch the promo')}
                </button>
            </div>
            {watching && (
                <PromoDialog
                    promo={promo}
                    portalClass="adminPortal"
                    eyebrow={`${t('Coming next')} · ${cls.name}`}
                    title={next.title}
                    meta={cls.instructorName ? t('From {date} · with {teacher}', { date: starts, teacher: cls.instructorName }) : t('From {date}', { date: starts })}
                    onClose={() => setWatching(false)}
                />
            )}
        </section>
    );
};

// The promo of a class's next routine (ClassView): instructors upload and manage it, students watch it.
const PromoCard = ({ cls, isInstructor, onChanged }) => {
    const state = routineState(cls.routines);
    return isInstructor ? <InstructorPromo cls={cls} state={state} onChanged={onChanged} /> : <StudentPromo cls={cls} state={state} />;
};

export default PromoCard;
