// Extra tuition money on the staff Tuition page: an invoice paid more than it costs shows "… extra" under
// its amount and in To do → Extra money; the dialog moves the extra onto the student's other unpaid course,
// undoing the payment takes it back off that course, and giving the extra back is recorded. Uses a student
// with two unpaid courses (never guest@, the student tuition spec's); puts both invoices back as found.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectToast, login, rest, rpc, staffJwt } from './support.js';

test.describe.configure({ mode: 'serial' });

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXTRA = 50000;
const GIVEN_BACK = 30000;

// The local service role (to put the refunded invoice back and restore updated_by), like tuition-staff.
function serviceKey() {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
        const env = execFileSync('supabase', ['status', '-o', 'env'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m)?.[1] ?? null;
    } catch {
        return null;
    }
}

let page;
let from; // the invoice paid too much
let to; // the same student's other unpaid course
const vnd = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const courseOf = (invoice) => invoice.lesson_title || invoice.class_name;
const row = (invoice) => page.locator(`#tuition-search .tuRow[data-code="${invoice.payment_code}"]`);
const searchBox = () => page.getByLabel('Find a student or an OOPS code');

async function invoiceNow(invoice) {
    return (await rest(await staffJwt(), `tuition_invoices?select=status,paid_amount,method,renewal&id=eq.${invoice.id}`)).data[0];
}

async function overpay(amount) {
    const res = await rpc(await staffJwt(), 'tuition_mark_paid', { p_invoice: from.id, p_method: 'cash', p_amount: Number(from.amount) + amount, p_note: null });
    expect(res.status, JSON.stringify(res.data)).toBe(200);
}

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    const jwt = await staffJwt();
    const guest = (await rest(jwt, 'profiles?select=id&email=eq.guest@demo.oopsdance.test')).data[0];
    const unpaid = (await rest(jwt,
        'tuition_invoices?select=id,student_id,student_name,class_name,lesson_title,amount,payment_code,updated_by&status=eq.unpaid&paid_amount=eq.0&renewal=eq.continue&switched_from=is.null&order=id')).data
        .filter((invoice) => invoice.student_id && invoice.student_id !== guest?.id);
    const byStudent = new Map();
    for (const invoice of unpaid) byStudent.set(invoice.student_id, [...(byStudent.get(invoice.student_id) ?? []), invoice]);
    const pair = [...byStudent.values()].find((list) => list.length >= 2);
    expect(pair, 'a student with two unpaid courses that say "continue"').toBeTruthy();
    [from, to] = pair;
    await overpay(EXTRA);
});

test.afterAll(async () => {
    const key = serviceKey();
    if (key) {
        // Back to unpaid, nothing moved or given back, last touched by the seed's value.
        await rest(key, `tuition_extra_moves?invoice_id=eq.${from.id}`, { method: 'DELETE' });
        await rest(key, `tuition_extra_moves?to_invoice=eq.${to.id}`, { method: 'DELETE' });
        for (const invoice of [from, to]) {
            await rest(key, `tuition_invoices?id=eq.${invoice.id}`, {
                method: 'PATCH',
                body: { status: 'unpaid', paid_amount: 0, method: null, paid_at: null, updated_by: invoice.updated_by },
            });
        }
    } else {
        const jwt = await staffJwt();
        for (const invoice of [from, to]) if (Number((await invoiceNow(invoice))?.paid_amount) > 0) await rpc(jwt, 'tuition_undo_payment', { p_invoice: invoice.id });
        console.warn('tuition-extra: no service role key, the refund row and updated_by stay.');
    }
    await page.close();
});

test('an invoice paid too much shows its extra, which pays the student’s other course', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/tuition?show=extra');
    const group = page.locator('#tuition-extra');
    await expect(group.getByRole('heading', { name: 'Extra money' })).toBeVisible();
    await expect(group.locator(`.tuRow[data-code="${from.payment_code}"]`)).toBeVisible();

    await searchBox().fill(from.payment_code);
    await row(from).getByRole('button', { name: `${vnd(EXTRA)} extra` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Extra money');
    await expect(dialog.getByRole('radio', { checked: true })).toContainText(to.class_name);
    await expect(dialog.getByLabel('Amount (VND)')).toHaveValue(String(EXTRA));
    await dialog.getByRole('button', { name: `Move ${vnd(EXTRA)}` }).click();
    await expectToast(page, `${vnd(EXTRA)} moved to “${courseOf(to)}”.`);
    await expect(dialog).toBeHidden();
    await expect(row(from).locator('.tuExtraTag')).toHaveCount(0);
    expect(await invoiceNow(from)).toMatchObject({ status: 'paid', paid_amount: Number(from.amount) });
    expect(await invoiceNow(to)).toMatchObject({ status: 'unpaid', paid_amount: EXTRA });
});

test('undoing the payment takes the moved money back off the other course', async () => {
    await row(from).getByRole('button', { name: /^More for/ }).click();
    await page.getByRole('menuitem', { name: 'Undo payment' }).click();
    await expectToast(page, 'Payment undone.');
    expect(await invoiceNow(from)).toMatchObject({ status: 'unpaid', paid_amount: 0 });
    expect(await invoiceNow(to)).toMatchObject({ status: 'unpaid', paid_amount: 0 });
});

test('giving the extra back is recorded, and the invoice keeps its price', async () => {
    await overpay(GIVEN_BACK);
    await page.reload();
    await searchBox().fill(from.payment_code);
    await row(from).getByRole('button', { name: `${vnd(GIVEN_BACK)} extra` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Give it back' }).click();
    await expect(dialog.getByLabel('Amount (VND)')).toHaveValue(String(GIVEN_BACK));
    await dialog.getByLabel('Note').fill('E2E handed back');
    await dialog.getByRole('button', { name: `Record ${vnd(GIVEN_BACK)} given back` }).click();
    await expectToast(page, `${vnd(GIVEN_BACK)} recorded as given back to ${from.student_name}.`);
    expect(await invoiceNow(from)).toMatchObject({ status: 'paid', paid_amount: Number(from.amount) });
    const moves = (await rest(await staffJwt(), `tuition_extra_moves?select=kind,amount,method,note&invoice_id=eq.${from.id}`)).data;
    expect(moves).toEqual([{ kind: 'refunded', amount: GIVEN_BACK, method: 'cash', note: 'E2E handed back' }]);
});
