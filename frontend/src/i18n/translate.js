import { vi as viLocale } from 'date-fns/locale';
import VI from './vi';

// English is the source language: every UI string is written in English and doubles as the
// lookup key for its Vietnamese translation (src/i18n/vi/*.js). Placeholders look like {name}.

export const LANGUAGES = ['en', 'vi'];
const INTL = { en: 'en-GB', vi: 'vi-VN' };

// Named date styles, so both languages read naturally (en-GB keeps the existing English output,
// e.g. "Monday 30 November", "Mon 30 Nov", "November 2026").
const DATE_STYLES = {
    full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, // Monday 30 November 2026
    long: { weekday: 'long', day: 'numeric', month: 'long' }, // Monday 30 November
    short: { weekday: 'short', day: 'numeric', month: 'short' }, // Mon 30 Nov
    shortYear: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, // Mon 30 Nov 2026
    dayMonth: { day: 'numeric', month: 'long' }, // 30 November
    monthYear: { month: 'long', year: 'numeric' }, // November 2026
    month: { month: 'long' }, // November
    monthShort: { month: 'short' }, // Nov
    weekday: { weekday: 'long' }, // Monday
    weekdayShort: { weekday: 'short' }, // Mon
};

// Dev aid: Vietnamese lookups that found no translation (window.__i18nMissing in the console).
const missing = import.meta.env?.DEV && typeof window !== 'undefined' ? (window.__i18nMissing ??= new Set()) : null;
// Text that is already Vietnamese (a message translated once and passed on, e.g. to a toast) isn't missing,
// also when its {placeholders} were filled in ("Đã đăng promo cho “Armageddon”.").
let translatedTexts = null;
let translatedShapes = null;
const shapeOf = (value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+')}$`, 's');
const isTranslated = (text) => {
    translatedTexts ??= new Set(Object.values(VI));
    if (translatedTexts.has(text)) return true;
    // Only templates with words of their own: "{held}/{total}" would look like anything.
    translatedShapes ??= Object.values(VI)
        .filter((value) => /\{\w+\}/.test(value) && value.replace(/\{\w+\}/g, '').replace(/[^\p{L}]/gu, '').length >= 4)
        .map(shapeOf);
    return translatedShapes.some((shape) => shape.test(text));
};

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text);

// 'yyyy-MM-dd' strings are calendar dates: read them as local midnight, not UTC.
const toDate = (value) => (typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : value);

export function createI18n(lang, setLang = () => {}) {
    const dict = lang === 'vi' ? VI : null;
    const intl = INTL[lang] ?? INTL.en;

    const t = (key, vars) => {
        if (!dict || key == null) return fill(String(key ?? ''), vars);
        const found = dict[key];
        if (found === undefined && missing && !isTranslated(key)) missing.add(key);
        return fill(found ?? key, vars);
    };

    return {
        lang,
        setLang,
        intl,
        dateLocale: lang === 'vi' ? viLocale : undefined, // for date-fns (formatDistanceToNow …)
        t,
        // Picks the English singular or plural key by `count`, then translates; {count} is filled in.
        tn: (count, one, many, vars) => t(count === 1 ? one : many, { count, ...vars }),
        formatDate: (value, style = 'long') => (value ? new Intl.DateTimeFormat(intl, DATE_STYLES[style] ?? DATE_STYLES.long).format(toDate(value)) : ''),
        // ISO weekday 1 = Monday … 7 = Sunday ('long' | 'short').
        dayName: (isoDay, style = 'long') =>
            new Intl.DateTimeFormat(intl, { weekday: style }).format(new Date(2024, 0, Number(isoDay))), // 1 Jan 2024 is a Monday
        // 'yyyy-MM-01' → "November" / "tháng 11"; { withYear } adds the year. Vietnamese month names
        // are lower case ("bài tháng 11"); capitalise in CSS where one starts a heading.
        monthName: (month, { withYear = false } = {}) => {
            const text = new Intl.DateTimeFormat(intl, withYear ? DATE_STYLES.monthYear : DATE_STYLES.month).format(toDate(month));
            return lang === 'vi' ? text.charAt(0).toLowerCase() + text.slice(1) : text;
        },
    };
}
