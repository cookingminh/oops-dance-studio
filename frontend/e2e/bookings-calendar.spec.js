import { test, expect } from '@playwright/test';
import { addDays, deleteBookingsOn, expectToast, isoWeekday, login, people, rest, rooms, staffJwt, studioToday } from './support.js';

// /admin/bookings as a calendar: class sessions as context, a free slot opens "New booking"
// prefilled, a booking opens its dialog (approve / cancel), room lanes with "All rooms", a
// press-and-drag range, month view, the list switch.
// Works on its own date (≥ 40 days ahead) and deletes its bookings there afterwards.
test.describe.configure({ mode: 'serial' });

let page;
let dialog;
let roomB;
let guest;
let guest2; // books the dragged range
let bookingDate;
let context; // a weekly class session in the booking's week: { name, date, start }

const lastName = (person) => person.full_name.split(' ').slice(-2).join(' ');
const calendar = () => page.getByRole('region', { name: 'Bookings calendar' });
// "Tue 22 Dec 20:30–21:30 Lê Minh Anh, Phòng B, pending, Awaiting approval"
const block = () => calendar().getByRole('button', { name: new RegExp(`20:30–21:30 ${guest.full_name}`) });
const lane = (roomId) => calendar().locator(`.calDay[data-date="${bookingDate}"] .calLane[data-lane="${roomId}"]`);

// Escape out of every open dialog (the booking dialog and the QR on top of it).
async function closeDialogs() {
    await expect(page.getByRole('dialog').first()).toBeVisible();
    while (await page.getByRole('dialog').count()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
    }
}

// Mouse down on the `from` slot of a lane and drag to the `last` slot (still pressed).
async function dragInLane(roomId, from, last) {
    const start = lane(roomId).locator(`.calSlot[data-time="${from}"]`);
    await start.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const a = await start.boundingBox();
    const b = await lane(roomId).locator(`.calSlot[data-time="${last}"]`).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, b.y + b.height / 2, { steps: 6 });
}

test.beforeAll(async ({ browser }) => {
    [, roomB] = await rooms();
    [, , , guest, guest2] = await people('guest');
    const today = await studioToday();
    const jwt = await staffJwt();
    const classes = (await rest(jwt, 'classes?select=id,name,room_id,starts_on,ended_on,schedules:class_schedules(day_of_week,start_time,end_time)')).data;
    const roomBSlots = classes.filter((cls) => cls.room_id === roomB.id).flatMap((cls) => cls.schedules);
    // A day whose Room B has no class at the times the tests use (12:00–16:00, 20:30–22:00).
    const windows = [['12:00', '16:00'], ['20:30', '22:00']];
    const busy = (iso) => roomBSlots.some((slot) => slot.day_of_week === isoWeekday(iso) && windows.some(([from, to]) => slot.start_time < to && slot.end_time > from));
    let offset = 40;
    while (busy(addDays(today, offset))) offset += 1;
    bookingDate = addDays(today, offset);
    await deleteBookingsOn(bookingDate);

    // A Room B class that meets that week (shown behind the bookings).
    const monday = addDays(bookingDate, 1 - isoWeekday(bookingDate));
    for (const cls of classes.filter((item) => item.room_id === roomB.id && !item.ended_on)) {
        const slot = cls.schedules[0];
        const date = slot && addDays(monday, slot.day_of_week - 1);
        if (slot && (!cls.starts_on || cls.starts_on <= date)) {
            context = { name: cls.name, date, start: slot.start_time.slice(0, 5) };
            break;
        }
    }

    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    dialog = page.getByRole('dialog');
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await deleteBookingsOn(bookingDate);
    await page.close();
});

test('the bookings page opens on the week calendar', async () => {
    await page.goto('/admin/bookings');
    await expect(calendar()).toBeVisible();
    await expect(calendar().locator('.calWeekHead .calDayHead.isToday')).toHaveCount(1);
    await expect(page.locator('.bookingsCard .cardTitles p')).toContainText(/bookings? this week/);
    await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('class sessions of the room show behind the bookings, not clickable', async () => {
    test.skip(!context, 'no Room B class that week');
    await page.goto(`/admin/bookings?date=${bookingDate}`);
    await page.getByRole('group', { name: 'Room' }).getByRole('button', { name: new RegExp(roomB.name) }).click();
    const session = calendar().locator(`.calDay[data-date="${context.date}"] .calItem.tone-background`).filter({ hasText: context.name });
    await expect(session.first()).toBeVisible();
    await expect(session.first()).toContainText(context.start);
    await expect(calendar().getByRole('button', { name: new RegExp(context.name) })).toHaveCount(0);
});

test('a free slot opens "New booking" with the room, date and time filled in', async () => {
    await page.goto(`/admin/bookings?date=${bookingDate}`);
    await page.getByRole('group', { name: 'Room' }).getByRole('button', { name: new RegExp(roomB.name) }).click();
    await calendar().locator(`.calDay[data-date="${bookingDate}"] .calSlot[data-time="20:30"]`).click();
    await expect(dialog.getByText('Add Booking').first()).toBeVisible();
    await expect(dialog.getByLabel('Date')).toHaveValue(bookingDate);
    await expect(dialog.getByRole('button', { name: /Room/ })).toContainText(roomB.name);
    await expect(dialog.getByRole('button', { name: /Start/ })).toContainText('20:30');
    await expect(dialog.getByRole('button', { name: /End/ })).toContainText('21:30');

    await dialog.getByLabel('Guest').fill(lastName(guest));
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: 'Hold (pending)' }).click();
    await dialog.getByRole('button', { name: 'Add Booking' }).click();
    await expectToast(page, 'created · code');
    await closeDialogs(); // a new booking opens on its QR code (nothing taken yet)
});

