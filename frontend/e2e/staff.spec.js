import { test, expect } from '@playwright/test';
import {
    PROOF, deleteBookingsOn, ensureProofToday, expectToast, freeDate, login, pathname, people, pickOption,
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

const lastName = (person) => person.full_name.split(' ').slice(-2).join(' ');

test.beforeAll(async ({ browser }) => {
    [roomA, roomB] = await rooms();
    guests = await people('guest');
    instructors = await people('instructor');
    today = await studioToday();
    bookingDate = await freeDate(23);
    await deleteBookingsOn(bookingDate);
    await rest(await staffJwt(), `classes?name=eq.${encodeURIComponent(CLASS_NAME)}`, { method: 'DELETE' });
    await ensureProofToday();
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    dialog = page.getByRole('dialog');
});
test.afterAll(() => page.close());

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

test('updates a room', async () => {
    await page.goto('/admin/rooms');
    await page.getByRole('button', { name: new RegExp(`^Edit ${roomA.name}`) }).click();
    await dialog.getByLabel('Room Size').fill(roomA.size ?? '');
    await dialog.getByRole('button', { name: 'Update Room' }).click();
    await expectToast(page, 'Room updated.');
});

test('creates a booking for a guest (create_booking with p_guest_id)', async () => {
    await page.goto('/admin/bookings');
    await expect(page.getByRole('grid', { name: 'Bookings' })).toBeVisible();
    await page.getByRole('button', { name: 'New booking' }).click();
    await dialog.getByLabel('Guest').fill(lastName(guests[1]));
    await page.getByRole('option').first().click();
    await pickOption(page, dialog, 'Room', roomB.name);
    await dialog.getByLabel('Date').fill(bookingDate);
    await pickOption(page, dialog, 'Start', '20:30');
    await pickOption(page, dialog, 'End', '21:30');
    await dialog.getByRole('button', { name: 'Add Booking' }).click();
    await expectToast(page, 'Booking added.');
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
    await expect(page.getByRole('grid', { name: 'Bookings' })).toBeVisible();
    await page.getByPlaceholder('Search...').fill(bookingDate);
    await expect(bookingRow().getByText('approved', { exact: true })).toHaveCount(1);
});

test('marks the booking completed via the quick action', async () => {
    await bookingAction('Mark completed');
    await expectToast(page, 'is now completed');
});

test('deletes the booking', async () => {
    await bookingAction('Delete booking');
    await expectToast(page, 'Booking deleted.');
});

test('creates a class with an image (classes insert + class-images upload)', async () => {
    await page.goto('/admin/classes');
    await expect(page.locator('.classCard').first()).toBeVisible();
    await page.getByRole('button', { name: 'New class' }).click();
    await dialog.getByLabel('Class Name').fill(CLASS_NAME);
    await pickOption(page, dialog, 'Instructor', instructors[0].full_name);
    await dialog.getByLabel('Price (VND)').fill('500000');
    await dialog.locator('input[type=file]').setInputFiles(PROOF);
    await expect(dialog.getByText(/proof\.\w+ \(/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Add Class' }).click();
    await expectToast(page, 'Class added.');
});

const classRow = () => page.locator('.classCard').filter({ hasText: CLASS_NAME });

test('adds a schedule to the class (ISO weekday)', async () => {
    await page.goto('/admin/classes');
    await page.getByRole('button', { name: 'Add session' }).click();
    await pickOption(page, dialog, 'Class', CLASS_NAME);
    await pickOption(page, dialog, 'Day of the Week', 'Tuesday');
    await pickOption(page, dialog, 'Start Time', '08:00');
    await pickOption(page, dialog, 'End Time', '09:00');
    await dialog.getByRole('button', { name: 'Add Schedule' }).click();
    await expectToast(page, 'Schedule added.');
    await page.locator('.classListDiv').getByPlaceholder('Search...').fill('E2E');
    await expect(classRow().getByText(/Tue\s*08:00/)).toBeVisible();
});

test('the class card shows the uploaded image', async () => {
    await expect(classRow().locator('img').first()).toBeVisible();
});

test('replaces the class image', async () => {
    await classRow().getByRole('button', { name: /Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Change class image' }).click();
    await dialog.locator('input[type=file]').setInputFiles(PROOF);
    await dialog.getByRole('button', { name: 'Change Image' }).click();
    await expectToast(page, 'Class image updated.');
});

test('a new class asks for this month\'s lesson', async () => {
    await expect(classRow().getByText(/No lesson for/)).toBeVisible();
});

test('sets this month\'s lesson (class_lessons upsert → classes.lesson)', async () => {
    await classRow().getByRole('button', { name: /No lesson for/ }).click();
    await dialog.getByLabel('Lesson').fill('Super Shy — NewJeans');
    await dialog.getByRole('button', { name: 'Save lesson' }).click();
    await expectToast(page, 'Lesson saved');
    await expect(classRow().getByText('Super Shy — NewJeans')).toBeVisible();
    const jwt = (await token('staff@demo.oopsdance.test')).jwt;
    const res = await rest(jwt, `classes?select=lesson&name=eq.${encodeURIComponent(CLASS_NAME)}`);
    expect(res.data).toEqual([{ lesson: 'Super Shy — NewJeans' }]);
});

test('generates today\'s student attendance from the UI', async () => {
    await page.goto('/admin/students');
    await expect(page.getByText('Student Attendance Today')).toBeVisible();
    await page.getByRole('button', { name: /Create today/ }).click();
    await expectToast(page, /attendance records for today|already exist/);
});

test('enrols a student', async () => {
    await pickOption(page, page, 'Class', CLASS_NAME);
    await page.getByRole('button', { name: 'Add New' }).click();
    await dialog.getByLabel('Student').fill('@demo');
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: 'Add Student' }).click();
    await expectToast(page, 'Student added to the class.');
});

test('removes the student', async () => {
    await page.getByRole('button', { name: 'Remove student' }).first().click();
    await expectToast(page, 'Student removed.');
});

test('deletes the class (cascade + image removed)', async () => {
    await page.goto('/admin/classes');
    await page.locator('.classListDiv').getByPlaceholder('Search...').fill('E2E');
    await classRow().getByRole('button', { name: /Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Delete class' }).click();
    await expectToast(page, 'Class deleted.');
});

test('generates this week\'s instructor attendance from the UI', async () => {
    await page.goto('/admin/attendance-records');
    await expect(page.getByRole('grid', { name: 'Instructor attendance' })).toBeVisible();
    await page.getByRole('button', { name: /Create this week/ }).click();
    await expectToast(page, /records for this week|already exist/);
});

test('staff sees proof photos through signed URLs', async () => {
    await page.getByPlaceholder('Search...').fill(today);
    const proof = page.locator('button[aria-label="View proof photo"] img').first();
    await expect(proof).toHaveAttribute('src', /\/object\/sign\/attendance-proofs\//);
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
