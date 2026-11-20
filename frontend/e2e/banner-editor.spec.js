// Homepage banners, the staff side (/admin/banners; supabase/migrations/20261117002200_home_banners.sql): staff make a
// banner from two posters, give its button an own link (a Facebook post), drag and resize it on the desktop preview,
// put it bottom-centre on the phone poster, save; the homepage shows it with that link in a new tab; turned off it
// leaves the homepage; deleted it leaves the list. Works on a banner of its own (deleted afterwards).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { API, ANON, expectToast, login, rest, rpc, staffJwt } from './support.js';

test.describe.configure({ mode: 'serial' });

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const NAME = `E2E Audition ${Date.now()}`;
const FACEBOOK = 'https://www.facebook.com/oopsdancestudio/posts/audition-2026';

let page;
const row = () => page.locator('.bnRow[data-banner]').filter({ hasText: NAME });
const saved = async () => (await rest(await staffJwt(), `home_banners?select=*&name=eq.${encodeURIComponent(NAME)}`)).data[0];
const liveNames = async () => ((await rpc(null, 'home_banners_live')).data ?? []).map((banner) => banner.name);

// Whatever a failed run left: the banner and its posters.
async function cleanUp() {
    const jwt = await staffJwt();
    const rows = (await rest(jwt, `home_banners?select=id&name=like.${encodeURIComponent('E2E Audition*')}`)).data ?? [];
    for (const banner of rows) {
        const paths = (await rpc(jwt, 'home_banner_delete', { p_id: banner.id })).data ?? [];
        if (paths.length) {
            await fetch(`${API}/storage/v1/object/site-assets`, {
                method: 'DELETE',
                headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ prefixes: paths }),
            });
        }
    }
}

test.beforeAll(async ({ browser }) => {
    await cleanUp();
    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close();
    await cleanUp();
});

test('staff make a banner: two posters, a button to a Facebook post, dragged and resized on the preview', async () => {
    await page.goto('/admin/banners');
    await page.getByRole('button', { name: 'New banner' }).first().click();
    await expect(page).toHaveURL(/\/admin\/banners\/new$/);

    await page.getByLabel('Banner name').fill(NAME);
    await page.locator('.bnPosterField.is-desktop input[type="file"]').setInputFiles(path.join(FIXTURES, 'banner-desktop.webp'));
    await expect(page.locator('.bnPosterField.is-desktop .bnVerdict')).toHaveText('1920 × 1080 · fits');
    await page.locator('.bnPosterField.is-phone input[type="file"]').setInputFiles(path.join(FIXTURES, 'banner-phone.webp'));
    await expect(page.locator('.bnPosterField.is-phone .bnVerdict')).toHaveText('1080 × 1920 · fits');
    await page.getByLabel('What the poster says').fill('Audition Oops! Crew: đăng ký trên Facebook.');

    const card = page.locator('.bnButtonCard').first();
    await card.getByLabel('Words on the button').fill('Xem chi tiết');
    await card.getByLabel('Leads to').selectOption('url');
    await card.getByLabel('Link (opens in a new tab)').fill(FACEBOOK);
    await card.getByRole('radio', { name: 'Gold' }).click();

    // The desktop poster (Laptop): drag the button right and up, then widen it from its corner handle.
    await page.getByRole('button', { name: 'Laptop' }).click();
    const button = page.locator('.beBtn').first();
    await expect(button).toHaveText(/Xem chi tiết/);
    const box = await button.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 - 60, { steps: 10 });
    await page.mouse.up();
    const handle = page.locator('.beResize');
    const grip = await handle.boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 30, grip.y + grip.height / 2, { steps: 6 });
    await page.mouse.up();

    // The phone poster: bottom centre from the quick spots.
    await page.getByRole('button', { name: 'Phone', exact: true }).click();
    await card.getByRole('button', { name: 'Bottom centre' }).click();

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectToast(page, 'Banner added to the homepage');
    await expect(page).toHaveURL(/\/admin\/banners$/);
    await expect(row()).toBeVisible();
    await expect(row().locator('.bnState')).toHaveText('Showing');

    const banner = await saved();
    const [first] = banner.buttons;
    expect(first).toMatchObject({ text_vi: 'Xem chi tiết', link: 'url', url: FACEBOOK, color: 'gold' });
    expect(first.desktop.x).toBeGreaterThan(52);
    expect(first.desktop.y).toBeLessThan(78);
    expect(first.desktop.scale).toBeGreaterThan(1.2);
    expect(first.phone.x).toBe(50);
    expect(first.phone.y).toBeGreaterThan(80);
});

test('the homepage shows it, and its button opens the Facebook post in a new tab', async ({ browser }) => {
    expect(await liveNames()).toContain(NAME);
    const visitor = await browser.newPage();
    await visitor.goto('/home');
    const link = visitor.locator(`a.bnBtn[href="${FACEBOOK}"]`).first();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await visitor.close();
});

test('turned off it leaves the homepage; deleted it leaves the list', async ({ browser }) => {
    await page.goto('/admin/banners');
    await row().getByRole('switch').click({ force: true });
    await expect(row().locator('.bnState')).toHaveText('Off');
    await expect.poll(liveNames).not.toContain(NAME);
    const visitor = await browser.newPage();
    await visitor.goto('/home');
    await visitor.waitForTimeout(800);
    await expect(visitor.locator(`a.bnBtn[href="${FACEBOOK}"]`)).toHaveCount(0);
    await visitor.close();

    await row().getByRole('button', { name: `Delete ${NAME}` }).click();
    await page.getByRole('button', { name: 'Delete banner' }).click();
    await expectToast(page, 'Banner deleted');
    await expect(row()).toHaveCount(0);
    expect(await saved()).toBeUndefined();
});
