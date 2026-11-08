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
    await page.getByPlaceholder('Search...').fill('Nguyễn Thảo Vy'); // guest@demo.oopsdance.test
    const row = page.getByRole('row').filter({ hasText: 'Nguyễn Thảo Vy' });
    await expect(row.getByRole('button', { name: 'Edit user' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Delete user' })).toHaveCount(0);
    await row.getByRole('button', { name: 'Edit user' }).click();
    await expect(page.getByRole('dialog').getByLabel('Email')).toHaveAttribute('readonly', '');
});

test('the demo banner can be hidden for the tab', async ({ page }) => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Hide demo notice' }).click();
    await expect(page.getByRole('note')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Explore our dance classes')).toBeVisible();
    await expect(page.getByRole('note')).toHaveCount(0);
});
