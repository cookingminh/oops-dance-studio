import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectToast, login, rest, rpc, staffJwt, token } from './support.js';

// The student's tuition page (/profile/tuition), per course (khoá): the course running now with its
// progress, the VietQR pay dialog, a simulated bank transfer (sandbox) that turns the invoice paid by
// itself, and the renewal of the next course (stop after the current one, then continue after all).
// guest@'s running course is paid and undone; the renewal uses another student whose next course is
// open and unanswered (guest@ has none in the seed). Everything is put back afterwards.

test.describe.configure({ mode: 'serial' });

const EMAIL = 'guest@demo.oopsdance.test';
const FIELDS = 'id,student_id,class_id,lesson_id,lesson_title,class_name,month,amount,paid_amount,status,renewal,method,void_reason,payment_code,updated_by';
const COURSE = 'course:class_lessons!lesson_id(title,starts_on,session_count)';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let page;
let me;
let staff;
let payInvoice; // guest@'s running course, unpaid: paid by the simulated transfer
let renew; // { invoice, email, previous }: another student's next course, open with no answer
let original; // { [id]: { renewal, updated_by } } as found

const song = (title) => title.split(/\s+[—–-]\s+/)[0];
const shortDate = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));

const myInvoices = async () => (await rest(me.jwt, `tuition_invoices?select=${FIELDS},${COURSE}&student_id=eq.${me.id}&order=month.desc,class_name`)).data;
const invoice = async (id) => (await rest(staff, `tuition_invoices?select=${FIELDS}&id=eq.${id}`)).data[0];

// Writes the tuition RPCs can't make (a renewal back to "no answer", deleting a fake transfer)
// need the local service role; read from the Supabase CLI, like scripts/demo-images.mjs.
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

// Simulated ('demo') transfers carrying one of guest@'s codes: undo what they paid, then delete them.
async function removeDemoTransfers() {
    const codes = (await myInvoices()).map((row) => row.payment_code);
    const transfers = (await rest(staff, 'bank_transfers?select=id,status,invoice_id,content&provider=eq.demo')).data;
    const mine = transfers.filter((transfer) => codes.some((code) => transfer.content.includes(code)));
    for (const transfer of mine) {
        if (transfer.status === 'matched' && transfer.invoice_id) {
            const undo = await rpc(staff, 'tuition_undo_payment', { p_invoice: transfer.invoice_id });
            expect(undo.status, JSON.stringify(undo.data)).toBe(200);
        }
        // Staff can't delete transfers (no RLS policy for it): fall back to the service role.
        let gone = (await rest(staff, `bank_transfers?id=eq.${transfer.id}`, { method: 'DELETE', prefer: 'return=representation' })).data;
        if (!Array.isArray(gone) || gone.length === 0) {
            const key = serviceKey();
            gone = key ? (await rest(key, `bank_transfers?id=eq.${transfer.id}`, { method: 'DELETE', prefer: 'return=representation' })).data : [];
        }
        if (!Array.isArray(gone) || gone.length === 0) {
            console.warn(`tuition-student: demo transfer #${transfer.id} is left in the staff inbox (no service role key).`);
        }
    }
}

// Puts a renewal answer back as it was (the RPCs can only set continue / stop), as staff.
async function restoreRenewal(id, renewal) {
    const now = await invoice(id);
    if (now.status === 'void') await rpc(staff, 'tuition_set_renewal', { p_invoice: id, p_decision: 'continue' });
    if ((await invoice(id)).renewal === renewal) return;
    if (renewal) {
        await rpc(staff, 'tuition_set_renewal', { p_invoice: id, p_decision: renewal });
        return;
    }
    const key = serviceKey();
    if (!key) {
        console.warn(`tuition-student: invoice #${id} keeps renewal "continue" (no service role key to clear it).`);
        return;
    }
    const res = await rest(key, `tuition_invoices?id=eq.${id}`, { method: 'PATCH', body: { renewal: null } });
    expect(res.status).toBe(204);
}

