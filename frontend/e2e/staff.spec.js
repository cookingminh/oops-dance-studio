import { test, expect } from '@playwright/test';
import {
    PROOF, addDays, deleteBookingsOn, dropSessionToday, ensureProofToday, expectToast, freeDate, isoWeekday, login, pathname, people, pickOption,
    rest, rooms, rpc, staffJwt, studioToday, token,
} from './support.js';

test.describe.configure({ mode: 'serial' });

const CLASS_NAME = 'E2E Test Class';
let page;
let dialog;
let roomA;
let roomB;
let guests;
let instructors;
let bookingDate;
let today;
let proofSession; // a session added today for the check-in proof, if none had one

const lastName = (person) => person.full_name.split(' ').slice(-2).join(' ');

test.beforeAll(async ({ browser }) => {
    [roomA, roomB] = await rooms();
    guests = await people('guest');
    instructors = await people('instructor');
    today = await studioToday();
    // Room B from 20:30 to 22:00 must be free of classes that weekday (the booking tests use it);
    // seeded classes can meet in the evening, so move on a day until it is.
    const roomBSlots = (await rest(await staffJwt(), 'class_schedules?select=day_of_week,start_time,end_time,class:classes!class_id(room_id)')).data
        .filter((slot) => slot.class?.room_id === roomB.id);
    let offset = 23;
    while (roomBSlots.some((slot) => slot.day_of_week === isoWeekday(addDays(today, offset)) && slot.start_time < '22:00' && slot.end_time > '20:30')) offset += 1;
    bookingDate = await freeDate(offset);
    await deleteBookingsOn(bookingDate);
    await rest(await staffJwt(), `classes?name=eq.${encodeURIComponent(CLASS_NAME)}`, { method: 'DELETE' });
    proofSession = await ensureProofToday();
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    dialog = page.getByRole('dialog');
});
test.afterAll(async () => {
    await page.close();
    await dropSessionToday(proofSession);
});

test('staff lands on /admin', async () => {
    await login(page, 'staff@demo.oopsdance.test');
    expect(pathname(page)).toBe('/admin');
});

test('dashboard shows dashboard_stats', async () => {
    const stats = page.locator('.studioStats');
    await expect(page.getByText('Studio Stats')).toBeVisible();
    await expect(stats).not.toContainText('…');
    await expect(stats).not.toContainText('—');
    await expect(stats).toContainText('Revenue this month');
});

test('recent activity shows instructor check-ins', async () => {
    await expect(page.getByText(/checked (in to|out of)/).first()).toBeVisible();
});

test('staff sidebar hides Users', async () => {
    await expect(page.locator('.sideBar').getByText('Charts', { exact: true })).toBeVisible();
    await expect(page.locator('.sideBar').getByText('Users', { exact: true })).toHaveCount(0);
});

test('staff /admin/users redirects to /admin', async () => {
    await page.goto('/admin/users');
    await page.waitForURL((url) => url.pathname === '/admin');
});

