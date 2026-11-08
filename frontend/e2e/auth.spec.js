import { test, expect } from '@playwright/test';
import { MAILPIT, PASSWORD, adminUsers, expectToast, rest, testEmail, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const SIGNUP = testEmail('signup');
const RESET_USER = 'guest02@demo.oopsdance.test';
const TEMP_PASSWORD = 'NewPass@2026';
let page;
let recoveryLink;

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
});
test.afterAll(() => page.close());

test.describe('sign-up', () => {
    test('blocks a short password (native validation)', async () => {
        await page.goto('/register');
        await page.getByLabel('Email').fill(SIGNUP);
        await page.getByLabel('Username').fill(`e2e${Date.now()}`);
        await page.getByLabel('Full name').fill('E2E Signup');
        await page.getByLabel('Password').fill('short');
        await page.getByRole('button', { name: 'Register' }).click();
        expect(await page.getByLabel('Password').evaluate((el) => !el.checkValidity())).toBe(true);
    });

    test('signs up, logs in and lands on /profile', async () => {
        await page.getByLabel('Password').fill('E2eSignup@2026');
        await page.getByRole('button', { name: 'Register' }).click();
        await page.waitForURL((url) => url.pathname === '/profile');
    });

    test('the new account is a guest', async () => {
        await expect(page.getByText('Attended').first()).toBeVisible();
        const me = await token(SIGNUP, 'E2eSignup@2026');
        const res = await rest(me.jwt, 'profiles?select=role');
        expect(res.data).toEqual([{ role: 'guest' }]);
    });

    test('a taken username gets a clear message', async () => {
        await page.getByRole('button', { name: 'Log Out' }).click();
        await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
        await page.goto('/register');
        await page.getByLabel('Email').fill(testEmail('dup'));
        await page.getByLabel('Username').fill('thaovy'); // guest@demo.oopsdance.test
        await page.getByLabel('Full name').fill('Dup');
        await page.getByLabel('Password').fill('E2eSignup@2026');
        await page.getByRole('button', { name: 'Register' }).click();
        await expect(page.locator('.showMessage')).toContainText('already taken');
    });

    test('cleanup: the sign-up account is deleted through admin-users', async () => {
        const admin = await token('admin@demo.oopsdance.test');
        const [profile] = (await rest(admin.jwt, `profiles?select=id&email=eq.${encodeURIComponent(SIGNUP)}`)).data;
        const res = await adminUsers(admin.jwt, { action: 'delete', user_id: profile.id });
        expect(res.status).toBe(200);
    });
});

test('a wrong password shows a friendly message', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('guest@demo.oopsdance.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByText('Wrong email or password.')).toBeVisible();
});

test.describe('password reset', () => {
    test('sends a reset email (resetPasswordForEmail)', async () => {
        await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
        await page.goto('/login');
        await page.getByRole('link', { name: 'Click Here' }).click();
        await page.waitForURL('**/reset-password');
        await page.getByLabel('Email').fill(RESET_USER);
        await page.getByRole('button', { name: 'Send reset link' }).click();
        await expect(page.getByText('a reset link is on its way')).toBeVisible();
    });

    test('the recovery email arrives', async () => {
        await expect.poll(async () => {
            const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
            const message = list.messages?.find((m) => m.To?.some((t) => t.Address === RESET_USER));
            if (!message) return null;
            const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
            recoveryLink = (full.Text || full.HTML || '').match(/https?:\/\/[^\s"'<>)]+verify[^\s"'<>)]+/)?.[0]?.replace(/&amp;/g, '&');
            return recoveryLink ?? null;
        }, { timeout: 15_000 }).toBeTruthy();
    });

    test('the link redirects to /reset-password', async () => {
        expect(decodeURIComponent(recoveryLink)).toContain('redirect_to=http://127.0.0.1:5173/reset-password');
    });

    test('sets a new password from the recovery link', async () => {
        await page.goto(recoveryLink);
        await expect(page.getByText('Choose a new password')).toBeVisible();
        await page.getByLabel('New password', { exact: true }).fill(TEMP_PASSWORD);
        await page.getByLabel('Confirm new password').fill(TEMP_PASSWORD);
        await page.getByRole('button', { name: 'Save new password' }).click();
        await expectToast(page, 'Your password has been updated.');
        await page.waitForURL((url) => url.pathname === '/profile');
    });

    test('change password rejects a wrong current password', async () => {
        await page.goto('/profile/my-profile');
        await page.getByLabel('Current password').fill('wrong-one');
        await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
        await page.getByLabel('Confirm new password').fill(PASSWORD);
        await page.getByRole('button', { name: 'Save Password' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'current password is incorrect' }).first()).toBeVisible();
    });

    test('changes the password back; the demo password works again', async () => {
        await page.getByLabel('Current password').fill(TEMP_PASSWORD);
        await page.getByRole('button', { name: 'Save Password' }).click();
        await expectToast(page, 'Password changed.');
        expect((await token(RESET_USER)).jwt).toBeTruthy();
    });
});
