// The class hub (/admin/classes): the directory's views (classes picked from the database, plus an ended
// test class it adds), opening a past class, and a whole class's life on a test class made with the "New
// class" wizard — add a student, a make-up session today, its roll call, the delete guard, ending and
// reopening, removing the student. The test classes and everything they created (enrolment, invoices,
// sessions, roll calls, routine) are removed with the local service role, and the student's other records
// are checked to be exactly as before.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEEKDAYS, addDays, expectToast, isoWeekday, login, pickOption, rest, staffJwt, studioToday } from './support.js';

test.describe.configure({ mode: 'serial' });

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HUB = '/admin/classes';
const PREFIX = 'E2E Hub';
const NAME = `${PREFIX} ${Date.now()}`;
const PAST = `${PREFIX} Past ${Date.now()}`; // an ended class the spec adds for the Past view
const TEACHER_EMAIL = 'instructor@demo.oopsdance.test';
const STUDENT_EMAIL = 'guest08@demo.oopsdance.test';
// Every table a class's life writes to, child tables first (the class itself last).
const CLASS_TABLES = ['student_attendance', 'instructor_attendance', 'tuition_invoices', 'class_students', 'class_schedules', 'class_lessons'];

// Local service role (cleans what RLS or the delete guard won't let staff remove), like tuition-student.spec.js.
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

test.skip(!serviceKey(), 'needs the local service role key (supabase status) to remove the test class');

const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);

let page;
let staff;
let today;
let student; // { id, full_name }
let before; // the student's own rows before the run
let classId;
let teacher; // { id, full_name } who teaches the wizard's class
let running; // two running classes: [{ id, name }]
let upcoming; // a class opening later, or undefined

// Lower case without accents, as the directory's search compares.
const fold = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

// Everything of the student outside test classes: it must be untouched at the end.
async function studentRows(key, studentId) {
    const testIds = (await rest(key, `classes?select=id&name=like.${encodeURIComponent(`${PREFIX}*`)}`)).data.map((row) => row.id);
    const skip = testIds.length ? `&class_id=not.in.(${testIds.join(',')})` : '';
    const [enrolments, invoices, roll] = await Promise.all([
        rest(key, `class_students?select=*&student_id=eq.${studentId}${skip}&order=class_id`),
        rest(key, `tuition_invoices?select=*&student_id=eq.${studentId}${skip}&order=id`),
        rest(key, `student_attendance?select=*&student_id=eq.${studentId}${skip}&order=id`),
    ]);
    return { enrolments: enrolments.data, invoices: invoices.data, roll: roll.data };
}

// Removes every test class (this run's and leftovers of an interrupted one) with all it created.
async function purgeTestClasses() {
    const key = serviceKey();
    const ids = (await rest(key, `classes?select=id&name=like.${encodeURIComponent(`${PREFIX}*`)}`)).data.map((row) => row.id);
    if (!ids.length) return;
    const list = ids.join(',');
    for (const table of CLASS_TABLES) ok(await rest(key, `${table}?class_id=in.(${list})`, { method: 'DELETE' }), `delete ${table}`);
    ok(await rest(key, `class_pay_rates?class_id=in.(${list})`, { method: 'DELETE' }), 'delete pay rates');
    ok(await rest(key, `classes?id=in.(${list})`, { method: 'DELETE' }), 'delete classes');
}

test.beforeAll(async ({ browser }) => {
    staff = await staffJwt();
    today = await studioToday();
    await purgeTestClasses();
    student = (await rest(staff, `profiles?select=id,full_name&email=eq.${STUDENT_EMAIL}`)).data[0];
    expect(student, `${STUDENT_EMAIL} exists (seed)`).toBeTruthy();
    before = await studentRows(serviceKey(), student.id);
    teacher = (await rest(staff, `profiles?select=id,full_name&email=eq.${TEACHER_EMAIL}`)).data[0];
    running = (await rest(staff, `classes?select=id,name&starts_on=lte.${today}&ended_on=is.null&order=name`)).data;
    expect(running.length, 'two running classes').toBeGreaterThanOrEqual(2);
    upcoming = (await rest(staff, `classes?select=id,name&starts_on=gt.${today}&ended_on=is.null&order=starts_on,name&limit=1`)).data[0];
    // An ended class (the demo has none): two months, over ten days ago.
    ok(await rest(serviceKey(), 'classes', {
        method: 'POST',
        body: { name: PAST, instructor_id: teacher.id, price: 500000, starts_on: addDays(today, -70), ended_on: addDays(today, -10), end_reason: 'E2E past class' },
    }), 'add the past class');

    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close().catch(() => {});
    if (!student) return;
    await purgeTestClasses();
    const key = serviceKey();
    expect((await rest(key, `classes?select=id&name=like.${encodeURIComponent(`${PREFIX}*`)}`)).data).toEqual([]);
    if (classId) {
        for (const table of CLASS_TABLES) expect((await rest(key, `${table}?select=class_id&class_id=eq.${classId}`)).data, table).toEqual([]);
    }
    expect(await studentRows(key, student.id)).toEqual(before);
});

