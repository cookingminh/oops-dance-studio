// AI knowledge (/admin/knowledge; supabase/migrations/20261117003300_knowledge_articles.sql): staff write an article with
// a live Markdown preview, save it as a draft, publish it, change it while published, unpublish and delete it; the list's
// filters and search stay in the URL; visitors, guests and instructors get neither the page nor the rows (their own
// JWTs); slug, editor and times are the server's. Works on articles of its own (titles "E2E …", deleted afterwards).
import { test, expect } from '@playwright/test';
import { expectToast, login, pathname, pickOption, rest, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const TITLE = `E2E Huỷ phòng ${RUN}`;
const OTHER = `E2E Nội quy ${RUN}`;
const FIELDS = 'id,slug,title,category,body,status,updated_by,created_at,updated_at,published_at';
const LIKE_E2E = `like.${encodeURIComponent('E2E *')}`;

let page;
let staff; // { jwt, id }
let admin;
let names; // id → full name

const saved = async (title = TITLE) => (await rest(staff.jwt, `knowledge_articles?select=${FIELDS}&title=eq.${encodeURIComponent(title)}`)).data[0];
const row = (title = TITLE) => page.locator('.kbRows li').filter({ hasText: title });
const pill = () => page.locator('.kbEditorTitle .kbPill');
const preview = () => page.locator('.kbPreviewCol');
const button = (name) => page.locator('.kbEditorActions').getByRole('button', { name, exact: true });
const openArticle = async (title = TITLE) => {
    await page.goto('/admin/knowledge');
    await row(title).getByRole('link').click();
    await expect(page.locator('.kbEditorTitle h2')).toHaveText(title);
};
const cleanUp = async () => expect((await rest(staff.jwt, `knowledge_articles?title=${LIKE_E2E}`, { method: 'DELETE' })).status).toBe(204);

test.beforeAll(async ({ browser }) => {
    staff = await token('staff@demo.oopsdance.test');
    admin = await token('admin@demo.oopsdance.test');
    await cleanUp();
    const people = (await rest(staff.jwt, `profiles?select=id,full_name&id=in.(${staff.id},${admin.id})`)).data;
    names = new Map(people.map((person) => [person.id, person.full_name]));
    const other = await rest(staff.jwt, 'knowledge_articles', { method: 'POST', body: { title: OTHER, category: 'house_rules', body: 'Published.', status: 'published' } });
    expect(other.status, JSON.stringify(other.data)).toBe(201);
    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close();
    await cleanUp();
});

// ---------------------------------------------------------------------------
// Who gets in
// ---------------------------------------------------------------------------
test('RLS: a visitor gets nothing', async () => {
    for (const request of [
        rest(null, 'knowledge_articles?select=id'),
        rest(null, 'knowledge_articles', { method: 'POST', body: { title: 'E2E hacked', category: 'faq' } }),
        rest(null, `knowledge_articles?title=eq.${encodeURIComponent(OTHER)}`, { method: 'PATCH', body: { body: 'hacked' } }),
        rest(null, `knowledge_articles?title=eq.${encodeURIComponent(OTHER)}`, { method: 'DELETE' }),
    ]) {
        const { status, data } = await request;
        expect(status).toBe(401);
        expect(data.code).toBe('42501');
    }
});

for (const [role, email] of [['guest', 'guest@demo.oopsdance.test'], ['instructor', 'instructor@demo.oopsdance.test']]) {
    test(`RLS: ${role} can't read or write articles`, async () => {
        const { jwt } = await token(email);
        const before = await saved(OTHER);
        const read = await rest(jwt, 'knowledge_articles?select=id,title,body');
        expect(read.status).toBe(200);
        expect(read.data).toEqual([]);

        const created = await rest(jwt, 'knowledge_articles', { method: 'POST', body: { title: 'E2E hacked', category: 'faq', body: 'x' } });
        expect(created.status).toBe(403);
        expect(created.data.code).toBe('42501');

        const changed = await rest(jwt, `knowledge_articles?id=eq.${before.id}`, { method: 'PATCH', body: { body: 'hacked' }, prefer: 'return=representation' });
        expect(changed.data).toEqual([]);
        const removed = await rest(jwt, `knowledge_articles?id=eq.${before.id}`, { method: 'DELETE', prefer: 'return=representation' });
        expect(removed.data).toEqual([]);
        expect(await saved(OTHER)).toEqual(before);
    });

    test(`${role} is sent away from the page`, async ({ browser }) => {
        const theirs = await browser.newPage();
        await login(theirs, email);
        await theirs.goto('/admin/knowledge');
        await theirs.waitForURL((url) => url.pathname.startsWith('/profile'));
        await expect(theirs.getByText('AI knowledge')).toHaveCount(0);
        await theirs.close();
    });
}

test('a visitor is asked to log in', async ({ browser }) => {
    const visitor = await browser.newPage();
    await visitor.goto('/admin/knowledge');
    await visitor.waitForURL((url) => url.pathname === '/login');
    await visitor.close();
});

test('slug, editor and times can’t be sent, not even by staff', async () => {
    const other = await saved(OTHER);
    for (const body of [{ slug: 'mine' }, { updated_by: admin.id }, { updated_at: '2020-01-01' }, { published_at: '2020-01-01' }, { created_at: '2020-01-01' }]) {
        const changed = await rest(staff.jwt, `knowledge_articles?id=eq.${other.id}`, { method: 'PATCH', body });
        expect(changed.status, JSON.stringify(body)).toBe(403);
        const created = await rest(staff.jwt, 'knowledge_articles', { method: 'POST', body: { title: 'E2E sent', category: 'faq', ...body } });
        expect(created.status, JSON.stringify(body)).toBe(403);
    }
    expect(await saved(OTHER)).toEqual(other);
});

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------
test('staff open it from the sidebar; "Ask the assistant" waits for later', async () => {
    await page.locator('.adminSidebar').getByRole('link', { name: 'AI knowledge' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    await expect(page.locator('.adminTopBar h1')).toHaveText('AI knowledge');
    await expect(page.getByRole('button', { name: /Ask the assistant/ })).toBeDisabled();
    await expect(row(OTHER)).toContainText('House rules');
    await expect(row(OTHER)).toContainText(`Edited by ${names.get(staff.id)} · just now`);
});

test('a new article: tips, what is missing, a live preview, saved as a draft', async () => {
    await page.getByRole('button', { name: 'New article' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge\/new$/);
    await expect(page.locator('.kbTips li')).toHaveText([
        'One topic per article.',
        'Short, factual sentences.',
        'Only real prices and real rules.',
        'Customers may read this: nothing private or internal.',
    ]);

    await button('Publish').click();
    const missing = page.locator('.kbMissing');
    await expect(missing.getByRole('listitem')).toHaveText(['Give the article a title.', 'Pick the article’s category.', 'Write the article’s text.']);
    // A draft needs no text.
    await button('Save draft').click();
    await expect(missing.getByRole('listitem')).toHaveText(['Give the article a title.', 'Pick the article’s category.']);

    await page.getByLabel('Article title').fill(TITLE);
    await pickOption(page, page.locator('.kbForm'), 'Article category', 'Policy');
    await expect(missing).toHaveCount(0);
    await expect(preview()).toContainText(TITLE);
    await expect(preview()).toContainText('The text shows here as you write.');

    const images = [];
    page.on('request', (request) => request.url().includes('example.com') && images.push(request.url()));
    await page.getByLabel('Article text').fill(
        '# Refunds\n\n- Before **24 hours**: 100%\n- After: [ask us](https://example.com/ask)\n\n| When | Back |\n|---|---|\n| Late | 0% |\n\n<img src=x onerror="window.hacked = true">\n\n![photo](https://example.com/photo.png)'
    );
    const text = preview().locator('.kbMarkdown');
    await expect(text.getByRole('heading', { name: 'Refunds' })).toBeVisible();
    await expect(text.locator('li strong')).toHaveText('24 hours');
    await expect(text.locator('td').first()).toHaveText('Late');
    await expect(text.getByRole('link', { name: 'ask us' })).toHaveAttribute('rel', /noopener/);
    // Raw HTML is shown, not run; images aren't loaded.
    await expect(text).toContainText('<img src=x');
    await expect(text.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
    expect(images).toEqual([]);
    // Typing goes on showing.
    await page.getByLabel('Article text').fill('Cancel before **24 hours**: 100% back.');
    await expect(text).toHaveText('Cancel before 24 hours: 100% back.');

    await button('Save draft').click();
    await expectToast(page, 'Draft saved');
    await expect(page).toHaveURL(/\/admin\/knowledge\/\d+$/);
    await expect(pill()).toHaveText('In draft');
    await expect(button('Save draft')).toBeDisabled();

    const article = await saved();
    expect(article).toMatchObject({ category: 'policy', body: 'Cancel before **24 hours**: 100% back.', status: 'draft', updated_by: staff.id, published_at: null });
    expect(article.slug).toBe(`e2e-huy-phong-${RUN}`);
});

test('publish it: the server notes when', async () => {
    await openArticle();
    await button('Publish').click();
    await expectToast(page, 'Article published');
    await expect(pill()).toHaveText('Published');
    await expect(page.locator('.kbNotice')).toContainText('saving changes the published text at once');
    const article = await saved();
    expect(article.status).toBe('published');
    expect(Math.abs(Date.now() - Date.parse(article.published_at))).toBeLessThan(60_000);
});

test('change it while published: the text changes, the publication time stays', async () => {
    const before = await saved();
    await openArticle();
    await expect(button('Save changes')).toBeDisabled();
    await page.getByLabel('Article text').fill('');
    await button('Save changes').click();
    await expect(page.locator('.kbMissing')).toContainText('Write the article’s text.');
    await page.getByLabel('Article text').fill('Cancel before 24 hours: 90% back.');
    await expect(page.locator('.kbUnsaved')).toBeVisible();
    await button('Save changes').click();
    await expectToast(page, 'Changes published');
    await expect(page.locator('.kbUnsaved')).toHaveCount(0);
    const after = await saved();
    expect(after).toMatchObject({ body: 'Cancel before 24 hours: 90% back.', status: 'published', published_at: before.published_at, slug: before.slug });
    expect(Date.parse(after.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
});

test('whoever edits last shows in the list', async () => {
    const article = await saved();
    expect((await rest(admin.jwt, `knowledge_articles?id=eq.${article.id}`, { method: 'PATCH', body: { body: 'Cancel before 24 hours: 80% back.' } })).status).toBe(204);
    expect((await saved()).updated_by).toBe(admin.id);
    await page.goto('/admin/knowledge');
    await expect(row()).toContainText(`Edited by ${names.get(admin.id)} · just now`);
});

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------
test('filters by category and status and searches titles; the filters stay in the URL', async () => {
    await page.goto('/admin/knowledge');
    await expect(row()).toBeVisible();

    await page.getByRole('button', { name: /Article category/ }).click();
    await page.getByRole('option', { name: /^House rules/ }).click();
    await expect(page).toHaveURL(/category=house_rules/);
    await expect(row(OTHER)).toBeVisible();
    await expect(row()).toHaveCount(0);
    await page.reload();
    await expect(row(OTHER)).toBeVisible();
    await expect(row()).toHaveCount(0);

    await page.goto('/admin/knowledge');
    await page.getByRole('group', { name: 'Article status' }).getByRole('button', { name: /Drafts/ }).click();
    await expect(page).toHaveURL(/status=draft/);
    await expect(row()).toHaveCount(0);
    await page.getByRole('group', { name: 'Article status' }).getByRole('button', { name: /Published/ }).click();
    await expect(row()).toBeVisible();

    // Accents or not, in any case.
    await page.getByLabel('Search by title').fill(`huy PHONG ${RUN}`);
    await expect(page.locator('.kbRows li')).toHaveCount(1);
    await expect(row()).toBeVisible();
    await expect(page).toHaveURL(/q=huy/);
    await page.reload();
    await expect(page.getByLabel('Search by title')).toHaveValue(`huy PHONG ${RUN}`);
    await expect(page.locator('.kbRows li')).toHaveCount(1);

    await page.getByLabel('Search by title').fill('E2E nothing like this');
    await expect(page.getByText('No article fits')).toBeVisible();
    await page.getByRole('button', { name: 'Show every article' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    await expect(row()).toBeVisible();
    await expect(row(OTHER)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Unpublish, leave, delete
// ---------------------------------------------------------------------------
test('unpublish it: back to a draft', async () => {
    await openArticle();
    await button('Unpublish').click();
    await expectToast(page, 'Article unpublished');
    await expect(pill()).toHaveText('In draft');
    expect(await saved()).toMatchObject({ status: 'draft', published_at: null, updated_by: staff.id });
});

test('leaving with unsaved changes asks first', async () => {
    const before = await saved();
    await openArticle();
    await page.getByLabel('Article text').fill('Not saved');
    await page.getByRole('button', { name: 'Back to the articles' }).click();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Article text')).toHaveValue('Not saved');
    await page.getByRole('button', { name: 'Back to the articles' }).click();
    await page.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    expect(await saved()).toEqual(before);
});

test('delete it: asked first, then gone', async () => {
    await openArticle();
    const url = pathname(page);
    await button('Delete').click();
    await expect(page.getByRole('dialog')).toContainText(`Delete the article “${TITLE}”?`);
    await page.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await saved()).toBeTruthy();

    await button('Delete').click();
    await page.getByRole('button', { name: 'Delete article' }).click();
    await expectToast(page, 'Article deleted');
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    await expect(row()).toHaveCount(0);
    expect(await saved()).toBeUndefined();

    await page.goto(url);
    await expect(page.getByText('This article doesn’t exist any more')).toBeVisible();
    await page.goto('/admin/knowledge/not-a-number');
    await expect(page.getByText('This article doesn’t exist any more')).toBeVisible();
    await page.getByRole('button', { name: 'Back to the articles' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
});

// ---------------------------------------------------------------------------
// Activity, Vietnamese
// ---------------------------------------------------------------------------
test('every step is on the admin’s Activity page, never the text', async ({ browser }) => {
    const log = (await rest(admin.jwt, `activity_log?select=action,actor_id,label,meta,changes&entity=eq.knowledge_articles&label=eq.${encodeURIComponent(TITLE)}&order=id`)).data;
    expect(log.map((entry) => entry.action)).toEqual([
        'knowledge_created', 'knowledge_published', 'knowledge_updated', 'knowledge_updated', 'knowledge_unpublished', 'knowledge_deleted',
    ]);
    expect(JSON.stringify(log)).not.toContain('24 hours');

    const theirs = await browser.newPage();
    await login(theirs, 'admin@demo.oopsdance.test');
    await theirs.goto('/admin/activity');
    await expect(theirs.locator('.alogFeed').getByText(`published the knowledge article “${TITLE}”`).first()).toBeVisible();
    // Admins have the page too.
    await theirs.goto('/admin/knowledge');
    await expect(theirs.locator('.kbRows li').filter({ hasText: OTHER })).toBeVisible();
    await theirs.close();
});

test('it reads in Vietnamese too', async () => {
    await page.goto('/admin/knowledge');
    await page.locator('.adminTopBar').getByRole('button', { name: 'Tiếng Việt' }).click();
    await expect(page.locator('.adminTopBar h1')).toHaveText('Kiến thức cho AI');
    await expect(row(OTHER)).toContainText('Nội quy');
    await row(OTHER).getByRole('link').click();
    await expect(page.locator('.kbEditorActions').getByRole('button', { name: 'Gỡ xuống' })).toBeVisible();
    await expect(page.locator('.kbTips')).toContainText('đừng ghi thông tin nội bộ');
    expect(await page.evaluate(() => [...(window.__i18nMissing ?? [])])).toEqual([]);
    await page.locator('.adminTopBar').getByRole('button', { name: 'English' }).click();
});
