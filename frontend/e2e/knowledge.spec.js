// AI knowledge (/admin/knowledge; supabase/migrations/20261117003300_knowledge_articles.sql): staff write an article as it
// will look (the editor itself: knowledge-editor.spec.js) or in Markdown with a live preview, save it as a draft, publish
// it, change it while published, unpublish and delete it; what isn't saved is kept in the browser and offered again; the
// list's filters and search stay in the URL; visitors, guests and instructors get neither the page nor the rows (their
// own JWTs); slug, editor and times are the server's. Works on articles of its own (titles "E2E …", deleted afterwards).
import { test, expect } from '@playwright/test';
import { expectToast, login, pathname, pickOption, rest, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const TITLE = `E2E Huỷ phòng ${RUN}`;
const OTHER = `E2E Nội quy ${RUN}`;
const UNSAVED = `E2E Chưa lưu ${RUN}`;
const TYPED_ON = `E2E Gõ tiếp ${RUN}`;
const FIELDS = 'id,slug,title,category,body,status,updated_by,created_at,updated_at,published_at';
const LIKE_E2E = `like.${encodeURIComponent('E2E *')}`;

let page;
let staff; // { jwt, id }
let admin;
let names; // id → full name
const errors = []; // on the staff's page: none expected

const saved = async (title = TITLE) => (await rest(staff.jwt, `knowledge_articles?select=${FIELDS}&title=eq.${encodeURIComponent(title)}`)).data[0];
const row = (title = TITLE) => page.locator('.kbRows li').filter({ hasText: title });
const pill = () => page.locator('.kbEditorTitle .kbPill');
const preview = () => page.locator('.kbPreviewCol');
const text = () => page.getByLabel('Article text');
const button = (name) => page.locator('.kbEditorActions').getByRole('button', { name, exact: true });
const openArticle = async (title = TITLE) => {
    await page.goto('/admin/knowledge');
    await row(title).getByRole('link').click();
    await expect(page.locator('.kbEditorTitle h2')).toHaveText(title);
};
// The unsaved texts this browser keeps (lib/unsavedArticles.js).
const unsavedKeys = (where) => where.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('oops-article-draft')));
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
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close();
    await cleanUp();
    expect(errors, 'errors on the page').toEqual([]);
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

test('a new article: tips, what is missing, written as it looks, saved as a draft', async () => {
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

    // Written as it looks, stored as Markdown.
    await text().click();
    await page.keyboard.type('Cancel before ');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('24 hours');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type(': 100% back.');
    await expect(text().locator('strong')).toHaveText('24 hours');
    await expect(page.locator('.kbCount')).toHaveText('38 of 20,000 characters');

    await button('Save draft').click();
    await expectToast(page, 'Draft saved');
    await expect(page).toHaveURL(/\/admin\/knowledge\/\d+$/);
    await expect(pill()).toHaveText('In draft');
    await expect(text()).toHaveText('Cancel before 24 hours: 100% back.');
    await expect(button('Save draft')).toBeDisabled();

    const article = await saved();
    expect(article).toMatchObject({ category: 'policy', body: 'Cancel before **24 hours**: 100% back.', status: 'draft', updated_by: staff.id, published_at: null });
    expect(article.slug).toBe(`e2e-huy-phong-${RUN}`);
});

