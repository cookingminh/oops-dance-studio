import { test, expect } from '@playwright/test';
import { freeDate, publicClasses, rooms, searchRooms } from './support.js';

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

test('rooms section lists every room', async () => {
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

test('timetable rows are rendered from class_schedules', async () => {
    await page.locator('.timeTableDiv table').scrollIntoViewIfNeeded();
    await expect(page.locator('.timeTableDiv table tbody tr').first()).toBeVisible();
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