test('the directory shows today, this month, upcoming, past and the timetable', async () => {
    await page.goto(`${HUB}?view=month`);
    const views = page.getByRole('group', { name: 'Show classes' });
    await expect(views.getByRole('button', { name: /^Today/ })).toBeVisible();
    await expect(page.getByRole('link', { name: running[0].name, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: PAST })).toHaveCount(0);

    await views.getByRole('button', { name: /^Upcoming/ }).click();
    await expect(page).toHaveURL(/view=upcoming/);
    if (upcoming) {
        const card = page.getByRole('link', { name: upcoming.name, exact: true });
        await expect(card).toBeVisible();
        await expect(card).toContainText('Opens');
    }

    await views.getByRole('button', { name: /^Past/ }).click();
    await expect(page.getByRole('link', { name: PAST })).toContainText('Sessions taught');

    await views.getByRole('button', { name: 'Timetable' }).click();
    await expect(page.getByRole('heading', { name: 'Weekly timetable' })).toBeVisible();

    await views.getByRole('button', { name: /^Today/ }).click();
    await expect(page.locator('.hubToday, .hubDirectory').first()).toBeVisible();

    // Search narrows the cards (typed without accents).
    const [found, other] = [running[0], running.find((cls) => !fold(cls.name).includes(fold(running[0].name)))];
    await views.getByRole('button', { name: /^This month/ }).click();
    await page.getByRole('textbox', { name: 'Search classes' }).fill(fold(found.name));
    // exact: today's list (fading out) may also have "Take the roll call for …".
    await expect(page.getByRole('link', { name: found.name, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: other.name, exact: true })).toHaveCount(0);
});

test('opening a past class shows its page, read-only', async () => {
    await page.goto(`${HUB}?view=past`);
    await page.getByRole('link', { name: PAST }).click();
    await expect(page).toHaveURL(new RegExp(`${HUB}/\\d+$`));
    await expect(page.getByRole('heading', { name: new RegExp(PAST) })).toBeVisible();
    await expect(page.getByText('This class has ended')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add student' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Students' }).click();
    await expect(page).toHaveURL(/tab=students/);
    await expect(page.getByRole('heading', { name: 'Students who took this class' })).toBeVisible();
});

test('the New class wizard creates a class with a weekly session and its first routine', async () => {
    const tomorrow = WEEKDAYS[isoWeekday(addDays(today, 1)) - 1];
    await page.goto(HUB);
    await page.getByRole('button', { name: 'New class' }).click();
    const dialog = page.getByRole('dialog');

    // 1. Details (no room: a test class blocks nothing; it starts today by default).
    await dialog.getByLabel('Class Name').fill(NAME);
    await pickOption(page, dialog, 'Instructor', teacher.full_name);
    await dialog.getByLabel('Price per course').fill('500000');
    await dialog.getByRole('button', { name: 'Create class' }).click();
    await expectToast(page, `${NAME} created.`);

    // 2. A weekly session on another weekday than today (so a make-up fits today).
    await pickOption(page, dialog, 'Day of the Week', tomorrow);
    await pickOption(page, dialog, 'Start Time', '21:00');
    await pickOption(page, dialog, 'End Time', '22:00');
    await dialog.getByRole('button', { name: 'Add session' }).click();
    await expect(dialog.getByRole('list', { name: 'Weekly sessions' })).toContainText(`${tomorrow}21:00–22:00`);
    await dialog.getByRole('button', { name: 'Next' }).click();

    // 3. First routine, 4. image (skipped), 5. done → the class page to add students.
    await dialog.getByLabel('Routine').fill('E2E Routine — Hub');
    await dialog.getByLabel('Number of sessions').fill('4');
    await dialog.getByRole('button', { name: 'Save routine' }).click();
    await dialog.getByRole('button', { name: 'Skip for now' }).click();
    await expect(dialog.getByRole('heading', { name: `${NAME} is ready` })).toBeVisible();
    await dialog.getByRole('button', { name: 'Add students' }).click();

    await expect(page).toHaveURL(new RegExp(`${HUB}/\\d+\\?tab=students`));
    classId = Number(new URL(page.url()).pathname.split('/').pop());
    const created = (await rest(staff, `classes?select=id,name,price,room_id,starts_on,schedules:class_schedules(day_of_week,start_time),lessons:class_lessons(title,session_count)&id=eq.${classId}`)).data[0];
    expect(created).toMatchObject({ name: NAME, price: 500000, room_id: null, starts_on: today });
    expect(created.schedules).toEqual([{ day_of_week: isoWeekday(addDays(today, 1)), start_time: '21:00:00' }]);
    expect(created.lessons).toEqual([{ title: 'E2E Routine — Hub', session_count: 4 }]);
});

