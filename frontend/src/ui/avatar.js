import PlainImg from './PlainImg';

// "Nguyễn Thảo Vy" → "NV", "admin" → "AD"
export function initials(name = '') {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Spread into every NextUI <Avatar> / avatarProps.
export const AVATAR_DEFAULTS = { ImgComponent: PlainImg, getInitials: initials };
