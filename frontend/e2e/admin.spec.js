import { test, expect } from '@playwright/test';
import { expectToast, login, pathname, rest, testEmail, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const EMAIL = testEmail('user');
const RENAMED = EMAIL.replace('e2e.user', 'e2e.renamed');
const NAME = 'E2E Test User';
let page;

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
});
test.afterAll(() => page.close());

// The People list on /admin/users; each person is a button that opens their panel (a dialog
// named after them). While the panel is open the list behind it is hidden from the a11y tree.
const people = () => page.getByRole('list', { name: 'Everyone at the studio' });
const userRow = () => people().getByRole('button').filter({ hasText: NAME });
const sheet = () => page.getByRole('dialog', { name: NAME });

async function openUser() {
    await userRow().click();
    await expect(sheet()).toBeVisible();
}

async function closeUser() {
    await sheet().getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet()).toHaveCount(0);
}

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
    await expect(people().getByRole('listitem').first()).toBeVisible();
    await expect(page.getByText(/^\d+ people$/)).toBeVisible();
});

test('creates a user (admin-users create)', async () => {
    await page.getByRole('button', { name: 'Add person' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a person' });
    await dialog.getByRole('radio', { name: /^Instructor/ }).check();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByLabel('Full name').fill(NAME);
    await dialog.getByLabel('Email', { exact: true }).fill(EMAIL);
    await dialog.getByLabel('Temporary password').fill('E2eTemp@2026');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expectToast(page, 'Account created');
    const done = page.getByRole('dialog', { name: 'Account ready' });
    await expect(done.getByText(`${NAME} can sign in now`)).toBeVisible();
    await done.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(done).toHaveCount(0);
});

test('the new user has the requested role (instructor)', async () => {
    await page.getByLabel('Search people').fill(NAME);
    await expect(userRow()).toHaveCount(1);
    await expect(userRow().getByText('Instructor', { exact: true })).toBeVisible();
});

test('changes the login email (admin-users update)', async () => {
    await openUser();
    await sheet().getByRole('button', { name: 'Edit details' }).click();
    await sheet().getByLabel('Email', { exact: true }).fill(RENAMED);
    await sheet().getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Details saved.');
    await expect(sheet().getByText(RENAMED)).toBeVisible();
    const renamed = await token(RENAMED, 'E2eTemp@2026');
    expect(renamed.jwt, 'the user signs in with the new email').toBeTruthy();
});

test('changes the role (admin_set_role)', async () => {
    await sheet().getByRole('button', { name: 'Change role' }).click();
    await sheet().getByRole('radio', { name: /^Staff/ }).check();
    await sheet().getByRole('button', { name: 'Change to Staff' }).click();
    await expectToast(page, `${NAME} is now: Staff.`);
    await closeUser();
    await expect(userRow().getByText('Staff', { exact: true })).toBeVisible();
    await expect(userRow().getByText(RENAMED)).toHaveCount(1);
});

test('deletes the user (admin-users delete)', async () => {
    await openUser();
    await sheet().getByRole('button', { name: 'Delete account' }).click();
    await sheet().getByRole('button', { name: 'Yes, delete' }).click();
    await expectToast(page, 'Account deleted.');
});

test('the deleted user is gone from the list', async () => {
    await expect(sheet()).toHaveCount(0);
    await expect(userRow()).toHaveCount(0);
});

test('admin reads every profile, including admins', async () => {
    const admin = await token('admin@demo.oopsdance.test');
    const res = await rest(admin.jwt, 'profiles?select=id&role=eq.admin');
    expect(res.data.length).toBeGreaterThanOrEqual(1);
});