test('add a student, then the delete guard is open (no history yet)', async () => {
    // The wizard opened "Add a student" on the Students tab.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Add a student to ${NAME}`);
    await dialog.getByRole('combobox', { name: /Student/ }).fill(student.full_name);
    await page.getByRole('option', { name: new RegExp(student.full_name) }).click();
    await dialog.getByRole('button', { name: 'Add Student' }).click();
    await expectToast(page, 'Student added to the class.');
    await expect(page.locator('.hubStudent', { hasText: student.full_name })).toBeVisible();
    expect((await rest(staff, `class_students?select=student_id&class_id=eq.${classId}`)).data).toEqual([{ student_id: student.id }]);

    // A class without history may still be deleted (created by mistake).
    await page.getByRole('button', { name: `More for ${NAME}` }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete class' })).toBeVisible();
    await page.keyboard.press('Escape');
});

test('a make-up session today, and its roll call', async () => {
    await page.getByRole('tab', { name: 'Sessions & attendance' }).click();
    await expect(page).toHaveURL(/tab=sessions/);
    await page.getByRole('button', { name: 'Add a make-up session' }).first().click();
    const dialog = page.getByRole('dialog');
    // Picking a start keeps the usual length; the end is then set apart (re-picking the shown
    // value would clear it).
    await pickOption(page, dialog, 'From', '20:00');
    await pickOption(page, dialog, 'To', '21:30');
    await dialog.getByRole('button', { name: 'Add session' }).click();
    await expectToast(page, 'Make-up session added on');
    const made = (await rest(staff, `instructor_attendance?select=date,is_extra,start_time,status&class_id=eq.${classId}&date=eq.${today}`)).data;
    expect(made).toEqual([{ date: today, is_extra: true, start_time: '20:00:00', status: 'pending' }]);
    // The weekly session the wizard added (tomorrow) already has its session, when tomorrow is still this week.
    if (isoWeekday(today) < 7) {
        const weekly = (await rest(staff, `instructor_attendance?select=is_extra,status&class_id=eq.${classId}&date=eq.${addDays(today, 1)}`)).data;
        expect(weekly).toEqual([{ is_extra: false, status: 'pending' }]);
    }

    // The calendar shows it today with its tag; a click opens the session with its roll call.
    const item = page.locator('.sessionCalendar').getByRole('button', { name: /20:00–21:30.*Make-up/ });
    await expect(item).toHaveCount(1);
    await item.click();
    const session = page.getByRole('dialog');
    await expect(session).toContainText('Make-up');
    const row = session.locator('.smRosterRow', { hasText: student.full_name });
    await row.getByRole('button', { name: 'Mark attended' }).click();
    await expect(row.getByRole('button', { name: 'Mark attended' })).toHaveAttribute('aria-pressed', 'true');
    await expect(session).toContainText('1 of 1 marked');
    const roll = (await rest(staff, `student_attendance?select=date,status&class_id=eq.${classId}&student_id=eq.${student.id}`)).data;
    expect(roll).toEqual([{ date: today, status: 'attend' }]);
    await session.getByRole('button', { name: 'Close' }).last().click();
    await expect(session).toHaveCount(0);
});

test('the delete guard: a class with a marked roll call can only be ended', async () => {
    await page.getByRole('tab', { name: 'Setup' }).click();
    await expect(page.getByText('This class can’t be deleted')).toBeVisible();
    await expect(page.getByText(/It has history \(1 roll-call mark\)/)).toBeVisible();
    await page.getByRole('button', { name: `More for ${NAME}` }).click();
    await expect(page.getByRole('menuitem', { name: 'End class' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete class' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The database refuses it too.
    const refused = await rest(staff, `classes?id=eq.${classId}`, { method: 'DELETE' });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(refused.data)).toContain('IN_USE');
});

test('end the class today, then keep it running', async () => {
    const danger = page.locator('.hubDangerCard');
    await danger.getByRole('button', { name: 'Today' }).click();
    await danger.getByLabel('Reason').fill('E2E: ending test');
    await danger.getByRole('button', { name: 'End class' }).click();
    await expectToast(page, `${NAME} ends on`);
    await expect(page.locator('.hubTitle')).toContainText('Last day today');
    expect((await rest(staff, `classes?select=ended_on,end_reason&id=eq.${classId}`)).data[0]).toEqual({ ended_on: today, end_reason: 'E2E: ending test' });

    await danger.getByRole('button', { name: 'Keep it running' }).click();
    await expectToast(page, `${NAME} is running again.`);
    await expect(page.locator('.hubTitle')).toContainText('Running');
    expect((await rest(staff, `classes?select=ended_on,end_reason&id=eq.${classId}`)).data[0]).toEqual({ ended_on: null, end_reason: null });
});

test('remove the student from the class', async () => {
    await page.getByRole('tab', { name: 'Students' }).click();
    const row = page.locator('.hubStudent', { hasText: student.full_name });
    await row.getByRole('button', { name: `More for ${student.full_name}` }).click();
    await page.getByRole('menuitem', { name: 'Remove from class' }).click();
    await expectToast(page, `${student.full_name} left ${NAME}.`);
    await expect(row).toHaveCount(0);
    expect((await rest(staff, `class_students?select=student_id&class_id=eq.${classId}`)).data).toEqual([]);
});
