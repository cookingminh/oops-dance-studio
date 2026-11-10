import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, expectToast, isoWeekday, login, people, pickOption, rest, rooms, rpc, staffJwt, studioToday } from './support.js';

// Routines by number of sessions and make-up sessions (Classes → Routines). A test class of its own
// (one weekly session, tomorrow's weekday, one student) gets a 4-session routine starting today, then
// a make-up session today: it gets a roll call, starts the routine and pulls its last session (the
// shoot day) a week earlier. Everything the spec made is removed afterwards.

test.describe.configure({ mode: 'serial' });

const CLASS_NAME = 'E2E Routine Class';
const TITLE = 'Ditto — NewJeans';
const NOTE = 'E2E make-up';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let page;
let staff;
let today;
let cls; // { id, room_id }
let student;
let neighbour; // another class in the same room meeting today: { name, start, end }
let makeUp; // { start, end } a free hour in the room today

const short = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
// The routines panel on the class page (/admin/classes/<id>?tab=routines).
const panel = () => page.locator('.rtPanel');
const makeUpDialog = () => page.getByRole('dialog').filter({ hasText: 'A one-off session' });
const progress = async () => (await rpc(staff, 'lesson_progress', { p_class_ids: [cls.id] })).data;

// Cleanups RLS forbids (e.g. an invoice left behind) need the local service role, read from the
// Supabase CLI like e2e/tuition-student.spec.js does.
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

// Removes the test class and everything hanging off it (sessions, roll calls, routines, members,
// invoices), whatever state an earlier run left it in.
async function removeTestClasses() {
    const found = (await rest(staff, `classes?select=id&name=eq.${encodeURIComponent(CLASS_NAME)}`)).data;
    for (const { id } of found) {
        for (const table of ['student_attendance', 'instructor_attendance', 'class_lessons', 'class_students', 'class_schedules']) {
            const res = await rest(staff, `${table}?class_id=eq.${id}`, { method: 'DELETE' });
            expect(res.status, `${table}: ${JSON.stringify(res.data)}`).toBe(204);
        }
        const gone = await rest(staff, `classes?id=eq.${id}`, { method: 'DELETE', prefer: 'return=representation' });
        expect(gone.status, JSON.stringify(gone.data)).toBe(200);
        // Unpaid invoices go with the class; anything else needs the service role.
        const left = (await rest(staff, `tuition_invoices?select=id&class_id=eq.${id}`)).data;
        if (left.length) {
            const key = serviceKey();
            expect(key, 'service role key to remove leftover invoices').toBeTruthy();
            await rest(key, `tuition_invoices?class_id=eq.${id}`, { method: 'DELETE' });
        }
        expect((await rest(staff, `tuition_invoices?select=id&class_id=eq.${id}`)).data).toEqual([]);
    }
}

// Busy stretches of a room on a day (bookings, classes meeting that day, make-ups) → first free hour.
async function freeHour(roomId, date) {
    const weekday = isoWeekday(date);
    const bookings = (await rest(staff, `bookings?select=start_time,end_time&room_id=eq.${roomId}&date=eq.${date}&status=in.(pending,approved)`)).data;
    const classes = (await rest(staff, `classes?select=id,starts_on,ended_on,schedules:class_schedules(day_of_week,start_time,end_time)&room_id=eq.${roomId}`)).data;
    const extras = (await rest(staff, `instructor_attendance?select=start_time,end_time&room_id=eq.${roomId}&date=eq.${date}&is_extra=eq.true&status=neq.cancelled`)).data;
    const busy = [
        ...bookings,
        ...extras,
        ...classes.filter((c) => c.id !== cls.id && c.starts_on <= date && (!c.ended_on || c.ended_on >= date))
            .flatMap((c) => c.schedules.filter((s) => s.day_of_week === weekday)),
    ].map((slot) => [toMinutes(slot.start_time), toMinutes(slot.end_time)]);
    for (let start = 8 * 60; start + 60 <= 22 * 60; start += 30) {
        if (!busy.some(([from, to]) => from < start + 60 && to > start)) return { start: toClock(start), end: toClock(start + 60) };
    }
    return null;
}

