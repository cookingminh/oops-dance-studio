import { test, expect } from '@playwright/test';
import { addDays, expectToast, isoWeekday, login, pickOption, rest, rooms, rpc, serviceKey, staffJwt, studioToday } from './support.js';

// A regular rental (20261117003100_booking_series): staff book a walk-in every Wednesday 08:00–09:00 for four weeks;
// the second Wednesday's room is taken, so that day goes to the other room; 10 % off; the first session opens with
// the series, and a month is paid by one transfer with its code (the demo's pretend transfer). Works ≥ 60 days ahead
// and deletes everything it made afterwards.
test.describe.configure({ mode: 'serial' });

const NAME = 'E2E Weekly Crew';
let page;
let jwt;
let roomA;
let roomB;
let first; // the first Wednesday
let clashId; // a booking in Room A on the second one

test.beforeAll(async ({ browser }) => {
    [roomA, roomB] = await rooms();
    jwt = await staffJwt();
    const today = await studioToday();
    let offset = 60;
    while (isoWeekday(addDays(today, offset)) !== 3) offset += 1;
    first = addDays(today, offset);
    const booked = await rpc(jwt, 'booking_staff_create', {
        p_guest: null,
        p_room: roomA.id,
        p_date: addDays(first, 7),
        p_start: '08:00',
        p_end: '09:00',
        p_walk_in_name: 'E2E Series Clash',
        p_walk_in_phone: '0900000098',
    });
    expect(booked.status, JSON.stringify(booked.data)).toBe(200);
    clashId = booked.data.id;
    page = await browser.newPage();
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    const key = await serviceKey();
    const series = (await rest(key, `booking_series?select=id&walk_in_name=eq.${encodeURIComponent(NAME)}`)).data ?? [];
    for (const { id } of series) {
        await rest(key, `bank_transfers?series_id=eq.${id}`, { method: 'DELETE' });
        await rest(key, `bookings?series_id=eq.${id}`, { method: 'DELETE' });
        await rest(key, `booking_series?id=eq.${id}`, { method: 'DELETE' });
    }
    await rest(key, `bookings?id=eq.${clashId}`, { method: 'DELETE' });
    await page?.close();
});

test('staff book a weekly rental: the taken day goes to the other room, with 10 % off', async () => {
    await page.goto(`/admin/bookings?date=${first}`);
    await page.getByRole('button', { name: 'New booking' }).click();
    const form = page.locator('.bookingForm');
    await form.getByRole('button', { name: 'A walk-in (no account)' }).click();
    await form.getByLabel('Walk-in’s name').fill(NAME);
    await form.getByLabel('Phone').fill('0977 000 111');
    await pickOption(page, form, 'Room', roomA.name);
    await form.getByLabel('Date').first().fill(first);
    await pickOption(page, form, 'Start', '08:00');
    await pickOption(page, form, 'End', '09:00');

    await form.getByText('Repeat every week').click();
    await form.getByLabel('Until').fill(addDays(first, 21));
    await expect(form.locator('.rpCount')).toContainText('4 days · 1 is taken');
    const taken = form.locator('.rpDays li.isClash');
    await expect(taken).toContainText('Taken: a booking 08:00–09:00');
    await expect(taken.getByRole('button', { name: /That day/ })).toContainText(roomB.name); // the first free room

    await form.getByRole('button', { name: '%', exact: true }).click();
    await form.getByLabel('Percent off').fill('10');
    await expect(form.getByRole('button', { name: 'Book 4 sessions' })).toBeDisabled(); // the reason is missing
    await form.getByLabel('Reason').fill('Regular rental');
    await form.getByRole('button', { name: 'Book 4 sessions' }).click();
    await expectToast(page, 'Booked 4 sessions, paid by month.');

    const sessions = (await rest(jwt, `bookings?select=date,room_id,list_price,full_payment,price_note,series_id&walk_in_name=eq.${encodeURIComponent(NAME)}&order=date`)).data;
    expect(sessions.map((row) => row.date)).toEqual([0, 7, 14, 21].map((days) => addDays(first, days)));
    expect(sessions[1].room_id).toBe(roomB.id);
    expect(sessions[0].full_payment).toBe(Math.round((sessions[0].list_price * 0.9) / 1000) * 1000);
    expect(sessions[0].price_note).toBe('Regular rental');
});

test('the first session opens with the series, and a month is paid by one transfer with its code', async () => {
    const series = page.locator('.bookingDetails .bdSeries');
    await expect(series).toContainText('Regular rental');
    await expect(series).toContainText('4 sessions');
    await expect(series).toContainText('10% off · Regular rental');
    await series.getByRole('button', { name: 'QR for the month' }).first().click();
    const pay = page.locator('.bkPayModal');
    await expect(pay).toContainText('of the rental');
    await pay.getByRole('button', { name: 'Simulate the transfer' }).click();
    await expect(pay).toContainText('Paid in full. Thank you!');
});
