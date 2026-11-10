// Class switch, between courses (supabase/migrations/20261116000400_switch_after_course.sql): staff
// move a student who paid their running course to another class from the Tuition page. Checks the
// preview (they finish the course they paid — no refund — and join the new class from its next
// course, billed in full), then through REST that the old place gets leaves_after = that course's
// last session, the new place joins from the new course's start, and the new course's invoice has
// switched_from; then that the staff and the student tuition pages show it. Everything is put back
// exactly with the local service role (invoices, transfers, both places with joined_at and
// leaves_after). Never touches guest@ (tuition-student spec) or a student already switching.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectToast, login, rest, rpc, staffJwt, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// What to put back, written before the switch so an interrupted run is undone by the next one.
const SNAPSHOT = path.join(os.tmpdir(), 'oops-e2e-class-switch.json');
const INVOICE = 'id,student_id,class_id,lesson_id,lesson_title,student_name,class_name,month,amount,paid_amount,sessions,status,renewal,method,payment_code,due_date,paid_at,void_reason,switched_from,note,updated_by';
// The fields a switch can change on the old class's invoices.
const RESTORED = ['amount', 'paid_amount', 'status', 'renewal', 'method', 'due_date', 'paid_at', 'void_reason', 'switched_from', 'note', 'updated_by'];
const NOTE = `E2E switch ${Date.now()}`;

const vnd = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const shortDate = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));

// Local service role (restores what RLS doesn't let staff write), like tuition-student.spec.js.
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

test.skip(!serviceKey(), 'needs the local service role key (supabase status) to restore the data');

const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);

let page;
let staff;
// { student, from, to, keep (old running course + its end), target (new course), place (old enrolment),
//   invoices (old class, as found), transfers, existingTo (their invoices in the new class before) }
let plan;

const invoicesOf = async (jwt, studentId, classId) => (await rest(jwt, `tuition_invoices?select=${INVOICE}&student_id=eq.${studentId}&class_id=eq.${classId}&order=id`)).data;
const placesOf = async (jwt, studentId, classIds) =>
    (await rest(jwt, `class_students?select=class_id,joined_at,leaves_after&student_id=eq.${studentId}&class_id=in.(${classIds.join(',')})&order=class_id`)).data;

// Puts everything back as the snapshot says: transfers, the new class's invoices and place, the old
// place (joined_at, leaves_after) and the old invoices, field by field.
async function restore(snapshot) {
    const key = serviceKey();
    const { student, from, to, invoices, transfers, place, existingTo } = snapshot;
    for (const transfer of transfers) {
        ok(await rest(key, `bank_transfers?id=eq.${transfer.id}`, { method: 'PATCH', body: { invoice_id: transfer.invoice_id, status: transfer.status, note: transfer.note } }), 'transfer back');
    }
    const keep = existingTo.length ? `&id=not.in.(${existingTo.join(',')})` : '';
    ok(await rest(key, `tuition_invoices?student_id=eq.${student.id}&class_id=eq.${to.id}${keep}`, { method: 'DELETE' }), 'delete new invoices');
    ok(await rest(key, `class_students?class_id=eq.${to.id}&student_id=eq.${student.id}`, { method: 'DELETE' }), 'leave the new class');
    const back = await rest(key, 'class_students?on_conflict=class_id,student_id', {
        method: 'POST',
        body: { class_id: from.id, student_id: student.id, joined_at: place.joined_at, leaves_after: place.leaves_after },
        prefer: 'resolution=merge-duplicates',
    });
    ok(back, 'old place back');
    for (const invoice of invoices) {
        const body = Object.fromEntries(RESTORED.map((field) => [field, invoice[field]]));
        ok(await rest(key, `tuition_invoices?id=eq.${invoice.id}`, { method: 'PATCH', body }), 'old invoice back');
    }
}

