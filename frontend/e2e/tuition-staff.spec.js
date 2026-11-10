// Staff tuition page (/admin/tuition), studio-wide money work only: the summary strip, "To do" (late,
// transfers to sort, due soon) and where the to-do bell lands, "By class" and the class page's Tuition
// tab it opens (course dropdown, next course's answers), search by name and by code (older invoice, room
// booking), a cash payment and its undo, a note on an invoice, assigning an unmatched bank transfer (and
// undoing it: the transfer goes back to the inbox), setting a transfer aside and bringing it back from the
// history drawer, and the admin-only payment settings drawer with the course renewal rules. Leaves the
// data as it found it. Never touches guest@'s invoices (the student tuition spec uses them), never
// saves the settings and never runs the cycle.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, expectToast, login, rest, rpc, staffJwt, studioToday } from './support.js';

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

// The invoice as the search shows it (it may also be on the to-do lists).
const invoiceRow = () => page.locator(`#tuition-search .tuRow[data-code="${invoice.payment_code}"]`);
const transferCard = (transfer) => page.locator(`.tuTransfer[data-transfer="${transfer.id}"]`);
const searchBox = () => page.getByLabel('Find a student or an OOPS code');
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "Nguyễn Thảo Vy" → "nguyen thao vy", as people type it.
const folded = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

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
    if (invoice && (await invoiceNow())?.note !== invoice.note) await rpc(jwt, 'tuition_set_note', { p_invoice: invoice.id, p_note: invoice.note ?? '' });
    // Who touched the invoice last: back to the seed's value.
    const key = serviceKey();
    if (invoice && key) await rest(key, `tuition_invoices?id=eq.${invoice.id}`, { method: 'PATCH', body: { updated_by: invoice.updated_by } });
    else if (invoice) console.warn(`tuition-staff: invoice #${invoice.id} keeps the staff member as updated_by (no service role key).`);
    await page.close();
});