test.beforeAll(async ({ browser }) => {
    staff = await staffJwt();
    today = await studioToday();
    await removeTestClasses();

    // A class meeting today in a room, to show what a make-up clashes with.
    const weekday = isoWeekday(today);
    const cancelledToday = new Set((await rest(staff, `instructor_attendance?select=class_id&date=eq.${today}&status=eq.cancelled`)).data.map((row) => row.class_id));
    const classes = (await rest(staff, 'classes?select=id,name,room_id,starts_on,ended_on,schedules:class_schedules(day_of_week,start_time,end_time)&room_id=not.is.null&order=id')).data;
    const busy = classes.find((c) => c.starts_on <= today && (!c.ended_on || c.ended_on >= today) && !cancelledToday.has(c.id)
        && c.schedules.some((s) => s.day_of_week === weekday && /:(00|30):00$/.test(s.start_time) && /:(00|30):00$/.test(s.end_time)));
    const slot = busy?.schedules.find((s) => s.day_of_week === weekday);
    neighbour = busy ? { name: busy.name, start: slot.start_time.slice(0, 5), end: slot.end_time.slice(0, 5) } : null;
    const roomId = busy?.room_id ?? (await rooms())[0].id;

    // The test class: one weekly session on tomorrow's weekday, wherever the room is free.
    const instructor = (await people('instructor'))[0];
    const created = await rest(staff, 'classes?select=id,room_id', {
        method: 'POST',
        prefer: 'return=representation',
        body: { name: CLASS_NAME, instructor_id: instructor.id, room_id: roomId, price: 500000 },
    });
    expect(created.status, JSON.stringify(created.data)).toBe(201);
    cls = created.data[0];
    const tomorrow = isoWeekday(addDays(today, 1));
    let scheduled = false;
    for (let start = 8 * 60; start + 60 <= 22 * 60 && !scheduled; start += 60) {
        const res = await rest(staff, 'class_schedules', {
            method: 'POST',
            body: { class_id: cls.id, day_of_week: tomorrow, start_time: toClock(start), end_time: toClock(start + 60) },
        });
        scheduled = res.status === 201;
    }
    expect(scheduled, 'a free weekly hour for the test class').toBe(true);

    // One student, so the make-up session gets a roll call.
    student = (await people('guest')).at(-1);
    const enrolled = await rest(staff, 'class_students', { method: 'POST', body: { class_id: cls.id, student_id: student.id } });
    expect(enrolled.status, JSON.stringify(enrolled.data)).toBe(201);

    makeUp = await freeHour(cls.room_id, today);
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
});

test.afterAll(async () => {
    await page?.close();
    await removeTestClasses();
});

// Weekly sessions of the test class from today: tomorrow, then every 7 days.
const weekly = (n) => addDays(today, 1 + 7 * (n - 1));

test('plans a 4-session routine with a live preview of its shoot day', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    // A class without a routine opens the Routines tab with the planning form ready.
    await page.goto(`/admin/classes/${cls.id}?tab=routines`);
    await expect(panel().getByRole('heading', { name: 'Plan the next routine' })).toBeVisible();

    const dialog = panel();
    await dialog.getByLabel('Routine', { exact: true }).fill(TITLE);
    await dialog.getByLabel('Sessions', { exact: true }).fill('4');
    await dialog.getByLabel('Starts on', { exact: true }).fill(today);
    // First session tomorrow, the 4th three weeks later.
    await expect(dialog.locator('.rtPreviewDates')).toContainText(short(weekly(1)));
    await expect(dialog.locator('.rtPreviewDates')).toContainText(short(weekly(4)));
    await expect(dialog.getByLabel('Course fee', { exact: true })).toHaveValue('500.000');
    await dialog.getByRole('button', { name: 'Plan routine' }).click();
    await expectToast(page, 'is planned');

    const lessons = (await rest(staff, `class_lessons?select=title,starts_on,session_count,price&class_id=eq.${cls.id}`)).data;
    expect(lessons).toEqual([{ title: TITLE, starts_on: today, session_count: 4, price: null }]);
    const [row] = await progress();
    expect(row).toMatchObject({ title: TITLE, status: 'planned', sessions_held: 0, next_session: weekly(1), ends_on: weekly(4) });
    expect((await rest(staff, `classes?select=lesson&id=eq.${cls.id}`)).data).toEqual([{ lesson: TITLE }]);
});

