import { test, expect } from '@playwright/test';
import { expectToast, login, pathname, rest, testEmail, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const EMAIL = testEmail('user');
const RENAMED = EMAIL.replace('e2e.user', 'e2e.renamed');
let page;
let dialog;

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    dialog = page.getByRole('dialog');
});
test.afterAll(() => page.close());

const userRow = () => page.getByRole('row').filter({ hasText: 'E2E Test User' });

test('admin lands on /admin', async () => {
    await login(page, 'admin@demo.oopsdance.test');
    expect(pathname(page)).toBe('/admin');
});

test('admin sidebar shows Users', async () => {
    await expect(page.locator('.sideBar').getByText('Charts', { exact: true })).toBeVisible();
    await expect(page.locator('.sideBar').getByText('Users', { exact: true })).toHaveCount(1);
});

test('lists every user', async () => {
    await page.goto('/admin/users');
    await expect(page.getByRole('grid', { name: 'Users' })).toBeVisible();
    await expect(page.getByText(/Total \d+ items/)).toBeVisible();
});

test('creates a user (admin-users create)', async () => {
    await page.getByRole('button', { name: 'Add New' }).click();
    await dialog.getByLabel('Email').fill(EMAIL);
    await dialog.getByLabel('Temporary password').fill('E2eTemp@2026');
    await dialog.getByLabel('Full Name').fill('E2E Test User');
    await dialog.getByRole('button', { name: 'Create User' }).click();
    await expectToast(page, 'Account created');
});

test('the new user has the requested role (instructor)', async () => {
    await page.getByPlaceholder('Search...').fill('E2E Test User');
    await expect(userRow().getByText('instructor', { exact: true })).toHaveCount(1);
});

test('changes the role (admin_set_role)', async () => {
    await userRow().getByRole('button', { name: 'Edit user' }).click();
    await dialog.getByLabel('Email').fill(RENAMED);
    await dialog.getByRole('button', { name: /Role/ }).click();
    await page.getByRole('option', { name: 'staff', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expectToast(page, 'User updated.');
    await expect(userRow().getByText('staff', { exact: true })).toBeVisible();
});

test('changes the login email (admin-users update)', async () => {
    await expect(userRow().getByText(RENAMED)).toHaveCount(1);
    const renamed = await token(RENAMED, 'E2eTemp@2026');
    expect(renamed.jwt, 'the user signs in with the new email').toBeTruthy();
});

test('deletes the user (admin-users delete)', async () => {
    await userRow().getByRole('button', { name: 'Delete user' }).click();
    await expectToast(page, 'User deleted.');
});

test('the deleted user is gone from the list', async () => {
    await expect(userRow()).toHaveCount(0);
});

test('admin reads every profile, including admins', async () => {
    const admin = await token('admin@demo.oopsdance.test');
    const res = await rest(admin.jwt, 'profiles?select=id&role=eq.admin');
    expect(res.data.length).toBeGreaterThanOrEqual(1);
});