test('a pending booking is dashed, badged and counted in the header', async () => {
    await expect(block()).toBeVisible();
    await expect(block()).toHaveClass(/tone-dashed/);
    await expect(block()).toContainText('Awaiting approval');
    await expect(page.locator('.bookingsCard .cardTitles p')).toContainText('1 awaiting approval');

    // The quick filter shows only pending requests.
    const chip = page.locator('.awaitChip');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(block()).toBeVisible();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
});

test('clicking the booking opens its dialog; approve from there', async () => {
    await block().click();
    await expect(dialog).toContainText(guest.full_name);
    await expect(dialog).toContainText(roomB.name);
    await expect(dialog).toContainText('20:30 – 21:30');
    await expect(dialog).toContainText('Deposit');
    await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(page, 'is now approved');
    await expect(dialog).toHaveCount(0);
    await expect(block()).toHaveClass(/tone-solid/);
});

test('cancelling from the dialog mutes the booking', async () => {
    await block().click();
    await expect(dialog.getByRole('button', { name: 'Mark completed' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel booking' }).click();
    await expectToast(page, 'is now cancelled');
    await expect(block()).toHaveClass(/tone-muted/);
    await expect(block()).toHaveClass(/status-cancelled/);
});

test('with All rooms each day has a lane per room, and a Phòng B booking sits in the B lane', async () => {
    await page.goto(`/admin/bookings?date=${bookingDate}`);
    const day = calendar().locator(`.calDay[data-date="${bookingDate}"]`);
    await expect(day.locator('.calLane')).toHaveCount(2);
    await expect(calendar().locator('.calDayHead').first().locator('.calLaneHead')).toHaveCount(2);
    await expect(calendar().locator('.calDayHead').first().locator('.calLaneHead').last()).toHaveAttribute('title', roomB.name);
    await expect(lane(roomB.id).getByRole('button', { name: new RegExp(guest.full_name) })).toBeVisible();
    await expect(day.locator('.calLane').first().getByRole('button', { name: new RegExp(guest.full_name) })).toHaveCount(0);
});

test('a single click in a lane gives that room, the time and one hour', async () => {
    await lane(roomB.id).locator('.calSlot[data-time="12:00"]').click();
    await expect(dialog.getByRole('button', { name: /Room/ })).toContainText(roomB.name);
    await expect(dialog.getByLabel('Date')).toHaveValue(bookingDate);
    await expect(dialog.getByRole('button', { name: /Start/ })).toContainText('12:00');
    await expect(dialog.getByRole('button', { name: /End/ })).toContainText('13:00');
    await dialog.getByRole('button', { name: 'Close' }).last().click();
    await expect(dialog).toHaveCount(0);
});

test('a drag from 14:00 to 16:00 in the B lane opens the form with that range; saving books it', async () => {
    await dragInLane(roomB.id, '14:00', '15:30');
    await expect(lane(roomB.id).locator('.calGhost')).toContainText('14:00–16:00');
    await page.mouse.up();
    await expect(dialog.getByRole('button', { name: /Room/ })).toContainText(roomB.name);
    await expect(dialog.getByLabel('Date')).toHaveValue(bookingDate);
    await expect(dialog.getByRole('button', { name: /Start/ })).toContainText('14:00');
    await expect(dialog.getByRole('button', { name: /End/ })).toContainText('16:00');

    await dialog.getByLabel('Guest').fill(lastName(guest2));
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: 'Hold (pending)' }).click();
    await dialog.getByRole('button', { name: 'Add Booking' }).click();
    await expectToast(page, 'created · code');
    await closeDialogs(); // a new booking opens on its QR code (nothing taken yet)
    const booked = lane(roomB.id).getByRole('button', { name: new RegExp(`14:00–16:00 ${guest2.full_name}`) });
    await expect(booked).toBeVisible();
    await expect(booked).toHaveClass(/tone-dashed/);
});

test('dragging over a booking warns; Esc cancels the drag', async () => {
    await dragInLane(roomB.id, '13:00', '14:30');
    const ghost = lane(roomB.id).locator('.calGhost');
    await expect(ghost).toHaveClass(/isClash/);
    await expect(ghost).toContainText(`Overlaps ${guest2.full_name}`);
    await page.keyboard.press('Escape');
    await expect(ghost).toHaveCount(0);
    await page.mouse.up();
    await expect(dialog).toHaveCount(0);
});

test('month view lists the booking on its day; List shows the table', async () => {
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    const day = calendar().locator('.calCell').filter({ has: page.getByRole('button', { name: new RegExp(guest.full_name) }) });
    await expect(day).toHaveCount(1);
    await expect(page.locator('.bookingsCard .cardTitles p')).toContainText(/booking/);

    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('grid', { name: 'Bookings' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('view')).toBe('list');
});
