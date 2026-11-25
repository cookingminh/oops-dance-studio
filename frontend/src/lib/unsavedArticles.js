// The text of an AI knowledge article someone hasn't saved yet, kept in their browser (localStorage, per account), so
// opening another page, the Back button or a closed tab doesn't lose it. One entry per article, and one for a new
// article. It goes when the text is saved or discarded, the article is deleted, or the person signs out.
// Entry: { title, category, body, base (the article's updated_at it was written over; null = a new article), at (ISO) }

const PREFIX = 'oops-article-draft';
const NEW = 'new';
const ownPrefix = (userId) => `${PREFIX}:${userId}:`;
const keyFor = (userId, articleId) => `${ownPrefix(userId)}${articleId ?? NEW}`;

const text = (value) => (typeof value === 'string' ? value : '');

function parse(raw) {
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || Number.isNaN(Date.parse(entry.at))) return null;
    return { title: text(entry.title), category: text(entry.category), body: text(entry.body), base: text(entry.base) || null, at: entry.at };
}

// → true when it is kept (false: storage is blocked or full, so the editor has to ask before leaving).
export function keepUnsaved(userId, articleId, { title, category, body }, base = null) {
    try {
        localStorage.setItem(keyFor(userId, articleId), JSON.stringify({ title, category, body, base, at: new Date().toISOString() }));
        return true;
    } catch {
        return false;
    }
}

export function readUnsaved(userId, articleId) {
    try {
        return parse(localStorage.getItem(keyFor(userId, articleId)));
    } catch {
        return null;
    }
}

export function dropUnsaved(userId, articleId) {
    try {
        localStorage.removeItem(keyFor(userId, articleId));
    } catch {
        // storage blocked: nothing was kept either
    }
}

// Every entry of this account: [{ articleId (null = a new article), ...entry }].
export function listUnsaved(userId) {
    try {
        const prefix = ownPrefix(userId);
        return Object.keys(localStorage)
            .filter((key) => key.startsWith(prefix))
            .map((key) => {
                const id = key.slice(prefix.length);
                return { articleId: id === NEW ? null : Number(id), ...readUnsaved(userId, id) };
            })
            .filter((entry) => entry.at);
    } catch {
        return [];
    }
}

// Signing out: none of this account's text stays on a shared computer.
export function dropAllUnsaved(userId) {
    for (const { articleId } of listUnsaved(userId)) dropUnsaved(userId, articleId);
}
