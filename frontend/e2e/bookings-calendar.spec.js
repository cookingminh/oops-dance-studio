import { test, expect } from '@playwright/test';
import { addDays, deleteBookingsOn, expectToast, isoWeekday, login, people, pickOption, rest, rooms, staffJwt, studioToday } from './support.js';

// /admin/bookings as a calendar: class sessions as context, a free slot opens "New booking"
// prefilled, a booking opens its dialog (approve / cancel), month view, the list switch.
// Works on its own date (≥ 40 days ahead) and deletes its bookings there afterwards.
test.describe.configure({ mode: 'serial' });

let page;
let dialog;
let roomB;
let guest;
let bookingDate;
let context; // a weekly class session in the booking's week: { name, date, start }

const lastName = (person) => person.full_name.split(' ').slice(-2).join(' ');
const calendar = () => page.getByRole('region', { name: 'Bookings calendar' });
// "Tue 22 Dec 20:30–21:30 Lê Minh Anh, Phòng B, pending, Awaiting approval"
const block = () => calendar().getByRole('button', { name: new RegExp(`20:30–21:30 ${guest.full_name}`) });

test.beforeAll(async ({ browser }) => {
    [, roomB] = await rooms();
    guest = (await people('guest'))[3];
    const today = await studioToday();
    const jwt = await staffJwt();
    const classes = (await rest(jwt, 'classes?select=id,name,room_id,starts_on,ended_on,schedules:class_schedules(day_of_week,start_time,end_time)')).data;
    const roomBSlots = classes.filter((cls) => cls.room_id === roomB.id).flatMap((cls) => cls.schedules);
    // A day whose Room B evening (20:30–22:00) has no class.
    let offset = 40;
    while (roomBSlots.some((slot) => slot.day_of_week === isoWeekday(addDays(today, offset)) && slot.start_time < '22:00' && slot.end_time > '20:30')) offset += 1;
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
    await pickOption(page, dialog, 'Status', 'pending');
    await dialog.getByRole('button', { name: 'Add Booking' }).click();
    await expectToast(page, 'Booking added.');
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

test('month view lists the booking on its day; List shows the table', async () => {
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    const day = calendar().locator('.calCell').filter({ has: page.getByRole('button', { name: new RegExp(guest.full_name) }) });
    await expect(day).toHaveCount(1);
    await expect(page.locator('.bookingsCard .cardTitles p')).toContainText(/booking/);

    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('grid', { name: 'Bookings' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('view')).toBe('list');
});
