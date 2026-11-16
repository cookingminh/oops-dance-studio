// What students and guests still have to pay is pushed to them: a bell in /profile with a QR button per
// item, a badge on the menu page, and once a day a friendly reminder in the corner ("Later" = not again
// today). The data: an approved booking still waiting for its deposit, two days ahead. The guest may owe more (the
// demo makes some tuition late at random), so the reminder is checked for a payment, the bell for the deposit.
// Paid elsewhere, the bell reads it again when opened, and a pay dialog opened from an older list shows it paid.
import { test, expect } from '@playwright/test';
import { addDays, login, rest, rpc, serviceKey, staffJwt, studioToday, token } from './support.js';

const GUEST = 'guest02@demo.oopsdance.test';
const shortDate = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));

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
        if (!booking?.id) return;
        const staff = await staffJwt();
        const key = await serviceKey().catch(() => null);
        for (const transfer of (await rest(staff, `bank_transfers?select=id&content=ilike.*${booking.payment_code}*`)).data ?? []) {
            if (key) await rest(key, `bank_transfers?id=eq.${transfer.id}`, { method: 'DELETE' });
        }
        await rest(staff, `bookings?id=eq.${booking.id}`, { method: 'DELETE' });
    });

    test('the guest gets a reminder once a day, with the QR one tap away', async ({ page }) => {
        await login(page, GUEST);
        await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('oops-pay-nudge')).forEach((key) => localStorage.removeItem(key)));
        await page.goto('/profile');

        // The most urgent thing to pay: the deposit, or a tuition the demo made late.
        const nudge = page.getByRole('status', { name: 'Payment reminder' });
        await expect(nudge.getByRole('button', { name: /^Pay / })).toBeVisible();
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

    test('paid elsewhere meanwhile: the bell reads it again, and a pay dialog opened from before says it is paid', async ({ page }) => {
        const guest = await token(GUEST);
        const staff = await staffJwt();
        const room = (await rest(staff, `rooms?select=name&id=eq.${booking.room_id}`)).data[0].name;
        const title = `Deposit for ${room} on ${shortDate(booking.date)}`;
        await login(page, GUEST);
        const bell = page.getByRole('button', { name: /^Notifications: / });
        const panel = page.locator('.duesPanel');
        const item = panel.locator('li', { hasText: title });
        await bell.click();
        await expect(item).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);

        // The deposit is paid on My bookings (another tab): opening the bell again reads it again.
        const deposit = await rpc(guest.jwt, 'booking_simulate_transfer', { p_booking: booking.id });
        expect(deposit.data?.status, JSON.stringify(deposit.data)).toBe('matched');
        await bell.click();
        await expect(item).toHaveCount(0);
        await page.keyboard.press('Escape');

        // Staff take that transfer back: the deposit is owed again and the bell shows it.
        expect((await rpc(staff, 'booking_unassign_transfer', { p_transfer: deposit.data.transfer_id })).status).toBeLessThan(300);
        await bell.click();
        await expect(item).toBeVisible();

        // With the bell open, everything is paid elsewhere; its pay button opens a dialog that reads the booking
        // again at once (not at the next 3-second check): paid, nothing to send.
        const all = await rpc(guest.jwt, 'booking_simulate_transfer', { p_booking: booking.id, p_amount: Number(booking.full_payment) });
        expect(all.data?.status, JSON.stringify(all.data)).toBe('matched');
        await item.locator('.duesPayBtn').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('Paid in full. Thank you!', { timeout: 2500 });
        await expect(dialog.getByRole('button', { name: 'Simulate the transfer' })).toHaveCount(0);
        // A pretend transfer from a dialog opened before is refused by the server too.
        const again = await rpc(guest.jwt, 'booking_simulate_transfer', { p_booking: booking.id, p_amount: Number(booking.full_payment) });
        expect(JSON.stringify(again.data)).toContain('nothing is left to pay');

        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await bell.click();
        await expect(panel).toBeVisible();
        await expect(item).toHaveCount(0);
    });

    test('nothing owed: the bell says so', async ({ page }) => {
        await login(page, 'instructor@demo.oopsdance.test');
        await page.getByRole('button', { name: 'Notifications: nothing new' }).click();
        await expect(page.locator('.duesPanel')).toContainText('All paid up. Thank you!');
    });
});
