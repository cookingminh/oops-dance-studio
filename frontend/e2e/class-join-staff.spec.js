// Join requests, the staff side (supabase/migrations/20261117002500_class_join_requests.sql): guest02 asks to join
// three running classes they aren't in (through REST, one with a note); staff see the sidebar badge, the request with
// its note on /admin/join-requests, approve one "now" there (toast, Answered tab, a class_students row and a tuition
// invoice for the running course: the whole course unless the studio pro-rates late joins), decline another with a
// quick reason (guest02 reads it back) and approve the third from the class page's Students tab (the student shows up
// in the list). Everything the spec made is removed with the local service role:
// the places (their trigger voids the unpaid invoices and drops today's roll call), the invoices made since the
// start, the requests. Nothing else of guest02 is touched; other requests may be waiting meanwhile.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expectToast, login, rest, rpc, serviceKey, staffJwt, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const STUDENT_EMAIL = 'guest02@demo.oopsdance.test';
const NOTE = `E2E join-staff ${Date.now()}: I danced K-pop for a year and want to learn choreography.`;
const REASON = 'The class is full';
// What to remove, written before the requests are made so an interrupted run is cleaned by the next one.
const SNAPSHOT = path.join(os.tmpdir(), 'oops-e2e-class-join-staff.json');

const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);
const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

let staff;
let student; // { id, jwt, name }
let since; // ISO time just before the run: invoices and requests made after it are the spec's
let classes; // [A (approve on the page), B (decline), C (approve on the class page)]: { id, name, price }
let running; // class id → its running course (a lesson_progress row)
let prorates; // tuition_settings.prorate_late_join (off by default: someone new pays the whole course)
const requests = {}; // class id → request id

// The spec's places, invoices and requests of `snapshot` go (the student's other rows stay).
async function cleanUp(snapshot) {
    const key = await serviceKey();
    const ids = snapshot.classIds.join(',');
    const after = encodeURIComponent(snapshot.since);
    ok(await rest(key, `class_students?student_id=eq.${snapshot.studentId}&class_id=in.(${ids})`, { method: 'DELETE' }), 'places');
    ok(await rest(key, `tuition_invoices?student_id=eq.${snapshot.studentId}&class_id=in.(${ids})&created_at=gte.${after}`, { method: 'DELETE' }), 'invoices');
    ok(await rest(key, `class_join_requests?student_id=eq.${snapshot.studentId}&class_id=in.(${ids})&created_at=gte.${after}`, { method: 'DELETE' }), 'requests');
}

// The request's card on the page: the student's, for that class.
const cardOf = (page, cls) =>
    page
        .locator('li.jrCard')
        .filter({ hasText: student.name })
        .filter({ has: page.locator('.jrClassName', { hasText: exact(cls.name) }) });

