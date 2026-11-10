// EN | VI switch: the choice applies everywhere, is remembered, and can be switched back.
import { test, expect } from '@playwright/test';
import { login } from './support.js';

test.describe.configure({ mode: 'serial' });

let page;

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
});
test.afterAll(() => page.close());

test('the homepage switches to Vietnamese and remembers it', async () => {
    await page.goto('/home');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('.navBar').getByRole('button', { name: 'Tiếng Việt' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.locator('.navBar').getByRole('button', { name: 'Tiếng Việt' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('the workspace is in Vietnamese too (sidebar, top bar, dates)', async () => {
    await page.locator('.navBar').getByRole('button', { name: 'English' }).click();
    await login(page, 'staff@demo.oopsdance.test');
    await page.locator('.adminTopBar').getByRole('button', { name: 'Tiếng Việt' }).click();
    await expect(page.locator('.adminSidebar').getByText('Đặt phòng', { exact: true })).toBeVisible();
    // "Dashboard", "Chart", "User", "Setting" stay in English in Vietnamese too (the owner's choice); the
    // page's description is Vietnamese.
    await expect(page.locator('.adminTopBar h1')).toHaveText('Dashboard');
    await expect(page.locator('.adminTopBar')).toContainText('Mọi việc ở studio hôm nay');
    // Today's date in Vietnamese ("Chủ Nhật, 8 tháng 11" …).
    await expect(page.locator('.adminTopBar .datePill')).toContainText('tháng');
});

test('switching back to English restores every label', async () => {
    await page.locator('.adminTopBar').getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.adminSidebar').getByText('Bookings', { exact: true })).toBeVisible();
    await expect(page.locator('.adminTopBar h1')).toHaveText('Dashboard');
});
