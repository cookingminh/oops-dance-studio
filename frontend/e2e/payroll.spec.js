// Payroll (admin only): a deduction with a reason, finalize → reopen, and back to how it was.
import { test, expect } from '@playwright/test';
import { expectToast, login, pathname, rest, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const REASON = `E2E late check-in ${Date.now()}`;
let page;
let dialog;

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    dialog = page.getByRole('dialog');
});
test.afterAll(() => page.close());

test('staff can’t see payroll', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    await expect(page.locator('.adminSidebar').getByText('Payroll', { exact: true })).toHaveCount(0);
    await page.goto('/admin/payroll');
    await page.waitForURL((url) => url.pathname === '/admin');
    const staff = await token('staff@demo.oopsdance.test');
    const res = await rest(staff.jwt, 'staff_salaries?select=profile_id');
    expect(res.data).toEqual([]);
    await page.getByRole('button', { name: 'Log Out' }).click();
});

test('admin sees this month’s payroll', async () => {
    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/payroll');
    expect(pathname(page)).toBe('/admin/payroll');
    await expect(page.getByText('Total payroll')).toBeVisible();
    await expect(page.locator('.payRow').filter({ hasText: 'Bin' })).toBeVisible();
});

const binRow = () => page.locator('.payRow').filter({ hasText: 'Bin' });

test('adds a deduction with a reason', async () => {
    await binRow().click();
    await expect(dialog.getByText('Payslip for')).toBeVisible();
    await dialog.getByLabel('Amount (VND)').fill('12000');
    await dialog.getByLabel('Reason').fill(REASON);
    await dialog.getByRole('button', { name: 'Add deduction' }).click();
    await expectToast(page, 'Deduction added.');
    await expect(dialog.getByText(REASON)).toBeVisible();
    const admin = await token('admin@demo.oopsdance.test');
    const res = await rest(admin.jwt, `payroll_adjustments?select=amount&reason=eq.${encodeURIComponent(REASON)}`);
    expect(res.data).toEqual([{ amount: -12000 }]);
});

test('finalize freezes it, reopen unlocks it', async () => {
    await dialog.getByRole('button', { name: 'Finalize payslip' }).click();
    await expectToast(page, 'Payslip finalized.');
    await expect(dialog.getByText('Reopen the payslip to change bonuses or deductions.')).toBeVisible();
    await expect(binRow()).toContainText('Finalized');
    await dialog.getByRole('button', { name: 'Reopen' }).click();
    await expectToast(page, 'Payslip reopened.');
    await expect(binRow()).toContainText('Draft');
});

test('cleanup: the deduction is removed', async () => {
    await dialog.locator('li').filter({ hasText: REASON }).getByRole('button', { name: 'Remove' }).click();
    await expectToast(page, 'Removed.');
    const admin = await token('admin@demo.oopsdance.test');
    const res = await rest(admin.jwt, `payroll_adjustments?select=id&reason=eq.${encodeURIComponent(REASON)}`);
    expect(res.data).toEqual([]);
});
