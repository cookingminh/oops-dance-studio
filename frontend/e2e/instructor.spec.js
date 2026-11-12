import { test, expect } from '@playwright/test';
import { PROOF, dropSessionToday, expectToast, login, pathname, resetSession, rest, rpc, sessionToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const EMAIL = 'instructor@demo.oopsdance.test';
const OTHER = 'instructor2@demo.oopsdance.test';
let page;
let me;
let mine; // her session today (a make-up added for the run on a day she doesn't teach)
let other; // another instructor's session today, likewise

test.beforeAll(async ({ browser }) => {
    mine = await sessionToday(EMAIL);
    other = await sessionToday(OTHER);
    await resetSession(mine.id, { open: true });
    me = await token(EMAIL);
    page = await browser.newPage();
});
test.afterAll(async () => {
    await page.close();
    await dropSessionToday(mine);
    await dropSessionToday(other);
});

test('instructor lands on /profile', async () => {
    await login(page, EMAIL);
    expect(pathname(page)).toBe('/profile');
    await expect(page.getByText('Sessions taught')).toBeVisible();
});

test('my classes lists own classes', async () => {
    await page.goto('/profile/my-classes');
    await expect(page.locator('.singleItem').first()).toBeVisible();
});

test('checks in with a proof photo (upload + instructor_check_in)', async () => {
    await page.goto('/profile/attendance');
    await expect(page.getByText('Your Classes Today')).toBeVisible();
    await page.getByRole('button', { name: 'Check In Now' }).first().click();
    await page.locator('input[type=file]').setInputFiles(PROOF);
    await expect(page.getByText(/proof\.(jpg|webp) \(/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Check In', exact: true }).click();
    await expectToast(page, 'Checked in');
});

test('checks out with a proof photo (instructor_check_out -> completed)', async () => {
    await page.getByRole('button', { name: 'Check Out Now' }).first().click();
    await page.locator('input[type=file]').setInputFiles(PROOF);
    await expect(page.getByText(/proof\.(jpg|webp) \(/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Check Out', exact: true }).click();
    await expectToast(page, 'Checked out');
});

test('history shows the proof thumbnails', async () => {
    const proofs = page.locator('.historyDiv button[aria-label="View proof photo"] img');
    await expect.poll(() => proofs.count()).toBeGreaterThanOrEqual(2);
});

test('proof photos are served through signed URLs', async () => {
    const src = await page.locator('.historyDiv button[aria-label="View proof photo"] img').first().getAttribute('src');
    expect(src).toMatch(/\/object\/sign\/attendance-proofs\//);
});

for (const target of ['/admin', '/profile/my-attendance']) {
    test(`instructor ${target} redirects to /profile`, async () => {
        await page.goto(target);
        await page.waitForURL((url) => url.pathname === '/profile');
    });
}

test("cannot check in another instructor's session", async () => {
    const res = await rpc(me.jwt, 'instructor_check_in', { p_attendance_id: other.id, p_proof_path: `${me.id}/${other.id}/checkin.jpg` });
    expect(res.data.message).toMatch(/^FORBIDDEN/);
});

test('RLS: instructor sees only own attendance', async () => {
    const res = await rest(me.jwt, 'instructor_attendance?select=instructor_id');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((r) => r.instructor_id === me.id)).toBe(true);
});

test("RLS: instructor sees own and students' profiles only", async () => {
    const res = await rest(me.jwt, 'profiles?select=id,role');
    expect(res.data.some((r) => r.id === me.id)).toBe(true);
    expect(res.data.every((r) => r.role !== 'admin' && r.role !== 'staff')).toBe(true);
});
