import { BANNER_MAX_LIVE, BANNER_SAFE, BANNER_SCALE, posterUrl } from '@/services/banners';

// The banner editor's plain logic: where a banner stands today, an empty draft, defaults for a new button, and
// turning a draft into what home_banner_save expects.

// Today in studio time ('yyyy-MM-dd').
export const studioToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

// Each banner's state today, in list order: { [id]: { tone, key, vars } } where tone is
// 'live' | 'hidden' (live but past the first four) | 'scheduled' | 'ended' | 'off'.
export function bannerStates(banners, today = studioToday()) {
    let live = 0;
    const out = {};
    for (const banner of banners) {
        if (!banner.enabled) out[banner.id] = { tone: 'off', key: 'Off' };
        else if (banner.starts_on && banner.starts_on > today) out[banner.id] = { tone: 'scheduled', key: 'Starts {date}', vars: { date: banner.starts_on } };
        else if (banner.ends_on && banner.ends_on < today) out[banner.id] = { tone: 'ended', key: 'Ended {date}', vars: { date: banner.ends_on } };
        else {
            live += 1;
            out[banner.id] = live <= BANNER_MAX_LIVE ? { tone: 'live', key: 'Showing' } : { tone: 'hidden', key: 'Not shown: only the first 4 show' };
        }
    }
    return out;
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const round = (value, step = 0.1) => Math.round(value / step) * step;
export const roundScale = (value) => Number(clamp(round(value, BANNER_SCALE.step), BANNER_SCALE.min, BANNER_SCALE.max).toFixed(2));

// A new button: under the last one (inside the safe area), or low in the middle.
export function newButton(previous) {
    const below = (spot, device, step) => ({
        x: spot.x,
        y: Number(clamp(spot.y + step, BANNER_SAFE[device].y0 + 4, BANNER_SAFE[device].y1 - 4).toFixed(1)),
        scale: spot.scale ?? 1,
    });
    return {
        id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        text_vi: 'Xem chi tiết',
        text_en: 'See more',
        link: 'timetable',
        url: '',
        color: previous ? 'glass' : 'red',
        arrow: !previous,
        desktop: previous ? below(previous.desktop, 'desktop', 8) : { x: 50, y: 78, scale: 1.2 },
        phone: previous ? below(previous.phone, 'phone', 6) : { x: 50, y: 84, scale: 1.15 },
    };
}

// A draft from a saved banner (or an empty one). Posters: { path, width, height, url } (url: what the preview shows).
export function draftOf(banner) {
    if (!banner) {
        return { name: '', alt_text: '', starts_on: '', ends_on: '', enabled: true, desktop: null, phone: null, buttons: [newButton()] };
    }
    const poster = (device) => ({
        path: banner[`${device}_path`],
        width: banner[`${device}_width`],
        height: banner[`${device}_height`],
        url: posterUrl(banner[`${device}_path`]),
    });
    return {
        name: banner.name,
        alt_text: banner.alt_text,
        starts_on: banner.starts_on ?? '',
        ends_on: banner.ends_on ?? '',
        enabled: banner.enabled,
        desktop: poster('desktop'),
        phone: poster('phone'),
        buttons: (banner.buttons ?? []).map((button) => ({ ...button, text_en: button.text_en ?? '', url: button.url ?? '' })),
    };
}

// What home_banner_save takes.
export function payloadOf(draft) {
    return {
        name: draft.name.trim(),
        alt_text: draft.alt_text.trim(),
        desktop_path: draft.desktop?.path ?? null,
        desktop_width: draft.desktop?.width ?? null,
        desktop_height: draft.desktop?.height ?? null,
        phone_path: draft.phone?.path ?? null,
        phone_width: draft.phone?.width ?? null,
        phone_height: draft.phone?.height ?? null,
        starts_on: draft.starts_on || null,
        ends_on: draft.ends_on || null,
        enabled: draft.enabled,
        buttons: draft.buttons.map((button) => ({
            id: button.id,
            text_vi: button.text_vi.trim(),
            text_en: button.text_en.trim() || null,
            link: button.link,
            url: button.link === 'url' ? button.url.trim() : null,
            color: button.color,
            arrow: button.arrow,
            desktop: button.desktop,
            phone: button.phone,
        })),
    };
}

// Comparable form of a draft (to know whether anything changed). Preview-only fields (url) are left out.
export const draftKey = (draft) => JSON.stringify(payloadOf(draft));

export const isHttps = (value) => /^https:\/\/\S{3,}$/.test(value.trim());

// What is still missing before saving: English keys.
export function missingOf(draft) {
    const missing = [];
    if (!draft.name.trim()) missing.push('Give the banner a name.');
    if (!draft.desktop?.path) missing.push('Add the desktop poster.');
    if (!draft.phone?.path) missing.push('Add the phone poster.');
    if (!draft.alt_text.trim()) missing.push('Write what the poster says.');
    if (draft.starts_on && draft.ends_on && draft.ends_on < draft.starts_on) missing.push('The banner ends before it starts.');
    if (draft.buttons.some((button) => !button.text_vi.trim())) missing.push('Each button needs words.');
    if (draft.buttons.some((button) => button.link === 'url' && !isHttps(button.url))) missing.push('A button’s own link starts with https://');
    return missing;
}

// The screens the preview shows: drawn at real size, then scaled down, so it is exactly the homepage.
export const PREVIEW_PRESETS = {
    laptop: { width: 1440, height: 900, device: 'desktop', label: 'Laptop', size: '1440 × 900' },
    wide: { width: 1920, height: 928, device: 'desktop', label: 'Large screen', size: '1920 × 1080' },
    phone: { width: 390, height: 844, device: 'phone', label: 'Phone', size: '390 × 844' },
};
