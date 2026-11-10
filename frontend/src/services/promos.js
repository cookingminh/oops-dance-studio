import { parseISO, subDays } from 'date-fns';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { toIsoDate } from '@/lib/format';
import { cleanVideoUrl, isVideoUrl, isYoutubeShort, youtubeId, youtubeThumb } from '@/lib/youtube';
import { AppError, toAppError, unwrap } from './errors';
import { publicUrl, removeFiles } from './storage';
import { getStudioToday } from './studio';

// Routine promos (supabase/migrations/20261117000700_routine_promos.sql, api-contract §5 lesson_set_promo):
// before a class starts its next routine, its instructor films a short clip of the piece. A promo is an
// uploaded clip (with its poster frame, in the public class-promos bucket under {class_id}/{lesson_id}/)
// or a YouTube link (a Short or any video). The class's instructor or staff set it; everyone can watch.

export const PROMO_BUCKET = 'class-promos';
export const PROMO_MAX_MB = 50; // the bucket's limit (and Supabase Free's per-file limit)
export const PROMO_MAX_SECONDS = 180;
export const PROMO_CAPTION_MAX = 200;
// Promos of routines that started this many days ago still show on /classes ("still time to join").
export const PROMO_PUBLIC_GRACE_DAYS = 7;

// class_lessons columns of a promo, and who uploaded it (null where profiles aren't readable).
export const PROMO_COLUMNS =
    'promo_path, promo_poster_path, promo_url, promo_caption, promo_seconds, promo_by, promo_at, promo_author:profiles!promo_by(full_name, username)';

const VIDEO_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
const EXT_OF_TYPE = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

// Messages (English keys, translated where shown).
export const PROMO_ERRORS = {
    type: 'Upload a video: MP4, MOV or WebM.',
    size: 'That clip is over 50 MB. Trim it to under a minute or record at 1080p, then try again.',
    long: 'A promo can be up to 3 minutes. Trim the clip and try again.',
    unplayable: 'This browser can’t play that clip. Save it as MP4 and try again.',
    missing: 'The clip didn’t finish uploading. Please choose it again.',
    link: 'Paste a YouTube link: a Short or a video.',
};

export const promoUrl = (path) => publicUrl(PROMO_BUCKET, path);

export const hasPromo = (row) => Boolean(row?.promo_path || row?.promo_url);

// The promo of a routine row (class_lessons or a progress row merged with it), ready for a player:
// { src (uploaded clip) | ytId + isShort + url (YouTube), poster, caption, seconds, at, author } — or null.
export function promoOf(row) {
    if (!hasPromo(row)) return null;
    const author = row.promo_author;
    const ytId = row.promo_url ? youtubeId(row.promo_url) : null;
    return {
        src: row.promo_path ? promoUrl(row.promo_path) : null,
        ytId,
        isShort: ytId ? isYoutubeShort(row.promo_url) : false,
        url: row.promo_url ?? null,
        poster: ytId ? youtubeThumb(ytId, 'hq') : promoUrl(row.promo_poster_path),
        caption: row.promo_caption ?? '',
        seconds: row.promo_seconds ?? null,
        at: row.promo_at ?? null,
        author: author ? author.full_name || author.username : null,
    };
}

// The promo fields of a class_lessons row, to copy onto a progress row.
export const promoFields = (lesson) => ({
    promo_path: lesson?.promo_path ?? null,
    promo_poster_path: lesson?.promo_poster_path ?? null,
    promo_url: lesson?.promo_url ?? null,
    promo_caption: lesson?.promo_caption ?? null,
    promo_seconds: lesson?.promo_seconds ?? null,
    promo_by: lesson?.promo_by ?? null,
    promo_at: lesson?.promo_at ?? null,
    promo_author: lesson?.promo_author ?? null,
});

