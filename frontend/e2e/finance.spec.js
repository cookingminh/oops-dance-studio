// Finance report (/admin/reports, admin only): the numbers match finance_monthly / finance_by_class /
// finance_expenses, profit is built up line by line (revenue − payroll − each expense), student
// movement is counted per person with class switches apart, staff are kept out (page and RPCs),
// and the CSV exports carry the new columns. Read-only: nothing to restore.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { login, pathname, rpc, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

// Same formatting as the page (formatVnd, with a real minus sign for losses; en-GB percentages).
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const money = (amount) => (amount < 0 ? `−${vnd.format(-amount)}` : vnd.format(amount));
const pct = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
const numeric = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, ['month', 'category', 'class_name', 'instructor_name', 'class_id'].includes(k) ? v : Number(v)]));

function shiftMonth(month, n) {
    const [year, mon] = month.split('-').map(Number);
    const index = year * 12 + (mon - 1) + n;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

let page;
let thisMonth;
let lastMonth; // the report opens on the last full month
let rows; // finance_monthly by month, numbers as numbers
let classes; // finance_by_class for the last full month
let expenses; // finance_expenses for the last full month, biggest first

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    thisMonth = `${(await studioToday()).slice(0, 7)}-01`;
    lastMonth = shiftMonth(thisMonth, -1);
    const admin = await token('admin@demo.oopsdance.test');
    const monthly = await rpc(admin.jwt, 'finance_monthly', { p_from: shiftMonth(thisMonth, -2), p_to: thisMonth });
    expect(monthly.status).toBe(200);
    rows = Object.fromEntries(monthly.data.map((row) => [row.month, numeric(row)]));
    expect(rows[lastMonth].revenue, 'the seed has a full month of finance data').toBeGreaterThan(0);
    expect(rows[lastMonth].expenses_total, 'the seed has expenses last month').toBeGreaterThan(0);
    const byClass = await rpc(admin.jwt, 'finance_by_class', { p_month: lastMonth });
    expect(byClass.status).toBe(200);
    classes = byClass.data.map(numeric);
    const spent = await rpc(admin.jwt, 'finance_expenses', { p_from: lastMonth, p_to: lastMonth });
    expect(spent.status).toBe(200);
    expenses = spent.data.map(numeric).sort((a, b) => b.amount - a.amount);
});
test.afterAll(() => page.close());

test('staff can’t open the report or call its RPCs', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    await expect(page.locator('.adminSidebar').getByText('Reports', { exact: true })).toHaveCount(0);
    await page.goto('/admin/reports');
    await page.waitForURL((url) => url.pathname === '/admin');

    const staff = await token('staff@demo.oopsdance.test');
    for (const [name, args] of [
        ['finance_monthly', { p_from: lastMonth, p_to: thisMonth }],
        ['finance_by_class', { p_month: lastMonth }],
        ['finance_expenses', { p_from: lastMonth, p_to: thisMonth }],
    ]) {
        const res = await rpc(staff.jwt, name, args);
        expect(res.status, name).toBe(400);
        expect(res.data.message, name).toMatch(/^FORBIDDEN/);
    }
    await page.getByRole('button', { name: 'Log Out' }).click();
});