test.beforeAll(async ({ browser }) => {
    me = await token(EMAIL);
    staff = await staffJwt();
    await removeDemoTransfers(); // leftovers of an interrupted run

    const today = (await rpc(null, 'studio_today')).data;
    payInvoice = (await myInvoices()).find((row) => row.status === 'unpaid' && Number(row.paid_amount) === 0 && row.course?.starts_on <= today);
    expect(payInvoice, 'guest@ has an unpaid invoice for a running course (seed)').toBeTruthy();

    // Another demo student asked about their next course (it hasn't started), not answered yet.
    const open = (await rest(staff,
        `tuition_invoices?select=${FIELDS},${COURSE},student:profiles!student_id(email)&status=eq.unpaid&renewal=is.null&paid_amount=eq.0&switched_from=is.null&order=id`)).data;
    const next = open.find((row) => row.course?.starts_on > today && /^guest\d+@demo\.oopsdance\.test$/.test(row.student?.email ?? ''));
    expect(next, 'a student with an open, unanswered next course (seed: K-pop Cover Nâng Cao’s renewal)').toBeTruthy();
    const before = (await rest(staff, `class_lessons?select=title&class_id=eq.${next.class_id}&starts_on=lt.${next.course.starts_on}&order=starts_on.desc&limit=1`)).data[0];
    renew = { invoice: next, email: next.student.email, previous: before?.title ?? null };

    original = Object.fromEntries([payInvoice, next].map((row) => [row.id, { renewal: row.renewal, updated_by: row.updated_by }]));

    page = await browser.newPage();
    // The QR image comes from img.vietqr.io: answer it locally, the test checks its URL.
    await page.route('**/img.vietqr.io/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }),
    );
    await login(page, EMAIL);
});

test.afterAll(async () => {
    await page?.close();
    if (!payInvoice) return;
    await removeDemoTransfers(); // undoes the simulated payment (its transfer goes back to 'unmatched') and deletes it
    const paid = await invoice(payInvoice.id);
    if (Number(paid.paid_amount) > 0) await rpc(staff, 'tuition_undo_payment', { p_invoice: payInvoice.id });
    for (const row of [payInvoice, renew?.invoice].filter(Boolean)) {
        await restoreRenewal(row.id, original[row.id].renewal);
        // Who touched it last (the RPCs stamp updated_by): back to the seed's value when possible.
        const key = serviceKey();
        if (key) await rest(key, `tuition_invoices?id=eq.${row.id}`, { method: 'PATCH', body: { updated_by: original[row.id].updated_by } });
    }

    expect(await invoice(payInvoice.id)).toMatchObject({ status: 'unpaid', paid_amount: 0, method: null, renewal: original[payInvoice.id].renewal });
    if (renew) {
        expect(await invoice(renew.invoice.id)).toMatchObject({ status: 'unpaid', void_reason: null, renewal: original[renew.invoice.id].renewal });
    }
});

test('overview shows the tuition of the running course with a Pay button', async () => {
    await page.goto('/profile');
    const strip = page.locator('.tuStrip');
    await expect(strip).toContainText('Your tuition');
    await expect(strip).toContainText(payInvoice.class_name);
    await expect(strip.getByRole('button', { name: /^Pay / })).toBeVisible();
    await expect(strip.getByRole('link', { name: 'See tuition' })).toHaveAttribute('href', '/profile/tuition');
});

test('the student sees their courses, how renewal works and the finished courses', async () => {
    await page.goto('/profile/tuition');
    await expect(page.locator('#tuition-headline')).toContainText(/course(s)? to pay by|overdue/);

    // The running course: its song, the class, sessions held and the last session.
    const row = page.locator('.tuNowCard .tuRow', { hasText: payInvoice.lesson_title });
    await expect(row).toContainText(payInvoice.class_name);
    await expect(row).toContainText(new RegExp(`${payInvoice.course.session_count} sessions \\(\\d+ held\\) · until`));
    await expect(row.getByRole('img', { name: /of \d+ sessions held/ })).toBeVisible();
    await expect(row).toContainText(/Due by|Overdue/);
    await expect(row.getByRole('button', { name: `Pay now ${payInvoice.class_name}` })).toBeVisible();

    // No next course open for guest@: the renewal rules instead.
    await expect(page.locator('.tuRenewCard').getByRole('heading', { name: 'How renewal works' })).toBeVisible();

    const history = page.locator('.tuHistoryCard');
    await expect(history.getByRole('heading', { name: 'Payment history' })).toBeVisible();
    await expect(history.locator('.tuHistRow').first()).toContainText(/sessions · /);
});

