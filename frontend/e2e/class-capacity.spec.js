import { test, expect } from '@playwright/test';
import { expectToast, login, rest, rpc, serviceKey, studioToday, token } from './support.js';

// A class's maximum number of students (supabase/migrations/20261117003200_class_capacity.sql): staff set it in the
// class's Setup (not below the students already in it); the class card says how many places are left; once every
// place is taken the card says the class is full, the student can't ask, and staff can't add anyone. The class is
// read from the running stack (one guest05 isn't in, with students); its maximum is put back afterwards.

test.describe.configure({ mode: 'serial' });

const STUDENT = 'guest05@demo.oopsdance.test';

let key;
let me;
let cls; // the list_public_classes() row
let taken; // places held in it
let before; // its maximum before the spec (null = no limit)

const setMax = async (value) => {
    const res = await rest(key, `classes?id=eq.${cls.id}`, { method: 'PATCH', body: { max_students: value } });
    expect(res.status, JSON.stringify(res.data)).toBeLessThan(300);
};

test.beforeAll(async () => {
    key = await serviceKey();
    if (!key) throw new Error('This spec needs the local service role key (SUPABASE_SERVICE_ROLE_KEY or `supabase status`).');
    me = await token(STUDENT);
    const today = await studioToday();
    const listed = (await rpc(me.jwt, 'list_public_classes')).data;
    const places = (await rest(key, 'class_students?select=class_id,student_id,leaves_after')).data.filter((row) => !row.leaves_after || row.leaves_after >= today);
    const closed = new Set((await rest(null, 'classes?select=id&ended_on=not.is.null')).data.map((row) => row.id));
    const mine = new Set(places.filter((row) => row.student_id === me.id).map((row) => row.class_id));
    const count = (id) => places.filter((row) => row.class_id === id).length;
    cls = listed.find((row) => !mine.has(row.id) && !closed.has(row.id) && count(row.id) > 0);
    if (!cls) throw new Error('No running class with students that guest05 is not in.');
    taken = count(cls.id);
    before = (await rest(key, `classes?select=max_students&id=eq.${cls.id}`)).data[0].max_students;
    await rest(key, `class_join_requests?class_id=eq.${cls.id}&student_id=eq.${me.id}`, { method: 'DELETE' });
});

test.afterAll(async () => {
    await setMax(before);
    await rest(key, `class_join_requests?class_id=eq.${cls.id}&student_id=eq.${me.id}`, { method: 'DELETE' });
});

test('staff set the maximum in Setup, not below the students in the class', async ({ page }) => {
    await setMax(null);
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/classes/${cls.id}?tab=setup`);
    const field = page.getByLabel('Max students');
    await field.fill(String(Math.max(taken - 1, 0) || ''));
    if (taken > 1) {
        await expect(page.getByText(`${taken} students already hold a place: the maximum can’t be lower.`)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save details' })).toBeDisabled();
    }
    await field.fill(String(taken + 1));
    await page.getByRole('button', { name: 'Save details' }).click();
    await expectToast(page, 'Class updated.');
    expect((await rest(key, `classes?select=max_students&id=eq.${cls.id}`)).data[0].max_students).toBe(taken + 1);

    await page.goto(`/admin/classes/${cls.id}?tab=students`);
    await expect(page.getByText(`${taken} of ${taken + 1} places · 1 left`).first()).toBeVisible();
});

test('the class card says one place is left, and the student can still ask', async ({ page }) => {
    await login(page, STUDENT);
    await page.goto('/classes');
    const card = page.locator(`#class-${cls.id}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.hpSeats')).toHaveText(/1 place left/);
    await expect(card.getByRole('button', { name: 'Ask to join' })).toBeVisible();
});

test('a full class says so: no way to ask, and staff can’t add anyone', async ({ page, browser }) => {
    await setMax(taken);
    const refused = await rpc(me.jwt, 'class_join_request', { p_class_id: cls.id });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(refused.data)).toContain('this class is full');

    await login(page, STUDENT);
    await page.goto('/classes');
    const card = page.locator(`#class-${cls.id}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText('Class is full')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Ask to join' })).toHaveCount(0);

    const staff = await browser.newPage();
    await login(staff, 'staff@demo.oopsdance.test');
    await staff.goto(`/admin/classes/${cls.id}?tab=students`);
    await expect(staff.getByText(`Full: ${taken} of ${taken} places`).first()).toBeVisible();
    const add = staff.getByRole('button', { name: 'Add student' });
    await expect(add).toHaveCount(2); // the header's and the list's
    for (const button of await add.all()) await expect(button).toBeDisabled();
    await staff.close();
});