test('the Markdown itself is a button away, with a live preview; raw HTML isn’t run, images aren’t loaded', async () => {
    await page.goto('/admin/knowledge/new');
    await page.getByRole('button', { name: 'Write in Markdown' }).click();
    await expect(preview()).toContainText('The text shows here as you write.');
    await page.getByLabel('Article title').fill('E2E preview');
    await expect(preview()).toContainText('E2E preview');

    const images = [];
    page.on('request', (request) => request.url().includes('example.com') && images.push(request.url()));
    await text().fill(
        '# Refunds\n\n- Before **24 hours**: 100%\n- After: [ask us](https://example.com/ask)\n\n| When | Back |\n|---|---|\n| Late | 0% |\n\n<img src=x onerror="window.hacked = true">\n\n![photo](https://example.com/photo.png)'
    );
    const shown = preview().locator('.kbMarkdown');
    await expect(shown.getByRole('heading', { name: 'Refunds' })).toBeVisible();
    await expect(shown.locator('li strong')).toHaveText('24 hours');
    await expect(shown.locator('td').first()).toHaveText('Late');
    await expect(shown.getByRole('link', { name: 'ask us' })).toHaveAttribute('rel', /noopener/);
    await expect(shown).toContainText('<img src=x');
    await expect(shown.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
    expect(images).toEqual([]);
    // Typing goes on showing.
    await text().fill('Cancel before **24 hours**: 100% back.');
    await expect(shown).toHaveText('Cancel before 24 hours: 100% back.');
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard it' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    expect(await unsavedKeys(page)).toEqual([]);
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

test('what isn’t saved survives leaving: menu, Back and reload, no questions asked', async () => {
    const before = await saved();
    const dialog = page.getByRole('dialog');

    // The sidebar, right after typing.
    await openArticle();
    await text().fill('Not saved: menu');
    await page.locator('.adminSidebar').getByRole('link', { name: 'Expenses' }).click();
    await expect(page).toHaveURL(/\/admin\/expenses$/);
    expect(await saved()).toEqual(before);
    await page.goto('/admin/knowledge');
    await expect(row()).toContainText('Unsaved changes on this device');
    await expect(row(OTHER)).not.toContainText('Unsaved changes');

    // Coming back asks; nothing changes until it is answered.
    await row().getByRole('link').click();
    await expect(dialog).toContainText(`You left “${TITLE}” without saving (just now).`);
    await expect(dialog).toContainText('Not saved: menu');
    await expect(dialog).not.toContainText('has changed since then');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Carry on writing' }).click();
    await expect(text()).toHaveText('Not saved: menu');
    await expect(page.locator('.kbUnsaved')).toContainText('Not saved yet, kept on this device');

    // A reload.
    await text().fill('Not saved: reload');
    await page.reload();
    await dialog.getByRole('button', { name: 'Carry on writing' }).click();
    await expect(text()).toHaveText('Not saved: reload');

    // The browser's Back button, then the arrow of the page.
    await text().fill('Not saved: back');
    await page.goBack();
    await expect(page.locator('.kbEditor')).toHaveCount(0);
    await row().getByRole('link').click();
    await dialog.getByRole('button', { name: 'Carry on writing' }).click();
    await expect(text()).toHaveText('Not saved: back');
    await page.getByRole('button', { name: 'Back to the articles' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    await expect(dialog).toHaveCount(0);

    // Someone else saved it meanwhile: the question says so. Discarding shows what is saved.
    expect((await rest(admin.jwt, `knowledge_articles?id=eq.${before.id}`, { method: 'PATCH', body: { body: 'Changed by the admin.' } })).status).toBe(204);
    await row().getByRole('link').click();
    await expect(dialog).toContainText(`The saved article has changed since then (Edited by ${names.get(admin.id)} · just now).`);
    await dialog.getByRole('button', { name: 'Discard it' }).click();
    await expect(text()).toHaveText('Changed by the admin.');
    await expect(page.locator('.kbUnsaved')).toHaveCount(0);
    await page.reload();
    await expect(text()).toHaveText('Changed by the admin.');
    await expect(dialog).toHaveCount(0);

    // Discarding while writing, and saving, leave nothing behind.
    await text().fill('Not saved: discard');
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(text()).toHaveText('Not saved: discard');
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await dialog.getByRole('button', { name: 'Discard it' }).click();
    await expect(text()).toHaveText('Changed by the admin.');
    await text().fill('Saved after all.');
    await button('Save draft').click();
    await expectToast(page, 'Draft saved');
    expect(await unsavedKeys(page)).toEqual([]);
    expect((await saved()).body).toBe('Saved after all.');
});

test('a new article left unsaved is a draft in the list, on this device and for this account only', async ({ browser }) => {
    await page.goto('/admin/knowledge/new');
    await page.getByLabel('Article title').fill(UNSAVED);
    await pickOption(page, page.locator('.kbForm'), 'Article category', 'FAQ');
    await page.getByLabel('Article text').fill('Half a sentence');
    await page.locator('.adminSidebar').getByRole('link', { name: 'Dashboard' }).click();
    await page.locator('.adminSidebar').getByRole('link', { name: 'AI knowledge' }).click();

    const draft = page.locator('.kbUnsavedRow');
    await expect(draft).toContainText(UNSAVED);
    await expect(draft).toContainText('Unsaved draft');
    await expect(draft).toContainText('Only on this device · just now');
    expect(await saved(UNSAVED)).toBeUndefined();
    // Another account using this same browser doesn't get it.
    const theirs = await browser.newPage();
    await login(theirs, 'admin@demo.oopsdance.test');
    await theirs.evaluate(([key, value]) => localStorage.setItem(key, value), [
        `oops-article-draft:${staff.id}:new`,
        await page.evaluate((key) => localStorage.getItem(key), `oops-article-draft:${staff.id}:new`),
    ]);
    await theirs.goto('/admin/knowledge');
    await expect(theirs.locator('.kbRows li').first()).toBeVisible();
    await expect(theirs.locator('.kbUnsavedRow')).toHaveCount(0);
    await theirs.getByRole('button', { name: 'New article' }).click();
    await expect(theirs.getByLabel('Article text')).toHaveText('');
    await expect(theirs.getByRole('dialog')).toHaveCount(0);
    await theirs.close();

    // From the list it carries on right away; from "New article" it asks.
    await draft.getByRole('link').click();
    await expect(page.getByLabel('Article text')).toHaveText('Half a sentence');
    await expect(page.getByLabel('Article title')).toHaveValue(UNSAVED);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to the articles' }).click();
    await page.getByRole('button', { name: 'New article' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Carry on writing' }).click();

    // Saved: an ordinary draft, the unsaved one is gone.
    await button('Save draft').click();
    await expectToast(page, 'Draft saved');
    await expect(page).toHaveURL(/\/admin\/knowledge\/\d+$/);
    expect(await saved(UNSAVED)).toMatchObject({ category: 'faq', body: 'Half a sentence', status: 'draft' });
    expect(await unsavedKeys(page)).toEqual([]);
    await page.goto('/admin/knowledge');
    await expect(row(UNSAVED)).toContainText('In draft');
    await expect(draft).toHaveCount(0);

    // Discarded from the list.
    await page.goto('/admin/knowledge/new');
    await page.getByLabel('Article text').fill('Never mind');
    await page.getByRole('button', { name: 'Back to the articles' }).click();
    await expect(draft).toContainText('Untitled article');
    await page.getByRole('button', { name: 'Discard the unsaved draft' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Keep it' }).click();
    await expect(draft).toBeVisible();
    await page.getByRole('button', { name: 'Discard the unsaved draft' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard it' }).click();
    await expect(draft).toHaveCount(0);
    expect(await unsavedKeys(page)).toEqual([]);
});

test('what is typed while a new article is being saved isn’t lost', async () => {
    await page.goto('/admin/knowledge/new');
    await page.getByLabel('Article title').fill(TYPED_ON);
    await pickOption(page, page.locator('.kbForm'), 'Article category', 'FAQ');
    await page.getByLabel('Article text').fill('First');
    await page.route('**/rest/v1/knowledge_articles*', async (route) => {
        if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
    });
    await button('Save draft').click();
    await page.getByLabel('Article text').fill('First and second');
    await expect(page).toHaveURL(/\/admin\/knowledge\/\d+$/);
    await page.unroute('**/rest/v1/knowledge_articles*');
    await expect(page.getByLabel('Article text')).toHaveText('First and second');
    await expect(page.locator('.kbUnsaved')).toBeVisible();
    expect((await saved(TYPED_ON)).body).toBe('First');
    await button('Save draft').click();
    await expect(page.locator('.kbUnsaved')).toHaveCount(0);
    expect((await saved(TYPED_ON)).body).toBe('First and second');
    expect(await unsavedKeys(page)).toEqual([]);
});

test('signing out takes the unsaved text off the computer', async ({ browser }) => {
    const mine = await browser.newPage();
    await login(mine, 'staff@demo.oopsdance.test');
    await mine.goto('/admin/knowledge/new');
    await mine.getByLabel('Article text').fill('Shared computer');
    expect(await unsavedKeys(mine)).toEqual([`oops-article-draft:${staff.id}:new`]);
    await mine.locator('.adminSidebar').getByRole('button', { name: 'Log Out' }).click();
    await mine.waitForURL((url) => url.pathname === '/home');
    await expect.poll(() => unsavedKeys(mine)).toEqual([]);
    await mine.close();
});

test('a browser that can’t keep it: going back asks first', async ({ browser }) => {
    const mine = await browser.newPage();
    await login(mine, 'staff@demo.oopsdance.test');
    await mine.addInitScript(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key, value) {
            if (key.startsWith('oops-article-draft')) throw new DOMException('full', 'QuotaExceededError');
            return set.call(this, key, value);
        };
    });
    await mine.goto('/admin/knowledge/new');
    await mine.getByLabel('Article text').fill('At risk');
    await expect(mine.locator('.kbUnsaved')).toContainText('Unsaved changes');
    await mine.getByRole('button', { name: 'Back to the articles' }).click();
    await mine.getByRole('button', { name: 'Keep editing' }).click();
    await expect(mine.getByLabel('Article text')).toHaveText('At risk');
    await mine.getByRole('button', { name: 'Back to the articles' }).click();
    await mine.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(mine).toHaveURL(/\/admin\/knowledge$/);
    await mine.close();
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
        'knowledge_created', 'knowledge_published', 'knowledge_updated', 'knowledge_updated', 'knowledge_unpublished',
        'knowledge_updated', 'knowledge_updated', 'knowledge_deleted',
    ]);
    expect(JSON.stringify(log)).not.toContain('24 hours');

    const theirs = await browser.newPage();
    await login(theirs, 'admin@demo.oopsdance.test');
    // Searched for, so earlier runs' lines don't fold into the same row ("published 2 knowledge articles").
    await theirs.goto(`/admin/activity?q=${RUN}`);
    const lines = theirs.locator('.alogFeed .alogSentence');
    await expect(lines.filter({ hasText: `${names.get(staff.id)} published the knowledge article “${TITLE}”` })).toHaveCount(1);
    await expect(lines.filter({ hasText: `${names.get(staff.id)} unpublished the knowledge article “${TITLE}”` })).toHaveCount(1);
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
