// The homepage hero's slideshow (Components/HomePage/Components/Home, migration 20261117002200_home_banners.sql):
// the studio's slide first, then the banners that show today. The banners are read from home_banners_live at the
// start (so banners other specs add don't break this one): the slide bar moves to a banner with its buttons (words
// and links from the data), pause stops the slide bar, phones get the portrait poster, and with no banner showing
// the hero is the studio slide alone, without a slide bar.
import { test, expect } from '@playwright/test';
import { rest, rpc, serviceKey } from './support.js';

test.describe.configure({ mode: 'serial' });

const PAGES = { timetable: '/classes#timetable', classes: '/classes', register: '/register', rooms: '/rooms', about: '/about' };
const hero = (page) => page.locator('section.hpHero');
const slideOf = (page, banner) => page.locator(`.hpBannerSlide[data-banner="${banner.id}"]`);
const fillScale = (locator) => locator.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
const liveBanners = async () => (await rpc(null, 'home_banners_live')).data ?? [];

let banners = [];

test.beforeAll(async () => {
    banners = await liveBanners();
});

test('the studio slide shows first, with a slide bar for every banner', async ({ page }) => {
    test.skip(banners.length === 0, 'no banner shows today');
    await page.goto('/home');
    await expect(page.locator('#hpHeroTitle')).toHaveText(/Create Slay Memories With Us!/);
    await expect(hero(page)).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(page.locator('.hpStudioSlide')).toHaveClass(/isActive/);
    const segments = page.locator('.hpSeg');
    await expect(segments).toHaveCount(banners.length + 1);
    await expect(segments.first()).toHaveAttribute('aria-current', 'true');
    await expect(segments.nth(1)).toHaveAccessibleName(`Slide 2: ${banners[0].name}`);
    await expect(slideOf(page, banners[0])).toHaveAttribute('aria-label', `2 of ${banners.length + 1}`);
});

test('next shows the first banner, its buttons leading where staff set them', async ({ page }) => {
    test.skip(banners.length === 0, 'no banner shows today');
    await page.goto('/home');
    await hero(page).getByRole('button', { name: 'Next slide' }).click();
    const slide = slideOf(page, banners[0]);
    await expect(slide).toHaveClass(/isActive/);
    await expect(page.locator('.hpStudioSlide')).not.toHaveClass(/isActive/);
    await expect(page.locator('.hpSeg').nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(slide.locator('.bnStage.is-desktop .bnImage')).toBeVisible();
    await expect(slide.locator('.sr-only')).toHaveText(banners[0].alt_text);
    for (const button of banners[0].buttons) {
        const link = slide.locator('.bnBtn', { hasText: button.text_en || button.text_vi });
        await expect(link).toBeVisible();
        if (button.link === 'url') {
            await expect(link).toHaveAttribute('href', button.url);
            await expect(link).toHaveAttribute('target', '_blank');
        } else {
            await expect(link).toHaveAttribute('href', PAGES[button.link]);
        }
    }
    // Back to the studio slide: its buttons are reachable again, the banner's aren't.
    await hero(page).getByRole('button', { name: 'Previous slide' }).click();
    await expect(page.locator('.hpStudioSlide')).toHaveClass(/isActive/);
    await expect(slide).toHaveAttribute('inert', '');
});

test('the slide bar runs, and pause stops it', async ({ page }) => {
    test.skip(banners.length === 0, 'no banner shows today');
    await page.goto('/home');
    const fill = page.locator('.hpSeg').first().locator('.hpSegFill');
    await expect.poll(() => fillScale(fill)).toBeGreaterThan(0.05);

    await hero(page).getByRole('button', { name: 'Pause the slideshow' }).click();
    // Onto the navbar (outside the hero), so only the pause holds it.
    await page.mouse.move(700, 12);
    await expect(hero(page).getByRole('button', { name: 'Play the slideshow' })).toBeVisible();
    const held = await fillScale(fill);
    await page.waitForTimeout(1200);
    expect(await fillScale(fill)).toBeCloseTo(held, 2);
});

test('phones get the portrait poster, and no arrows', async ({ browser }) => {
    test.skip(banners.length === 0, 'no banner shows today');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
        await page.goto('/home');
        await page.locator('.hpSeg').nth(1).click();
        const slide = slideOf(page, banners[0]);
        await expect(slide.locator('.bnStage.is-phone .bnImage')).toBeVisible();
        await expect(slide.locator('.bnStage.is-desktop')).toHaveCount(0);
        await expect(hero(page).getByRole('button', { name: 'Next slide' })).toBeHidden();
    } finally {
        await page.close();
    }
});

test('with no banner showing, the hero is the studio slide alone', async ({ page }) => {
    const key = await serviceKey();
    test.skip(!key, 'needs the local service role key');
    const hidden = [];
    try {
        // Hide what shows (a fifth banner may step in once the first four are hidden: hide that one too).
        for (let round = 0; round < 6; round += 1) {
            const live = await liveBanners();
            if (live.length === 0) break;
            const ids = live.map((b) => b.id);
            const res = await rest(key, `home_banners?id=in.(${ids.join(',')})`, { method: 'PATCH', body: { enabled: false }, prefer: 'return=minimal' });
            expect(res.status).toBeLessThan(300);
            hidden.push(...ids);
        }
        expect(await liveBanners()).toHaveLength(0);

        await page.goto('/home');
        await expect(page.locator('#hpHeroTitle')).toBeVisible();
        await expect(page.locator('.hpHeroControls')).toHaveCount(0);
        await expect(page.locator('.hpBannerSlide')).toHaveCount(0);
        await expect(hero(page)).not.toHaveAttribute('aria-roledescription', 'carousel');
    } finally {
        if (hidden.length) {
            await rest(key, `home_banners?id=in.(${hidden.join(',')})`, { method: 'PATCH', body: { enabled: true }, prefer: 'return=minimal' });
        }
    }
});