// '0:42'
export function clipLength(seconds) {
    if (!seconds) return '';
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// What a promo is, in a few words: 'YouTube Short', 'YouTube video' or the clip's length ('0:42').
// `t` translates (useI18n).
export function promoKind(promo, t) {
    if (promo.ytId) return promo.isShort ? t('YouTube Short') : t('YouTube video');
    return clipLength(promo.seconds);
}

// ---- Reading a picked clip ------------------------------------------------------------

function waitFor(target, event, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => done(reject, new Error('timeout')), ms);
        const ok = () => done(resolve);
        const fail = () => done(reject, new Error('error'));
        function done(settle, value) {
            clearTimeout(timer);
            target.removeEventListener(event, ok);
            target.removeEventListener('error', fail);
            settle(value);
        }
        target.addEventListener(event, ok, { once: true });
        target.addEventListener('error', fail, { once: true });
    });
}

// A frame of the clip as a JPEG (longest side ≤ 720 px), or null if the browser won't draw it.
async function grabFrame(video, at) {
    try {
        video.currentTime = at;
        await waitFor(video, 'seeked', 8000);
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    } catch {
        return null;
    }
}

// Checks a picked video and reads what the promo needs: { file (typed), ext, seconds, width, height,
// poster: JPEG Blob | null }. Throws an AppError (FILE_TYPE / FILE_TOO_LARGE / INVALID_INPUT) with a
// message from PROMO_ERRORS.
export async function inspectPromo(picked) {
    const nameExt = picked.name?.split('.').pop()?.toLowerCase();
    const type = VIDEO_TYPES[nameExt] ?? (EXT_OF_TYPE[picked.type] ? picked.type : null);
    if (!type) throw new AppError('FILE_TYPE', PROMO_ERRORS.type);
    if (picked.size > PROMO_MAX_MB * 1024 * 1024) throw new AppError('FILE_TOO_LARGE', PROMO_ERRORS.size);
    const file = picked.type === type ? picked : new File([picked], picked.name || `promo.${EXT_OF_TYPE[type]}`, { type });

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    try {
        video.src = url;
        try {
            await waitFor(video, 'loadeddata', 20000);
        } catch {
            throw new AppError('INVALID_INPUT', PROMO_ERRORS.unplayable);
        }
        if (!video.videoWidth) throw new AppError('INVALID_INPUT', PROMO_ERRORS.unplayable);
        // Some recorders leave the length unknown (Infinity): the clip is still fine.
        const seconds = Number.isFinite(video.duration) ? Math.max(1, Math.round(video.duration)) : null;
        if (seconds && seconds > PROMO_MAX_SECONDS) throw new AppError('INVALID_INPUT', PROMO_ERRORS.long);
        const poster = await grabFrame(video, seconds ? Math.min(1, seconds / 3) : 0.5);
        return { file, ext: EXT_OF_TYPE[type], seconds, width: video.videoWidth, height: video.videoHeight, poster };
    } finally {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
    }
}

// ---- Uploading -------------------------------------------------------------------------

const newName = (lesson, ext) => `${lesson.class_id}/${lesson.id}/${crypto.randomUUID()}.${ext}`;

// supabase-js can't report upload progress, so the clip goes up with XMLHttpRequest to the same
// Storage endpoint (POST /storage/v1/object/{bucket}/{path}, the form supabase-js sends).
async function uploadWithProgress(path, file, { onProgress, signal } = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AppError('SESSION_EXPIRED');
    const form = new FormData();
    form.append('cacheControl', '31536000'); // every take has its own name: it never changes
    form.append('', file);
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/${PROMO_BUCKET}/${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', supabaseAnonKey);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve(path);
            let body = {};
            try {
                body = JSON.parse(xhr.responseText);
            } catch {
                // not JSON: keep the status
            }
            const error = toAppError({ message: body.message ?? body.error ?? '', statusCode: body.statusCode ?? xhr.status });
            if (error.code === 'FILE_TOO_LARGE') return reject(new AppError('FILE_TOO_LARGE', PROMO_ERRORS.size, error));
            if (error.code === 'FILE_TYPE') return reject(new AppError('FILE_TYPE', PROMO_ERRORS.type, error));
            return reject(error);
        };
        xhr.onerror = () => reject(new AppError('NETWORK'));
        xhr.onabort = () => reject(new AppError('ABORTED', 'Upload cancelled.'));
        if (signal) {
            if (signal.aborted) return xhr.abort();
            signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }
        xhr.send(form);
    });
}

