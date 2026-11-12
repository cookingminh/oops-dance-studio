// The website timetable's look (site_settings.timetable_template): staff pick it above the directory's weekly
// timetable — the Red card, then the Poster again with the arrow keys — and the public Classes page follows;
// the admin's Activity page tells who switched it. Then a class's level, set in its details form, saved and shown
// on its directory card, and cleared again. The look ends on 'poster' and the class gets its level back, whatever
// happens (RPC / REST as staff).
import { test, expect } from '@playwright/test';
import { expectToast, login, pickOption, rest, rpc, staffJwt, studioToday } from './support.js';

test.describe.configure({ mode: 'serial' });

const HUB = '/admin/classes';
const LEVELS = { newbie: 'Newbie', basic: 'Basic', advanced: 'Advanced' };

const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);
const template = async () => (await rest(null, 'site_settings?select=timetable_template&id=eq.1')).data[0]?.timetable_template;
const levelOf = async (id) => (await rest(await staffJwt(), `classes?select=level&id=eq.${id}`)).data[0]?.level;

let page; // staff
let site; // a visitor on the Classes page
let looks; // the "On the website" radio group
let cls; // { id, name, level }: a running class whose level the spec changes and puts back

test.beforeAll(async ({ browser }) => {
    const jwt = await staffJwt();
    // Start from the default look (an interrupted run may have left the red card).
    ok(await rpc(jwt, 'site_set_timetable_template', { p_template: 'poster' }), 'start on the poster');
    const today = await studioToday();
    cls = (await rest(jwt, `classes?select=id,name,level&starts_on=lte.${today}&ended_on=is.null&order=id&limit=1`)).data[0];
    expect(cls, 'a running class').toBeTruthy();

    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
    looks = page.getByRole('radiogroup', { name: 'On the website' });
    site = await browser.newPage();
});

test.afterAll(async () => {
    const jwt = await staffJwt();
    ok(await rpc(jwt, 'site_set_timetable_template', { p_template: 'poster' }), 'back to the poster');
    expect(await template()).toBe('poster');
    if (cls) {
        ok(await rest(jwt, `classes?id=eq.${cls.id}`, { method: 'PATCH', body: { level: cls.level } }), 'level back');
        expect(await levelOf(cls.id)).toBe(cls.level);
    }
    await page?.close();
    await site?.close();
});

test('the Timetable view offers both looks, the one in use marked', async () => {
    await page.goto(`${HUB}?view=timetable`);
    await expect(looks.getByRole('radio', { name: 'Poster' })).toBeChecked();
    await expect(looks.getByRole('radio', { name: 'Red card' })).not.toBeChecked();
    const link = page.getByRole('link', { name: /See it on the website/ });
    await expect(link).toHaveAttribute('href', '/classes#timetable');
    await expect(link).toHaveAttribute('target', '_blank');
    // The weekly timetable is still right there.
    await expect(page.getByRole('list', { name: 'Weekly timetable' })).toBeVisible();
});

test('picking the Red card saves it and the website shows the red card', async () => {
    await looks.getByRole('radio', { name: 'Red card' }).click();
    await expectToast(page, 'The website now shows the Red card timetable.');
    await expect(looks.getByRole('radio', { name: 'Red card' })).toBeChecked();
    await expect.poll(template).toBe('brush');

    await page.reload();
    await expect(looks.getByRole('radio', { name: 'Red card' })).toBeChecked();

    await site.goto('/classes#timetable');
    await expect(site.locator('#timetable .hpTimetableCard')).toBeVisible();
    await expect(site.locator('.ttPoster')).toHaveCount(0);
    await expect(site.locator('.timeTableDiv .weekSlot').first()).toBeVisible();
});

test('an arrow key goes back to the Poster, and so does the website', async () => {
    await looks.getByRole('radio', { name: 'Red card' }).focus();
    await page.keyboard.press('ArrowLeft');
    const poster = looks.getByRole('radio', { name: 'Poster' });
    await expect(poster).toBeChecked();
    await expect(poster).toBeFocused();
    await expectToast(page, 'The website now shows the Poster timetable.');
    await expect.poll(template).toBe('poster');

    await site.reload();
    await expect(site.locator('#timetable .ttPoster')).toBeVisible();
    await expect(site.locator('.hpTimetableCard')).toHaveCount(0);
    await expect(site.locator('.timeTableDiv .weekSlot').first()).toBeVisible();
});

test('the Activity page tells who switched the website timetable', async ({ browser }) => {
    const admin = await browser.newPage();
    try {
        await login(admin, 'admin@demo.oopsdance.test');
        await admin.goto('/admin/activity?area=settings&period=today');
        await expect(admin.locator('.alogFeed .alogEntry').first()).toContainText('switched the website timetable to Poster');
    } finally {
        await admin.close();
    }
});

test('a class’s level is set in its details form and shows on its card', async () => {
    const target = cls.level === 'advanced' ? 'newbie' : 'advanced';
    await page.goto(`${HUB}/${cls.id}?tab=setup`);
    const form = page.locator('form.hubForm');
    await pickOption(page, form, 'Level', LEVELS[target]);
    await form.getByRole('button', { name: 'Save details' }).click();
    await expectToast(page, 'Class updated.');
    await expect.poll(() => levelOf(cls.id)).toBe(target);

    await page.goto(`${HUB}?view=month`);
    await expect(page.getByRole('link', { name: cls.name, exact: true })).toContainText(LEVELS[target]);
});

test('“No level” clears it', async () => {
    await page.goto(`${HUB}/${cls.id}?tab=setup`);
    const form = page.locator('form.hubForm');
    await pickOption(page, form, 'Level', 'No level');
    await form.getByRole('button', { name: 'Save details' }).click();
    await expectToast(page, 'Class updated.');
    await expect.poll(() => levelOf(cls.id)).toBeNull();
});
