import { test, expect } from '@playwright/test';
import { addDays, expectToast, isoWeekday, login, pickOption, putClassBack, putClassInRoom, rest, rooms, rpc, staffJwt, studioToday } from './support.js';

// Moving a class into a room booked on one of its days (20261117003000_class_session_places): instead of being
// refused, the class moves and the clashing session gets another room or none yet (a to-do); a session without a
// room is placed later from its dialog. Works on its own day (≥ 40 days ahead) and puts everything back afterwards.
test.describe.configure({ mode: 'serial' });

let page;
let jwt;
let roomA;
let roomB;
let placed; // the class put into Room B (putClassInRoom)
let day; // one of its sessions, booked in Room A
let bookingId;

// A booking on the half-hour grid over a weekly session that may start at :15 or :45.
const onGrid = (time) => `${time.slice(0, 2)}:${Number(time.slice(3, 5)) < 30 ? '00' : '30'}`;
const anHourLater = (time) => `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:${time.slice(3, 5)}`;

test.beforeAll(async ({ browser }) => {
    [roomA, roomB] = await rooms();
    jwt = await staffJwt();
    placed = await putClassInRoom([roomB]);
    const [cls] = (await rest(jwt, `classes?id=eq.${placed.cls.id}&select=id,name,schedules:class_schedules(day_of_week,start_time,end_time)`)).data;
    placed.name = cls.name;
    const slot = cls.schedules[0];
    const today = await studioToday();
    let offset = 40;
    while (isoWeekday(addDays(today, offset)) !== slot.day_of_week) offset += 1;
    day = addDays(today, offset);
    const start = onGrid(slot.start_time);
    const booked = await rpc(jwt, 'booking_staff_create', {
        p_guest: null,
        p_room: roomA.id,
        p_date: day,
        p_start: start,
        p_end: anHourLater(start),
        p_walk_in_name: 'E2E Room Clash',
        p_walk_in_phone: '0900000099',
    });
    expect(booked.status, JSON.stringify(booked.data)).toBe(200);
    bookingId = booked.data.id;
    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await rest(jwt, `bookings?id=eq.${bookingId}`, { method: 'DELETE' });
    await putClassBack(placed);
    await rest(jwt, `instructor_attendance?class_id=eq.${placed.cls.id}&date=eq.${day}&own_place=is.true`, { method: 'DELETE' });
    await page?.close();
});

test('moving the class into the booked room lists the clashing day, with its booking, instead of refusing', async () => {
    await page.goto(`/admin/classes/${placed.cls.id}?tab=setup`);
    const form = page.locator('form.hubForm');
    await pickOption(page, form, 'Where it’s taught', roomA.name);
    await form.getByRole('button', { name: 'Save details' }).click();

    const dialog = page.locator('.roomClashDialog');
    await expect(dialog).toContainText(`${roomA.name} is booked on 1 of ${placed.name}’s sessions`);
    await expect(dialog).toContainText(`Booking #${bookingId}`);
    await expect(dialog).toContainText('E2E Room Clash');
    await expect(dialog.getByRole('link', { name: 'Open booking' })).toHaveAttribute('href', `/admin/bookings?booking=${bookingId}`);

    await pickOption(page, dialog, 'This session takes place in', 'No room yet (to-do for staff)');
    await expect(dialog).toContainText('1 session will have no room yet');
    await dialog.getByRole('button', { name: `Move the class to ${roomA.name}` }).click();
    await expectToast(page, 'Class moved. 1 session(s) have no room yet');
    await expect(dialog).toHaveCount(0);
});

test('the session without a room says so, is on the to-do list, and is placed from its dialog', async () => {
    const tasks = await rest(jwt, `instructor_attendance?select=room_id,own_place,needs_place&class_id=eq.${placed.cls.id}&date=eq.${day}`);
    expect(tasks.data).toEqual([{ room_id: null, own_place: true, needs_place: true }]);

    await page.goto(`/admin/attendance?class=${placed.cls.id}&day=${day}`);
    const session = page.getByRole('dialog').first();
    await expect(session).toContainText('No room yet');
    await session.getByRole('button', { name: 'Place it' }).click();
    const place = page.getByRole('dialog').filter({ hasText: 'Room for this session' });
    await place.getByRole('radio', { name: roomB.name }).check({ force: true }); // NextUI keeps the input visually hidden
    await expect(place.getByRole('radio', { name: roomB.name })).toBeChecked();
    await place.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Room set for this session.');
    await expect(session).not.toContainText('No room yet');
    await expect(session).toContainText(roomB.name);
});
