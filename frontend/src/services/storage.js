import { supabase } from '@/lib/supabase';
import { extensionFor } from '@/lib/image';
import { toAppError } from './errors';

export const BUCKETS = {
    avatars: 'avatars',
    classImages: 'class-images',
    proofs: 'attendance-proofs',
    siteAssets: 'site-assets',
};

const SIGNED_URL_SECONDS = 3600;

export function publicUrl(bucket, path, version) {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}

// `version` (e.g. profiles.updated_at) busts the cache after an upsert to the same path.
export const avatarUrl = (path, version) => publicUrl(BUCKETS.avatars, path, version);
export const classImageUrl = (path) => publicUrl(BUCKETS.classImages, path);
export const siteAssetUrl = (path) => publicUrl(BUCKETS.siteAssets, path);

// Photos of a room: rooms.image_paths are paths in the public site-assets bucket.
export const roomImageUrls = (room) => (room?.image_paths ?? []).map(siteAssetUrl).filter(Boolean);

async function upload(bucket, path, file, { upsert = false } = {}) {
    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert, contentType: file.type, cacheControl: '3600' });
    if (error) throw toAppError(error);
    return path;
}

// `file` must already be prepared with prepareImage().
export function uploadAvatar(userId, file) {
    return upload(BUCKETS.avatars, `${userId}/avatar.${extensionFor(file)}`, file, { upsert: true });
}

export function uploadClassImage(classId, file) {
    return upload(BUCKETS.classImages, `${classId}/${crypto.randomUUID()}.${extensionFor(file)}`, file);
}

export function uploadProof(instructorId, attendanceId, kind, file) {
    return upload(BUCKETS.proofs, `${instructorId}/${attendanceId}/${kind}.${extensionFor(file)}`, file, { upsert: true });
}

// Best effort: a leftover object is harmless, so failures are ignored.
export async function removeFiles(bucket, paths) {
    const list = paths.filter(Boolean);
    if (list.length === 0) return;
    await supabase.storage.from(bucket).remove(list);
}

// Returns { [path]: signedUrl } for private attendance proofs.
export async function signProofUrls(paths) {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return {};
    const { data, error } = await supabase.storage.from(BUCKETS.proofs).createSignedUrls(unique, SIGNED_URL_SECONDS);
    if (error) throw toAppError(error);
    return Object.fromEntries(data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
}