test('admin sees last month’s numbers as finance_monthly has them', async () => {
    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/reports');
    expect(pathname(page)).toBe('/admin/reports');
    const row = rows[lastMonth];
    // Costs are payroll + expenses, and profit is what revenue leaves after them.
    expect(row.costs_total).toBe(row.payroll_cost + row.expenses_total);
    expect(row.profit).toBe(row.revenue - row.costs_total);

    await expect(page.locator('.monthState')).toHaveText('Full month');
    const tile = (kpi) => page.locator(`.kpiTile[data-kpi="${kpi}"]`);
    await expect(tile('revenue').locator('.kpiValue')).toHaveText(money(row.revenue));
    await expect(tile('costs_total').locator('.kpiValue')).toHaveText(money(row.costs_total));
    await expect(tile('costs_total')).toContainText('Payroll');
    await expect(tile('costs_total')).toContainText('expenses');
    await expect(tile('profit').locator('.kpiValue')).toHaveText(money(row.profit));
    await expect(tile('profit')).toContainText('Revenue − payroll − expenses');
    await expect(tile('tuition_outstanding').locator('.kpiValue')).toHaveText(money(row.tuition_outstanding));
    await expect(tile('students_active').locator('.kpiValue')).toHaveText(String(row.students_active));
    // Costs going up read as "Worse", never just as an arrow.
    const previous = rows[shiftMonth(lastMonth, -1)];
    if (row.costs_total > previous.costs_total) await expect(tile('costs_total').locator('.kpiDelta')).toContainText('Worse');

    // The month-by-month table has the same row, and this month is marked as running.
    const monthRow = page.locator(`.monthlyTable tr[data-month="${lastMonth}"]`);
    await expect(monthRow).toContainText(money(row.revenue));
    await expect(monthRow).toContainText(money(row.payroll_cost));
    await expect(monthRow).toContainText(money(row.expenses_total));
    await expect(page.locator(`.monthlyTable tr[data-month="${thisMonth}"]`)).toContainText('In progress');
});

