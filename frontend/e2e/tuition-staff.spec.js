// Staff tuition page (/admin/tuition), per course (khoá): the views (running now / next courses / by
// month), the renewal of each class, a cash payment and its undo, assigning an unmatched bank
// transfer (and undoing it: the transfer goes back to the inbox), setting a transfer aside and
// bringing it back, and the admin-only payment settings with the course renewal rules. Leaves the
// data as it found it. Never touches guest@'s invoices (the student tuition spec uses them), never
// saves the settings and never runs the cycle.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectToast, login, rest, rpc, staffJwt, studioToday } from './support.js';

test.describe.configure({ mode: 'serial' });

const NOTE = `E2E not tuition ${Date.now()}`;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The RPCs stamp updated_by on the invoice they touch; putting the seed's value back needs the
// local service role (read from the Supabase CLI, like tuition-student.spec.js).
let serviceKeyCache;
function serviceKey() {
    if (serviceKeyCache !== undefined) return serviceKeyCache;
    serviceKeyCache = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
    if (!serviceKeyCache) {
        try {
            const env = execFileSync('supabase', ['status', '-o', 'env'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            serviceKeyCache = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m)?.[1] ?? null;
        } catch {
            serviceKeyCache = null;
        }
    }
    return serviceKeyCache;
}
let page;
let today; // the studio's 'yyyy-MM-dd'
let invoice; // another student's unpaid invoice that already says "continue" (paying sets that), with its course
let assigned; // seeded unmatched transfer, large enough to pay `invoice` in full
let ignored; // the other seeded unmatched transfer
let settings;

const invoiceRow = () => page.locator(`.tuRow[data-code="${invoice.payment_code}"]`);
const transferCard = (transfer) => page.locator(`.tuTransfer[data-transfer="${transfer.id}"]`);

async function invoiceNow() {
    const res = await rest(await staffJwt(), `tuition_invoices?select=status,paid_amount,method,renewal,note&id=eq.${invoice.id}`);
    return res.data[0];
}

async function transferNow(transfer) {
    const res = await rest(await staffJwt(), `bank_transfers?select=status,invoice_id,note&id=eq.${transfer.id}`);
    return res.data[0];
}

async function undoFromRow() {
    await invoiceRow().getByRole('button', { name: /^More for/ }).click();
    await page.getByRole('menuitem', { name: 'Undo payment' }).click();
    await expectToast(page, 'Payment undone.');
}

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());

    const jwt = await staffJwt();
    today = await studioToday();
    const guest = (await rest(jwt, 'profiles?select=id&email=eq.guest@demo.oopsdance.test')).data[0];
    const transfers = (await rest(jwt, 'bank_transfers?select=id,amount,content,note&provider=eq.sepay&provider_ref=like.seed-unmatched-*&status=eq.unmatched&order=amount.desc')).data;
    expect(transfers.length, 'two seeded unmatched transfers').toBeGreaterThanOrEqual(2);
    [assigned, ignored] = transfers;

    // Not a class switch's invoice (the class-switch spec reads those), running course first.
    const candidates = (await rest(jwt,
        `tuition_invoices?select=id,student_id,student_name,class_name,lesson_title,month,amount,note,payment_code,updated_by,course:class_lessons!lesson_id(starts_on)&status=eq.unpaid&paid_amount=eq.0&renewal=eq.continue&switched_from=is.null&order=id`)).data
        .filter((row) => row.student_id && row.student_id !== guest?.id && row.course && Number(row.amount) <= Number(assigned.amount));
    invoice = candidates.find((row) => row.course.starts_on <= today) ?? candidates[0];
    expect(invoice, 'an unpaid invoice of another student who said continue').toBeTruthy();

    settings = (await rest(jwt, 'tuition_settings?select=*')).data[0];
});

