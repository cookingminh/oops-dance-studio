import { test, expect } from '@playwright/test';
import { addDays, login, rest, rpc, staffJwt, studioToday } from './support.js';

// One routine at a time (migration 20261117000100): the next routine starts after the shoot day of the
// one being learned. The plan form only offers later days and says students are asked to continue; the
// server refuses an overlap. A routine to-do in the bell opens that class's Routines tab directly.
// Read-only on the seeded classes: nothing is created.

test.describe.configure({ mode: 'serial' });

let page;
let staff;
let today;
let target; // { cls: { id, name }, current: progress row } — a class learning a routine, nothing planned after it

test.beforeAll(async ({ browser }) => {
    staff = await staffJwt();
    today = await studioToday();
    const classes = (await rest(staff, 'classes?select=id,name&ended_on=is.null&order=id')).data;
    const progress = (await rpc(staff, 'lesson_progress', { p_class_ids: classes.map((cls) => cls.id) })).data;
    for (const cls of classes) {
        const rows = progress.filter((row) => row.class_id === cls.id);
        const current = rows.find((row) => row.status === 'current' && row.ends_on && row.ends_on >= today);
        if (current && !rows.some((row) => row.status === 'planned')) {
            target = { cls, current };
            break;
        }
    }
    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close();
});

test('the next routine can only start after the current one’s shoot day', async () => {
    test.skip(!target, 'no seeded class is learning a routine with nothing planned after it');
    const { cls, current } = target;
    await page.goto(`/admin/classes/${cls.id}?tab=routines`);
    const plan = page.locator('.rtPlan');
    // The form opens by itself when 2 sessions or fewer are left; otherwise behind a button.
    const open = plan.getByRole('button', { name: 'Plan the next routine' });
    await expect(open.or(plan.locator('form.rtForm'))).toBeVisible();
    if (await open.isVisible()) await open.click();

    await expect(plan.locator('.rtFollows')).toContainText(current.title);
    await expect(plan.locator('.rtFollows')).toContainText('asked whether they continue');
    const start = plan.getByLabel('Starts on', { exact: true });
    await expect(start).toHaveAttribute('min', addDays(current.ends_on, 1));
    expect(await start.inputValue() > current.ends_on).toBe(true);

    await plan.getByLabel('Routine', { exact: true }).fill('E2E — Too Soon');
    await start.fill(current.ends_on);
    await expect(plan.getByText(`“${current.title}” runs until`)).toBeVisible();
    await expect(plan.getByRole('button', { name: 'Plan routine' })).toBeDisabled();
});

test('the server refuses a routine that overlaps the current one', async () => {
    test.skip(!target, 'no seeded class is learning a routine with nothing planned after it');
    const res = await rest(staff, 'class_lessons', {
        method: 'POST',
        body: { class_id: target.cls.id, starts_on: target.current.ends_on, title: 'E2E — Too Soon', session_count: 4 },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.data)).toContain('routine order');
    const left = (await rest(staff, `class_lessons?select=id&class_id=eq.${target.cls.id}&title=eq.${encodeURIComponent('E2E — Too Soon')}`)).data;
    expect(left).toEqual([]);
});

test('a routine to-do opens that class’s Routines tab', async () => {
    await page.goto('/admin');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    const todo = page.locator('.taskItem.is-normal').filter({ has: page.locator('.taskIcon.kind-lessons') }).first();
    test.skip(!(await todo.count()), 'no routine to-do right now');
    await todo.click();
    await expect(page).toHaveURL(/\/admin\/classes\/\d+\?tab=routines$/);
    await expect(page.locator('.rtPanel')).toBeVisible();
});
