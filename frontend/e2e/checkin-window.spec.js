// The check-in window and a late check-out (supabase/migrations/20261117001100_checkin_window.sql), on the demo
// instructor's session today (a make-up added for the run on a day she doesn't teach; its own times set over REST
// around the clock, so it works at any hour):
//   * starting in 30 minutes: the button waits — "Check-in opens at HH:MM" — and the server refuses too;
//   * already over: "The session is over — ask the studio to record it";
//   * ended more than 10 minutes ago, checked in: the check-out says it is late, works, and the session is
//     marked "Late check-out";
//   * staff correct the times in the session dialog with a reason (Attendance), the late mark follows the
//     times, the badge shows on today's board, and the activity log has the entry with before → after.
// The session row is put back exactly as it was (an added one is removed).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { ANON, API, PROOF, dropSessionToday, expectToast, login, rest, rpc, sessionToday, staffJwt, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const EMAIL = 'instructor@demo.oopsdance.test';
const FIELDS = 'status,start_time,end_time,checkin_at,checkout_at,checkout_late,checkin_proof_path,checkout_proof_path';

let today;
let staff; // { jwt, name }
let me; // the instructor: { jwt, id, name }
let mine; // her session today (sessionToday)
let session; // { id, class_id, className }
let original; // the row's FIELDS as they were
let insPage;
let staffPage;
let adminPage;

// Studio clock 'HH:mm', `minutes` from now (the tests skip near midnight).
const clockIn = (minutes) => {
    const at = new Date(Date.now() + minutes * 60_000);
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
};
const minutesNow = () => {
    const [h, m] = clockIn(0).split(':').map(Number);
    return h * 60 + m;
};
const isoIn = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

const setRow = async (body) => {
    const res = await rest(await staffJwt(), `instructor_attendance?id=eq.${session.id}`, { method: 'PATCH', body });
    expect(res.status, JSON.stringify(res.data)).toBeLessThan(300);
};
const rowNow = async () => (await rest(await staffJwt(), `instructor_attendance?select=${FIELDS}&id=eq.${session.id}`)).data[0];
const NOT_IN = { status: 'pending', checkin_at: null, checkout_at: null, checkout_late: false, checkin_proof_path: null, checkout_proof_path: null };

async function uploadProof(kind) {
    const path = `${me.id}/${session.id}/${kind}.jpg`;
    const upload = await fetch(`${API}/storage/v1/object/attendance-proofs/${path}`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${me.jwt}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: fs.readFileSync(PROOF),
    });
    expect(upload.ok, `proof upload ${upload.status}`).toBe(true);
    return path;
}

// Her card for the session on her check-in page.
const sessionCard = () => insPage.locator('.pfSession').filter({ hasText: session.className });

test.beforeAll(async ({ browser }) => {
    today = await studioToday();
    mine = await sessionToday(EMAIL);
    const jwt = await staffJwt();
    const row = (await rest(jwt, `instructor_attendance?select=id,class_id,${FIELDS},class:classes!class_id(name)&id=eq.${mine.id}`)).data[0];
    const { id, class_id: classId, class: cls, ...fields } = row;
    session = { id, class_id: classId, className: cls.name };
    original = fields;
    const teacher = await token(EMAIL);
    me = { ...teacher, name: (await rest(jwt, `profiles?select=full_name&id=eq.${teacher.id}`)).data[0].full_name };
    staff = { name: (await rest(jwt, 'profiles?select=full_name&email=eq.staff@demo.oopsdance.test')).data[0].full_name };

    insPage = await (await browser.newContext()).newPage();
    await login(insPage, EMAIL);
    staffPage = await (await browser.newContext()).newPage();
    await login(staffPage, 'staff@demo.oopsdance.test');
    adminPage = await (await browser.newContext()).newPage();
    await login(adminPage, 'admin@demo.oopsdance.test');
});

test.afterAll(async () => {
    if (session && mine.added) await dropSessionToday(mine);
    else if (session) {
        await setRow(original);
        expect(await rowNow()).toEqual(original);
    }
    for (const page of [insPage, staffPage, adminPage]) await page?.context().close().catch(() => {});
});

test('a session starting in 30 minutes: the button says when check-in opens; the server refuses', async () => {
    test.skip(minutesNow() > 22 * 60 + 20, 'too close to midnight for a session 30 minutes from now');
    const start = clockIn(30);
    const end = clockIn(90);
    const opens = clockIn(15);
    await setRow({ ...NOT_IN, start_time: start, end_time: end });

    await insPage.goto('/profile/attendance');
    const button = sessionCard().getByRole('button', { name: `Check-in opens at ${opens}` });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(sessionCard().getByRole('button', { name: 'Check In Now' })).toHaveCount(0);

    const proof = await uploadProof('checkin');
    const res = await rpc(me.jwt, 'instructor_check_in', { p_attendance_id: session.id, p_proof_path: proof });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.data.message).toMatch(new RegExp(`^INVALID_STATE: check-in opens at ${opens}`));
});

test('a session that is over: no check-in, ask the studio to record it', async () => {
    test.skip(minutesNow() < 95, 'too close to midnight for a session that ended');
    await setRow({ ...NOT_IN, start_time: clockIn(-90), end_time: clockIn(-30) });
    await insPage.goto('/profile/attendance');
    await expect(sessionCard()).toContainText('The session is over — ask the studio to record it');
    await expect(sessionCard().getByRole('button', { name: /Check In Now|Check-in opens/ })).toHaveCount(0);

    const proof = await uploadProof('checkin');
    const res = await rpc(me.jwt, 'instructor_check_in', { p_attendance_id: session.id, p_proof_path: proof });
    expect(res.data.message).toMatch(/^INVALID_STATE: the session is over/);
});

