import { test, expect } from '@playwright/test';
import { expectToast, login, rest, rpc, serviceKey, studioToday, token } from './support.js';

// Asking to join a class, the student's side: on /classes a class card offers "Ask to join" → the dialog (start
// choice when offered, a note) → "Request sent!"; the card then shows the request as waiting, asking again is
// refused, My classes lists it with the note and cancels it, after which the card offers "Ask to join" again.
// Visitors get "Join this class", which goes through log in and comes back with the dialog open; instructors get
// no way in. The class is read from the running stack: one the student isn't in and that takes new students.
// Approving is the staff spec's job (with guest02).

test.describe.configure({ mode: 'serial' });

const EMAIL = 'guest@demo.oopsdance.test';
const NOTE = `Two years of K-pop covers, e2e ${Date.now()}`;

let page;
let me;
let key;
let cls; // the list_public_classes() row of the class asked for

const card = (target) => target.locator(`#class-${cls.id}`);
const joinDialog = (target) => target.getByRole('dialog').filter({ hasText: 'Ask to join' });

// Removes the student's requests for the class (left over from an earlier run, or made here).
async function clearRequests() {
    const res = await rest(key, `class_join_requests?class_id=eq.${cls.id}&student_id=eq.${me.id}`, { method: 'DELETE' });
    expect(res.status).toBeLessThan(300);
}

test.beforeAll(async ({ browser }) => {
    key = await serviceKey();
    if (!key) throw new Error('This spec needs the local service role key (SUPABASE_SERVICE_ROLE_KEY or `supabase status`).');
    me = await token(EMAIL);
    const today = await studioToday();
    const listed = (await rpc(me.jwt, 'list_public_classes')).data;
    const places = (await rest(me.jwt, `class_students?select=class_id,leaves_after&student_id=eq.${me.id}`)).data;
    const closed = new Set((await rest(null, 'classes?select=id&ended_on=not.is.null')).data.map((row) => row.id));
    const inClass = new Set(places.filter((row) => !row.leaves_after || row.leaves_after >= today).map((row) => row.class_id));
    cls = listed.find((row) => !inClass.has(row.id) && !closed.has(row.id));
    if (!cls) throw new Error('Every running class already has the demo student in it.');
    await clearRequests();
    page = await browser.newPage();
});

test.afterAll(async () => {
    await clearRequests();
    await page?.close();
});

test('the card offers "Ask to join" and the dialog sends a request', async () => {
    await login(page, EMAIL);
    await page.goto('/classes');
    const ask = card(page).getByRole('button', { name: 'Ask to join' });
    await ask.scrollIntoViewIfNeeded();
    await ask.click();

    const dialog = joinDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(cls.name);
    await expect(dialog.getByRole('heading', { name: 'What happens after you ask' })).toBeVisible();
    // With a course running and the next one planned, the student picks; "Start now" is the default.
    const choices = dialog.getByRole('radiogroup');
    if (await choices.count()) await expect(choices.getByRole('radio', { name: /Start now/ })).toBeChecked();
    await dialog.getByLabel('A note for the studio (optional)').fill(NOTE);
    await expect(dialog.getByText(`${NOTE.length} of 500 characters`)).toBeVisible();
    await dialog.getByRole('button', { name: 'Send request' }).click();

    await expect(dialog.getByRole('heading', { name: 'Request sent!' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Go to My classes/ })).toBeVisible();
    const rows = (await rest(me.jwt, `class_join_requests?select=status,start_pref,note&class_id=eq.${cls.id}`)).data;
    expect(rows).toEqual([{ status: 'pending', start_pref: 'now', note: NOTE }]);
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toBeHidden();
});

test('the card now shows the request as waiting, and the pill opens it', async () => {
    const pill = card(page).getByRole('button', { name: 'Request sent · waiting for the studio' });
    await expect(pill).toBeVisible();
    await expect(card(page).getByRole('button', { name: 'Ask to join' })).toHaveCount(0);
    await pill.click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Your request' });
    await expect(dialog).toContainText('Waiting for the studio');
    await expect(dialog).toContainText(NOTE);
    await expect(dialog.getByRole('button', { name: 'Cancel request' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
});

test('asking again is refused', async () => {
    const res = await rpc(me.jwt, 'class_join_request', { p_class_id: cls.id, p_start: 'now', p_note: null });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.data)).toContain('already asked to join this class');
});

test('My classes lists it as waiting, with the note, and cancels it', async () => {
    await page.goto('/profile/my-classes');
    const requests = page.locator('.jrCard');
    await expect(requests.getByRole('heading', { name: 'Your requests' })).toBeVisible();
    const row = requests.locator('.jrRow').filter({ hasText: cls.name });
    await expect(row).toContainText('Waiting for the studio');
    await expect(row).toContainText(NOTE);
    await expect(row).toContainText('Start now');

    await row.getByRole('button', { name: 'Cancel request' }).click();
    await expect(row).toContainText('Cancel this request?');
    await row.getByRole('button', { name: 'Yes, cancel it' }).click();
    await expectToast(page, 'Request cancelled.');
    await expect(row.locator('.jrPill')).toHaveText('Cancelled');
    await expect(row.getByRole('link', { name: 'Pick another class' })).toBeVisible();
    const rows = (await rest(me.jwt, `class_join_requests?select=status&class_id=eq.${cls.id}`)).data;
    expect(rows).toEqual([{ status: 'cancelled' }]);
});

test('after cancelling, the card offers "Ask to join" again', async () => {
    await page.goto('/classes');
    await expect(card(page).getByRole('button', { name: 'Ask to join' })).toBeVisible();
    await expect(card(page).getByRole('button', { name: /Request sent/ })).toHaveCount(0);
});

test('a visitor\'s "Join this class" goes through log in and comes back with the dialog open', async ({ browser }) => {
    const visitor = await browser.newPage();
    await visitor.goto('/classes');
    const join = card(visitor).getByRole('link', { name: 'Join this class' });
    await join.scrollIntoViewIfNeeded();
    await join.click();
    await visitor.waitForURL((url) => url.pathname === '/login');
    await visitor.getByLabel('Email').fill(EMAIL);
    await visitor.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? 'OopsDemo@2026');
    await visitor.getByRole('button', { name: /login/i }).click();

    await visitor.waitForURL((url) => url.pathname === '/classes');
    const dialog = joinDialog(visitor);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(cls.name);
    // The ?join= that brought them here is gone, so a refresh doesn't open it again.
    await expect.poll(() => new URL(visitor.url()).searchParams.has('join')).toBe(false);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await visitor.close();
});

test('an instructor gets no way in on /classes', async ({ browser }) => {
    const teacher = await browser.newPage();
    await login(teacher, 'instructor@demo.oopsdance.test');
    await teacher.goto('/classes');
    await expect(card(teacher)).toBeVisible();
    await expect(teacher.locator('.hpClassGrid').getByText(/Ask to join|Join this class|Request sent|You’re in this class/)).toHaveCount(0);
    await teacher.close();
});