test('updates a room (Rooms & prices in Bookings; the old /admin/rooms leads there)', async () => {
    await page.goto('/admin/rooms');
    await page.waitForURL((url) => url.pathname === '/admin/bookings' && url.searchParams.get('view') === 'rooms');
    await expect(page.getByRole('button', { name: 'Rooms & prices', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: new RegExp(`^Edit ${roomA.name}`) }).click();
    await dialog.getByLabel('Room Size').fill(roomA.size ?? '');
    await dialog.getByRole('button', { name: 'Update Room' }).click();
    await expectToast(page, 'Room updated.');
});

test('creates a booking for a guest (create_booking with p_guest_id)', async () => {
    await page.goto('/admin/bookings');
    // The calendar is the default view; "New booking" works from it as well as from the list.
    await expect(page.getByRole('region', { name: 'Bookings calendar' })).toBeVisible();
    await page.getByRole('button', { name: 'New booking' }).click();
    await dialog.getByLabel('Guest').fill(lastName(guests[1]));
    await page.getByRole('option').first().click();
    await pickOption(page, dialog, 'Room', roomB.name);
    await dialog.getByLabel('Date').fill(bookingDate);
    await pickOption(page, dialog, 'Start', '20:30');
    await pickOption(page, dialog, 'End', '21:30');
    await dialog.getByRole('button', { name: 'Add Booking' }).click();
    // The server sets the payment code; nothing taken yet → the new booking opens on its QR code.
    await expectToast(page, 'created · code OOPS');
    await expect(page.locator('.bkPayModal')).toBeVisible();
    while (await page.getByRole('dialog').count()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
    }
});

test('an overlapping booking shows the SLOT_TAKEN message', async () => {
    await page.getByRole('button', { name: 'New booking' }).click();
    await dialog.getByLabel('Guest').fill(lastName(guests[2]));
    await page.getByRole('option').first().click();
    await pickOption(page, dialog, 'Room', roomB.name);
    await dialog.getByLabel('Date').fill(bookingDate);
    await pickOption(page, dialog, 'Start', '21:00');
    await pickOption(page, dialog, 'End', '22:00');
    await dialog.getByRole('button', { name: 'Add Booking' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'already taken' }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).last().click();
});

const bookingRow = () => page.getByRole('row').filter({ hasText: '20:30' }).filter({ hasText: roomB.name });
async function bookingAction(item) {
    await bookingRow().getByRole('button', { name: /Actions for booking/ }).click();
    await page.waitForTimeout(500); // menu open animation
    await page.getByText(item, { exact: true }).click();
}

test('a booking created by staff is approved', async () => {
    await page.goto('/admin/bookings');
    await page.getByRole('button', { name: 'List', exact: true }).click(); // the searchable table
    await expect(page.getByRole('grid', { name: 'Bookings' })).toBeVisible();
    await page.getByPlaceholder('Search...').fill(bookingDate);
    await expect(bookingRow().getByText('approved', { exact: true })).toHaveCount(1);
});

test('a booking ahead offers Cancel, not Mark completed (it completes itself once paid in full)', async () => {
    await bookingRow().getByRole('button', { name: /Actions for booking/ }).click();
    await page.waitForTimeout(500); // menu open animation
    const menu = page.getByRole('menu', { name: /^Actions for booking/ });
    await expect(menu.getByRole('menuitem', { name: 'Cancel', exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Mark completed' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
});

test('deletes the booking', async () => {
    await bookingAction('Delete booking');
    await expectToast(page, 'Booking deleted.');
});

// The class hub (/admin/classes): the "New class" wizard, then the class's own page.
const classPage = () => page.locator('.hubHeader');
let classId;

test('creates a class with an image (classes insert + class-images upload)', async () => {
    await page.goto('/admin/classes');
    await expect(page.getByRole('group', { name: 'Show classes' })).toBeVisible();
    await page.getByRole('button', { name: 'New class' }).click();
    await dialog.getByLabel('Class Name').fill(CLASS_NAME);
    await pickOption(page, dialog, 'Instructor', instructors[0].full_name);
    await dialog.getByLabel('Price (VND)').fill('500000');
    await dialog.getByRole('button', { name: 'Create class' }).click();
    await expectToast(page, `${CLASS_NAME} created.`);
    // Weekly sessions and the routine come later, from the class page.
    await dialog.getByRole('button', { name: 'Skip for now' }).click();
    await dialog.getByRole('button', { name: 'Skip for now' }).click();
    await dialog.locator('input[type=file]').setInputFiles(PROOF);
    await expect(dialog.getByText(/proof\.\w+ \(/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Upload image' }).click();
    await expect(dialog.getByRole('heading', { name: `${CLASS_NAME} is ready` })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).last().click();
    const res = await rest(await staffJwt(), `classes?select=id,image_path&name=eq.${encodeURIComponent(CLASS_NAME)}`);
    expect(res.data[0].image_path).toMatch(new RegExp(`^${res.data[0].id}/.+\\.\\w+$`));
    classId = res.data[0].id;
});

test('adds a schedule to the class (ISO weekday)', async () => {
    // Running from today, with no session yet: listed under "This month", not "Today".
    await page.goto('/admin/classes?view=month');
    await page.getByRole('textbox', { name: 'Search classes' }).fill('E2E Test');
    await page.getByRole('link', { name: CLASS_NAME }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/classes/${classId}$`));
    await page.getByRole('tab', { name: 'Setup' }).click();
    await page.getByRole('button', { name: 'Add session' }).click();
    await pickOption(page, dialog, 'Day of the Week', 'Tuesday');
    await pickOption(page, dialog, 'Start Time', '08:00');
    await pickOption(page, dialog, 'End Time', '09:00');
    await dialog.getByRole('button', { name: 'Add Schedule' }).click();
    await expectToast(page, 'Schedule added.');
    await expect(classPage().getByText(/Tue\s*08:00/)).toBeVisible();
    const res = await rest(await staffJwt(), `class_schedules?select=day_of_week,start_time&class_id=eq.${classId}`);
    expect(res.data).toEqual([{ day_of_week: 2, start_time: '08:00:00' }]);
});

test('the class page shows the uploaded image', async () => {
    await expect(classPage().locator('img.hubImage')).toBeVisible();
});

test('replaces the class image', async () => {
    await classPage().getByRole('button', { name: `More for ${CLASS_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Change image' }).click();
    // The framing dialog: a new image (previewed on the Classes page card), saved with its position.
    await dialog.locator('input[type=file]').setInputFiles(PROOF);
    await expect(dialog.locator('.hpClassCard .hpClassMedia img')).toHaveAttribute('src', /^blob:/);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Class image updated.');
});

test('a new class asks for its first routine', async () => {
    await page.getByRole('tab', { name: 'Overview' }).click();
    // The class's to-do list says so and takes you to its Routines tab.
    const todo = page.locator('.hubTodos').getByRole('button', { name: /Plan a routine/ });
    await expect(todo).toBeVisible();
    await todo.click();
    await expect(page).toHaveURL(/tab=routines/);
});

// The E2E class meets on Tuesdays from today: the routine starts on the next Tuesday.
const nextTuesday = () => {
    let day = today;
    while (isoWeekday(day) !== 2) day = addDays(day, 1);
    return day;
};
const routines = () => page.locator('.rtPanel');

test('plans the first routine (class_lessons insert → classes.lesson)', async () => {
    await routines().getByLabel('Routine', { exact: true }).fill('Super Shy — NewJeans');
    await expect(routines().getByLabel('Sessions', { exact: true })).toHaveValue('8');
    await expect(routines().getByLabel('Starts on', { exact: true })).toHaveValue(nextTuesday());
    await routines().getByRole('button', { name: 'Plan routine' }).click();
    await expectToast(page, 'is planned');
    await expect(routines().getByText('Super Shy — NewJeans').first()).toBeVisible();
    const jwt = (await token('staff@demo.oopsdance.test')).jwt;
    const res = await rest(jwt, `classes?select=lesson,lessons:class_lessons(starts_on,session_count,price)&name=eq.${encodeURIComponent(CLASS_NAME)}`);
    expect(res.data).toEqual([{ lesson: 'Super Shy — NewJeans', lessons: [{ starts_on: nextTuesday(), session_count: 8, price: null }] }]);
});

test('adds the class video: YouTube links only (class_lessons.video_url)', async () => {
    await routines().getByRole('button', { name: /^Add the class video/ }).click();
    await routines().getByLabel('YouTube link').fill('https://vimeo.com/123456');
    await expect(routines().getByText('Paste a YouTube video link (youtube.com or youtu.be).')).toBeVisible();
    await expect(routines().getByRole('button', { name: 'Save video' })).toBeDisabled();
    await routines().getByLabel('YouTube link').fill('youtu.be/tbDUtRdhfUI');
    await routines().getByRole('button', { name: 'Save video' }).click();
    await expectToast(page, /Video saved/);
    await expect(routines().getByRole('link', { name: /Watch the class video of/ })).toBeVisible();
    const jwt = (await token('staff@demo.oopsdance.test')).jwt;
    const res = await rest(jwt, `classes?select=lessons:class_lessons(video_url)&name=eq.${encodeURIComponent(CLASS_NAME)}`);
    expect(res.data).toEqual([{ lessons: [{ video_url: 'https://youtu.be/tbDUtRdhfUI' }] }]);
});

// Attendance (/admin/attendance): today's roll calls and check-ins; class members live on the class page.
test('generates today\'s student attendance from the UI', async () => {
    await page.goto('/admin/attendance');
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Create today/ }).click();
    await expectToast(page, /attendance records for today|already exist/);
});

test('enrols a student (the class members link opens the class page)', async () => {
    await page.locator('.atMembersCard').getByRole('link', { name: new RegExp(CLASS_NAME) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/classes/${classId}\\?tab=students`));
    await classPage().getByRole('button', { name: 'Add student' }).click();
    await dialog.getByLabel('Student').fill('@demo');
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: 'Add Student' }).click();
    await expectToast(page, 'Student added to the class.');
});

test('removes the student', async () => {
    await page.locator('.hubStudent').first().getByRole('button', { name: /^More for / }).click();
    await page.getByRole('menuitem', { name: 'Remove from class' }).click();
    await expectToast(page, `left ${CLASS_NAME}.`);
    expect((await rest(await staffJwt(), `class_students?select=student_id&class_id=eq.${classId}`)).data).toEqual([]);
});

test('deletes the class (cascade + image removed)', async () => {
    // Created by mistake: no sessions taught, roll calls or payments, so the page offers Delete.
    await page.goto(`/admin/classes/${classId}`);
    await classPage().getByRole('button', { name: `More for ${CLASS_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Delete class' }).click();
    await expectToast(page, 'Class deleted.');
    await expect(page).toHaveURL(/\/admin\/classes$/);
    expect((await rest(await staffJwt(), `classes?select=id&id=eq.${classId}`)).data).toEqual([]);
});

test('generates this week\'s instructor attendance from the UI', async () => {
    // The old page's address still works.
    await page.goto('/admin/attendance-records');
    await expect(page).toHaveURL(/\/admin\/attendance$/);
    await expect(page.getByRole('region', { name: 'Sessions calendar' })).toBeVisible();
    await page.getByRole('button', { name: /Create this week/ }).click();
    await expectToast(page, /records for this week|already exist/);
});

test('staff sees proof photos through signed URLs', async () => {
    // Today's check-in proofs, on the session row and in the session dialog.
    const row = page.locator('.atTodayRow').filter({ has: page.locator('button[aria-label="View proof photo"]') }).first();
    await expect(row.locator('button[aria-label="View proof photo"] img').first()).toHaveAttribute('src', /\/object\/sign\/attendance-proofs\//);
    await row.locator('.atTodayOpen').click();
    await expect(dialog.locator('button[aria-label="View proof photo"] img').first()).toHaveAttribute('src', /\/object\/sign\/attendance-proofs\//);
    await dialog.getByRole('button', { name: 'Close' }).last().click();
});

test('charts render', async () => {
    await page.goto('/admin/charts');
    await expect(page.getByText('Monthly Revenue')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(3);
});

test('staff admin_set_role is FORBIDDEN', async () => {
    const me = await token('staff@demo.oopsdance.test');
    const res = await rpc(me.jwt, 'admin_set_role', { p_user: me.id, p_role: 'admin' });
    expect(res.data.message).toMatch(/^FORBIDDEN/);
});

test('staff can read every profile', async () => {
    const res = await rest(await staffJwt(), 'profiles?select=id');
    expect(res.data.length).toBeGreaterThanOrEqual(22);
});
