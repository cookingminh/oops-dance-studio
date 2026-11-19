// The chat's invitation next to the bubble (ui/support-chat/SupportTeaser.jsx): a few seconds after a page opens,
// "Got a question? Chat with us live!" (with the first name when signed in); clicking it opens the chat; × hides it
// for a week; it isn't shown again in the same tab session, nor when the chat isn't taking new questions.
// Other specs start with it dismissed (playwright.config.js storageState); these start clean.
import { test, expect } from '@playwright/test';
import { deleteAccount, login, setChatHours, signUpStudent } from './support.js';

test.describe.configure({ mode: 'serial' });

const CLEAN = { storageState: { cookies: [], origins: [] } };
const teaser = (page) => page.locator('.supportTeaser');

let student;

test.beforeAll(async () => {
    await setChatHours('open');
    student = await signUpStudent('chat-teaser', 'Phạm Minh Anh');
});

test.afterAll(async () => {
    await deleteAccount(student?.id);
    await setChatHours('default');
});

test('a visitor is invited to chat; clicking the invitation opens the chat', async ({ browser }) => {
    const page = await browser.newPage(CLEAN);
    await page.goto('/home');
    await expect(teaser(page)).toContainText('Got a question? Chat with us live!', { timeout: 10_000 });
    await teaser(page).getByRole('button', { name: /Chat with us live/ }).click();
    await expect(page.locator('.supportPanel')).toBeVisible();
    await expect(teaser(page)).toHaveCount(0);
    await page.close();
});

test('a student is greeted by first name; × hides it for good, and once per session anyway', async ({ browser }) => {
    const context = await browser.newContext(CLEAN);
    const page = await context.newPage();
    await login(page, student.email);
    await expect(teaser(page)).toContainText('Hi Anh! Got a question? Chat with us live.', { timeout: 10_000 });

    // Same tab session: a reload doesn't bring it back.
    await page.reload();
    await page.waitForTimeout(5000);
    await expect(teaser(page)).toHaveCount(0);

    // A new tab: it comes back, and × hides it for a week in this browser.
    const second = await context.newPage();
    await second.goto('/profile');
    await expect(teaser(second)).toBeVisible({ timeout: 10_000 });
    await teaser(second).getByRole('button', { name: 'Hide this message' }).click();
    await expect(teaser(second)).toHaveCount(0);
    const third = await context.newPage();
    await third.goto('/profile');
    await third.waitForTimeout(5000);
    await expect(teaser(third)).toHaveCount(0);
    await context.close();
});

test('no invitation when the chat takes no new questions', async ({ browser }) => {
    try {
        await setChatHours('last_call');
        const page = await browser.newPage(CLEAN);
        await page.goto('/home');
        await expect(page.locator('.supportBubble')).toBeVisible();
        await page.waitForTimeout(5000);
        await expect(teaser(page)).toHaveCount(0);
        await page.close();
    } finally {
        await setChatHours('open');
    }
});
