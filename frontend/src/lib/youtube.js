// YouTube links for the end-of-month class videos (class_lessons.video_url).

// Same rule as the database check `class_lessons_video_url_youtube`.
export const VIDEO_URL_PATTERN =
    /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?(.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}([?&#/].*)?$/;

const ID_IN_URL = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

// 'https://youtu.be/abc…' → 'abc…' (null when it isn't a YouTube video link).
export function youtubeId(url) {
    const match = ID_IN_URL.exec(url ?? '');
    return match ? match[1] : null;
}

export const isYoutubeShort = (url) => /youtube\.com\/shorts\//.test(url ?? '');

// What people paste: trims it and adds the missing https:// ("youtu.be/…", "www.youtube.com/…").
export function cleanVideoUrl(input) {
    const value = (input ?? '').trim();
    if (!value) return '';
    if (/^http:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
    if (/^(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(value)) return `https://${value}`;
    return value;
}

export const isVideoUrl = (url) => VIDEO_URL_PATTERN.test(url ?? '');

// Thumbnails: 'max' (1280 px, missing on some videos — YouTube then serves a 120 px placeholder) or 'hq' (480 px).
export const youtubeThumb = (id, size = 'hq') => `https://i.ytimg.com/vi/${id}/${size === 'max' ? 'maxresdefault' : 'hqdefault'}.jpg`;

// The privacy-enhanced player; it only loads once someone presses play.
export const youtubeEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;

export const youtubeWatch = (id) => `https://www.youtube.com/watch?v=${id}`;