test('checking out more than 10 minutes after the end warns first, works, and marks it late', async () => {
    test.skip(minutesNow() < 95, 'too close to midnight for a session that ended');
    const checkin = await uploadProof('checkin');
    await setRow({ ...NOT_IN, status: 'in_progress', start_time: clockIn(-80), end_time: clockIn(-20), checkin_at: isoIn(-78), checkin_proof_path: checkin });

    await insPage.goto('/profile/attendance');
    await sessionCard().getByRole('button', { name: 'Check out late' }).click();
    const dialog = insPage.getByRole('dialog');
    await expect(dialog.locator('.pfLateWarn')).toContainText('Late check-out');
    await insPage.locator('input[type=file]').setInputFiles(PROOF);
    await expect(insPage.getByText(/proof\.(jpg|webp) \(/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Check out late' }).click();
    await expectToast(insPage, 'Checked out');
    expect(await rowNow()).toMatchObject({ status: 'completed', checkout_late: true });

    // Today's card and the history say so.
    await expect(sessionCard()).toContainText('Late check-out');
    await expect(insPage.locator('.historyDiv').getByText('Late check-out').first()).toBeVisible();
});

test('staff correct a forgotten check-out from its tile; the late mark follows the times', async () => {
    await setRow({ ...NOT_IN, status: 'in_progress', start_time: '09:00', end_time: '10:00', checkin_at: `${today}T09:02:00+07:00` });

    await staffPage.goto(`/admin/attendance?class=${session.class_id}&day=${today}`);
    const modal = staffPage.locator('.sessionModal');
    await expect(modal).toContainText(session.className);
    await modal.getByRole('button', { name: /^Check-out: Not yet/ }).click();

    // The editor opens under the tiles: the session's end ready, "forgot to check out" picked.
    const editor = modal.locator('.ckEditor');
    await expect(editor).toContainText('Correct the check-out');
    const time = editor.getByLabel('Check-out', { exact: true });
    await expect(time).toHaveValue('10:00');
    await expect(editor.getByRole('radio', { name: 'Forgot to check out' })).toHaveAttribute('aria-checked', 'true');
    await time.fill('1025'); // typed the 24-hour way
    await expect(time).toHaveValue('10:25');
    // 25 minutes after the end: late, by the times.
    await expect(editor.getByRole('checkbox', { name: /Counts as a late check-out/ })).toBeChecked();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expectToast(staffPage, 'Check-in times corrected.');
    await expect(editor).toHaveCount(0);

    const row = await rowNow();
    expect(row).toMatchObject({ status: 'completed', checkout_late: true });
    expect(new Date(row.checkout_at).toISOString()).toBe(new Date(`${today}T10:25:00+07:00`).toISOString());
    await expect(modal.locator('.smCheck').filter({ hasText: 'Check-out' })).toContainText('10:25');
    await expect(modal.locator('.smLateLine')).toContainText('Late check-out');
    await expect(modal.locator('.smLateLine')).toContainText('More than 10 minutes after the end (10:00).');

    // Excused: kept back by the studio unmarks it.
    await modal.getByRole('button', { name: /^Check-out: 10:25/ }).click();
    await expect(editor.getByRole('radio', { name: 'Wrong time' })).toHaveAttribute('aria-checked', 'true');
    await editor.getByRole('radio', { name: 'Kept back by the studio' }).click();
    await expect(editor.getByRole('checkbox', { name: /Counts as a late check-out/ })).not.toBeChecked();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expectToast(staffPage, 'Check-in times corrected.');
    expect(await rowNow()).toMatchObject({ status: 'completed', checkout_late: false });
    await expect(modal.locator('.smLateLine')).toHaveCount(0);
    await staffPage.keyboard.press('Escape');
});

test('today’s board shows a late check-out', async () => {
    await setRow({ checkout_late: true });
    await staffPage.goto('/admin/attendance');
    const row = staffPage.locator('.atTodayRow').filter({ hasText: session.className });
    await expect(row.locator('.ckLateTag')).toHaveText('Late check-out');
});

test('the activity log has each correction, with the reason and before → after', async () => {
    await adminPage.goto('/admin/activity?area=sessions&action=check_edited');
    const entries = adminPage.locator('.alogFeed .alogEntry');
    const first = entries.filter({ hasText: 'Forgot to check out' }).first();
    await expect(first).toContainText(`${staff.name} corrected ${me.name}’s check-in times for ${session.className}`);
    await first.click();
    const drawer = adminPage.getByRole('dialog');
    const changed = drawer.getByRole('table');
    await expect(changed.getByRole('row', { name: /Late check-out/ })).toContainText('No');
    await expect(changed.getByRole('row', { name: /Late check-out/ })).toContainText('Yes');
    await expect(changed.getByRole('row', { name: /Check-out/ }).first()).toContainText('10:25');
    await expect(changed.getByRole('row', { name: /Status/ })).toContainText('In progress');
    await expect(changed.getByRole('row', { name: /Status/ })).toContainText('Completed');
    await drawer.getByRole('button', { name: 'Close' }).click();
    // The excuse is in the log too, on its own line (a correction is never folded into a run).
    await expect(entries.filter({ hasText: 'Kept back by the studio' }).first()).toContainText(`${staff.name} corrected ${me.name}’s check-in times`);
});
