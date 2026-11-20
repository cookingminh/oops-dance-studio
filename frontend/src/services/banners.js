import { supabase } from '@/lib/supabase';
import { extensionFor, prepareImage } from '@/lib/image';
import { BUCKETS, removeFiles, siteAssetUrl } from './storage';
import { toAppError, unwrap } from './errors';

// Homepage banners (supabase/migrations/20261117002200_home_banners.sql, api-contract §5 Homepage banners).
// The homepage hero is a carousel: the studio's own slide first, then up to four banners. A banner is a poster designed
// elsewhere (Canva…) in two versions, desktop (landscape) and phone (portrait), both required. The site always shows
// the whole poster (never cropped), so a button placed at x %, y % of a poster stays on that spot of the design.
// Banner row: { id, name, alt_text, desktop_path, desktop_width, desktop_height, phone_path, phone_width,
//   phone_height, starts_on, ends_on, enabled, sort_order, buttons, … }
// Button: { id, text_vi, text_en, link, url, color, arrow, desktop: { x, y, scale }, phone: { x, y, scale } }
//   x, y: the button's centre in % of that poster; scale: 0.6–2 (1 = the standard button).

export const BANNER_DEVICES = ['desktop', 'phone'];
export const BANNER_MAX_BUTTONS = 4;
export const BANNER_MAX_LIVE = 4; // plus the studio's own slide
// The size to design at (Canva: "Presentation 16:9" and "Instagram Story").
export const BANNER_SPECS = {
    desktop: { width: 1920, height: 1080, ratio: 16 / 9, label: 'Landscape 16:9' },
    phone: { width: 1080, height: 1920, ratio: 9 / 16, label: 'Portrait 9:16' },
};
// Where buttons may sit, in % of the poster: the navbar and the slide bar can cover the strips outside.
export const BANNER_SAFE = {
    desktop: { x0: 4, x1: 96, y0: 11, y1: 89 },
    phone: { x0: 5, x1: 95, y0: 6, y1: 94 },
};
export const BANNER_SCALE = { min: 0.6, max: 2, step: 0.05 };
export const BANNER_COLORS = [
    { key: 'red', label: 'Oops red' },
    { key: 'white', label: 'White' },
    { key: 'gold', label: 'Gold' },
    { key: 'dark', label: 'Black' },
    { key: 'glass', label: 'White outline' },
];
// Where a button leads: a page of the site, or the banner's own https link (opens in a new tab).
export const BANNER_LINKS = [
    { key: 'timetable', label: 'Weekly timetable', to: '/classes#timetable' },
    { key: 'classes', label: 'Classes', to: '/classes' },
    { key: 'register', label: 'Sign up (free first class)', to: '/register' },
    { key: 'rooms', label: 'Book a room', to: '/rooms' },
    { key: 'about', label: 'About the studio', to: '/about' },
    { key: 'url', label: 'Own link (Facebook, a form…)' },
];

// Where a button goes: { href, external }.
export function bannerTarget(button) {
    if (button.link === 'url') return { href: button.url || '#', external: true };
    return { href: BANNER_LINKS.find((link) => link.key === button.link)?.to ?? '/', external: false };
}
// The button's words in the visitor's language (English falls back to Vietnamese).
export const buttonText = (button, lang) => (lang === 'en' ? button.text_en || button.text_vi : button.text_vi) || '';
export const posterUrl = (path) => siteAssetUrl(path);

// How a picked image fits the spec: { tone: 'ok' | 'small' | 'shape', width, height }.
// 'shape': another aspect ratio (it still shows whole, with blurred bands); 'small': under 80 % of the size.
export function judgePoster(device, width, height) {
    const spec = BANNER_SPECS[device];
    if (!width || !height) return null;
    if (Math.abs(width / height - spec.ratio) / spec.ratio > 0.03) return { tone: 'shape', width, height };
    if (width < spec.width * 0.8) return { tone: 'small', width, height };
    return { tone: 'ok', width, height };
}

// ---------------------------------------------------------------------------
// Everyone
// ---------------------------------------------------------------------------

// The banners the homepage shows today, in order (up to four).
export async function listLiveBanners() {
    return unwrap(await supabase.rpc('home_banners_live'));
}

// ---------------------------------------------------------------------------
// Staff and admins
// ---------------------------------------------------------------------------

export async function listBanners() {
    return unwrap(await supabase.from('home_banners').select('*').order('sort_order').order('id'));
}

// Create (id null) or change a banner → the saved row. Posters it no longer uses are deleted (best effort).
export async function saveBanner(id, banner) {
    const result = unwrap(await supabase.rpc('home_banner_save', { p_id: id, p_banner: banner }));
    await removeFiles(BUCKETS.siteAssets, result?.unused_paths ?? []);
    return result.banner;
}

export async function setBannerEnabled(id, enabled) {
    return unwrap(await supabase.rpc('home_banner_set_enabled', { p_id: id, p_enabled: enabled }));
}

// ids in their new order (the others keep theirs, after them).
export async function reorderBanners(ids) {
    return unwrap(await supabase.rpc('home_banners_reorder', { p_ids: ids }));
}

export async function deleteBanner(id) {
    const paths = unwrap(await supabase.rpc('home_banner_delete', { p_id: id }));
    await removeFiles(BUCKETS.siteAssets, paths ?? []);
}

// A picked poster image → { path, width, height }: scaled to at most 2400 px, re-encoded, uploaded to
// site-assets/banners/. Width and height are the uploaded image's (what the editor judges).
export async function uploadBannerPoster(file, device) {
    const prepared = await prepareImage(file, { maxDimension: 2400, maxBytes: 4 * 1024 * 1024 });
    const { width, height } = await imageSize(prepared);
    const path = `banners/${crypto.randomUUID()}-${device}.${extensionFor(prepared)}`;
    const { error } = await supabase.storage
        .from(BUCKETS.siteAssets)
        .upload(path, prepared, { contentType: prepared.type, cacheControl: '31536000' });
    if (error) throw toAppError(error);
    return { path, width, height };
}

// Files the editor uploaded but never saved.
export function discardPosters(paths) {
    return removeFiles(BUCKETS.siteAssets, paths);
}

// { width, height } of an image file (or blob).
export async function imageSize(blob) {
    if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close?.();
        return size;
    }
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight };
    } finally {
        URL.revokeObjectURL(url);
    }
}
