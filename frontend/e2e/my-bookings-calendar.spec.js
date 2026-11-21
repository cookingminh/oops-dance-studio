// My bookings → List | Calendar (the guest's side). The data: an approved booking still waiting for its
// deposit, some weeks ahead, made for guest02 by staff. The calendar shows it on its day (time and room); its
// day dialog has the list's buttons (pay → the QR dialog, then back to the day; the receipt); the status filter
// hides it; List comes back; the choice survives a reload. On a phone: a dot on the day, its card under the grid.
// Last, it is cancelled from its day dialog: the day comes back reloaded and the chip turns grey.
import { test, expect } from '@playwright/test';
import { addDays, login, rest, rpc, staffJwt, studioToday, token } from './support.js';

const GUEST = 'guest02@demo.oopsdance.test';
const hhmm = (time) => time.slice(0, 5);
const longDate = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00:00`));
const dayMonthYear = (iso) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));

test.describe.serial('my bookings as a calendar', () => {
    let booking;
    let room;

    test.beforeAll(async () => {
        const staff = await staffJwt();
        const guest = await token(GUEST);
        const date = addDays(await studioToday(), 41);
        const slots = (await rpc(staff, 'get_available_slots', { p_date: date })).data;
        const slot = slots.find((row) => row.end_time > row.start_time);
        const twoHoursOn = `${String(Number(slot.start_time.slice(0, 2)) + 2).padStart(2, '0')}${slot.start_time.slice(2)}`;
        const created = await rpc(staff, 'booking_staff_create', {
            p_guest: guest.id,
            p_room: slot.room_id,
            p_date: date,
            p_start: slot.start_time,
            p_end: twoHoursOn < slot.end_time ? twoHoursOn : slot.end_time,
            p_details: 'e2e: my bookings calendar',
            p_status: 'approved',
        });
        booking = created.data;
        expect(booking?.id, JSON.stringify(created.data)).toBeTruthy();
        expect(booking.deposit_status).toBe('waiting');
        room = (await rest(staff, `rooms?select=name&id=eq.${booking.room_id}`)).data[0].name;
    });

    test.afterAll(async () => {
        if (booking?.id) await rest(await staffJwt(), `bookings?id=eq.${booking.id}`, { method: 'DELETE' });
    });

    const times = () => `${hhmm(booking.start_time)}–${hhmm(booking.end_time)}`;
    const day = (page) => page.locator(`.mbDay[data-date="${booking.date}"]`);
    const chip = (page) => day(page).getByRole('button', { name: new RegExp(`^${times()}, ${room}, approved`) });
    const views = (page) => page.getByRole('group', { name: 'Show the bookings as' });

    // ‹ › until the booking's month shows (the calendar opens on the next booking's month).
    async function showBookingMonth(page) {
        for (let step = 0; step < 12 && !(await day(page).count()); step += 1) {
            await page.getByRole('button', { name: 'Next month' }).click();
        }
        await expect(day(page)).toBeVisible();
    }

    async function pickStatus(page, label) {
        await page.locator('.statusSelectTrigger').click();
        await page.getByRole('option').filter({ hasText: label }).first().click();
    }

    test('the booking shows on its day; its day dialog has the list’s buttons', async ({ page }) => {
        await login(page, GUEST);
        await page.goto('/profile/my-bookings');
        await expect(page.locator('.bookingTable')).toBeVisible(); // List first
        await expect(views(page).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');

        await views(page).getByRole('button', { name: 'Calendar' }).click();
        await expect(page.locator('.bookingTable')).toHaveCount(0);
        await expect(page.getByRole('group', { name: 'Dates' })).toHaveCount(0); // ‹ month › instead of Upcoming / Past / All
        await expect(page.getByRole('group', { name: 'Choose a month' })).toBeVisible();
        await showBookingMonth(page);

        await expect(chip(page)).toBeVisible();
        await expect(chip(page)).toContainText(times());
        await expect(chip(page)).toContainText(room);
        await expect(chip(page).locator('.mbOwed')).toHaveCount(1); // the deposit is still to pay
        await expect(page.locator('.mbLegend')).toContainText('Money still to pay');

        await chip(page).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText(dayMonthYear(booking.date)); // "Friday, 1 January 2027"
        const item = dialog.locator('.mbDayItem.isPicked');
        await expect(item).toContainText(room);
        await expect(item).toContainText(`${hhmm(booking.start_time)} – ${hhmm(booking.end_time)}`);
        await expect(item).toContainText('approved');
        await expect(item).toContainText(`#${booking.id}`);
        await expect(item.locator('.mbDayMoney')).toContainText('Still to pay');
        await expect(item.getByRole('button', { name: 'Cancel' })).toBeVisible();

        // Pay deposit: the page's QR dialog; closing it brings the day back.
        await item.getByRole('button', { name: `Pay deposit · #${booking.id}` }).click();
        await expect(page.getByRole('dialog')).toContainText('Pay by bank transfer');
        await page.keyboard.press('Escape');
        await expect(page.locator('.mbDayItem.isPicked')).toBeVisible();

        // The receipt: the page's receipt dialog, then the day again.
        await page.locator('.mbDayItem.isPicked').getByRole('button', { name: `Receipt for booking #${booking.id}` }).click();
        await expect(page.locator('.bkReceiptModal')).toContainText(`#${booking.id}`);
        await page.keyboard.press('Escape');
        await expect(page.locator('.mbDayItem.isPicked')).toBeVisible();

        await page.locator('.mbDayDialog .tuPayFoot').getByRole('button', { name: 'Close' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('the status filter hides it; List comes back; the choice survives a reload', async ({ page }) => {
        await login(page, GUEST);
        await page.goto('/profile/my-bookings');
        await views(page).getByRole('button', { name: 'Calendar' }).click();
        await showBookingMonth(page);
        await expect(chip(page)).toBeVisible();

        await pickStatus(page, 'Pending');
        await expect(chip(page)).toHaveCount(0);
        await pickStatus(page, 'Approved');
        await expect(chip(page)).toBeVisible();

        // Calendar is remembered…
        await page.reload();
        await expect(views(page).getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.mbCal')).toBeVisible();

        // …and so is List.
        await views(page).getByRole('button', { name: 'List' }).click();
        await expect(page.locator('.bookingTable')).toBeVisible();
        await expect(page.getByRole('group', { name: 'Dates' })).toBeVisible();
        await page.reload();
        await expect(page.locator('.bookingTable')).toBeVisible();
        await expect(page.locator('.mbCal')).toHaveCount(0);
    });

    test('on a phone: a dot on its day, and its card with the pay button under the grid', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await login(page, GUEST);
        await page.goto('/profile/my-bookings');
        await views(page).getByRole('button', { name: 'Calendar' }).click();
        await showBookingMonth(page);

        await expect(day(page).locator('.mbDot.tone-approved')).toHaveCount(1);
        await day(page).click();
        await expect(day(page)).toHaveAttribute('aria-pressed', 'true');
        const picked = page.locator('.mbPicked');
        await expect(picked).toContainText(longDate(booking.date));
        await expect(picked.locator('.pfBookingCard')).toContainText(room);
        await expect(picked.getByRole('button', { name: 'Pay deposit' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });

    test('cancelled from its day: the day comes back reloaded, the chip turns grey', async ({ page }) => {
        await login(page, GUEST);
        await page.goto('/profile/my-bookings');
        await views(page).getByRole('button', { name: 'Calendar' }).click();
        await showBookingMonth(page);
        await chip(page).click();

        await page.locator('.mbDayItem.isPicked').getByRole('button', { name: 'Cancel' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel the booking' }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Booking cancelled.' }).first()).toBeVisible();

        const item = page.locator('.mbDayItem.isPicked');
        await expect(item).toContainText('cancelled');
        await expect(item.getByRole('button', { name: /^Pay deposit/ })).toHaveCount(0);
        await expect(item.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(day(page).locator('.mbChip.tone-off')).toContainText(times());
        await expect(day(page).locator('.mbOwed')).toHaveCount(0);
    });
});