test('staff see the summary, the to-do list and the classes, but not the payment settings', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/tuition');
    const strip = page.locator('.tuStrip');
    await expect(strip).toContainText('Running courses');
    await expect(strip).toContainText('collected of');
    await expect(strip).toContainText('still owed');
    await expect(page.getByRole('heading', { name: 'To do', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By class', exact: true })).toBeVisible();
    // The long invoice list and the renewal tracker are gone: they live on each class's page.
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Renewals', exact: true })).toHaveCount(0);
    await expect(transferCard(assigned)).toContainText(assigned.content);
    // The transfers waiting are a to-do: a badge on Tuition in the sidebar.
    await expect(page.locator('.adminSidebar .navItem').filter({ hasText: 'Tuition' }).locator('.navBadge')).toBeVisible();

    // The ⋯ menu: export and today's check for everyone, the payment settings for admins only.
    await page.getByRole('button', { name: 'More tuition tools' }).click();
    await expect(page.getByRole('menuitem', { name: 'Export CSV…' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Run today’s check' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Payment settings' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // RLS: a staff update of the settings changes nothing (same value, no row returned).
    const res = await rest(await staffJwt(), 'tuition_settings?id=eq.1', { method: 'PATCH', body: { due_session: settings.due_session }, prefer: 'return=representation' });
    expect(res.data).toEqual([]);
});

test('To do: who is late, the transfers to sort, and what falls due this week (folded); the bell’s links land there', async () => {
    const jwt = await staffJwt();
    const unpaid = (await rest(jwt, 'tuition_invoices?select=id,due_date&status=eq.unpaid')).data;
    const late = unpaid.filter((row) => row.due_date < today);
    const soon = unpaid.filter((row) => row.due_date >= today && row.due_date <= addDays(today, 7));
    const waiting = (await rest(jwt, 'bank_transfers?select=id&status=eq.unmatched')).data;

    if (late.length) await expect(page.locator('#tuition-late .tuRow')).toHaveCount(late.length);
    else await expect(page.locator('#tuition-late')).toHaveCount(0);
    await expect(page.locator('#tuition-transfers .tuTransfer')).toHaveCount(waiting.length);
    if (soon.length) {
        const group = page.locator('#tuition-soon');
        await expect(group.getByRole('heading')).toHaveText(new RegExp(`Due soon\\s*${soon.length}`));
        await expect(group.locator('.tuRow')).toHaveCount(0);
        await group.getByRole('button', { name: 'Show' }).click();
        await expect(group.locator('.tuRow')).toHaveCount(soon.length);
        // Each row says which class and course it is for.
        await expect(group.locator('.tuRow').first().locator('.tuCourseCell a')).toHaveAttribute('href', /\/admin\/classes\/\d+\?tab=tuition&course=\d+/);
    }

    // The to-do bell's links.
    await page.goto('/admin/tuition?show=transfers');
    await expect(page.locator('#tuition-transfers')).toBeInViewport();
    if (late.length) {
        await page.goto('/admin/tuition?show=overdue');
        await expect(page.locator('#tuition-late')).toBeInViewport();
    }
    await page.goto('/admin/tuition?show=renewal');
    await expect(page.locator('#tuition-classes')).toBeInViewport();
    // Classes whose renewal still waits for answers come first.
    const asking = page.locator('.tuClassRow.isAsking');
    if (await asking.count()) await expect(page.locator('.tuClassRow').first()).toHaveClass(/isAsking/);
});

test('By class: each class’s running course and next one; a row opens its Tuition tab with the course dropdown', async () => {
    const jwt = await staffJwt();
    const classes = (await rest(jwt, `classes?select=id,name&or=(ended_on.is.null,ended_on.gte.${today})`)).data;
    const progress = (await rpc(jwt, 'lesson_progress', { p_class_ids: classes.map((cls) => cls.id) })).data;
    const invoices = (await rest(jwt, 'tuition_invoices?select=id,lesson_id,status,renewal,void_reason&order=id')).data;
    const byStart = (a, b) => a.starts_on.localeCompare(b.starts_on);
    const entries = classes.map((cls) => {
        const rows = progress.filter((row) => row.class_id === cls.id).sort(byStart);
        const next = rows.find((row) => row.status === 'planned') ?? null;
        return {
            cls,
            current: rows.filter((row) => row.status === 'current').at(-1) ?? null,
            next,
            done: rows.filter((row) => row.status === 'done').at(-1) ?? null,
            billed: next ? invoices.filter((row) => row.lesson_id === next.lesson_id) : [],
        };
    });
    // A class whose next course is open (answers so far), else one with a running course.
    const target = entries.find((entry) => entry.current && entry.billed.length) ?? entries.find((entry) => entry.current);
    expect(target, 'a class with a running course').toBeTruthy();

    await page.goto('/admin/tuition');
    const row = page.locator(`.tuClassRow[data-class="${target.cls.id}"]`);
    const live = invoices.filter((inv) => inv.lesson_id === target.current.lesson_id && inv.status !== 'void');
    await expect(row.locator('.isNow')).toContainText(target.current.title);
    await expect(row.locator('.isNow')).toContainText(`${live.filter((inv) => inv.status !== 'unpaid').length}/${live.length} paid`);
    if (target.billed.length) {
        const counted = target.billed.filter((inv) => !(inv.status === 'void' && inv.void_reason === 'switched'));
        const yes = counted.filter((inv) => inv.status !== 'void' && inv.renewal !== 'stop' && !(inv.status === 'unpaid' && !inv.renewal)).length;
        await expect(row.locator('.isNext')).toContainText(target.next.title);
        await expect(row.locator('.isNext')).toContainText(new RegExp(`${yes} continues?`));
    }

    // The row opens the class's Tuition tab, on the running course.
    await row.getByRole('link', { name: target.cls.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/classes/${target.cls.id}\\?tab=tuition$`));
    const picker = page.locator('.hubCourseTrigger');
    await expect(picker).toContainText(target.current.title);
    await expect(picker).toContainText('Current');
    if (target.billed.length) {
        // The next course in plain words, then Continue · Stop · No answer yet.
        const panel = page.locator('.hubRenewal');
        await expect(panel).toContainText(`“${target.next.title}” starts`);
        await expect(panel.locator('.hubAnswerCounts li')).toHaveText([/Continue\s*\d+/, /Stop\s*\d+/, /No answer yet\s*\d+/]);
    }

    // The courses are one dropdown, newest first, each with its status; a pick goes in the URL.
    if (target.done) {
        await picker.click();
        const options = page.getByRole('option');
        await expect(options.first()).toContainText(target.next?.title ?? target.current.title);
        const option = page.getByRole('option', { name: new RegExp(escapeRe(target.done.title)) });
        await expect(option).toContainText('Finished');
        await option.click();
        await expect(page).toHaveURL(new RegExp(`tab=tuition&course=${target.done.lesson_id}$`));
        await expect(picker).toContainText(target.done.title);
        await expect(page.locator('.hubInvoiceList .tuRow')).toHaveCount(invoices.filter((inv) => inv.lesson_id === target.done.lesson_id).length);
        // The link keeps that course.
        await page.reload();
        await expect(picker).toContainText(target.done.title);
    }
});

test('search finds a student typed without accents, an older invoice by its code, and a room booking', async () => {
    const jwt = await staffJwt();
    await page.goto('/admin/tuition');
    await searchBox().fill(folded(invoice.student_name));
    await expect(invoiceRow()).toBeVisible();
    await expect(invoiceRow().locator('.tuCourseCell')).toContainText(invoice.class_name);

    // An invoice of a finished course (not on the page's lists), by its code typed with a space.
    const old = (await rest(jwt, 'tuition_invoices?select=payment_code&status=eq.paid&order=month,id&limit=1')).data[0];
    await searchBox().fill(`${old.payment_code.slice(0, 4)} ${old.payment_code.slice(4)}`);
    await expect(page.locator(`#tuition-search .tuRow[data-code="${old.payment_code}"]`)).toBeVisible();

    // A room booking's code: the booking, with a link to it.
    const booking = (await rest(jwt, 'bookings?select=id,payment_code&payment_code=not.is.null&order=id.desc&limit=1')).data[0];
    await searchBox().fill(booking.payment_code.toLowerCase());
    const hit = page.locator(`#tuition-search .tuBookingHit[data-booking="${booking.id}"]`);
    await expect(hit).toContainText(`Booking #${booking.id}`);
    await expect(hit.getByRole('link', { name: 'Open booking' })).toHaveAttribute('href', `/admin/bookings?booking=${booking.id}`);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.locator('#tuition-search')).toHaveCount(0);
});

test('records a cash payment, then undoes it', async () => {
    await searchBox().fill(invoice.payment_code);
    await expect(page.locator('#tuition-search .tuRow')).toHaveCount(1);

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

test('writes a note on the invoice with its note button, then edits it away', async () => {
    const dialog = page.getByRole('dialog');
    const late = (invoice.note ?? '').match(/^Joined after \d+ of \d+ sessions\.\s*/)?.[0] ?? '';
    await invoiceRow().getByRole('button', { name: /^(Add|Edit) note for/ }).click();
    await dialog.getByRole('button', { name: 'Promised to pay cash at the weekend' }).click();
    await expect(dialog.getByLabel('Note', { exact: true })).toHaveValue('Promised to pay cash at the weekend');
    await dialog.getByRole('button', { name: 'Save note' }).click();
    await expectToast(page, 'Note saved.');
    await expect(invoiceRow().locator('.tuRowNote')).toContainText('Promised to pay cash at the weekend');
    // A "joined late" line written by the server stays in front of staff's words.
    expect((await invoiceNow()).note).toBe(`${late}${late && !late.endsWith(' ') ? ' ' : ''}Promised to pay cash at the weekend`);

    await invoiceRow().getByRole('button', { name: /^Edit note for/ }).click();
    await dialog.getByRole('button', { name: 'Remove note' }).click();
    await expectToast(page, 'Note removed.');
    expect((await invoiceNow()).note ?? null).toBe(late.trim() || null);
    // Back to the seed's note exactly.
    await rpc(await staffJwt(), 'tuition_set_note', { p_invoice: invoice.id, p_note: invoice.note ?? '' });
    expect((await invoiceNow()).note).toBe(invoice.note);
});

test('assigns an unmatched transfer to the invoice; undoing puts it back in the inbox', async () => {
    await transferCard(assigned).getByRole('button', { name: 'Assign to an invoice' }).click();
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

test('sets a transfer aside, then brings it back from the transfer history', async () => {
    const card = transferCard(ignored);
    await card.getByRole('button', { name: 'Set aside', exact: true }).click();
    await card.getByLabel('Why set it aside?').fill(NOTE);
    await card.getByRole('button', { name: 'Set it aside' }).click();
    await expectToast(page, 'Transfer set aside.');
    await expect(card).toHaveCount(0);
    expect(await transferNow(ignored)).toMatchObject({ status: 'ignored', note: NOTE });

    // Matched and set-aside transfers are behind "Transfer history".
    await page.getByRole('button', { name: 'Transfer history' }).click();
    const drawer = page.locator('#tuition-history');
    await expect(drawer.getByRole('heading', { name: 'Transfer history' })).toBeVisible();
    await drawer.locator('.tuTabs').getByRole('button', { name: /^Ignored/ }).click();
    await drawer.locator(`[data-transfer="${ignored.id}"]`).getByRole('button', { name: /^Back to inbox/ }).click();
    await expectToast(page, 'Transfer is back in the inbox.');
    expect(await transferNow(ignored)).toMatchObject({ status: 'unmatched' });
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toHaveCount(0);
    await expect(card).toBeVisible();
});

test('admins open the payment settings from the ⋯ menu: the bank account, the rules, how to connect the bank', async () => {
    await page.getByRole('button', { name: 'Log Out' }).click();
    // Signing out finishes in the background: wait for the session to be gone before signing in again.
    await page.waitForFunction(() => !Object.keys(localStorage).some((key) => key.endsWith('-auth-token')));
    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/tuition');
    await page.getByRole('button', { name: 'More tuition tools' }).click();
    // Shown, never pressed here: it would run the real daily job.
    await expect(page.getByRole('menuitem', { name: 'Run today’s check' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Payment settings' }).click();
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
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toHaveCount(0);
});