test.beforeAll(async ({ browser }) => {
    const key = serviceKey();
    staff = await staffJwt();

    // An interrupted earlier run left its snapshot: undo it first.
    if (fs.existsSync(SNAPSHOT)) {
        await restore(JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')));
        fs.rmSync(SNAPSHOT);
    }

    const today = await studioToday();
    const classes = (await rest(staff, `classes?select=id,name,price,ended_on,lessons:class_lessons(id,title,starts_on,session_count,price)&or=(ended_on.is.null,ended_on.gte.${today})&order=id`)).data
        .filter((cls) => !/^E2E/i.test(cls.name));
    const progress = (await rpc(staff, 'lesson_progress', { p_class_ids: classes.map((cls) => cls.id) })).data;
    const running = (cls) => progress.filter((row) => row.class_id === cls.id && row.status === 'current').sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
    // The course a switch joins: the first one starting today or later (like the server).
    const upcoming = (cls) => [...cls.lessons].filter((lesson) => lesson.starts_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
    const places = (await rest(staff, 'class_students?select=class_id,student_id,joined_at,leaves_after,student:profiles!student_id(email,full_name)')).data;
    const switching = new Set(places.filter((row) => row.leaves_after).map((row) => row.student_id));

    // A demo student who paid the course running in their class (no next course billed there), and a
    // class they aren't in whose next course starts after today (so they join from a later day).
    for (const place of places) {
        const email = place.student?.email ?? '';
        if (!/^guest\d+@demo\.oopsdance\.test$/.test(email) || switching.has(place.student_id) || place.joined_at > today) continue;
        const from = classes.find((cls) => cls.id === place.class_id);
        const keep = from && running(from);
        if (!keep || !keep.ends_on) continue;
        const mine = await invoicesOf(staff, place.student_id, from.id);
        const paid = mine.find((row) => row.lesson_id === keep.lesson_id && row.status === 'paid');
        const later = mine.filter((row) => row.status !== 'void' && from.lessons.some((lesson) => lesson.id === row.lesson_id && lesson.starts_on > keep.ends_on));
        if (!paid || later.length) continue;
        const theirs = new Set(places.filter((row) => row.student_id === place.student_id).map((row) => row.class_id));
        const to = classes.find((cls) => !theirs.has(cls.id) && upcoming(cls)?.starts_on > today);
        if (!to) continue;
        const existing = await invoicesOf(staff, place.student_id, to.id);
        plan = {
            student: { id: place.student_id, name: place.student.full_name, email },
            from: { id: from.id, name: from.name },
            to: { id: to.id, name: to.name, price: Number(to.price) },
            keep: { lessonId: keep.lesson_id, title: keep.title, endsOn: keep.ends_on, invoice: paid },
            target: upcoming(to),
            place: { joined_at: place.joined_at, leaves_after: place.leaves_after },
            existingTo: existing.map((row) => row.id),
        };
        break;
    }
    expect(plan, 'a student who paid their running course, and a class with a course starting later').toBeTruthy();

    // Snapshot with the service role (every field, including updated_by).
    plan.invoices = await invoicesOf(key, plan.student.id, plan.from.id);
    const ids = plan.invoices.map((invoice) => invoice.id);
    plan.transfers = (await rest(key, `bank_transfers?select=id,invoice_id,status,note&invoice_id=in.(${ids.join(',') || 0})`)).data;
    plan.fee = Number(plan.target.price ?? plan.to.price);
    fs.writeFileSync(SNAPSHOT, JSON.stringify(plan));

    page = await browser.newPage();
    // The QR image comes from img.vietqr.io: answer it locally, the test checks its URL.
    await page.route('**/img.vietqr.io/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }),
    );
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    // Closing can fail (e.g. its trace file is gone); the data must be put back regardless.
    await page?.close().catch(() => {});
    if (!plan?.invoices) return;
    await restore(plan);
    fs.rmSync(SNAPSHOT, { force: true });

    const key = serviceKey();
    const pick = (row) => Object.fromEntries(['id', ...RESTORED].map((field) => [field, row[field]]));
    expect((await invoicesOf(key, plan.student.id, plan.from.id)).map(pick)).toEqual(plan.invoices.map(pick));
    expect((await invoicesOf(key, plan.student.id, plan.to.id)).map((row) => row.id)).toEqual(plan.existingTo);
    const transfers = (await rest(key, `bank_transfers?select=id,invoice_id,status,note&id=in.(${plan.transfers.map((t) => t.id).join(',') || 0})&order=id`)).data;
    expect(transfers).toEqual([...plan.transfers].sort((a, b) => a.id - b.id));
    expect(await placesOf(key, plan.student.id, [plan.from.id, plan.to.id])).toEqual([{ class_id: plan.from.id, ...plan.place }]);
});

test('the Tuition page previews the switch: finish the paid course, join the next one', async () => {
    const { student, from, to, keep, target, fee } = plan;

    await page.goto(`/admin/tuition?q=${encodeURIComponent(student.name)}`);
    const row = page.locator(`.tuRow[data-code="${keep.invoice.payment_code}"]`);
    await row.getByRole('button', { name: /^More for/ }).click();
    await page.getByRole('menuitem', { name: 'Switch class' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Now in ${from.name}`);
    await expect(dialog).toContainText('Join another class');
    // Every class they aren't in is offered; their own classes aren't.
    await expect(dialog.getByRole('radio', { name: from.name, exact: true })).toHaveCount(0);
    const card = dialog.locator('label.swCard').filter({ has: page.getByRole('radio', { name: to.name, exact: true }) });
    await expect(card).toContainText(`Joins from ${target.title} · ${shortDate(target.starts_on)}`);
    await card.click();

    // "then joins" when the new course starts after the last one; "and joins" when they overlap.
    const then = target.starts_on > keep.endsOn ? '), then joins' : ') and joins';
    await expect(dialog.locator('.swSummary')).toHaveText(
        `${student.name} finishes ${keep.title} in ${from.name} (last session ${shortDate(keep.endsOn)}${then} ${to.name} from ${target.title} (starts ${shortDate(target.starts_on)} · ${vnd(fee)}).`,
    );
    await expect(dialog.locator('.swEnd.isFrom')).toContainText(`Last session ${shortDate(keep.endsOn)}`);
    await expect(dialog.locator('.swEnd.isTo .swResult')).toHaveText(`${vnd(fee)} to pay`);
    // No refund: the course they paid stays with the old class.
    await expect(dialog.locator('.swLines')).toContainText(`${keep.title} is paid (${vnd(keep.invoice.paid_amount)}): it stays with ${from.name}, no refund.`);
    await expect(dialog.locator('.swLines')).toContainText(`${target.title} costs ${vnd(fee)}, to pay by its session`);
    await expect(dialog).toContainText('Not counted as leaving');

    await dialog.getByLabel('Note (optional)').fill(NOTE);
    await dialog.getByRole('button', { name: `Switch to ${to.name}` }).click();
    await expectToast(page, `${student.name} joins ${to.name} from ${target.title}: ${vnd(fee)} to pay.`);
    await expect(dialog).toBeHidden();
});

test('the database: leaves after the paid course, joins from the next one, billed in full', async () => {
    const { student, from, to, keep, target, fee, invoices } = plan;
    const today = await studioToday();

    // The old class: still a member until the last session of the course they paid; nothing refunded.
    const places = await placesOf(staff, student.id, [from.id, to.id]);
    expect(places).toEqual(
        [
            { class_id: from.id, joined_at: plan.place.joined_at, leaves_after: keep.endsOn },
            { class_id: to.id, joined_at: target.starts_on > today ? target.starts_on : today, leaves_after: null },
        ].sort((a, b) => a.class_id - b.class_id),
    );
    const kept = (await rest(staff, `tuition_invoices?select=${INVOICE}&id=eq.${keep.invoice.id}`)).data[0];
    expect(kept).toMatchObject({ status: 'paid', paid_amount: Number(keep.invoice.paid_amount), void_reason: null });
    expect((await invoicesOf(staff, student.id, from.id)).map((row) => row.status)).toEqual(invoices.map((row) => row.status));

    // The new class: its next course, in full, already a yes; linked to the course they finish.
    const created = (await invoicesOf(staff, student.id, to.id)).filter((row) => !plan.existingTo.includes(row.id));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
        lesson_id: target.id,
        amount: fee,
        paid_amount: 0,
        sessions: target.session_count,
        status: 'unpaid',
        renewal: 'continue',
        switched_from: keep.invoice.id,
        note: `Switched from ${from.name}. ${NOTE}`,
    });
    plan.fresh = created[0];
});

test('the staff tuition page shows the planned leave and the new course', async () => {
    const { student, from, keep, fresh } = plan;
    await page.goto(`/admin/tuition?q=${encodeURIComponent(student.name)}`);
    const oldRow = page.locator(`.tuRow[data-code="${keep.invoice.payment_code}"]`);
    await expect(oldRow.locator('.tuPlaceTag')).toHaveText(`Leaves after ${shortDate(keep.endsOn)}`);
    // Already switching: no second switch from this row.
    await oldRow.getByRole('button', { name: /^More for/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Switch class' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.locator('.tuViews').getByRole('button', { name: 'Next courses' }).click();
    const newRow = page.locator(`.tuRow[data-code="${fresh.payment_code}"]`);
    await expect(newRow.locator('.tuFromTag')).toHaveText(`from ${from.name}`);
    await expect(newRow).toContainText(NOTE);
    if (plan.target.starts_on > (await studioToday())) await expect(newRow.locator('.tuPlaceTag')).toHaveText(`Joins ${shortDate(plan.target.starts_on)}`);
});

test('the student sees the last session, the move and the new course to pay', async ({ browser }) => {
    const { student, from, to, keep, fresh, target } = plan;
    const me = await token(student.email);
    expect(me.jwt, 'the student can sign in').toBeTruthy();

    const studentPage = await browser.newPage();
    await studentPage.route('**/img.vietqr.io/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }),
    );
    try {
        await login(studentPage, student.email);
        await studentPage.goto('/profile/tuition');
        const current = studentPage.locator('.tuNowCard .tuRow', { hasText: keep.title });
        await expect(current).toContainText(from.name);
        await expect(current).toContainText(`Your last session here is ${shortDate(keep.endsOn)}, then you move to ${to.name}.`);

        const next = studentPage.locator('.tuRenewCard .tuRenew', { hasText: target.title });
        await expect(next).toContainText('Continuing');
        await expect(next).toContainText(`Switched from ${from.name}`);
        await next.getByRole('button', { name: `Pay now ${to.name}` }).click();
        const dialog = studentPage.getByRole('dialog');
        const src = await dialog.locator('.tuQrFrame img').getAttribute('src');
        expect(src).toContain(fresh.payment_code);
        expect(src).toContain(`amount=${Number(fresh.amount)}`);
    } finally {
        await studentPage.close().catch(() => {});
    }
});