test('the pay dialog shows the VietQR code with the amount and the invoice code', async () => {
    await page.locator('.tuNowCard').getByRole('button', { name: `Pay now ${payInvoice.class_name}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Pay by bank transfer')).toBeVisible();
    await expect(dialog.locator('.tuPaySub')).toContainText(payInvoice.lesson_title);

    const qr = dialog.locator('.tuQrFrame img');
    const src = await qr.getAttribute('src');
    expect(src).toContain('img.vietqr.io');
    expect(src).toContain(payInvoice.payment_code);
    expect(src).toContain(`amount=${Number(payInvoice.amount) - Number(payInvoice.paid_amount)}`);

    await expect(dialog.locator('.tuCopyRow.isKey')).toContainText(payInvoice.payment_code);
    await expect(dialog.getByRole('button', { name: 'Copy Transfer content' })).toBeVisible();
    // The local stack is a payment sandbox: the code is marked as not real.
    await expect(dialog.getByText('Don’t transfer real money')).toBeVisible();
    await expect(dialog.getByText('Waiting for your transfer…')).toBeVisible();
});

test('a simulated bank transfer turns the invoice paid by itself', async () => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Simulate the bank transfer' }).click();
    await expect(dialog.getByRole('heading', { name: 'Paid. Thank you!' })).toBeVisible();
    await expect(dialog).toContainText(`${payInvoice.lesson_title} in ${payInvoice.class_name} is all set.`);
    await expectToast(page, 'Payment received. Thank you!');
    expect(await invoice(payInvoice.id)).toMatchObject({ status: 'paid', method: 'transfer', renewal: 'continue' });

    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
    const row = page.locator('.tuNowCard .tuRow', { hasText: payInvoice.lesson_title });
    await expect(row.locator('.tuPill')).toHaveText('Paid');
    await expect(row).toContainText('Paid by bank transfer on');
});

test('renewal of the next course: stop after the current one, then continue after all', async ({ browser }) => {
    const { invoice: next, email, previous } = renew;
    const studentPage = await browser.newPage();
    try {
        await login(studentPage, email);
        await studentPage.goto('/profile/tuition');

        const card = studentPage.locator('.tuRenewCard');
        await expect(card.getByRole('heading', { name: /^Your next course/ })).toBeVisible();
        const item = card.locator('.tuRenew', { hasText: next.class_name });
        await expect(item).toContainText(`Continue with ${next.lesson_title} (starts ${shortDate(next.course.starts_on)})?`);

        const stopLabel = previous ? `Stop after ${song(previous)}` : 'Don’t continue';
        await item.getByRole('button', { name: stopLabel }).click();
        const confirm = studentPage.getByRole('dialog');
        await expect(confirm).toContainText(`leave ${next.class_name} before ${next.lesson_title} starts`);
        await confirm.getByRole('button', { name: stopLabel }).click();
        await expectToast(studentPage, 'Got it. You’ll stop when the current course ends.');
        await expect(item.locator('.tuPill')).toHaveText('Stopped');
        await expect(item).toContainText(`You’ll leave ${next.class_name} when ${next.lesson_title} starts.`);
        expect(await invoice(next.id)).toMatchObject({ status: 'void', void_reason: 'stopped', renewal: 'stop' });

        await item.getByRole('button', { name: 'Continue after all' }).click();
        await expectToast(studentPage, 'Welcome back! You’re in again.');
        await expect(item).toContainText('Continuing');
        await expect(item.getByRole('button', { name: `Pay now ${next.class_name}` })).toBeVisible();
        expect(await invoice(next.id)).toMatchObject({ status: 'unpaid', void_reason: null, renewal: 'continue' });
    } finally {
        await studentPage.close().catch(() => {});
    }
});