// Attach an uploaded clip or a YouTube link to a routine (or take the promo off: neither) and delete the
// files nothing points at any more (the old take, finished routines' promos).
async function setPromo(lessonId, { path = null, url = null, poster = null, caption = null, seconds = null }) {
    let gone;
    try {
        gone = unwrap(
            await supabase.rpc('lesson_set_promo', { p_lesson: lessonId, p_path: path, p_url: url, p_poster: poster, p_caption: caption, p_seconds: seconds })
        );
    } catch (error) {
        if (error.code === 'INVALID_INPUT' && /upload the clip before/i.test(error.detail)) throw new AppError('INVALID_INPUT', PROMO_ERRORS.missing, error);
        throw error;
    }
    await removeFiles(PROMO_BUCKET, gone ?? []);
}

// Upload a clip checked by inspectPromo() and make it the routine's promo. `lesson` is { id, class_id }.
// onProgress(0…1) follows the clip's upload.
export async function publishPromo(lesson, clip, { caption = '', onProgress, signal } = {}) {
    const path = await uploadWithProgress(newName(lesson, clip.ext), clip.file, { onProgress, signal });
    let poster = null;
    if (clip.poster) {
        const posterPath = newName(lesson, 'jpg');
        const { error } = await supabase.storage.from(PROMO_BUCKET).upload(posterPath, clip.poster, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (!error) poster = posterPath; // a promo without a poster still plays
    }
    try {
        await setPromo(lesson.id, { path, poster, caption, seconds: clip.seconds });
    } catch (error) {
        await removeFiles(PROMO_BUCKET, [path, poster]);
        throw error;
    }
    return path;
}

// A YouTube link (a Short or any video, public or unlisted) as the routine's promo.
export function publishPromoLink(lesson, input, { caption = '' } = {}) {
    const url = cleanVideoUrl(input);
    if (!isVideoUrl(url)) throw new AppError('INVALID_INPUT', PROMO_ERRORS.link);
    return setPromo(lesson.id, { url, caption });
}

// Change only the caption ('' = none) of a routine's promo (a row with promo_path / promo_url).
export function setPromoCaption(lesson, caption) {
    return setPromo(lesson.id ?? lesson.lesson_id, { path: lesson.promo_path, url: lesson.promo_url, caption });
}

export function removePromo(lessonId) {
    return setPromo(lessonId, {});
}

// ---- Public -------------------------------------------------------------------------------

// The promos /classes shows: per class, the promo of its next routine (else of the one it started in
// the last week), soonest first → { today, promos: [class_lessons rows] }.
export async function listUpcomingPromos() {
    const today = await getStudioToday();
    const from = toIsoDate(subDays(parseISO(today), PROMO_PUBLIC_GRACE_DAYS));
    const rows = unwrap(
        await supabase
            .from('class_lessons')
            .select('id, class_id, title, starts_on, session_count, promo_path, promo_poster_path, promo_url, promo_caption, promo_seconds, promo_at')
            .or('promo_path.not.is.null,promo_url.not.is.null')
            .gte('starts_on', from)
            .order('starts_on')
            .limit(60)
    );
    const perClass = new Map();
    for (const row of rows) {
        const kept = perClass.get(row.class_id);
        // Upcoming beats started; among upcoming, the soonest; among started, the latest.
        const better = !kept || (row.starts_on >= today ? kept.starts_on < today : kept.starts_on < today && row.starts_on > kept.starts_on);
        if (better) perClass.set(row.class_id, row);
    }
    const promos = [...perClass.values()].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    return { today, promos };
}
