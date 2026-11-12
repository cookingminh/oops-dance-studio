// A class's pictures on the website, framed by staff in its Setup tab: the class image's position on the Classes
// page card (its dialog previews the real card) and the round photo on the poster timetable (its dialog zooms
// it, the poster follows). Both are saved and seen by a visitor. The class's picture columns and the website's
// timetable look are put back afterwards, whatever happens (REST / RPC as staff).
import { test, expect } from '@playwright/test';
import { expectToast, login, rest, rpc, staffJwt } from './support.js';

test.describe.configure({ mode: 'serial' });

const FRAME_COLUMNS = ['image_pos_x', 'image_pos_y', 'timetable_photo_x', 'timetable_photo_y', 'timetable_photo_zoom'];
const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const template = async () => (await rest(null, 'site_settings?select=timetable_template&id=eq.1')).data[0]?.timetable_template;
const pictureOf = async (id) => (await rest(await staffJwt(), `classes?select=${FRAME_COLUMNS.join(',')}&id=eq.${id}`)).data[0];

let page; // staff
let site; // a visitor
let cls; // a running class with weekly sessions, an image and a timetable photo of its own
let look; // the website's timetable look before the spec

// Puts a NextUI slider on `value` with the keyboard (Home = its minimum, one step per arrow key).
async function slideTo(slider, value, min) {
    await slider.focus();
    await slider.press('Home');
    for (let step = min; step < value; step += 1) await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(value));
}

test.beforeAll(async ({ browser }) => {
    const jwt = await staffJwt();
    const rows = (
        await rest(
            jwt,
            `classes?select=id,name,image_path,timetable_photo_path,${FRAME_COLUMNS.join(',')},schedules:class_schedules(id)` +
                '&ended_on=is.null&image_path=not.is.null&timetable_photo_path=not.is.null&order=id'
        )
    ).data;
    cls = rows.find((row) => row.schedules.length > 0);
    expect(cls, 'a running class with sessions, an image and a timetable photo').toBeTruthy();
    // The poster shows the timetable photos.
    look = await template();
    if (look !== 'poster') ok(await rpc(jwt, 'site_set_timetable_template', { p_template: 'poster' }), 'show the poster');

    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
    site = await browser.newPage();
});

test.afterAll(async () => {
    const jwt = await staffJwt();
    if (cls) {
        const back = Object.fromEntries(FRAME_COLUMNS.map((column) => [column, cls[column]]));
        ok(await rest(jwt, `classes?id=eq.${cls.id}`, { method: 'PATCH', body: back }), 'frames back');
        expect(await pictureOf(cls.id)).toEqual(back);
    }
    if (look && look !== 'poster') ok(await rpc(jwt, 'site_set_timetable_template', { p_template: look }), 'look back');
    await page?.close();
    await site?.close();
});

const setupCard = (title) => page.locator('section.adminCard', { has: page.getByRole('heading', { name: title, exact: true }) });

test('the image dialog previews the Classes card and saves which part of the image it shows', async () => {
    await page.goto(`/admin/classes/${cls.id}?tab=setup`);
    await setupCard('Image').getByRole('button', { name: 'Change image' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Preview on the Classes page' })).toBeVisible();

    // The real card of the Classes page, with this class (and not a link or a button in it).
    const card = dialog.locator('.hpClassCard');
    await expect(card.locator('h3')).toHaveText(cls.name);
    await expect(card.locator('.hpClassMedia img')).toHaveCSS('object-position', `${cls.image_pos_x}% ${cls.image_pos_y}%`);
    const save = dialog.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();

    // A tall poster moves up and down; the preview follows the slider.
    const y = cls.image_pos_y === 20 ? 30 : 20;
    await slideTo(dialog.getByRole('slider', { name: 'Up – down' }), y, 0);
    await expect(card.locator('.hpClassMedia img')).toHaveCSS('object-position', `${cls.image_pos_x}% ${y}%`);
    await expect(save).toBeEnabled();
    await save.click();
    await expectToast(page, 'Class image updated.');
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await pictureOf(cls.id)).image_pos_y).toBe(y);
    // The Setup card's picture is cropped the same way.
    await expect(setupCard('Image').locator('img.hubImage')).toHaveCSS('object-position', `${cls.image_pos_x}% ${y}%`);

    await site.goto('/classes');
    await expect(site.locator(`#class-${cls.id} .hpClassMedia img`)).toHaveCSS('object-position', `${cls.image_pos_x}% ${y}%`);
});

test('the timetable photo dialog zooms the round photo and the poster follows', async () => {
    await setupCard('Photo on the timetable').getByRole('button', { name: 'Change the round photo' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Preview on the timetable' })).toBeVisible();
    await expect(dialog.locator('.frmPoster .ttDisc')).toBeVisible();
    const save = dialog.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();

    const zoom = cls.timetable_photo_zoom === 150 ? 160 : 150;
    const scale = new RegExp(`--pz: ${zoom / 100}(;|$)`);
    await slideTo(dialog.getByRole('slider', { name: 'Zoom' }), zoom, 50);
    await expect(dialog.locator('.ttPhoto img')).toHaveAttribute('style', scale);
    await save.click();
    await expectToast(page, 'Timetable photo saved.');
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await pictureOf(cls.id)).timetable_photo_zoom).toBe(zoom);
    await expect(setupCard('Photo on the timetable').locator('.ttPhoto img')).toHaveAttribute('style', scale);

    // On the poster, every session of the class carries the new frame (the visitor's page loads it again).
    await site.goto('/classes#timetable');
    await site.reload();
    const discs = site.locator('.ttPoster .ttSlot', { has: site.locator('textPath', { hasText: new RegExp(`^${escape(cls.name)}$`) }) });
    await expect(discs.first()).toBeVisible();
    for (const image of await discs.locator('img.instructor').all()) await expect(image).toHaveAttribute('style', scale);
});
