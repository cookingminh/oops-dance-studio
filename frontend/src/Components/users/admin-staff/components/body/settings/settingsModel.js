// Plain helpers for the profile settings page (no components here, for react-refresh).
import { LuLanguages, LuPhone, LuShieldCheck, LuUser } from 'react-icons/lu';
import { MIN_PASSWORD_LENGTH } from '@/hooks/useAccountSettings';
import { toIsoDate } from '@/lib/format';

// The page's sections in order. The side nav and its scroll spy use the ids; `fields` tells the
// nav which unsaved form fields live in a section. Labels are English (translated where shown).
export const SECTIONS = [
    { id: 'settings-personal', label: 'Personal details', icon: LuUser, fields: ['full_name', 'username', 'date_of_birth'] },
    { id: 'settings-contact', label: 'Contact', icon: LuPhone, fields: ['contact_number'] },
    { id: 'settings-preferences', label: 'Preferences', icon: LuLanguages, fields: [] },
    { id: 'settings-security', label: 'Password', icon: LuShieldCheck, fields: [] },
];
export const SECTION_IDS = SECTIONS.map((section) => section.id);

// What a complete profile has, in the order we suggest filling it in. `field` is the form field
// to jump to ('photo' opens the photo picker).
export const PROFILE_CHECKS = [
    { field: 'photo', label: 'Add a photo', isDone: (user) => Boolean(user.avatar_path) },
    { field: 'full_name', label: 'Add your name', isDone: (user) => Boolean(user.full_name?.trim()) },
    { field: 'contact_number', label: 'Add a phone number', isDone: (user) => Boolean(user.contact_number?.trim()) },
    { field: 'date_of_birth', label: 'Add your birthday', isDone: (user) => Boolean(user.date_of_birth) },
    { field: 'username', label: 'Pick a username', isDone: (user) => Boolean(user.username?.trim()) },
];

export function profileCompleteness(user) {
    const missing = PROFILE_CHECKS.filter((check) => !check.isDone(user));
    const percent = Math.round(((PROFILE_CHECKS.length - missing.length) / PROFILE_CHECKS.length) * 100);
    return { missing, percent };
}

const trimmed = (value) => String(value ?? '').trim();

// Fields whose value differs from what is stored (spaces around values don't count).
export const changedFields = (profile, saved) => Object.keys(saved).filter((key) => trimmed(profile[key]) !== trimmed(saved[key]));

// Phone numbers as people type them: digits with spaces, dots, dashes, brackets and a leading +.
const PHONE = /^\+?[\d\s().-]+$/;
const digitCount = (value) => value.replace(/\D/g, '').length;

// Problems with the edited fields as English messages, keyed by field. Only changed fields are
// checked, so an old record that breaks a rule never blocks saving something else.
export function profileErrors(profile, saved) {
    const errors = {};
    const changed = changedFields(profile, saved);
    const value = (key) => trimmed(profile[key]);

    if (changed.includes('full_name') && !value('full_name')) errors.full_name = 'Please enter your name.';
    if (changed.includes('username') && !value('username')) errors.username = 'Please choose a username.';
    if (changed.includes('contact_number') && value('contact_number')) {
        const phone = value('contact_number');
        const digits = digitCount(phone);
        if (!PHONE.test(phone) || digits < 8 || digits > 15) errors.contact_number = 'Enter a valid phone number.';
    }
    if (changed.includes('date_of_birth') && value('date_of_birth')) {
        if (value('date_of_birth') > toIsoDate(new Date())) errors.date_of_birth = 'Your birthday can’t be in the future.';
        else if (value('date_of_birth') < '1900-01-01') errors.date_of_birth = 'Please check the year.';
    }
    return errors;
}

// A rough guide to how hard a new password is to guess: level 0 (too short) … 4 (strong), with
// one tip for making it stronger. Only a hint; the server enforces the minimum length.
const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

export function passwordStrength(password) {
    if (!password) return null;
    if (password.length < MIN_PASSWORD_LENGTH) return { level: 0, label: STRENGTH_LABELS[0], tip: null };

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const kinds = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
    const points = kinds + (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0);
    const level = Math.min(4, Math.max(1, points - 1));

    let tip = null;
    if (level < 4) {
        if (!hasDigit && !hasSymbol) tip = 'Add a number or a symbol.';
        else if (!(hasLower && hasUpper)) tip = 'Mix capital and small letters.';
        else if (password.length < 12) tip = 'A few more characters make it much harder to guess.';
    }
    return { level, label: STRENGTH_LABELS[level], tip };
}
