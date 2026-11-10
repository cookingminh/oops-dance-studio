// The public demo build (VITE_DEMO_MODE=true, served on :5174 by playwright.config.js).
import { test, expect } from '@playwright/test';
import { pathname } from './support.js';

const ROLES = [
    { label: 'Admin', lands: '/admin' },
    { label: 'Staff', lands: '/admin' },
    { label: 'Instructor', lands: '/profile' },
    { label: 'Guest', lands: '/profile' },
];

test('shows the demo banner', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByRole('note')).toHaveText('Demo data, resets every 6 hours');
});

for (const { label, lands } of ROLES) {
    test(`one-click login as ${label}`, async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.waitForURL((url) => url.pathname === lands);
        expect(pathname(page)).toBe(lands);
    });
}

test('demo accounts cannot change their password or email', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Guest', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/profile');
    await page.goto('/profile/my-profile');
    await expect(page.getByText('Demo accounts can’t change their email or password.')).toBeVisible();
    await expect(page.getByText('Change Password')).toHaveCount(0);
    await expect(page.getByLabel('Current password')).toHaveCount(0);
});

test('admin cannot re-email or delete demo accounts', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/admin');
    await page.goto('/admin/users');
    await page.getByLabel('Search people').fill('Nguyễn Thảo Vy'); // guest@demo.oopsdance.test
    await page.getByRole('list', { name: 'Everyone at the studio' }).getByRole('button').filter({ hasText: 'Nguyễn Thảo Vy' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nguyễn Thảo Vy' });
    await expect(sheet.getByText('Demo accounts can’t be deleted in the public demo.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Delete account' })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Edit details' }).click();
    await expect(sheet.getByLabel('Email', { exact: true })).toHaveAttribute('readonly', '');
});

test('the demo banner can be hidden for the tab', async ({ page }) => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Hide demo notice' }).click();
    await expect(page.getByRole('note')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Explore our dance classes')).toBeVisible();
    await expect(page.getByRole('note')).toHaveCount(0);
});
