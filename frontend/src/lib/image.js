import { AppError } from '@/services/errors';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

const EXTENSIONS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export function extensionFor(file) {
    return EXTENSIONS[file.type] ?? 'jpg';
}

function isHeic(file) {
    return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(blob) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

// Converts HEIC to JPEG, scales down to MAX_DIMENSION and re-encodes as WebP (JPEG where the
// browser can't encode WebP) until the file fits the 5 MB bucket limit.
export async function prepareImage(file, { maxDimension = MAX_DIMENSION, maxBytes = MAX_BYTES } = {}) {
    if (!file) throw new AppError('INVALID_INPUT', 'Please choose an image.');

    let source = file;
    if (isHeic(file)) {
        try {
            // Loaded on demand: heic2any is ~1.3 MB and only needed for iPhone photos.
            const { default: heic2any } = await import('heic2any');
            const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
            source = Array.isArray(converted) ? converted[0] : converted;
        } catch (error) {
            throw new AppError('FILE_TYPE', 'This HEIC photo couldn’t be converted. Please try a JPEG or PNG.', error);
        }
    } else if (!file.type.startsWith('image/')) {
        throw new AppError('FILE_TYPE');
    }

    let image;
    try {
        image = await decode(source);
    } catch (error) {
        throw new AppError('FILE_TYPE', 'This image couldn’t be read. Please try another file.', error);
    }

    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    let width = Math.round(image.width * scale);
    let height = Math.round(image.height * scale);
    let type = 'image/webp';
    let quality = 0.85;
    const canvas = document.createElement('canvas');

    try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (type === 'image/jpeg') {
                ctx.fillStyle = '#fff'; // JPEG has no alpha channel
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(image, 0, 0, width, height);

            let blob = await canvasToBlob(canvas, type, quality);
            if (blob && blob.type !== type) {
                // This browser can't encode WebP; switch to JPEG and redraw.
                type = 'image/jpeg';
                continue;
            }
            if (blob && blob.size <= maxBytes) {
                const base = file.name.replace(/\.[^.]+$/, '') || 'image';
                return new File([blob], `${base}.${EXTENSIONS[type]}`, { type });
            }
            if (quality > 0.6) {
                quality -= 0.1;
            } else {
                width = Math.round(width * 0.8);
                height = Math.round(height * 0.8);
            }
        }
    } finally {
        image.close?.();
    }
    throw new AppError('FILE_TOO_LARGE', 'This image is too large even after compression. Please choose a smaller one.');
}