test.afterAll(async () => {
    // Safety net when a step failed half-way, then the transfers get their original notes back.
    const jwt = await staffJwt();
    if (invoice && Number((await invoiceNow())?.paid_amount) > 0) await rpc(jwt, 'tuition_undo_payment', { p_invoice: invoice.id });
    for (const transfer of [assigned, ignored].filter(Boolean)) {
        const now = await transferNow(transfer);
        if (now.status === 'matched' && now.invoice_id === invoice?.id) await rpc(jwt, 'tuition_undo_payment', { p_invoice: invoice.id });
        if (now.status !== 'matched') await rpc(jwt, 'tuition_ignore_transfer', { p_transfer: transfer.id, p_ignore: false, p_note: transfer.note });
    }
    // Who touched the invoice last: back to the seed's value.
    const key = serviceKey();
    if (invoice && key) await rest(key, `tuition_invoices?id=eq.${invoice.id}`, { method: 'PATCH', body: { updated_by: invoice.updated_by } });
    else if (invoice) console.warn(`tuition-staff: invoice #${invoice.id} keeps the staff member as updated_by (no service role key).`);
    await page.close();
});

test('staff see the running courses, the inbox and the renewals, but not the payment settings', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/tuition');
    await expect(page.locator('.tuOverview')).toContainText('Collected');
    await expect(page.locator('.tuViews').getByRole('button', { name: 'Running now' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Bank transfers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Renewals' })).toBeVisible();
    await expect(transferCard(assigned)).toContainText(assigned.content);
    // The transfers waiting are a to-do: a badge on Tuition in the sidebar.
    await expect(page.locator('.adminSidebar .navItem').filter({ hasText: 'Tuition' }).locator('.navBadge')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Payment settings' })).toHaveCount(0);
    // RLS: a staff update of the settings changes nothing (same value, no row returned).
    const res = await rest(await staffJwt(), 'tuition_settings?id=eq.1', { method: 'PATCH', body: { due_session: settings.due_session }, prefer: 'return=representation' });
    expect(res.data).toEqual([]);
});

test('invoices are grouped by class and course; the views switch between running, next and a month', async () => {
    const jwt = await staffJwt();
    const classes = (await rest(jwt, `classes?select=id,name&or=(ended_on.is.null,ended_on.gte.${today})`)).data;
    const progress = (await rpc(jwt, 'lesson_progress', { p_class_ids: classes.map((cls) => cls.id) })).data;
    const billed = new Set((await rest(jwt, 'tuition_invoices?select=lesson_id&status=neq.void')).data.map((row) => row.lesson_id));
    const running = progress.find((row) => row.status === 'current' && billed.has(row.lesson_id));
    const planned = (await rest(jwt, `tuition_invoices?select=lesson_title,class_name,course:class_lessons!lesson_id(starts_on)&status=neq.void`)).data
        .find((row) => row.course?.starts_on > today);

    // Running now: the class, then its course with sessions held and the last session.
    const list = page.locator('#tuition-invoices');
    const course = list.locator('.tuCourse', { hasText: running.title });
    await expect(course.locator('.tuCourseHead')).toContainText(new RegExp(`${running.session_count} sessions \\(${running.sessions_held} held\\)`));
    await expect(course.locator('.tuPhase')).toHaveText(/Running now|Finished · still unpaid/);

    // The next courses: the renewals already billed.
    await page.locator('.tuViews').getByRole('button', { name: 'Next courses' }).click();
    if (planned) {
        await expect(list.locator('.tuCourse', { hasText: planned.lesson_title }).locator('.tuPhase')).toHaveText('Up next');
        // Its class's renewal is open in the tracker.
        await expect(page.locator('.tuRenewClass', { hasText: planned.class_name }).first()).toContainText('Renewal open');
    }

    // By month: a month navigator appears (courses starting in that month).
    await page.locator('.tuViews').getByRole('button', { name: 'By month' }).click();
    await expect(page.locator('.tuMonthNav')).toContainText('This month');
    await page.locator('.tuViews').getByRole('button', { name: 'Running now' }).click();
    await expect(page.locator('.tuMonthNav')).toHaveCount(0);
});

test('records a cash payment, then undoes it', async () => {
    // A course that hasn't started is under "Next courses".
    if (invoice.course.starts_on > today) await page.locator('.tuViews').getByRole('button', { name: 'Next courses' }).click();
    await page.getByLabel('Search invoices').fill(invoice.payment_code);
    await expect(page.locator('.tuRow')).toHaveCount(1);

    await invoiceRow().getByRole('button', { name: /^Record payment for/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Amount (VND)')).toHaveValue(String(invoice.amount));
    await dialog.getByRole('button', { name: 'Cash' }).click();
    await dialog.getByRole('button', { name: 'Record payment', exact: true }).click();
    await expectToast(page, `Payment recorded for ${invoice.student_name}.`);
    await expect(dialog).toBeHidden();
    await expect(invoiceRow().locator('.tuState')).toHaveText('Paid');
    expect(await invoiceNow()).toMatchObject({ status: 'paid', method: 'cash', paid_amount: Number(invoice.amount), note: invoice.note });

    await undoFromRow();
    await expect(invoiceRow().locator('.tuState')).not.toHaveText('Paid');
    expect(await invoiceNow()).toMatchObject({ status: 'unpaid', paid_amount: 0, method: null, renewal: 'continue', note: invoice.note });
});

test('assigns an unmatched transfer to the invoice; undoing puts it back in the inbox', async () => {
    await transferCard(assigned).getByRole('button', { name: 'Find invoice' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Search unpaid invoices').fill(invoice.payment_code);
    await dialog.getByRole('button', { name: `Assign to ${invoice.student_name}, ${invoice.class_name}` }).click();
    await expectToast(page, `assigned to ${invoice.student_name}.`);
    await expect(dialog).toBeHidden();
    await expect(transferCard(assigned)).toHaveCount(0);
    await expect(invoiceRow().locator('.tuState')).toHaveText('Paid');
    expect(await transferNow(assigned)).toMatchObject({ status: 'matched', invoice_id: invoice.id });
    expect(await invoiceNow()).toMatchObject({ status: 'paid', method: 'transfer' });

    await undoFromRow();
    await expect(transferCard(assigned)).toBeVisible();
    expect(await transferNow(assigned)).toMatchObject({ status: 'unmatched', invoice_id: null });
    expect(await invoiceNow()).toMatchObject({ status: 'unpaid', paid_amount: 0 });
});

test('sets a transfer aside, then brings it back to the inbox', async () => {
    const card = transferCard(ignored);
    await card.getByRole('button', { name: 'Ignore', exact: true }).click();
    await card.getByLabel('Why set it aside?').fill(NOTE);
    await card.getByRole('button', { name: 'Ignore transfer' }).click();
    await expectToast(page, 'Transfer set aside.');
    await expect(card).toHaveCount(0);
    expect(await transferNow(ignored)).toMatchObject({ status: 'ignored', note: NOTE });

    await page.locator('.tuTabs').getByRole('button', { name: /^Ignored/ }).click();
    await page.locator(`[data-transfer="${ignored.id}"]`).getByRole('button', { name: /^Back to inbox/ }).click();
    await expectToast(page, 'Transfer is back in the inbox.');
    expect(await transferNow(ignored)).toMatchObject({ status: 'unmatched' });
    await page.locator('.tuTabs').getByRole('button', { name: /^To sort/ }).click();
    await expect(card).toBeVisible();
});

test('admins see the payment settings and how to connect the bank', async () => {
    await page.getByRole('button', { name: 'Log Out' }).click();
    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/tuition');
    const card = page.locator('#tuition-settings');
    await expect(card.getByRole('heading', { name: 'Payment settings' })).toBeVisible();
    await expect(card.getByLabel('Account number')).toHaveValue(settings.account_no ?? '');
    // The course renewal rules (the old monthly days are gone from the screen).
    await expect(card.getByLabel('Open the renewal with sessions left')).toHaveValue(String(settings.renewal_open_sessions));
    await expect(card.getByLabel('Pay or answer by session')).toHaveValue(String(settings.due_session));
    const prorate = card.getByRole('switch', { name: /Joining mid-course pays only for the sessions left/ });
    await expect(prorate).toBeVisible();
    if (settings.prorate_late_join) await expect(prorate).toBeChecked();
    else await expect(prorate).not.toBeChecked();
    await expect(card.getByLabel('Pay or answer by day')).toHaveCount(0);
    await expect(card).toContainText(`opens after session ${8 - settings.renewal_open_sessions}`);
    await expect(card).toContainText('/functions/v1/bank-webhook');
    await expect(card).toContainText('BANK_WEBHOOK_KEY');
    // Shown, never pressed here: it would run the real daily job.
    await expect(card.getByRole('button', { name: 'Run today’s check now' })).toBeVisible();
});
