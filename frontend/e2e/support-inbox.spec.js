// Staff answer chats from the Inbox (/admin/inbox, supabase/migrations/20261117001900_support_chat.sql):
// a new question waits in the list (and in the to-do bell and the menu badge), staff open it with the asker's card,
// reply (they take it), hand it over, ask to close; the student closes it and it moves to Closed; at night the
// reply box is off. The chat hours are set to "open all day" for the spec and put back afterwards.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ANON, API, deleteAccount, login, rest, rpc, setChatHours, signUpStudent } from './support.js';

test.describe.configure({ mode: 'serial' });

const QUESTION = 'I transferred the tuition last night but it still says unpaid.';
const REPLY = 'Thanks! We found your transfer and matched it to the course.';

let page;
let student; // { email, id, jwt, name }
let threadId;

const thread = () => page.locator('.inboxThread');
const row = () => page.locator('.inboxRow').filter({ hasText: student.name });
const threadNow = async () => (await rest(student.jwt, `support_threads?select=status,assigned_to,waiting_since,closed_by&id=eq.${threadId}`)).data[0];

test.beforeAll(async ({ browser }) => {
    await setChatHours('open');
    student = await signUpStudent('chat-inbox', `Chat Inbox ${Date.now() % 100000}`);
    const started = await rpc(student.jwt, 'support_start', {
        p_category: 'tuition',
        p_body: QUESTION,
        p_opened_from: '/profile/tuition',
    });
    expect(started.status, JSON.stringify(started.data)).toBe(200);
    threadId = started.data.id;
    page = await browser.newPage();
});

test.afterAll(async () => {
    await page?.close();
    await deleteAccount(student?.id);
    await setChatHours('default');
});

test('a new question waits in the Inbox, the bell and the menu badge', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    await expect(page.locator('.adminSidebar a[href="/admin/inbox"]')).toContainText(/\d/);

    await page.goto('/admin/inbox');
    await expect(page.getByRole('tab', { name: /Waiting/ })).toHaveAttribute('aria-selected', 'true');
    await expect(row()).toBeVisible();
    await expect(row().locator('.inboxRowPreview')).toContainText('still says unpaid');
    await expect(row().locator('.inboxRowOwner')).toHaveText('Nobody has it yet');
    await expect(row().locator('.inboxRowWhen')).toContainText('Waiting');

    await page.getByRole('button', { name: /Notifications|to do/i }).first().click();
    await expect(page.getByText(/waiting for a chat answer/).first()).toBeVisible();
    await page.keyboard.press('Escape');
});

test('staff open it with the card of who is asking, and reply', async () => {
    await row().click();
    await expect(thread().locator('.inboxMsg.is-customer')).toContainText(QUESTION);
    const card = page.locator('.inboxCard');
    await expect(card).toContainText(student.name);
    await expect(card).toContainText('No phone number');
    await expect(card).toContainText('/profile/tuition');

    const box = page.locator('.inboxComposer textarea');
    await box.fill(REPLY);
    await page.locator('.inboxComposer').getByRole('button', { name: 'Send' }).click();
    await expect(thread().locator('.inboxMsg.is-studio').last()).toContainText(REPLY);
    await expect(box).toHaveValue('');

    await expect.poll(async () => (await threadNow()).waiting_since).toBeNull();
    await expect(thread().locator('.inboxOwner')).toContainText('You have it');
    await expect(thread().locator('.inboxNote.is-joined')).toContainText('Nam joined the chat');
    await expect(page.getByRole('tab', { name: /Answered/ })).toBeVisible();
});

test('staff see when the student has read the reply, and when they are typing', async () => {
    const latest = thread().locator('.inboxMsg.is-studio .inboxSeen');
    await expect(latest).toHaveText('Sent');
    const read = await rpc(student.jwt, 'support_mark_read', { p_thread: threadId });
    expect(read.status, JSON.stringify(read.data)).toBeLessThan(300);
    await expect(latest).toHaveText('Seen', { timeout: 35_000 });

    // The student's keystrokes (Realtime broadcast on the conversation's channel, as the bubble sends them).
    const client = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = client.channel(`support-typing-${threadId}`, { config: { broadcast: { self: false } } });
    await new Promise((resolve) => channel.subscribe((state) => state === 'SUBSCRIBED' && resolve()));
    try {
        await channel.send({ type: 'broadcast', event: 'typing', payload: { side: 'customer' } });
        await expect(thread().locator('.inboxTyping')).toContainText(`${student.name} is typing…`);
        await expect(thread().locator('.inboxTyping')).toHaveCount(0, { timeout: 8_000 });
    } finally {
        await client.removeChannel(channel);
    }
});

test('a new message from the student arrives while the chat is open', async () => {
    const sent = await rpc(student.jwt, 'support_send', { p_thread: threadId, p_body: 'Great, thank you!' });
    expect(sent.status, JSON.stringify(sent.data)).toBe(200);
    await expect(thread().locator('.inboxMsg.is-customer').last()).toContainText('Great, thank you!', { timeout: 35_000 });
});

test('handing over, then asking to close', async () => {
    await thread().getByRole('button', { name: 'Hand over' }).click();
    await page.getByRole('menuitem', { name: /Trần Thị Thu Hà/ }).click();
    await expect(thread().locator('.inboxOwner')).toContainText('Trần Thị Thu Hà');

    await thread().getByRole('button', { name: 'Ask to close' }).click();
    await expect(thread().locator('.inboxBanner.is-closing')).toContainText(`Waiting for ${student.name}`);
    await expect.poll(async () => (await threadNow()).status).toBe('closing');
    await expect(thread().locator('.inboxNote.is-close_asked')).toBeVisible();
});

test('the student closes it: it moves to Closed and is read-only', async () => {
    const closed = await rpc(student.jwt, 'support_answer_close', { p_thread: threadId, p_resolved: true });
    expect(closed.status, JSON.stringify(closed.data)).toBe(200);

    await page.goto('/admin/inbox?tab=closed');
    await row().first().click();
    await expect(thread().locator('.inboxBanner.is-closed')).toBeVisible();
    await expect(thread().locator('.inboxNote.is-closed')).toBeVisible();
    await expect(page.locator('.inboxComposer')).toHaveCount(0);
});

test('at night the reply box is off', async () => {
    const again = await rpc(student.jwt, 'support_start', { p_category: 'classes', p_body: 'One more question about Saturday.' });
    expect(again.status, JSON.stringify(again.data)).toBe(200);
    await setChatHours('closed');
    try {
        await page.goto(`/admin/inbox?thread=${again.data.id}`);
        await expect(page.locator('.inboxHours.is-closed')).toBeVisible();
        await expect(thread().locator('.inboxBanner.is-night')).toBeVisible();
        await expect(page.locator('.inboxComposer textarea')).toBeDisabled();
        await expect(thread().getByRole('button', { name: 'Ask to close' })).toBeDisabled();
    } finally {
        await setChatHours('open');
    }
});
