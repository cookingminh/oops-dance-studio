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

const LATEST_COUNT = Number(/latest: \{[\s\S]*?count: (\d+)/.exec(CONTENT)?.[1] ?? 0);

// A stand-in for the crew's YouTube feed (/youtube-feed/…, passed on to YouTube by the dev server), so
// the tests don't depend on the real channel. One entry is already a pick and one is a Short: both skipped.
const feedEntry = (id, title, day, short = false) =>
    `<entry><id>yt:video:${id}</id><yt:videoId>${id}</yt:videoId><title>${title}</title>` +
    `<link rel="alternate" href="https://www.youtube.com/${short ? `shorts/${id}` : `watch?v=${id}`}"/>` +
    `<published>2026-11-${day}T10:00:00+00:00</published></entry>`;
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><title>Oops! Crew</title>${[
    feedEntry('newVideo001', 'Newest routine', 20),
    feedEntry('queW26EWDLM', 'Already one of the picks', 19),
    feedEntry('shortVid001', 'A Short', 18, true),
    feedEntry('newVideo002', 'Second newest', 17),
    feedEntry('newVideo003', 'Third newest', 16),
    feedEntry('newVideo004', 'Fourth newest', 15),
    feedEntry('newVideo005', 'Fifth newest', 14),
    feedEntry('newVideo006', 'Sixth newest', 13),
].join('')}</feed>`;
const NEWEST = ['Newest routine', 'Second newest', 'Third newest', 'Fourth newest', 'Fifth newest', 'Sixth newest'];

test.beforeEach(async ({ page }) => {
    await page.route('**/youtube-feed/**', (route) => route.fulfill({ contentType: 'application/atom+xml', body: FEED }));
});

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

    // Videos: the big player plus the picks; the CTA goes to the timetable.
    await expect(page.locator('.abVideoRow.isPicks .abVideoCard')).toHaveCount(VIDEOS - 1);
    await expect(page.getByRole('link', { name: 'More on YouTube' })).toHaveAttribute('href', SOCIALS.YouTube);
    await expect(page.getByRole('link', { name: /See classes/ })).toHaveAttribute('href', '/classes#timetable');
});

test('nothing loads from YouTube until a video is played', async ({ page }) => {
    await page.goto('/about');
    const videos = page.locator('.abVideos');
    await videos.scrollIntoViewIfNeeded();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(videos.locator('.abStage img[src*="i.ytimg.com/vi/"], .isPicks img[src*="i.ytimg.com/vi/"]')).toHaveCount(VIDEOS);

    // A pick moves into the big player and plays there: one iframe, the privacy-enhanced player.
    const card = videos.locator('.isPicks .abVideoCard').first();
    const label = await card.getAttribute('aria-label');
    const title = label.replace(/^Play video: /, '');
    await card.click();
    const iframe = videos.locator('iframe');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?autoplay=1/);
    await expect(iframe).toHaveAttribute('title', title);
    await expect(videos.locator('.abStageMeta h3')).toHaveText(title);

    // Another one replaces it: still one player on the page.
    await videos.locator('.isPicks .abVideoCard').nth(1).click();
    await expect(page.locator('iframe')).toHaveCount(1);
});

test('the channel’s newest videos come from its feed, without picks or Shorts', async ({ page }) => {
    expect(LATEST_COUNT).toBeGreaterThan(0);
    await page.goto('/about');
    const latest = page.locator('.abVideoRow.isLatest');
    await latest.scrollIntoViewIfNeeded();
    await expect(latest.getByRole('heading', { name: 'New on the channel' })).toBeVisible();
    await expect(latest.locator('.abVideoText strong')).toHaveText(NEWEST.slice(0, LATEST_COUNT));
    await expect(latest.locator('.abVideoText small').first()).toContainText('2026');

    // It plays in the big player, and the row fills up with the next one.
    await latest.getByRole('button', { name: 'Play video: Newest routine' }).click();
    await expect(page.locator('.abStage iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/newVideo001\?/);
    await expect(page.locator('.abStageMeta h3')).toHaveText('Newest routine');
    await expect(latest.locator('.abVideoText strong')).toHaveText(NEWEST.slice(1, LATEST_COUNT + 1));
    await expect(page.locator('.abVideoRow.isPicks .abVideoCard')).toHaveCount(VIDEOS - 1);
});

test('when the feed can’t be read, the newest row stays away and the picks remain', async ({ page }) => {
    // YouTube failing, and a host without the pass-through (it answers with the app's own page).
    for (const reply of [{ status: 500, body: 'error' }, { status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }]) {
        await page.unroute('**/youtube-feed/**');
        await page.route('**/youtube-feed/**', (route) => route.fulfill(reply));
        await page.goto('/about');
        await page.locator('.abVideos').scrollIntoViewIfNeeded();
        await expect(page.locator('.abVideoRow.isLoading')).toHaveCount(0);
        await expect(page.locator('.abVideoRow.isLatest')).toHaveCount(0);
        await expect(page.locator('.abVideoRow.isPicks .abVideoCard')).toHaveCount(VIDEOS - 1);
        // One row only: it needs no heading.
        await expect(page.locator('.abVideoRow.isPicks .abVideoRowTitle')).toHaveCount(0);
    }
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
