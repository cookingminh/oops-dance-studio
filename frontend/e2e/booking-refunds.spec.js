// Booking cancellations and refunds (supabase/migrations/20261117000800_booking_refunds.sql): the booking
// form shows the cancellation policy; a guest cancels an approved booking ahead (the dialog quotes half
// back, the row then says the studio will refund it, to the account they gave); staff see it on the to-do,
// open the booking and record the refund (the guest's row then says refunded); staff cancel a booking as
// the studio (everything back; another amount waits for a reason); the admin changes the policy and puts
// the defaults back, staff only read it.
// Works on its own day far ahead, deletes its bookings afterwards and resets the policy to the defaults.
import { test, expect } from '@playwright/test';
import { addDays, expectToast, login, rest, rpc, searchRooms, staffJwt, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const GUEST = 'guest@demo.oopsdance.test';
const GUEST_NAME = 'Nguyễn Thảo Vy';
const OTHER_GUEST = 'guest02@demo.oopsdance.test';
const NOTE = 'E2E booking refunds';
const ACCOUNT = 'E2E Bank 0123456789 Nguyen Thao Vy';
const vnd = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

let guestPage;
let staffPage;
let adminPage;
let date;
let guestBooking; // approved, 125.000 paid by transfer → the guest cancels it (50 % back)
let studioBooking; // approved, fully paid in cash → staff cancel it as the studio (everything back)
let freeHour; // { start, end } free in some room that day, for the booking form

const adminJwt = async () => (await token('admin@demo.oopsdance.test')).jwt;
const resetPolicy = async () => rpc(await adminJwt(), 'booking_set_refund_policy', { p_full_hours: null, p_partial_hours: 24, p_partial_percent: 50 });
const policyNow = async () => (await rest(null, 'booking_settings?select=refund_full_hours,refund_partial_hours,refund_partial_percent')).data[0];
const bookingNow = async (id) =>
    (await rest(await staffJwt(), `bookings?select=status,cancel_kind,refund_due,refund_paid,refund_to,refund_note,real_income,bank_transfer,cash&id=eq.${id}`)).data[0];

// A free window of `hours` in `room` on our day (from the server's free slots), at :00.
async function slot(room, hours, after = '08:00') {
    const slots = (await rpc(await staffJwt(), 'get_available_slots', { p_date: date })).data;
    for (const w of slots.filter((row) => !room || row.room_id === room)) {
        const from = w.start_time.slice(0, 5) < after ? after : w.start_time.slice(0, 5);
        const startHour = Number(from.slice(0, 2)) + (from.slice(3) === '00' ? 0 : 1);
        const start = `${String(startHour).padStart(2, '0')}:00`;
        const end = `${String(startHour + hours).padStart(2, '0')}:00`;
        if (end <= w.end_time.slice(0, 5)) return { room: w.room_id, start, end };
    }
    throw new Error(`no free ${hours} h on ${date}`);
}

async function create(email, { room, start, end }, paid, method) {
    const jwt = await staffJwt();
    const guest = (await rest(jwt, `profiles?select=id&email=eq.${email}`)).data[0];
    const res = await rpc(jwt, 'booking_staff_create', {
        p_guest: guest.id, p_room: room, p_date: date, p_start: start, p_end: end, p_details: NOTE, p_status: 'approved', p_paid: paid, p_method: method,
    });
    expect(res.status, JSON.stringify(res.data)).toBe(200);
    return res.data;
}

async function cleanUp() {
    const jwt = await staffJwt();
    for (const row of (await rest(jwt, `bookings?select=id&details=eq.${encodeURIComponent(NOTE)}`)).data) {
        await rest(jwt, `bookings?id=eq.${row.id}`, { method: 'DELETE' }); // payment entries go with it
    }
}

test.beforeAll(async ({ browser }) => {
    date = addDays(await studioToday(), 34);
    await cleanUp();
    await resetPolicy();
    // Phòng A for an hour: 250.000, deposit 125.000 paid → the policy gives 62.500 back.
    guestBooking = await create(GUEST, await slot(1, 1, '09:00'), 125000, 'transfer');
    // Any room for an hour, its full price paid in cash.
    studioBooking = await create(OTHER_GUEST, await slot(null, 1, '12:00'), 0, 'cash');
    const paid = await rpc(await staffJwt(), 'booking_record_payment', { p_booking: studioBooking.id, p_amount: Number(studioBooking.full_payment), p_method: 'cash', p_note: NOTE });
    expect(paid.status, JSON.stringify(paid.data)).toBe(200);
    freeHour = await slot(null, 1, '17:00');

    guestPage = await (await browser.newContext()).newPage();
    guestPage.on('dialog', (d) => d.accept());
    await login(guestPage, GUEST);
    staffPage = await (await browser.newContext()).newPage();
    staffPage.on('dialog', (d) => d.accept());
    await login(staffPage, 'staff@demo.oopsdance.test');
    adminPage = await (await browser.newContext()).newPage();
    await login(adminPage, 'admin@demo.oopsdance.test');
});

test.afterAll(async () => {
    if (date) {
        await cleanUp();
        expect((await resetPolicy()).status).toBe(200);
        expect((await rest(await staffJwt(), `bookings?select=id&details=eq.${encodeURIComponent(NOTE)}`)).data).toEqual([]);
    }
    for (const page of [guestPage, staffPage, adminPage]) await page?.context().close().catch(() => {});
});

test('the booking form shows the cancellation policy before confirming', async () => {
    const page = guestPage;
    await page.goto('/rooms');
    const search = await searchRooms(page, date, freeHour.start, freeHour.end);
    await search.getByRole('button', { name: 'Book Now' }).first().click();
    const policy = page.getByRole('group', { name: 'Cancellation policy' });
    await expect(policy).toContainText('Cancel 24 hours or more ahead: 50% back');
    await policy.getByRole('button', { name: 'Details' }).click();
    await expect(policy).toContainText('Less than 24 hours ahead: no refund');
    await expect(policy).toContainText('Not approved yet, or cancelled by the studio: full refund');
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
});

test('a guest cancels an approved booking ahead: the dialog quotes half back, then the row says the studio will refund it', async () => {
    const page = guestPage;
    await page.goto('/profile/my-bookings');
    const row = page.getByRole('row').filter({ hasText: `#${guestBooking.id}` });
    await row.getByRole('button', { name: 'Cancel', exact: true }).click();

    const dialog = page.locator('.rfCancelModal');
    await expect(dialog).toContainText('Cancel this booking?');
    await expect(dialog.locator('.rfHero')).toContainText('Cancel 24 hours or more ahead: 50% back');
    await expect(dialog.locator('.rfHero')).toContainText(`You get ${vnd(62500)} back`);
    await expect(dialog.locator('.rfHero')).toContainText(`(you paid ${vnd(125000)})`);
    await expect(dialog.locator('.rfPolicy .isCurrent')).toContainText('Applies now');
    // "Keep the booking" is the default.
    await expect(dialog.getByRole('button', { name: 'Keep the booking' })).toBeFocused();
    await dialog.getByLabel('Send the refund to').fill(ACCOUNT);
    await dialog.getByRole('button', { name: 'Cancel the booking' }).click();
    await expectToast(page, 'Booking cancelled.');

    await expect(row).toContainText(`The studio will refund ${vnd(62500)} to ${ACCOUNT}`);
    await expect(row).toContainText('Refund due');
    await expect(row.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
    expect(await bookingNow(guestBooking.id)).toMatchObject({ status: 'cancelled', cancel_kind: 'guest', refund_due: 62500, refund_to: ACCOUNT, real_income: 62500 });
});

test('staff see the refund on the to-do, open the booking and record it; the guest’s row says refunded', async () => {
    const page = staffPage;
    await page.goto('/admin/bookings');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    const todo = page.locator('.taskItem').filter({ hasText: `Refund ${vnd(62500)} to ${GUEST_NAME}` });
    await expect(todo).toBeVisible();
    await todo.click();
    await expect(page).toHaveURL(new RegExp(`/admin/bookings\\?booking=${guestBooking.id}$`));

    const block = page.locator('.bookingDetails .rbBlock');
    await expect(block).toContainText('Cancelled by the guest');
    await expect(block.locator('.bdDueAmount')).toHaveText(vnd(62500));
    await expect(block).toContainText(`Send to: ${ACCOUNT}`);
    await expect(block).toContainText(`Studio keeps ${vnd(62500)}`);
    await expect(page.locator('.bookingDetails .bdPill')).toHaveText('Refund due');
    await block.getByRole('button', { name: 'Refunded by transfer' }).click();
    await expectToast(page, 'Refund recorded.');
    await expect(block).toContainText(`Refunded ${vnd(62500)}`);
    await expect(block.getByRole('button', { name: 'Refunded by transfer' })).toHaveCount(0);
    await expect(page.locator('.bookingDetails .bdHistory li.isRefund')).toContainText('Refund after cancellation');
    expect(await bookingNow(guestBooking.id)).toMatchObject({ refund_due: 0, refund_paid: 62500, bank_transfer: 62500, real_income: 62500 });

    await guestPage.goto('/profile/my-bookings');
    const row = guestPage.getByRole('row').filter({ hasText: `#${guestBooking.id}` });
    await expect(row).toContainText(`Refunded ${vnd(62500)}`);
    await expect(row).not.toContainText('The studio will refund');
});

test('staff cancel a booking as the studio: everything goes back; another amount waits for a reason', async () => {
    const page = staffPage;
    const paid = Number(studioBooking.full_payment);
    await page.goto(`/admin/bookings?booking=${studioBooking.id}`);
    await page.locator('.bookingDetails .bdFooter').getByRole('button', { name: 'Cancel booking' }).click();

    const dialog = page.locator('.scCancelDialog');
    await expect(dialog.locator('.scQuote')).toContainText(vnd(paid));
    // The guest asked: the policy gives half back.
    await expect(dialog.locator('.scQuote .isStep')).toContainText(vnd(paid / 2));
    await dialog.getByRole('button', { name: /^Studio cancels/ }).click();
    await expect(dialog.getByRole('button', { name: /^Studio cancels/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.locator('.scQuote .isStep')).toContainText('Cancelled by the studio: full refund');
    const amount = dialog.getByLabel('Refund (VND)');
    await expect(amount).toHaveValue(String(paid));

    // Another amount: the button waits for a reason; back to the policy's amount, it doesn't.
    const confirm = dialog.getByRole('button', { name: 'Cancel booking' });
    await amount.fill('10000');
    await expect(confirm).toBeDisabled();
    await expect(dialog).toContainText('Needed because the amount differs from the policy.');
    await dialog.getByRole('button', { name: `Back to ${vnd(paid)}` }).click();
    await expect(amount).toHaveValue(String(paid));
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expectToast(page, 'is now cancelled');
    await expect(dialog).toHaveCount(0);

    const block = page.locator('.bookingDetails .rbBlock');
    await expect(block).toContainText('Cancelled by the studio');
    await expect(block.locator('.bdDueAmount')).toHaveText(vnd(paid));
    await expect(block).toContainText('No account given: contact the guest.');
    expect(await bookingNow(studioBooking.id)).toMatchObject({ status: 'cancelled', cancel_kind: 'studio', refund_due: paid, real_income: 0 });

    // Changing the refund afterwards needs a reason too.
    await block.getByRole('button', { name: 'Change the refund' }).click();
    const change = page.locator('.bdMoneyDialog').filter({ hasText: 'Change the refund' });
    await change.getByLabel('Refund (VND)').fill(String(paid / 2));
    await expect(change.getByRole('button', { name: 'Save refund' })).toBeDisabled();
    await change.getByRole('button', { name: 'Moved to another booking' }).click();
    await change.getByRole('button', { name: 'Save refund' }).click();
    await expectToast(page, 'Refund changed.');
    await expect(block.locator('.bdDueAmount')).toHaveText(vnd(paid / 2));
    expect(await bookingNow(studioBooking.id)).toMatchObject({ refund_due: paid / 2, refund_note: 'Moved to another booking', real_income: paid / 2 });

    // The list's "To refund" filter has it.
    await page.goto('/admin/bookings?view=list&refunds=1');
    await expect(page.getByRole('button', { name: /^To refund/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('row').filter({ hasText: `#${studioBooking.id}` })).toContainText(`To refund ${vnd(paid / 2)}`);
});

test('the admin changes the policy and puts the defaults back; staff only read it', async () => {
    const page = adminPage;
    await page.goto('/admin/bookings');
    await page.getByRole('button', { name: 'Cancellation policy' }).click();
    const dialog = page.locator('.rpDialog');
    await dialog.getByText('Full refund when cancelled early').click();
    await dialog.getByLabel('Hours ahead').first().fill('72');
    await dialog.getByLabel('Refund (%)').fill('30');
    const preview = dialog.getByRole('region', { name: 'Guests see' });
    await expect(preview).toContainText('Cancel 72 hours or more ahead: full refund');
    await expect(preview).toContainText('Cancel 24 hours or more ahead: 30% back');
    // The full step must come before the partial one.
    await dialog.getByLabel('Hours ahead').first().fill('12');
    await expect(dialog).toContainText('The full refund needs more hours than the partial one.');
    await expect(dialog.getByRole('button', { name: 'Save policy' })).toBeDisabled();
    await dialog.getByLabel('Hours ahead').first().fill('72');
    await dialog.getByRole('button', { name: 'Save policy' }).click();
    await expectToast(page, 'Cancellation policy saved.');
    await expect(dialog).toHaveCount(0);
    await expect.poll(policyNow).toEqual({ refund_full_hours: 72, refund_partial_hours: 24, refund_partial_percent: 30 });

    // Staff read it, without a way to change it.
    await staffPage.goto('/admin/bookings?policy=1');
    const readOnly = staffPage.locator('.rpDialog');
    await expect(readOnly).toContainText('Cancel 72 hours or more ahead: full refund');
    await expect(readOnly).toContainText('Only an admin can change the policy.');
    await expect(readOnly.getByRole('button', { name: 'Save policy' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancellation policy' }).click();
    await dialog.getByRole('button', { name: 'Back to the default (24 hours, 50%)' }).click();
    await expect(dialog.getByRole('region', { name: 'Guests see' })).not.toContainText('Cancel 72 hours or more ahead');
    await dialog.getByRole('button', { name: 'Save policy' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(policyNow).toEqual({ refund_full_hours: null, refund_partial_hours: 24, refund_partial_percent: 50 });
});
