import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// /about is a static page: everything on it comes from src/content/about.js (no backend). The counts
// below are read from that file, so the studio can edit it without breaking these tests.
const CONTENT = readFileSync(new URL('../src/content/about.js', import.meta.url), 'utf8');
const count = (pattern) => (CONTENT.match(pattern) ?? []).length;
const TIMELINE_ENTRIES = count(/^\s+era: '/gm);
const HIGHLIGHTS = count(/timelineId: '/g);
const VIDEOS = count(/youtubeId: '/g);
const CREW = count(/photo: crewPhoto\('/g);
const ERAS = count(/^\s+\{ id: '[\w-]+', from: \d{4}/gm);
// The numbers as the page prints them: "2014", "20+", "800K+" (a year without a thousands separator).
const STATS = [...CONTENT.matchAll(/value: (\d+), suffix: '([^']*)'(, kind: 'year')?/g)].map(
    ([, value, suffix, year]) => `${year ? value : new Intl.NumberFormat('en-GB').format(Number(value))}${suffix}`,
);

const SOCIALS = {
    Facebook: 'https://www.facebook.com/dancecrewHN',
    YouTube: 'https://www.youtube.com/c/OopsCrew2014',
    Instagram: 'https://www.instagram.com/oopscrew.official',
    TikTok: 'https://www.tiktok.com/@oopscrew.official',
};

test('a visitor can open /about without logging in', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('Oops! Crew');
    await expect(page.locator('.abHero')).toContainText('REBORN');
});

test('the navbar and the footer link to /about', async ({ page }) => {
    await page.goto('/home');
    await page.locator('.navBar').getByRole('link', { name: 'About us', exact: true }).click();
    await page.waitForURL('**/about');
    await expect(page.locator('h1')).toContainText('Oops! Crew');

    await page.goto('/rooms');
    await page.locator('.pubFooter').getByRole('link', { name: 'About us', exact: true }).click();
    await page.waitForURL('**/about');
    await expect(page.locator('h1')).toContainText('Oops! Crew');
});

test('every section renders', async ({ page }) => {
    await page.goto('/about');

    expect(STATS.length).toBeGreaterThan(0);
    await expect(page.locator('.abStat')).toHaveCount(STATS.length);
    // Screen readers get the final number at once, while the visible one counts up.
    await expect(page.locator('.abStat .sr-only')).toHaveText(STATS);

    for (const name of ['From dancing covers to making our own', 'Meet our crew', 'Our journey', 'Biggest wins', 'Watch us dance', 'Follow Oops! Crew', 'Dance with Oops!']) {
        const heading = page.getByRole('heading', { level: 2, name });
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
    }

    // Story: told in paragraphs (the **marked** words in bold), with two photos.
    expect(await page.locator('.abStoryText p').count()).toBeGreaterThan(1);
    await expect(page.locator('.abStoryText strong').filter({ hasText: 'REBORN' })).toBeVisible();
    await expect(page.locator('.abStoryText')).not.toContainText('**');
    await expect(page.locator('.abStoryPhoto img')).toHaveCount(2);

    // Meet our crew: every member with a portrait and their name.
    expect(CREW).toBeGreaterThan(0);
    const members = page.locator('.abMember');
    await expect(members).toHaveCount(CREW);
    await expect(members.first()).toContainText('Đỗ Linh');
    for (const src of await members.locator('img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')))) expect(src).toBeTruthy();

    // Timeline: every entry, one icon kind each, and the REBORN divider between the eras.
    expect(TIMELINE_ENTRIES).toBeGreaterThan(0);
    await expect(page.locator('.abTlItem')).toHaveCount(TIMELINE_ENTRIES);
    await expect(page.locator('.abTlEra')).toHaveCount(ERAS);
    await expect(page.getByRole('heading', { level: 3, name: 'Cover era' })).toBeVisible();
    await expect(page.locator('.abTlEra.isTurn .abTlChapterTurn')).toHaveText('REBORN');
    for (const type of ['award', 'milestone', 'project']) await expect(page.locator(`.abTlItem.type-${type}`).first()).toBeAttached();

    // Highlights read their text from the timeline.
    await expect(page.locator('.abHl')).toHaveCount(HIGHLIGHTS);
    await expect(page.locator('.abHl').first()).toContainText('K-pop World Festival');

    // Videos: the big player plus the grid; the CTA goes to the timetable.
    await expect(page.locator('.abVideoCard')).toHaveCount(VIDEOS - 1);
    await expect(page.getByRole('link', { name: 'More on YouTube' })).toHaveAttribute('href', SOCIALS.YouTube);
    await expect(page.getByRole('link', { name: /See classes/ })).toHaveAttribute('href', '/classes#timetable');
});

test('nothing loads from YouTube until a video is played', async ({ page }) => {
    await page.goto('/about');
    const videos = page.locator('.abVideos');
    await videos.scrollIntoViewIfNeeded();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(videos.locator('img[src*="i.ytimg.com/vi/"]')).toHaveCount(VIDEOS);

    // A grid video moves into the big player and plays there: one iframe, the privacy-enhanced player.
    const card = videos.locator('.abVideoCard').first();
    const label = await card.getAttribute('aria-label');
    const title = label.replace(/^Play video: /, '');
    await card.click();
    const iframe = videos.locator('iframe');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?autoplay=1/);
    await expect(iframe).toHaveAttribute('title', title);
    await expect(videos.locator('.abStageMeta h3')).toHaveText(title);

    // Another one replaces it: still one player on the page.
    await videos.locator('.abVideoCard').nth(1).click();
    await expect(page.locator('iframe')).toHaveCount(1);
});

test('the social links open the crew’s pages in a new tab', async ({ page }) => {
    await page.goto('/about');
    const socials = page.locator('.abSocials');
    await socials.scrollIntoViewIfNeeded();
    for (const [name, href] of Object.entries(SOCIALS)) {
        const link = socials.getByRole('link', { name: new RegExp(`^${name}`) });
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(page.getByRole('link', { name: 'oopscrew.official@gmail.com' })).toHaveAttribute('href', 'mailto:oopscrew.official@gmail.com');
});

test('the page follows the EN | VI switch', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('oops-lang', 'vi'));
    await page.goto('/about');
    await expect(page.locator('.abHeroEyebrow')).toHaveText('Hà Nội · từ 2014');
    await expect(page.getByRole('heading', { level: 2, name: 'Hành trình' })).toBeAttached();
    await expect(page.getByRole('link', { name: /Xem lớp học/ })).toHaveAttribute('href', '/classes#timetable');
});

test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('everything shows at once, the numbers without counting', async ({ page }) => {
        await page.goto('/about');
        await expect(page.locator('.abCounterLive')).toHaveText(STATS);
        // Below the fold and never scrolled to, but not hidden waiting for a scroll.
        await expect(page.locator('.abTlItem').last()).toHaveCSS('opacity', '1');
        await expect(page.locator('.abHl').last()).toHaveCSS('opacity', '1');
    });
});
