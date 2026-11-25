import { LuFileText, LuHelpCircle, LuMusic2, LuScale, LuScrollText } from 'react-icons/lu';
import { ARTICLE_CATEGORIES, BODY_MAX, TITLE_MAX } from '@/services/knowledge';
import { fold, studioDateOf } from '../user-manager/peopleModel';
import { agoText, hoursSince } from '../join-requests/joinModel';

// The AI knowledge pages' plain logic. Labels are English i18n keys.

export const CATEGORY_ICONS = {
    policy: LuScale,
    faq: LuHelpCircle,
    class: LuMusic2,
    house_rules: LuScrollText,
    other: LuFileText,
};
export const CATEGORY_KEYS = ARTICLE_CATEGORIES.map((category) => category.key);

// The filter's words, and the pill on an article. (Payroll's "Draft" is another word in Vietnamese.)
export const STATUSES = {
    published: { filter: 'Published', pill: 'Published' },
    draft: { filter: 'Drafts', pill: 'In draft' },
};

// Articles that fit the filters ('all' = any); the search looks at titles, accents or not ("huy phong" finds "Huỷ phòng").
export function filterArticles(articles, { category, status, query }) {
    const words = fold(query).trim().split(/\s+/).filter(Boolean);
    return articles.filter((article) => {
        if (category !== 'all' && article.category !== category) return false;
        if (status !== 'all' && article.status !== status) return false;
        const title = fold(article.title);
        return words.every((word) => title.includes(word));
    });
}

export const countBy = (articles, field, value) => articles.filter((article) => article[field] === value).length;

// When something happened: "3 hours ago" within a week, then the date.
export const whenText = (timestamp, i18n) =>
    hoursSince(timestamp) < 24 * 7 ? agoText(timestamp, i18n) : i18n.formatDate(studioDateOf(timestamp), 'shortYear');

// "Edited by Lê Hoàng Nam · 3 hours ago" (no name once their account is gone).
export function editedText(article, i18n) {
    const time = whenText(article.updated_at, i18n);
    const name = article.editor?.full_name || article.editor?.username;
    return name ? i18n.t('Edited by {name} · {time}', { name, time }) : i18n.t('Edited {time}', { time });
}

// ---- The editor ----------------------------------------------------------------------

export const fieldsOf = (article) => ({ title: article?.title ?? '', category: article?.category ?? '', body: article?.body ?? '' });

// What is saved (and what tells whether anything changed).
export const payloadOf = (draft) => ({ title: draft.title.trim(), category: draft.category, body: draft.body });
export const draftKey = (draft) => JSON.stringify(payloadOf(draft));

// What is still missing: English keys. A published article also needs a text.
export function missingOf(draft, { published }) {
    const missing = [];
    if (!draft.title.trim()) missing.push('Give the article a title.');
    if (draft.title.trim().length > TITLE_MAX) missing.push('The title is up to 120 characters.');
    if (!draft.category) missing.push('Pick the article’s category.');
    if (published && !draft.body.trim()) missing.push('Write the article’s text.');
    if (draft.body.length > BODY_MAX) missing.push('The text is up to 20,000 characters.');
    return missing;
}