test('the ledger builds the profit up line by line', async () => {
    const row = rows[lastMonth];
    const ledger = page.locator('.ledgerCard');
    const amount = (key) => ledger.locator(`.ledgerLine[data-line="${key}"] .ledgerAmount`);
    await expect(ledger).toContainText('How we got to this profit');
    await expect(amount('tuition')).toHaveText(money(row.tuition_collected));
    if (row.bookings_revenue > 0) await expect(amount('rooms')).toHaveText(`+${money(row.bookings_revenue)}`);
    await expect(amount('revenue')).toHaveText(money(row.revenue));
    await expect(amount('payroll')).toHaveText(money(-row.payroll_cost));
    await expect(amount('expenses')).toHaveText(money(-row.expenses_total));
    // One line per expense category, biggest first, adding up to the expenses total.
    expect(expenses.reduce((sum, item) => sum + item.amount, 0)).toBe(row.expenses_total);
    const categoryLines = ledger.locator('.ledgerLine[data-line^="cat-"]');
    await expect(categoryLines).toHaveCount(expenses.length);
    for (const [index, item] of expenses.entries()) {
        await expect(categoryLines.nth(index)).toHaveAttribute('data-line', `cat-${item.category}`);
        await expect(categoryLines.nth(index).locator('.ledgerAmount')).toHaveText(money(-item.amount));
    }
    await expect(amount('profit')).toHaveText(money(row.profit));
    await expect(ledger.locator('.ledgerLine[data-line="profit"] .ledgerLabel')).toHaveText(row.profit < 0 ? 'Loss' : 'Profit');
    await expect(ledger.getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', '/admin/expenses');
    await expect(ledger.getByRole('link', { name: 'Payroll cost' })).toHaveAttribute('href', '/admin/payroll');
    await expect(ledger).toContainText('expenses by the day they were spent');
});

test('the costs chart’s table view sums to the month’s costs', async () => {
    const row = rows[lastMonth];
    const card = page.locator('.costsCard');
    await card.getByRole('button', { name: 'Table' }).click();
    const heading = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${lastMonth}T00:00:00`));
    const tableRow = card.locator('.chartTable tbody tr').filter({ has: page.getByRole('rowheader', { name: heading, exact: true }) });
    await expect(tableRow.locator('td').first()).toHaveText(money(row.payroll_cost));
    await expect(tableRow.locator('.isTotal')).toHaveText(money(row.costs_total));
    await card.getByRole('button', { name: 'Chart' }).click();
    await expect(card.locator('canvas')).toBeVisible();
});

test('each class’s margin takes off its instructor pay and its own costs', async () => {
    const table = page.locator('.classTable');
    await expect(table.locator('thead')).toContainText('Class costs');
    for (const cls of classes) {
        expect(cls.margin, cls.class_name).toBe(cls.collected - cls.instructor_pay - cls.direct_costs);
        const classRow = table.locator('tbody tr').filter({ hasText: cls.class_name });
        await expect(classRow).toContainText(money(cls.margin));
        if (cls.direct_costs > 0) await expect(classRow).toContainText(money(cls.direct_costs));
        await expect(classRow.getByText('Loses money')).toHaveCount(cls.margin < 0 ? 1 : 0);
    }
    await expect(page.locator('.classFinanceCard .tableNote')).toContainText('costs tied to the class');
});

test('student movement counts people, with class switches apart', async () => {
    const row = rows[lastMonth];
    const before = rows[shiftMonth(lastMonth, -1)];
    const card = page.locator('.movementCard');
    const figure = (key) => card.locator(`.movementFigure[data-figure="${key}"] dd`);
    await expect(figure('active')).toHaveText(String(row.students_active));
    await expect(figure('continuing')).toHaveText(String(row.students_continuing));
    await expect(figure('new')).toHaveText(String(row.students_new));
    await expect(figure('returning')).toHaveText(String(row.students_returning));
    await expect(figure('left')).toHaveText(String(row.students_left));
    await expect(figure('switches')).toHaveText(String(row.class_switches));
    if (before.students_active > 0) {
        const retention = pct.format(Math.min(1, row.students_continuing / before.students_active));
        await expect(card).toContainText(`Retention ${retention}`);
    }
    await expect(card).toContainText('A class switch isn’t counted as leaving.');
});

test('the month still running is shown as in progress, switches included', async () => {
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.locator('.monthState')).toHaveText('In progress');
    const row = rows[thisMonth];
    const revenue = page.locator('.kpiTile[data-kpi="revenue"]');
    await expect(revenue.locator('.kpiValue')).toHaveText(money(row.revenue));
    await expect(revenue).toContainText('So far, not comparable yet');
    await expect(page.locator('.ledgerLine[data-line="profit"] .ledgerAmount')).toHaveText(money(row.profit));
    await expect(page.locator('.movementFigure[data-figure="switches"] dd')).toHaveText(String(row.class_switches));
    if (row.class_switches > 0) await expect(page.locator('.insightsCard')).toContainText('not counted as leaving');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.locator('.monthState')).toHaveText('Full month');
});

test('CSV exports download the monthly and the class tables', async () => {
    const row = rows[lastMonth];
    const [monthly] = await Promise.all([page.waitForEvent('download'), page.locator('.monthlyCard').getByRole('button', { name: 'Export CSV' }).click()]);
    expect(monthly.suggestedFilename()).toBe(`finance-monthly-${(await firstShownMonth()).slice(0, 7)}_${thisMonth.slice(0, 7)}.csv`);
    const csv = fs.readFileSync(await monthly.path(), 'utf8');
    const head = csv.split('\n')[0];
    for (const column of ['"Revenue"', '"Payroll cost"', '"Expenses"', '"Costs"', '"Profit"', '"New students"', '"Students who left"', '"Retention (%)"', '"Class switches"', '"Renewed enrolments"']) {
        expect(head).toContain(column);
    }
    // One column per expense category, e.g. "Expenses: Rent".
    expect(head).toMatch(/"Expenses: [^"]+"/);
    const line = csv.split('\n').find((text) => text.startsWith(`"${lastMonth.slice(0, 7)}"`));
    for (const value of [row.revenue, row.expenses_total, row.costs_total, row.profit, row.students_continuing]) expect(line).toContain(`"${value}"`);

    const [byClass] = await Promise.all([page.waitForEvent('download'), page.locator('.classFinanceCard').getByRole('button', { name: 'Export CSV' }).click()]);
    expect(byClass.suggestedFilename()).toBe(`finance-classes-${lastMonth.slice(0, 7)}.csv`);
    const classCsv = fs.readFileSync(await byClass.path(), 'utf8');
    expect(classCsv.split('\n')[0]).toContain('"Class costs"');
    for (const cls of classes) expect(classCsv).toContain(`"${cls.class_name}"`);
});

// The first month row in the table (the report skips months before any records).
async function firstShownMonth() {
    return page.locator('.monthlyTable tbody tr').first().getAttribute('data-month');
}
