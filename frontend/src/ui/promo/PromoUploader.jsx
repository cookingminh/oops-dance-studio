import { useEffect, useRef, useState } from 'react';
import { Button, Input, Textarea } from '@nextui-org/react';
import { LuAlertCircle, LuFilm, LuLink, LuRefreshCw, LuSmartphone, LuSun, LuTimer, LuUploadCloud } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { cleanVideoUrl, isVideoUrl, isYoutubeShort, youtubeId, youtubeThumb } from '@/lib/youtube';
import { clipLength, inspectPromo, PROMO_CAPTION_MAX, PROMO_ERRORS, PROMO_MAX_MB, publishPromo, publishPromoLink } from '@/services/promos';
import { PromoPlayer } from './PromoPlayer';
import './promo.scss';

const MB = 1024 * 1024;
const sizeText = (bytes) => (bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`);

// How to film a good promo, shown before a clip is picked.
export const PromoTips = () => {
    const { t } = useI18n();
    return (
        <ul className="prTips">
            <li>
                <LuTimer aria-hidden="true" /> {t('15–60 seconds: a bit of the dance and a word about it')}
            </li>
            <li>
                <LuSmartphone aria-hidden="true" /> {t('Phone upright or sideways, both work')}
            </li>
            <li>
                <LuSun aria-hidden="true" /> {t('Good light, and the music loud enough to hear')}
            </li>
            <li>
                <LuFilm aria-hidden="true" /> {t('Up to {mb} MB (about a minute from a phone)', { mb: PROMO_MAX_MB })}
            </li>
        </ul>
    );
};

// The caption field both ways share.
const CaptionField = ({ value, onChange, isDisabled }) => {
    const { t } = useI18n();
    return (
        <Textarea
            label={t('A line for students (optional)')}
            placeholder={t('e.g. Lots of footwork, beginners welcome!')}
            value={value}
            onValueChange={(next) => onChange(next.slice(0, PROMO_CAPTION_MAX))}
            maxLength={PROMO_CAPTION_MAX}
            minRows={2}
            isDisabled={isDisabled}
            description={t('{count} of {max} characters', { count: value.length, max: PROMO_CAPTION_MAX })}
        />
    );
};

// A promo two ways: upload a clip (pick → check type, size, length and that it plays → watch it and write a
// line → upload with progress), or paste a YouTube link (a Short or any video). `lesson` is { id, class_id,
// title }; `initialUrl` opens on the link (the promo is one now). onDone() after it is published; onCancel()
// hides it (no cancel button without it). `withTips` shows how to film one under the picker.
const PromoUploader = ({ lesson, initialCaption = '', initialUrl = '', onDone, onCancel, withTips = true }) => {
    const { t } = useI18n();
    const toast = useToast();
    const inputRef = useRef(null);
    const abortRef = useRef(null);
    const urlsRef = useRef([]);
    const [source, setSource] = useState(initialUrl ? 'link' : 'file');
    const [clip, setClip] = useState(null);
    const [link, setLink] = useState(initialUrl);
    const [caption, setCaption] = useState(initialCaption);
    const [phase, setPhase] = useState('idle'); // file: idle | checking | ready | uploading
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);

    const revokeUrls = () => {
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        urlsRef.current = [];
    };

    useEffect(
        () => () => {
            abortRef.current?.abort();
            revokeUrls();
        },
        []
    );

    const done = () => {
        toast.success(t('Promo published for “{title}”.', { title: lesson.title }));
        onDone?.();
    };

    const take = async (file) => {
        if (!file) return;
        setError('');
        setPhase('checking');
        try {
            const result = await inspectPromo(file);
            revokeUrls();
            const preview = URL.createObjectURL(result.file);
            const poster = result.poster ? URL.createObjectURL(result.poster) : null;
            urlsRef.current = [preview, poster].filter(Boolean);
            setClip({ ...result, name: file.name, preview: { src: preview, poster } });
            setPhase('ready');
        } catch (pickError) {
            setError(pickError.message);
            setPhase(clip ? 'ready' : 'idle');
        }
    };

    const onPick = (event) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // the same file can be picked again
        take(file);
    };

    const onDrop = (event) => {
        event.preventDefault();
        setDragging(false);
        if (source === 'file' && (phase === 'idle' || phase === 'ready')) take(event.dataTransfer.files?.[0]);
    };

    const publishClip = async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        setError('');
        setProgress(0);
        setPhase('uploading');
        try {
            await publishPromo(lesson, clip, { caption, onProgress: setProgress, signal: controller.signal });
            done();
        } catch (publishError) {
            if (publishError.code !== 'ABORTED') setError(publishError.message);
            setPhase('ready');
        } finally {
            abortRef.current = null;
        }
    };

    const publishLink = async () => {
        setError('');
        setSaving(true);
        try {
            await publishPromoLink(lesson, link, { caption });
            done();
        } catch (publishError) {
            setError(publishError.message);
        } finally {
            setSaving(false);
        }
    };

    const switchTo = (next) => {
        setError('');
        setSource(next);
    };

    const errorLine = error && (
        <p className="prError" role="alert">
            <LuAlertCircle aria-hidden="true" /> {t(error)}
        </p>
    );
    const cancelButton = onCancel && (
        <Button variant="light" onPress={onCancel}>
            {t('Cancel')}
        </Button>
    );
    const busy = phase === 'checking' || phase === 'uploading' || saving;
    const switcher = (phase === 'idle' || source === 'link') && (
        <div className="prSource" role="group" aria-label={t('How to add the promo')}>
            <button type="button" aria-pressed={source === 'file'} onClick={() => switchTo('file')} disabled={busy}>
                <LuUploadCloud aria-hidden="true" /> {t('Upload a clip')}
            </button>
            <button type="button" aria-pressed={source === 'link'} onClick={() => switchTo('link')} disabled={busy}>
                <SiYoutube aria-hidden="true" /> {t('YouTube link')}
            </button>
        </div>
    );

    // ---- A YouTube link -----------------------------------------------------------------
    if (source === 'link') {
        const cleaned = cleanVideoUrl(link);
        const valid = isVideoUrl(cleaned);
        const ytId = valid ? youtubeId(cleaned) : null;
        const preview = ytId ? { ytId, isShort: isYoutubeShort(cleaned), poster: youtubeThumb(ytId, 'hq') } : null;
        return (
            <div className="prUploader">
                {switcher}
                <Input
                    autoFocus
                    label={t('YouTube link')}
                    placeholder="https://youtube.com/shorts/…"
                    startContent={<LuLink className="text-default-400" aria-hidden="true" />}
                    value={link}
                    onValueChange={(value) => {
                        setLink(value);
                        setError('');
                    }}
                    isInvalid={cleaned !== '' && !valid}
                    errorMessage={cleaned !== '' && !valid ? t(PROMO_ERRORS.link) : undefined}
                    description={t('Post it on YouTube as public or unlisted, then paste the link. Shorts work.')}
                    isDisabled={saving}
                />
                {preview && (
                    <div className={`prUploader isReady${preview.isShort ? '' : ' isWideReady'}`}>
                        <PromoPlayer promo={preview} title={t('Your clip')} className="isPreview" />
                        <div className="prReadySide">
                            <CaptionField value={caption} onChange={setCaption} isDisabled={saving} />
                            {errorLine}
                            <div className="prActions">
                                <Button color="danger" onPress={publishLink} isLoading={saving} startContent={saving ? null : <SiYoutube aria-hidden="true" />}>
                                    {t('Publish promo')}
                                </Button>
                                {cancelButton}
                            </div>
                        </div>
                    </div>
                )}
                {!preview && (
                    <>
                        {errorLine}
                        {cancelButton && <div className="prActions">{cancelButton}</div>}
                    </>
                )}
            </div>
        );
    }

    // ---- An uploaded clip ---------------------------------------------------------------
    const picker = (
        <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" hidden onChange={onPick} data-testid="promo-file" />
    );

    if (phase === 'idle' || phase === 'checking') {
        return (
            <div className="prUploader">
                {switcher}
                {picker}
                <button
                    type="button"
                    className={`prDrop${dragging ? ' isOver' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    disabled={phase === 'checking'}
                    aria-busy={phase === 'checking'}
                >
                    <LuUploadCloud aria-hidden="true" />
                    <strong>{phase === 'checking' ? t('Checking the clip…') : t('Choose a video')}</strong>
                    <small>{t('MP4, MOV or WebM · up to {mb} MB', { mb: PROMO_MAX_MB })}</small>
                </button>
                {errorLine}
                {withTips && <PromoTips />}
                {cancelButton && <div className="prActions">{cancelButton}</div>}
            </div>
        );
    }

    const uploading = phase === 'uploading';
    const percent = Math.round(progress * 100);
    return (
        <div className="prUploader isReady" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            {picker}
            <PromoPlayer promo={clip.preview} title={t('Your clip')} className="isPreview" />
            <div className="prReadySide">
                <p className="prFile">
                    <strong>{clip.name}</strong>
                    <span>{[sizeText(clip.file.size), clipLength(clip.seconds)].filter(Boolean).join(' · ')}</span>
                </p>
                <CaptionField value={caption} onChange={setCaption} isDisabled={uploading} />
                {uploading ? (
                    <div className="prProgress">
                        <div className="prProgressBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('Uploading the promo')}>
                            <span style={{ width: `${percent}%` }} />
                        </div>
                        <p>
                            <span>{percent < 100 ? t('Uploading… {done} of {total}', { done: sizeText(clip.file.size * progress), total: sizeText(clip.file.size) }) : t('Almost done…')}</span>
                            <Button size="sm" variant="light" onPress={() => abortRef.current?.abort()} isDisabled={percent >= 100}>
                                {t('Cancel upload')}
                            </Button>
                        </p>
                    </div>
                ) : (
                    <>
                        {errorLine}
                        <div className="prActions">
                            <Button color="danger" onPress={publishClip} startContent={<LuUploadCloud aria-hidden="true" />}>
                                {t('Publish promo')}
                            </Button>
                            <Button variant="flat" onPress={() => inputRef.current?.click()} startContent={<LuRefreshCw aria-hidden="true" />}>
                                {t('Another clip')}
                            </Button>
                            {cancelButton}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PromoUploader;
