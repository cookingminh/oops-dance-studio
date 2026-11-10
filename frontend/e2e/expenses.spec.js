import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANON, API, PROOF, expectToast, login, pickOption, rest, studioToday, token } from './support.js';

// The expenses page (/admin/expenses): an admin records a cost for one class with a receipt,
// views, edits and deletes it; staff see and add only their own petty costs; an admin adds a
// recurring cost, adds this month's copy, pauses it and deletes it. Every row this spec writes
// has a description starting with "E2E expense", and all of them (and their receipts) are
// removed again afterwards.

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const MARK = 'E2E expense';
const LIKE_MARK = `like.${encodeURIComponent(MARK)}*`;
const DESC = `${MARK} ${RUN} camera crew`;
const STAFF_DESC = `${MARK} ${RUN} tape and drinks`;
const ADMIN_ONLY = `${MARK} ${RUN} admin only`;
const REC_DESC = `${MARK} ${RUN} poster printing`;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let admin;
let staff;
let today;
let thisMonth;
let recurringBefore = null; // this month's recurring copies before "Add this month's now"

// Checking that a deleted receipt is really gone needs the local service role (storage RLS hides
// files of deleted expenses); read from the Supabase CLI like tuition-student.spec.js.
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

const FIELDS = 'id,spent_on,month,category,amount,description,vendor,class_id,method,receipt_path,recurring_id,created_by';
const expensesLike = async (jwt, description) => (await rest(jwt, `expenses?select=${FIELDS}&description=eq.${encodeURIComponent(description)}`)).data;

async function removeReceipts(jwt, paths) {
    const list = paths.filter(Boolean);
    if (!list.length) return;
    await fetch(`${API}/storage/v1/object/receipts`, {
        method: 'DELETE',
        headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: list }),
    });
}