test('the panel shows the routine’s progress and shoot day', async () => {
    const hero = panel().locator('.rtHero');
    await expect(hero).toContainText('Ditto');
    await expect(hero).toContainText(`Up next · starts ${short(weekly(1))}`);
    await expect(hero.getByRole('progressbar', { name: '0 of 4 sessions held' })).toBeVisible();
    await expect(hero.locator('.rtFacts .isShoot')).toContainText(short(weekly(4)));
    // A course with nothing running opens its renewal at once: the student is billed for it.
    await expect(hero.locator('.rtRenewal')).toContainText('Renewal open');
    await expect(hero.locator('.rtRenewal')).toContainText('1 waiting');
    const invoices = (await rest(staff, `tuition_invoices?select=student_id,status,lesson_title&class_id=eq.${cls.id}`)).data;
    expect(invoices).toEqual([{ student_id: student.id, status: 'unpaid', lesson_title: TITLE }]);
});

test('a make-up session in a busy room says what it clashes with', async () => {
    test.skip(!neighbour, 'no class with a room meets today');
    await panel().getByRole('button', { name: 'Add a make-up session' }).first().click();
    const dialog = makeUpDialog();
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue(today);
    await pickOption(page, dialog, 'From', neighbour.start);
    await pickOption(page, dialog, 'To', neighbour.end);
    await dialog.getByRole('button', { name: 'Add session' }).click();
    await expect(dialog.getByRole('alert')).toContainText(neighbour.name);
    expect((await rest(staff, `instructor_attendance?select=id&class_id=eq.${cls.id}`)).data).toEqual([]);
});

test('adds a make-up session today: a roll call, and the shoot day moves a week earlier', async () => {
    expect(makeUp, 'a free hour in the room today').toBeTruthy();
    if (!(await makeUpDialog().isVisible())) await panel().getByRole('button', { name: 'Add a make-up session' }).first().click();
    const dialog = makeUpDialog();
    await dialog.getByLabel('Date', { exact: true }).fill(today);
    await pickOption(page, dialog, 'From', makeUp.start);
    await pickOption(page, dialog, 'To', makeUp.end);
    await dialog.getByLabel('Note (optional)').fill(NOTE);
    await dialog.getByRole('button', { name: 'Add session' }).click();
    await expectToast(page, 'Make-up session added');

    const sessions = (await rest(staff, `instructor_attendance?select=date,status,is_extra,start_time,end_time,details&class_id=eq.${cls.id}`)).data;
    expect(sessions).toEqual([{ date: today, status: 'pending', is_extra: true, start_time: `${makeUp.start}:00`, end_time: `${makeUp.end}:00`, details: NOTE }]);
    const rollCall = (await rest(staff, `student_attendance?select=student_id,date,status&class_id=eq.${cls.id}`)).data;
    expect(rollCall).toEqual([{ student_id: student.id, date: today, status: 'pending' }]);

    // Today now counts as the first session: the 4th is the 3rd weekly one.
    const [row] = await progress();
    expect(row).toMatchObject({ status: 'current', next_session: today, ends_on: weekly(3) });
    const hero = panel().locator('.rtHero');
    await expect(hero).toContainText('Now learning');
    await expect(hero.locator('.rtFacts .isShoot')).toContainText(short(weekly(3)));
    await expect(hero.locator('.rtMakeUps')).toContainText(`${makeUp.start}–${makeUp.end}`);
    await expect(hero.locator('.rtMakeUps')).toContainText('Make-up');
});

test('the make-up shows with its own time and tag on the attendance page', async () => {
    await page.goto('/admin/attendance');
    const row = page.locator('.atTodayRow').filter({ hasText: CLASS_NAME });
    await expect(row.locator('.atTime strong')).toHaveText(makeUp.start);
    await expect(row.locator('.atTime small')).toHaveText(makeUp.end);
    await expect(row.getByText('Make-up')).toBeVisible();
});
