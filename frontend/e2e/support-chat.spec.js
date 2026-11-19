// The chat bubble (supabase/migrations/20261117001900_support_chat.sql, 20261117002000_support_chat_joined.sql):
// a visitor is asked to log in; a student picks a topic, asks, and sees a countdown until someone joins; the staff
// reply arrives live after "Nam has joined the chat" (first names only); the unread badge; the studio asks whether
// it's sorted and the student closes it; a new question is a new chat; from 21:45 no new question; at night the
// chat is offline.
// Staff answer through the RPCs here (support-inbox.spec.js covers their page). The chat hours are set for the spec
// ("open all day" unless a test says otherwise) and put back afterwards.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ANON, API, deleteAccount, login, rest, rpc, setChatHours, signUpStudent, staffJwt } from './support.js';

test.describe.configure({ mode: 'serial' });

const QUESTION = 'Can I make up Wednesday’s class on Saturday?';

let page;
let student; // { email, id, jwt, name }
let threadId;

const bubble = () => page.locator('.supportBubble');
const panel = () => page.locator('.supportPanel');
const openPanel = async () => {
    if (!(await panel().isVisible())) await bubble().click();
    await expect(panel()).toBeVisible();
};
const myOpenThread = async () =>
    (await rest(student.jwt, `support_threads?select=id,status,closed_by&customer_id=eq.${student.id}&order=id.desc&limit=1`)).data[0];

test.beforeAll(async ({ browser }) => {
    await setChatHours('open');
    student = await signUpStudent('chat-bubble', `Chat Bubble ${Date.now() % 100000}`);
    page = await browser.newPage();
});

test.afterAll(async () => {
    await page?.close();
    await deleteAccount(student?.id);
    await setChatHours('default');
});

test('a visitor is asked to log in', async () => {
    await page.goto('/home');
    await expect(bubble()).toHaveAccessibleName('Chat with the studio');
    await bubble().click();
    await expect(panel().locator('.supportGuest')).toBeVisible();
    await expect(panel().getByRole('link', { name: 'Log in' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel()).toBeHidden();
});

test('a student picks a topic and asks', async () => {
    await login(page, student.email);
    await openPanel();
    await panel().locator('.supportNew').getByRole('radio', { name: 'Absence & make-up' }).check();
    await panel().getByLabel('Write your question…').fill(QUESTION);
    await panel().getByRole('button', { name: 'Send' }).click();

    await expect(panel().locator('.supportMsg.is-customer')).toContainText(QUESTION);
    // Nobody has joined yet: the countdown to the usual answer time.
    await expect(panel().locator('.supportState')).toHaveText('Waiting for staff');
    await expect(panel().locator('.supportWaiting')).toContainText('Usually within 5 minutes');
    await expect(panel().locator('.supportCountdown')).toHaveText(/^[45]:\d\d$/);
    const row = await myOpenThread();
    expect(row.status).toBe('open');
    threadId = row.id;
});

test('the staff reply arrives while the chat is open', async () => {
    const sent = await rpc(await staffJwt(), 'support_send', { p_thread: threadId, p_body: 'Yes, Saturday 18:30 works.' });
    expect(sent.status, JSON.stringify(sent.data)).toBe(200);
    const reply = panel().locator('.supportMsg.is-staff').last();
    await expect(reply).toContainText('Saturday 18:30 works', { timeout: 35_000 });
    // Answering first, Nam took it: he joined, the countdown is gone, and he is shown by his first name only.
    await expect(panel().locator('.supportMsg.event-joined')).toContainText('Nam has joined the chat.');
    await expect(panel().locator('.supportWaiting')).toHaveCount(0);
    await expect(panel().locator('.supportState')).toHaveText('Nam is helping you');
    await expect(reply.locator('.supportMsgName')).toHaveText('Nam · Oops! Studio');
    await expect(panel()).not.toContainText('Lê Hoàng Nam');
});

test('the student sees their message was seen, and Nam typing', async () => {
    // Nam answered after reading it.
    await expect(panel().locator('.supportMsg.is-customer .supportReceipt').last()).toHaveText(/Seen/);

    // Nam's keystrokes (Realtime broadcast on the conversation's channel, as the Inbox sends them).
    const client = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = client.channel(`support-typing-${threadId}`, { config: { broadcast: { self: false } } });
    await new Promise((resolve) => channel.subscribe((state) => state === 'SUBSCRIBED' && resolve()));
    try {
        await channel.send({ type: 'broadcast', event: 'typing', payload: { side: 'staff' } });
        await expect(panel().locator('.supportTyping')).toContainText('Nam is typing…');
        await expect(panel().locator('.supportTyping')).toHaveCount(0, { timeout: 8_000 });
    } finally {
        await client.removeChannel(channel);
    }
});

test('a reply while the chat is closed shows on the bubble', async () => {
    await panel().getByRole('button', { name: 'Close the chat' }).first().click();
    await expect(panel()).toBeHidden();
    const sent = await rpc(await staffJwt(), 'support_send', { p_thread: threadId, p_body: 'See you then!' });
    expect(sent.status, JSON.stringify(sent.data)).toBe(200);

    await page.reload();
    await expect(page.locator('.supportBadge')).toHaveText('1');
    await expect(bubble()).toHaveAccessibleName(/1 unread/);
    await openPanel();
    await expect(panel().locator('.supportMsg.is-staff').last()).toContainText('See you then!');
    await expect(page.locator('.supportBadge')).toHaveCount(0);
});

test('the studio asks whether it is sorted; "not yet" keeps it open', async () => {
    const asked = await rpc(await staffJwt(), 'support_request_close', { p_thread: threadId });
    expect(asked.status, JSON.stringify(asked.data)).toBe(200);
    const card = panel().locator('.supportCloseCard');
    await expect(card).toBeVisible({ timeout: 35_000 });
    await card.getByRole('button', { name: 'Not yet, I still need help' }).click();
    await expect(card).toBeHidden();
    await expect.poll(async () => (await myOpenThread()).status).toBe('open');
});

test('asked again, the student closes it; a new question is a new chat', async () => {
    const asked = await rpc(await staffJwt(), 'support_request_close', { p_thread: threadId });
    expect(asked.status, JSON.stringify(asked.data)).toBe(200);
    const card = panel().locator('.supportCloseCard');
    await expect(card).toBeVisible({ timeout: 35_000 });
    await card.getByRole('button', { name: 'Yes, close the chat' }).click();

    await expect(panel().locator('.supportClosedNote')).toBeVisible();
    await expect.poll(async () => (await myOpenThread()).closed_by).toBe('customer');

    await panel().locator('.supportClosedNote').getByRole('button', { name: 'Ask a new question' }).click();
    await expect(panel().locator('.supportNew')).toBeVisible();
});

test('from 21:45 no new question, at night the chat is offline', async () => {
    try {
        await setChatHours('last_call');
        await page.reload();
        await openPanel();
        await expect(panel().locator('.supportNew')).toHaveCount(0);
        await expect(panel().locator('.supportOffline')).toBeVisible();

        await setChatHours('closed');
        await page.reload();
        await expect(page.locator('.supportDot.is-offline')).toBeVisible();
        await openPanel();
        await expect(panel().locator('.supportOffline')).toBeVisible();
        await expect(panel().locator('.supportNew')).toHaveCount(0);
    } finally {
        await setChatHours('open');
    }
});