async function receiptExists(receiptPath) {
    const key = serviceKey();
    if (!key) return null; // can't tell without the service role
    const res = await fetch(`${API}/storage/v1/object/receipts/${receiptPath}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    return res.ok;
}

// Removes every row this spec (or an interrupted earlier run) wrote, receipts first (storage
// RLS only allows them while their expense exists).
async function cleanup() {
    const rows = (await rest(admin.jwt, `expenses?select=id,receipt_path&description=${LIKE_MARK}`)).data ?? [];
    await removeReceipts(admin.jwt, rows.map((row) => row.receipt_path));
    expect((await rest(admin.jwt, `expenses?description=${LIKE_MARK}`, { method: 'DELETE' })).status).toBe(204);
    expect((await rest(admin.jwt, `recurring_expenses?description=${LIKE_MARK}`, { method: 'DELETE' })).status).toBe(204);
    // "Add this month's now" may also have re-added a seeded cost someone had deleted: take those out again.
    if (recurringBefore) {
        const now = (await rest(admin.jwt, `expenses?select=id&month=eq.${thisMonth}&recurring_id=not.is.null`)).data ?? [];
        const extra = now.map((row) => row.id).filter((id) => !recurringBefore.has(id));
        if (extra.length) await rest(admin.jwt, `expenses?id=in.(${extra.join(',')})`, { method: 'DELETE' });
    }
}

test.beforeAll(async () => {
    admin = await token('admin@demo.oopsdance.test');
    staff = await token('staff@demo.oopsdance.test');
    today = await studioToday();
    thisMonth = `${today.slice(0, 7)}-01`;
    await cleanup();
});

test.afterAll(async () => {
    await cleanup();
    expect((await rest(admin.jwt, `expenses?select=id&description=${LIKE_MARK}`)).data).toEqual([]);
    expect((await rest(admin.jwt, `recurring_expenses?select=id&description=${LIKE_MARK}`)).data).toEqual([]);
});

test('an admin adds a cost for one class with a receipt, views, edits and deletes it', async ({ page }) => {
    const cls = (await rest(null, 'classes?select=id,name&order=name&limit=1')).data[0];
    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/expenses');
    await expect(page.getByText('How this feeds the report')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open reports' })).toHaveAttribute('href', '/admin/reports');

    await page.locator('.exOverview').getByRole('button', { name: 'Add expense' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('What did the studio pay for?')).toBeVisible();

    // Saving an empty form says what is missing.
    await dialog.getByRole('button', { name: 'Add expense' }).click();
    await expect(dialog.getByText('Enter an amount above 0.')).toBeVisible();
    await expect(dialog.getByText('Pick a category.')).toBeVisible();

    const amount = dialog.getByLabel('Amount', { exact: true });
    await amount.fill('350k'); // shorthand, grouped as you type
    await expect(amount).toHaveValue('350.000');
    await dialog.locator('label.exCatOption', { hasText: 'Costumes' }).click();
    await expect(dialog.getByText('Renting or buying outfits for a shoot or show.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Bank transfer' }).click();
    await dialog.getByLabel('Description').fill(DESC);
    await dialog.getByLabel('Paid to').fill('E2E Studio Rentals');
    await dialog.getByText('Only for one class?').click();
    await expect(dialog.getByText('It then counts in that class’s margin on the report', { exact: false })).toBeVisible();
    await pickOption(page, dialog, 'Class', cls.name);
    await dialog.locator('input[type=file]').setInputFiles(PROOF);
    await expect(dialog.getByText('proof.jpg')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add expense' }).click();
    await expectToast(page, /added\./);
    await expect(dialog).toBeHidden();

    const [saved] = await expensesLike(admin.jwt, DESC);
    expect(saved).toMatchObject({
        amount: 350000,
        category: 'costumes',
        class_id: cls.id,
        method: 'transfer',
        vendor: 'E2E Studio Rentals',
        spent_on: today,
        created_by: admin.id,
    });
    expect(saved.receipt_path).toMatch(new RegExp(`^${saved.id}/`));

    // The row: class chip, receipt thumbnail, who wrote it down.
    const row = page.locator('.exRow', { hasText: DESC });
    await expect(row).toBeVisible();
    await expect(row.locator('.exClassChip')).toHaveText(cls.name);
    await expect(row.getByText('by you')).toBeVisible();
    await row.getByRole('button', { name: `View receipt for ${DESC}` }).click();
    const viewer = page.getByRole('dialog').filter({ hasText: 'Receipt' });
    const image = viewer.getByRole('img', { name: `Receipt for ${DESC}` });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await viewer.getByRole('button', { name: 'Close' }).first().click();
    await expect(viewer).toBeHidden();

    // Edit: a new amount and vendor.
    await row.getByRole('button', { name: `Edit ${DESC}` }).click();
    const edit = page.getByRole('dialog');
    await expect(edit.getByLabel('Amount', { exact: true })).toHaveValue('350.000');
    await edit.getByLabel('Amount', { exact: true }).fill('420000');
    await edit.getByLabel('Paid to').fill('E2E Costume Shop');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Expense saved.');
    const [edited] = await expensesLike(admin.jwt, DESC);
    expect(edited).toMatchObject({ amount: 420000, vendor: 'E2E Costume Shop', class_id: cls.id, receipt_path: saved.receipt_path });
    await expect(row).toContainText('E2E Costume Shop');

    // Delete (confirm): the row and its receipt are gone.
    page.once('dialog', (confirm) => confirm.accept());
    await row.getByRole('button', { name: `Delete ${DESC}` }).click();
    await expectToast(page, 'Expense deleted.');
    await expect(row).toHaveCount(0);
    expect(await expensesLike(admin.jwt, DESC)).toEqual([]);
    const stillThere = await receiptExists(saved.receipt_path);
    if (stillThere !== null) expect(stillThere, 'the receipt file is removed with the expense').toBe(false);
});

test('staff see and add only their own petty costs', async ({ page }) => {
    // A cost an admin wrote down this month: staff must not see it.
    const created = await rest(admin.jwt, 'expenses', {
        method: 'POST',
        prefer: 'return=representation',
        body: { spent_on: today, category: 'other', amount: 77000, description: ADMIN_ONLY },
    });
    expect(created.status).toBe(201);

    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/expenses');
    await expect(page.getByText('Only you and the admins see them.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your costs this month' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recurring costs' })).toHaveCount(0);
    await expect(page.getByText('Admins see your costs in the monthly report.')).toBeVisible();

    await page.locator('.exOverview').getByRole('button', { name: 'Add expense' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('group', { name: 'Quick amounts' }).getByRole('button', { name: '100k' }).click();
    await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('100.000');
    await dialog.locator('label.exCatOption', { hasText: 'Supplies' }).click();
    await dialog.getByLabel('Description').fill(STAFF_DESC);
    await dialog.getByRole('button', { name: 'Add expense' }).click();
    await expectToast(page, /added\./);

    await expect(page.locator('.exRow', { hasText: STAFF_DESC })).toBeVisible();
    await expect(page.getByText(ADMIN_ONLY)).toHaveCount(0);
    await expect(page.getByText('Thuê mặt bằng tầng 7', { exact: false })).toHaveCount(0); // the seeded rent (admin's)

    // RLS: staff read only their own rows; admins read everyone's.
    const mine = (await rest(staff.jwt, `expenses?select=description,created_by&description=like.${encodeURIComponent(`${MARK} ${RUN}`)}*`)).data;
    expect(mine).toEqual([{ description: STAFF_DESC, created_by: staff.id }]);
    const all = (await rest(admin.jwt, `expenses?select=description&description=like.${encodeURIComponent(`${MARK} ${RUN}`)}*&order=description`)).data;
    expect(all.map((row) => row.description).sort()).toEqual([ADMIN_ONLY, STAFF_DESC].sort());
    expect((await rest(staff.jwt, 'recurring_expenses?select=id')).data).toEqual([]);
});

test('an admin adds a recurring cost, adds this month’s copy, pauses it and deletes it', async ({ page }) => {
    recurringBefore = new Set(((await rest(admin.jwt, `expenses?select=id&month=eq.${thisMonth}&recurring_id=not.is.null`)).data ?? []).map((row) => row.id));

    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/expenses');
    const card = page.locator('.exRecurringCard');
    await expect(card.getByText('added automatically on their day each month', { exact: false })).toBeVisible();

    await card.getByRole('button', { name: 'Add recurring cost' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Amount', { exact: true }).fill('250k');
    await dialog.locator('label.exCatOption', { hasText: 'Marketing' }).click();
    await dialog.getByLabel('Description').fill(REC_DESC);
    await dialog.getByRole('button', { name: 'Add recurring cost' }).click();
    await expectToast(page, 'Recurring cost saved.');

    const [rec] = (await rest(admin.jwt, `recurring_expenses?select=*&description=eq.${encodeURIComponent(REC_DESC)}`)).data;
    expect(rec).toMatchObject({ amount: 250000, category: 'marketing', day_of_month: 1, starts_on: thisMonth, ends_on: null, active: true, method: 'transfer' });

    // Its day (the 1st) has come, so it's waiting for the nightly check: add it now.
    const row = card.locator('.exRecRow', { hasText: REC_DESC });
    await expect(row.getByText('Not added yet')).toBeVisible();
    await card.getByRole('button', { name: 'Add this month’s now' }).click();
    await expectToast(page, /added for/);
    await expect(row.getByText('Added this month')).toBeVisible();
    const copies = (await rest(admin.jwt, `expenses?select=${FIELDS}&recurring_id=eq.${rec.id}`)).data;
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ month: thisMonth, spent_on: thisMonth, amount: 250000, description: REC_DESC });
    await expect(page.locator('.exRow', { hasText: REC_DESC }).getByText('Monthly')).toBeVisible();

    // Pause.
    await row.getByRole('button', { name: `Pause ${REC_DESC}` }).click();
    await expectToast(page, 'is paused.');
    await expect(row.getByText('Paused')).toBeVisible();
    expect((await rest(admin.jwt, `recurring_expenses?select=active&id=eq.${rec.id}`)).data).toEqual([{ active: false }]);

    // Delete it: the month already added stays (no longer linked).
    page.once('dialog', (confirm) => confirm.accept());
    await row.getByRole('button', { name: `More for ${REC_DESC}` }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expectToast(page, 'Recurring cost deleted.');
    await expect(row).toHaveCount(0);
    expect((await rest(admin.jwt, `recurring_expenses?select=id&id=eq.${rec.id}`)).data).toEqual([]);
    expect((await rest(admin.jwt, `expenses?select=recurring_id&id=eq.${copies[0].id}`)).data).toEqual([{ recurring_id: null }]);
});
