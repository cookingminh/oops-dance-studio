// What students and guests still have to pay is pushed to them: a bell in /profile with a QR button per
// item, a badge on the menu page, and once a day a friendly reminder in the corner ("Later" = not again
// today). The data: an approved booking still waiting for its deposit, two days ahead.
import { test, expect } from '@playwright/test';
import { addDays, login, rest, rpc, staffJwt, studioToday, token } from './support.js';

const GUEST = 'guest02@demo.oopsdance.test';

test.describe.serial('reminders to pay', () => {
    let booking;

    test.beforeAll(async () => {
        const staff = await staffJwt();
        const guest = await token(GUEST);
        const date = addDays(await studioToday(), 2);
        const slots = (await rpc(staff, 'get_available_slots', { p_date: date })).data;
        const slot = slots.find((row) => row.end_time > row.start_time);
        const created = await rpc(staff, 'booking_staff_create', {
            p_guest: guest.id,
            p_room: slot.room_id,
            p_date: date,
            p_start: slot.start_time,
            p_end: slot.end_time,
            p_details: 'e2e: reminder to pay the deposit',
            p_status: 'approved',
        });
        booking = created.data;
        expect(booking?.id, JSON.stringify(created.data)).toBeTruthy();
        expect(booking.deposit_status).toBe('waiting');
    });

    test.afterAll(async () => {
        if (booking?.id) await rest(await staffJwt(), `bookings?id=eq.${booking.id}`, { method: 'DELETE' });
    });

    test('the guest gets a reminder once a day, with the QR one tap away', async ({ page }) => {
        await login(page, GUEST);
        await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('oops-pay-nudge')).forEach((key) => localStorage.removeItem(key)));
        await page.goto('/profile');

        const nudge = page.getByRole('status', { name: 'Payment reminder' });
        await expect(nudge).toContainText(/deposit/);
        await nudge.getByRole('button', { name: 'Later' }).click();
        await expect(nudge).toHaveCount(0);

        await page.reload();
        await expect(page.locator('.pfOverview')).toBeVisible();
        await page.waitForTimeout(2000); // longer than the reminder's delay
        await expect(page.getByRole('status', { name: 'Payment reminder' })).toHaveCount(0);
    });

    test('the bell and the menu say what to pay; paying opens the QR', async ({ page }) => {
        await login(page, GUEST);
        await expect(page.locator('.adminSidebar').getByRole('link', { name: /My Bookings/ }).locator('.navBadge')).toBeVisible();

        const bell = page.getByRole('button', { name: /Notifications: \d+ to pay or answer/ });
        await bell.click();
        const panel = page.locator('.duesPanel');
        await expect(panel).toContainText('Deposit for');
        await panel.locator('.duesPayBtn').first().click();
        await expect(page.getByRole('dialog')).toContainText('Pay by bank transfer');
    });

    test('nothing owed: the bell says so', async ({ page }) => {
        await login(page, 'instructor@demo.oopsdance.test');
        await page.getByRole('button', { name: 'Notifications: nothing to pay' }).click();
        await expect(page.locator('.duesPanel')).toContainText('All paid up. Thank you!');
    });
});
