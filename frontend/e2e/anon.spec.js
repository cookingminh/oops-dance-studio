import { test, expect } from '@playwright/test';
import { freeDate, lastMonthVideos, publicClasses, rooms, searchRooms } from './support.js';

test.describe.configure({ mode: 'serial' });

let page;
let ROOMS;
let CLASSES;

test.beforeAll(async ({ browser }) => {
    ROOMS = await rooms();
    CLASSES = await publicClasses();
    page = await browser.newPage();
});
test.afterAll(() => page.close());

test('/ redirects to /home', async () => {
    await page.goto('/');
    await page.waitForURL('**/home');
    expect(page.url()).toMatch(/\/home$/);
});

test('classes slider shows list_public_classes data', async () => {
    await expect(page.getByText('Explore our dance classes')).toBeVisible();
    await expect(page.getByText(CLASSES[0].name).first()).toBeVisible();
});

test('the navbar moves between the public pages', async () => {
    const nav = page.locator('.navBar');
    for (const [label, path] of [['Classes', '/classes'], ['Rooms', '/rooms'], ['About us', '/about'], ['Home', '/home']]) {
        await nav.getByRole('link', { name: label, exact: true }).click();
        await page.waitForURL(`**${path}`);
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveClass(/active/);
    }
});

test('the about page tells the Oops! Crew story', async () => {
    await page.goto('/about');
    await expect(page.locator('h1')).toContainText('Oops! Crew');
});

test('class videos: last month on camera, plus the YouTube channel', async () => {
    await page.goto('/classes');
    const videos = page.locator('#class-videos');
    await videos.scrollIntoViewIfNeeded();
    const expected = await lastMonthVideos();
    expect(expected).toBeGreaterThan(0);
    await expect(videos.locator('.hpVideoItem')).toHaveCount(expected);
    await expect(videos.getByRole('link', { name: 'Explore more on YouTube' })).toHaveAttribute('href', /youtube\.com\/channel\//);
    // Nothing loads from YouTube until someone presses play.
    await expect(videos.locator('iframe')).toHaveCount(0);
    await videos.locator('.hpVideoItem').nth(1).click();
    await expect(videos.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/[\w-]{11}/);
    await expect(videos.locator('.hpVideoItem').nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('rooms page lists every room', async () => {
    await page.goto('/rooms');
    await page.locator('.rooms').scrollIntoViewIfNeeded();
    await expect(page.locator('.rooms .room1')).toHaveCount(ROOMS.length);
});

test('room photos come from rooms.image_paths (fallback otherwise)', async () => {
    const sources = await page.locator('.rooms .swiper-slide img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
    const fromBucket = sources.filter((src) => src.includes('/storage/v1/object/public/site-assets/')).length;
    const withPhotos = ROOMS.filter((r) => (r.image_paths ?? []).length > 0).length;
    if (withPhotos === 0) expect(fromBucket).toBe(0);
    else expect(fromBucket).toBeGreaterThan(0);
});

test('timetable sessions are rendered from class_schedules', async () => {
    await page.goto('/classes');
    await page.locator('.timeTableDiv').scrollIntoViewIfNeeded();
    await expect(page.locator('.timeTableDiv .weekSlot').first()).toBeVisible();
    const sessions = CLASSES.reduce((sum, c) => sum + (c.schedules ?? []).length, 0);
    await expect(page.locator('.timeTableDiv .weekSlot')).toHaveCount(sessions);
});

test('timetable instructor avatars load', async () => {
    const avatars = page.locator('.timeTableDiv img.instructor');
    await expect(avatars.first()).toBeVisible();
    await expect.poll(() => avatars.evaluateAll((els) => els.every((e) => e.complete && e.naturalWidth > 0))).toBe(true);
});

test('timetable shows an avatar for every instructor with a photo', async () => {
    const alts = await page.locator('.timeTableDiv img.instructor').evaluateAll((els) => els.map((e) => e.alt));
    const withAvatar = new Set(CLASSES.filter((c) => c.instructor_avatar_path).map((c) => c.instructor_name));
    expect(withAvatar.size).toBeGreaterThan(0);
    for (const name of withAvatar) expect(alts).toContain(name);
});

test('room buttons come from the rooms table', async () => {
    await page.goto('/rooms');
    const search = page.locator('.search');
    await search.scrollIntoViewIfNeeded();
    for (const room of ROOMS) await expect(search.getByRole('button', { name: room.name, exact: true })).toHaveCount(1);
});

test('booking as a visitor prompts to log in', async () => {
    const search = await searchRooms(page, await freeDate(21), '21:00', '22:00');
    await search.getByRole('button', { name: 'Book Now' }).first().click();
    await expect(page.getByText('Please log in to book a room')).toBeVisible();
});

for (const target of ['/admin', '/admin/users', '/profile']) {
    test(`anon ${target} redirects to /login`, async () => {
        await page.goto(target);
        await page.waitForURL('**/login');
    });
}

test('no demo banner or demo logins outside demo mode', async () => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByText('One-click demo login')).toHaveCount(0);
    await expect(page.getByRole('note')).toHaveCount(0);
});
