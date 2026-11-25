import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// AI knowledge (supabase/migrations/20261117003300_knowledge_articles.sql, api-contract §3 knowledge_articles): what
// staff write for the studio's future assistant. RLS: staff and admins only. They write title, category, body and
// status; the database sets slug, updated_at / updated_by and published_at (and refuses them from here).
// Article: { id, slug, title, category, body (Markdown), status, updated_at, published_at (null on a draft),
//   editor: { id, full_name, username } | null } — lists come without the body.

export const ARTICLE_CATEGORIES = [
    { key: 'policy', label: 'Policy' },
    { key: 'faq', label: 'FAQ' },
    { key: 'class', label: 'Class guidance' },
    { key: 'house_rules', label: 'House rules' },
    { key: 'other', label: 'Other' },
];
export const categoryLabel = (key) => ARTICLE_CATEGORIES.find((category) => category.key === key)?.label ?? '';

export const TITLE_MAX = 120;
export const BODY_MAX = 20000;

const ROW = 'id, slug, title, category, status, updated_at, published_at, editor:profiles!knowledge_articles_updated_by_fkey(id, full_name, username)';
const ARTICLE = `${ROW}, body`;

// Every article, the last edited first.
export async function listArticles() {
    return unwrap(await supabase.from('knowledge_articles').select(ROW).order('updated_at', { ascending: false }).order('id', { ascending: false }));
}

// One article, or null when there is none (any more).
export async function getArticle(id) {
    return unwrap(await supabase.from('knowledge_articles').select(ARTICLE).eq('id', id).maybeSingle());
}

// fields: { title, category, body, status? } ('draft' unless told otherwise) → the article.
export async function createArticle(fields) {
    return unwrap(await supabase.from('knowledge_articles').insert(fields).select(ARTICLE).single());
}

// Any of { title, category, body, status } → the article. A published one changes at once.
export async function updateArticle(id, fields) {
    return unwrap(await supabase.from('knowledge_articles').update(fields).eq('id', id).select(ARTICLE).single());
}

export async function deleteArticle(id) {
    unwrap(await supabase.from('knowledge_articles').delete().eq('id', id));
}
