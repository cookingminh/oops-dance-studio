// Payroll (admin only): a deduction with a reason, finalize → reopen, and back to how it was;
// the payslip's sessions on a calendar of its month (chips, legend = the payslip's lines, List,
// the session modal, a substitute's badge). Everything changed is put back exactly as it was.
import { test, expect } from '@playwright/test';
import { addDays, expectToast, login, pathname, rest, rpc, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const REASON = `E2E late check-in ${Date.now()}`;
let page;
let dialog;
let teacher; // the instructor whose payslip the spec works on (name): the one with the most sessions this month

test.beforeAll(async ({ browser }) => {
    const admin = await token('admin@demo.oopsdance.test');
    const today = await studioToday();
    const rows = (await rpc(admin.jwt, 'payroll_month', { p_month: `${today.slice(0, 7)}-01` })).data;
    teacher = rows.filter((row) => row.role === 'instructor').sort((a, b) => b.sessions - a.sessions)[0]?.full_name;
    expect(teacher, 'an instructor on this month’s payroll').toBeTruthy();
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
    await expect(teacherRow()).toBeVisible();
});

const teacherRow = () => page.locator('.payRow').filter({ hasText: teacher });

test('adds a deduction with a reason', async () => {
    await teacherRow().click();
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
    await expect(teacherRow()).toContainText('Finalized');
    await dialog.getByRole('button', { name: 'Reopen' }).click();
    await expectToast(page, 'Payslip reopened.');
    await expect(teacherRow()).toContainText('Draft');
});

test('cleanup: the deduction is removed', async () => {
    await dialog.locator('li').filter({ hasText: REASON }).getByRole('button', { name: 'Remove' }).click();
    await expectToast(page, 'Removed.');
    const admin = await token('admin@demo.oopsdance.test');
    const res = await rest(admin.jwt, `payroll_adjustments?select=id&reason=eq.${encodeURIComponent(REASON)}`);
    expect(res.data).toEqual([]);
});

// ---- The payslip's calendar ------------------------------------------------------------------

// This month's payslip of the teacher: { month, row (payroll_month), sessions (instructor_attendance) }.
async function teacherMonth(jwt) {
    const today = await studioToday();
    const month = `${today.slice(0, 7)}-01`;
    const next = addDays(`${today.slice(0, 7)}-28`, 7).slice(0, 7);
    const row = (await rpc(jwt, 'payroll_month', { p_month: month })).data.find((item) => item.full_name === teacher);
    const sessions = (await rest(jwt, `instructor_attendance?select=id,class_id,status&instructor_id=eq.${row.profile_id}&date=gte.${month}&date=lt.${next}-01`)).data;
    return { today, month, row, sessions };
}

async function openTeacher() {
    if (await dialog.count()) {
        await dialog.getByRole('button', { name: 'Close' }).last().click();
        await expect(dialog).toHaveCount(0);
    }
    await teacherRow().click();
    await expect(dialog.getByText('Payslip for')).toBeVisible();
}

test('the payslip shows its month on a calendar, the legend matches the lines', async () => {
    const admin = await token('admin@demo.oopsdance.test');
    const { month, row, sessions } = await teacherMonth(admin.jwt);
    const completed = sessions.filter((session) => session.status === 'completed');
    await openTeacher();

    // Calendar is the default view; the month is fixed (no ‹ Today ›).
    const views = dialog.getByRole('group', { name: 'Show sessions as' });
    await expect(views.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true');
    const calendar = dialog.locator('.payCalendar');
    const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
    await expect(calendar.locator('.calTitle')).toHaveText(monthYear);
    await expect(calendar.getByRole('button', { name: 'Previous month' })).toHaveCount(0);
    await expect(calendar.getByRole('button', { name: 'Today' })).toHaveCount(0);

    // One chip per session of the month; the paid ones are the payslip's sessions.
    await expect(calendar.locator('.calChip')).toHaveCount(sessions.length);
    await expect(calendar.locator('.calChip.tone-solid')).toHaveCount(completed.length);
    expect(completed.length).toBe(row.sessions);

    // The legend repeats the payslip's lines: class, sessions, subtotal.
    const lines = await dialog.locator('.payBreakdown > div').evaluateAll((divs) =>
        divs
            .filter((div) => div.querySelector('dt small'))
            .map((div) => ({ name: div.querySelector('dt').firstChild.textContent.trim(), n: div.querySelector('dt small').textContent.split('×')[0].trim(), total: div.querySelector('dd').textContent.trim() }))
    );
    const legend = await calendar.locator('.payLegend li:not(.isOff):not(.isLater)').evaluateAll((items) =>
        items.map((li) => {
            const [count, total] = li.querySelector('small').textContent.split(' · ');
            return { name: li.querySelector('strong').textContent.trim(), n: count.split(' ')[0], total: total.trim() };
        })
    );
    expect(legend).toEqual(lines);
    expect(new Set(lines.map((line) => line.name)).size).toBe(new Set(completed.map((session) => session.class_id)).size);
    const unpaid = sessions.length - completed.length;
    const others = await calendar.locator('.payLegend li:is(.isOff, .isLater) small').allTextContents();
    expect(others.reduce((sum, text) => sum + Number(text.split(' ')[0]), 0)).toBe(unpaid);

    // A session opens the session modal (proofs, roll call); closing it keeps the payslip.
    await calendar.locator('.calChip').first().click();
    const session = page.getByRole('dialog').filter({ hasText: 'Roll call' });
    await expect(session).toBeVisible();
    await session.getByRole('button', { name: 'Close' }).last().click();
    await expect(session).toHaveCount(0);
    await expect(dialog.getByText('Payslip for')).toBeVisible();

    // List still lists every session.
    await views.getByRole('button', { name: 'List' }).click();
    await expect(calendar).toHaveCount(0);
    await expect(dialog.locator('.paySessions li')).toHaveCount(sessions.length);
    await expect(dialog.locator('.paySessions li:not(.isOff)')).toHaveCount(completed.length);
    await views.getByRole('button', { name: 'Calendar' }).click();
    await expect(dialog.locator('.payCalendar .calChip')).toHaveCount(sessions.length);
});

test('a session taught as a substitute has its badge', async () => {
    const admin = await token('admin@demo.oopsdance.test');
    const { today, month, row, sessions } = await teacherMonth(admin.jwt);
    const next = addDays(`${month.slice(0, 7)}-28`, 7).slice(0, 7);
    // A planned weekly session later this month of a class the teacher doesn't teach.
    const planned = (
        await rest(
            admin.jwt,
            `instructor_attendance?select=*,class:classes!class_id(name,instructor_id)&date=gt.${today}&date=lt.${next}-01&status=eq.pending&is_extra=eq.false&instructor_id=neq.${row.profile_id}&order=date,id&limit=20`
        )
    ).data.find((item) => item.class.instructor_id !== row.profile_id);
    test.skip(!planned, 'no planned session left this month');
    const { class: cls, ...original } = planned;
    const patch = await rest(admin.jwt, `instructor_attendance?id=eq.${original.id}`, { method: 'PATCH', body: { instructor_id: row.profile_id } });
    expect(patch.status).toBeLessThan(300);
    try {
        await openTeacher();
        const calendar = dialog.locator('.payCalendar');
        await expect(calendar.locator('.calChip')).toHaveCount(sessions.length + 1);
        const chip = calendar.getByRole('button', { name: new RegExp(`${cls.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*Substitute`) });
        await expect(chip).toHaveCount(1);
        await expect(chip).toHaveClass(/tone-dashed/);
        await expect(chip).toContainText('Not counted yet');
    } finally {
        const back = await rest(admin.jwt, `instructor_attendance?id=eq.${original.id}`, { method: 'PATCH', body: { instructor_id: original.instructor_id } });
        expect(back.status).toBeLessThan(300);
        expect((await rest(admin.jwt, `instructor_attendance?select=*&id=eq.${original.id}`)).data).toEqual([original]);
    }
});
