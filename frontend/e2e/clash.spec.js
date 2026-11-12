// Timetable rules seen from the UI: a class session may not overlap a live booking
// in its room, and a class may not move to a room that is booked at its times. The demo's classes are
// taught at rented studios, so the spec puts one into a room first and puts it back afterwards.
import { test, expect } from '@playwright/test';
import { addDays, clashTarget, isoWeekday, login, people, pickOption, putClassBack, putClassInRoom, rest, rooms, rpc, staffJwt, studioToday } from './support.js';

test.describe.configure({ mode: 'serial' });

let page;
let dialog;
let target;
let move;
let tempBooking = null;
let placed = null; // the class put into a room (putClassInRoom) and the other room: { cls, room, other }

const alertWith = (text) => page.getByRole('alert').filter({ hasText: text }).first();

test.beforeAll(async ({ browser }) => {
    const [roomA, roomB] = await rooms();
    const fits = await putClassInRoom([roomA, roomB]);
    expect(fits, 'a class that fits into a room').toBeTruthy();
    placed = { ...fits, other: fits.room.id === roomA.id ? roomB : roomA };
    page = await browser.newPage();
    dialog = page.getByRole('dialog');
    await login(page, 'staff@demo.oopsdance.test');
});
test.afterAll(async () => {
    // Safety net if the run stopped before the cleanup test.
    if (tempBooking) await rest(await staffJwt(), `bookings?id=eq.${tempBooking.id}`, { method: 'DELETE' });
    await putClassBack(placed);
    await page?.close();
});

test('finds an upcoming booking in a room that has classes', async () => {
    target = await clashTarget();
    expect(target, 'seeded upcoming booking in a class room').toBeTruthy();
});

test('schedule form explains a clash with a booking', async () => {
    await page.goto('/admin/classes?view=timetable');
    await expect(page.getByRole('list', { name: 'Weekly timetable' })).toBeVisible();
    await page.getByRole('button', { name: 'Add session' }).click();
    await pickOption(page, dialog, 'Class', target.className);
    await pickOption(page, dialog, 'Day of the Week', target.weekday);
    await pickOption(page, dialog, 'Start Time', target.start);
    await pickOption(page, dialog, 'End Time', target.end);
    await dialog.getByRole('button', { name: 'Add Schedule' }).click();
    await expect(alertWith('isn’t free in this class’s room')).toContainText(/overlaps a booking on \d{4}-\d{2}-\d{2}/);
});

test('books the other room at a class time (temporary booking)', async () => {
    const { room: roomA, other: roomB } = placed;
    const jwt = await staffJwt();
    const guest = (await people('guest'))[0];
    const classes = (await rest(jwt, `classes?select=id,name,room_id,schedules:class_schedules(day_of_week,start_time,end_time)&room_id=eq.${roomA.id}&order=id`)).data;
    // First class session whose hour is free in the other room, after the seeded bookings (14 days ahead).
    const firstFree = addDays(await studioToday(), 15);
    for (const cls of classes) {
        for (const schedule of cls.schedules) {
            let date = firstFree;
            while (isoWeekday(date) !== schedule.day_of_week) date = addDays(date, 1);
            const start = schedule.start_time.slice(0, 5);
            const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:${start.slice(3)}`;
            const made = await rpc(jwt, 'create_booking', { p_room_id: roomB.id, p_date: date, p_start: start, p_end: end, p_guest_id: guest.id });
            if (made.status === 200) {
                tempBooking = made.data;
                move = { cls, roomB };
                return;
            }
        }
    }
    throw new Error(`no class hour in ${roomA.name} is free in ${roomB.name}`);
});

test('class form explains why it cannot move to that room', async () => {
    // The class's own page: ⋮ → Edit details.
    await page.goto(`/admin/classes/${move.cls.id}`);
    await page.getByRole('button', { name: `More for ${move.cls.name}` }).click();
    await page.getByRole('menuitem', { name: 'Edit details' }).click();
    await pickOption(page, dialog, 'Where it’s taught', move.roomB.name);
    await dialog.getByRole('button', { name: 'Update Class' }).click();
    await expect(alertWith('That room isn’t free')).toBeVisible();
});

test('cleanup: the temporary booking is deleted', async () => {
    const res = await rest(await staffJwt(), `bookings?id=eq.${tempBooking.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    tempBooking = null;
});