test.beforeAll(async () => {
    const key = await serviceKey();
    test.skip(!key, 'needs the local service role key (supabase status) to clean up');
    if (fs.existsSync(SNAPSHOT)) {
        await cleanUp(JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')));
        fs.rmSync(SNAPSHOT);
    }

    staff = await staffJwt();
    const me = await token(STUDENT_EMAIL);
    const profile = (await rest(staff, `profiles?select=full_name,username&id=eq.${me.id}`)).data[0];
    student = { id: me.id, jwt: me.jwt, name: profile.full_name || profile.username };

    // Running classes (a course going on, so starting now bills it) that guest02 isn't in and hasn't asked to join.
    const today = await studioToday();
    const open = (await rest(staff, `classes?select=id,name,price&starts_on=lte.${today}&ended_on=is.null&order=id`)).data;
    const mine = new Set((await rest(staff, `class_students?select=class_id&student_id=eq.${student.id}`)).data.map((row) => row.class_id));
    const asked = new Set((await rest(staff, `class_join_requests?select=class_id&student_id=eq.${student.id}&status=eq.pending`)).data.map((row) => row.class_id));
    const progress = (await rpc(staff, 'lesson_progress', { p_class_ids: open.map((cls) => cls.id) })).data;
    running = new Map(progress.filter((row) => row.status === 'current').map((row) => [row.class_id, row]));
    classes = open.filter((cls) => !mine.has(cls.id) && !asked.has(cls.id) && running.has(cls.id)).slice(0, 3);
    expect(classes, 'three running classes guest02 is not in').toHaveLength(3);
    prorates = (await rest(staff, 'tuition_settings?select=prorate_late_join&id=eq.1')).data[0].prorate_late_join;

    since = new Date(Date.now() - 5_000).toISOString();
    fs.writeFileSync(SNAPSHOT, JSON.stringify({ studentId: student.id, classIds: classes.map((cls) => cls.id), since }));

    // guest02 asks: the first with a note, all to start now.
    for (const [index, cls] of classes.entries()) {
        const res = await rpc(student.jwt, 'class_join_request', { p_class_id: cls.id, p_start: 'now', p_note: index === 0 ? NOTE : null });
        ok(res, `ask to join ${cls.name}`);
        requests[cls.id] = res.data.id;
    }
});

test.afterAll(async () => {
    if (!classes?.length) return;
    await cleanUp({ studentId: student.id, classIds: classes.map((cls) => cls.id), since });
    fs.rmSync(SNAPSHOT, { force: true });
});

test('staff approve and decline requests on the Join requests page', async ({ page }) => {
    const [approved, declined] = classes;
    await login(page, 'staff@demo.oopsdance.test');

    await test.step('the sidebar shows how many are waiting', async () => {
        const badge = page.locator('.adminSidebar a[href="/admin/join-requests"] .navBadge');
        await expect(badge).toBeVisible();
        expect(Number(await badge.textContent())).toBeGreaterThanOrEqual(3);
    });

    await page.goto('/admin/join-requests');
    await test.step('the request is listed with its note', async () => {
        const card = cardOf(page, approved);
        await expect(card).toBeVisible();
        await expect(card.locator('.jrQuote')).toContainText(NOTE);
        await expect(card.locator('.jrStart')).toHaveText('From the running course');
    });

    await test.step('approve "now": the toast, then it is answered', async () => {
        await cardOf(page, approved).getByRole('button', { name: /^Approve / }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText(`Add ${student.name} to ${approved.name}`);
        await expect(dialog.getByRole('radio', { name: /From the running course/ }).or(dialog.locator('.hubHint')).first()).toBeVisible();
        // Joining after sessions were held: the dialog says what they pay (the whole course unless pro-rated).
        const course = running.get(approved.id);
        const left = course.session_count - course.sessions_held;
        if (course.sessions_held > 0 && left > 0) {
            await expect(dialog).toContainText(prorates ? `for the ${left} sessions left` : `the full course (${left} of ${course.session_count} sessions left)`);
        }
        await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
        await expectToast(page, `${student.name} is in ${approved.name}.`);
        await expect(cardOf(page, approved)).toHaveCount(0);

        await page.getByRole('button', { name: /^Answered/ }).click();
        const answered = cardOf(page, approved);
        await expect(answered).toBeVisible();
        await expect(answered.locator('.phaseBadge')).toHaveText('Approved');
    });

    await test.step('REST: guest02 is in the class and billed for it', async () => {
        const place = (await rest(staff, `class_students?select=class_id,joined_at&student_id=eq.${student.id}&class_id=eq.${approved.id}`)).data;
        expect(place).toHaveLength(1);
        const invoices = (await rest(staff, `tuition_invoices?select=id,status,lesson_id,amount,sessions,note&student_id=eq.${student.id}&class_id=eq.${approved.id}&created_at=gte.${encodeURIComponent(since)}`)).data;
        expect(invoices.length).toBeGreaterThanOrEqual(1);
        expect(invoices.every((invoice) => invoice.status === 'unpaid')).toBe(true);
        // The running course: in full (all its sessions, no "Joined after" note) unless the studio pro-rates.
        const course = running.get(approved.id);
        const lesson = (await rest(staff, `class_lessons?select=price&id=eq.${course.lesson_id}`)).data[0];
        const full = Number(lesson.price ?? approved.price);
        const invoice = invoices.find((row) => row.lesson_id === course.lesson_id);
        if (!prorates || course.sessions_held === 0) expect(invoice).toMatchObject({ amount: full, sessions: course.session_count, note: null });
        else expect(invoice.sessions).toBe(course.session_count - course.sessions_held);
        const request = (await rest(student.jwt, `class_join_requests?select=status,joined_at&id=eq.${requests[approved.id]}`)).data[0];
        expect(request.status).toBe('approved');
        expect(request.joined_at).toBe(place[0].joined_at);
    });

    await test.step('decline another with a quick reason', async () => {
        await page.getByRole('button', { name: /^Waiting/ }).click();
        await cardOf(page, declined).getByRole('button', { name: /^Decline / }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('The student will see this reason.');
        await dialog.getByRole('button', { name: REASON, exact: true }).click();
        await expect(dialog.getByRole('textbox')).toHaveValue(REASON);
        await expect(dialog).toContainText(`${REASON.length}/300`);
        await dialog.getByRole('button', { name: 'Decline', exact: true }).click();
        await expectToast(page, `${student.name} won’t join ${declined.name}.`);
        await expect(cardOf(page, declined)).toHaveCount(0);
    });

    await test.step('REST as guest02: declined, with that reason', async () => {
        const request = (await rest(student.jwt, `class_join_requests?select=status,decline_reason,decided_by&id=eq.${requests[declined.id]}`)).data[0];
        expect(request.status).toBe('declined');
        expect(request.decline_reason).toBe(REASON);
        const place = (await rest(staff, `class_students?select=class_id&student_id=eq.${student.id}&class_id=eq.${declined.id}`)).data;
        expect(place).toHaveLength(0);
    });
});

test('the class page shows who waits to join, and approving adds them to the list', async ({ page }) => {
    const hubClass = classes[2];
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/classes/${hubClass.id}?tab=students`);

    const block = page.locator('.jrHubBlock');
    await expect(block).toBeVisible();
    await expect(block.getByRole('heading', { name: /^Waiting to join \(\d+\)$/ })).toBeVisible();
    const row = block.locator('li.jrHubRow').filter({ hasText: student.name });
    await expect(row).toBeVisible();
    const list = page.getByRole('list', { name: 'Students', exact: true });
    await expect(list).not.toContainText(student.name);

    await row.getByRole('button', { name: /^Approve / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Add ${student.name} to ${hubClass.name}`);
    await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(page, `${student.name} is in ${hubClass.name}.`);

    await expect(list).toContainText(student.name);
    await expect(block.locator('li.jrHubRow').filter({ hasText: student.name })).toHaveCount(0);
    const request = (await rest(student.jwt, `class_join_requests?select=status&id=eq.${requests[hubClass.id]}`)).data[0];
    expect(request.status).toBe('approved');
});
