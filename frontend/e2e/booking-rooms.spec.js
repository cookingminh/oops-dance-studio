// Rooms inside Bookings, and bookings paid in full (supabase/migrations/20261117001000_booking_auto_complete.sql):
// the old /admin/rooms leads to Bookings → "Rooms & prices" (no Rooms page in the menu); each room shows its
// price and how it is booked, the cancellation policy sits beside them; staff change a room's price and put
// it back; "See this room's calendar" shows the calendar of that room alone. A booking ahead paid in full is
// `completed` by itself: solid on the calendar with "Paid up", no "Mark completed", still cancellable — by the
// guest (the Cancel button in My bookings) and by the studio.
// Works on its own day far ahead, deletes its bookings afterwards and puts the room's price back.
import { test, expect } from '@playwright/test';
import { addDays, expectToast, login, rest, rooms, rpc, staffJwt, studioToday } from './support.js';

test.describe.configure({ mode: 'serial' });

const GUEST = 'guest@demo.oopsdance.test';
const GUEST_NAME = 'Nguyễn Thảo Vy';
const NOTE = 'E2E booking rooms';
const vnd = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

let page;
let guestPage;
let roomA;
let roomB;
let date;
let paidUp; // approved, then paid in full in cash → completed
let slotOf; // { start, end } of paidUp

const calendar = () => page.getByRole('region', { name: 'Bookings calendar' });
const details = () => page.locator('.bookingDetails');
const card = (room) => page.locator('.roomCard').filter({ has: page.getByRole('heading', { name: room.name }) });
const bookingNow = async (id) => (await rest(await staffJwt(), `bookings?select=status,refund_due,cancel_kind&id=eq.${id}`)).data[0];

async function cleanUp() {
    const jwt = await staffJwt();
    for (const row of (await rest(jwt, `bookings?select=id&details=eq.${encodeURIComponent(NOTE)}`)).data) {
        await rest(jwt, `bookings?id=eq.${row.id}`, { method: 'DELETE' }); // payment entries go with it
    }
}

// A free hour in Room B on our day (from the server's free slots), on the hour.
async function freeHour() {
    const slots = (await rpc(await staffJwt(), 'get_available_slots', { p_date: date })).data.filter((row) => row.room_id === roomB.id);
    for (const w of slots) {
        const from = w.start_time.slice(0, 5) < '10:00' ? '10:00' : w.start_time.slice(0, 5);
        const hour = Number(from.slice(0, 2)) + (from.slice(3) === '00' ? 0 : 1);
        const start = `${String(hour).padStart(2, '0')}:00`;
        const end = `${String(hour + 1).padStart(2, '0')}:00`;
        if (end <= w.end_time.slice(0, 5)) return { start, end };
    }
    throw new Error(`no free hour in ${roomB.name} on ${date}`);
}

test.beforeAll(async ({ browser }) => {
    [roomA, roomB] = await rooms();
    date = addDays(await studioToday(), 48);
    await cleanUp();
    const jwt = await staffJwt();
    const guest = (await rest(jwt, `profiles?select=id&email=eq.${GUEST}`)).data[0];
    slotOf = await freeHour();
    const created = await rpc(jwt, 'booking_staff_create', {
        p_guest: guest.id, p_room: roomB.id, p_date: date, p_start: slotOf.start, p_end: slotOf.end, p_details: NOTE, p_status: 'approved', p_paid: 0, p_method: 'cash',
    });
    expect(created.status, JSON.stringify(created.data)).toBe(200);
    paidUp = created.data;

    page = await (await browser.newContext()).newPage();
    page.on('dialog', (d) => d.accept());
    await login(page, 'staff@demo.oopsdance.test');
    guestPage = await (await browser.newContext()).newPage();
    await login(guestPage, GUEST);
});

test.afterAll(async () => {
    if (date) {
        await cleanUp();
        expect((await rest(await staffJwt(), `bookings?select=id&details=eq.${encodeURIComponent(NOTE)}`)).data).toEqual([]);
    }
    // The room's price, whatever happened in between.
    if (roomA) {
        const back = await rest(await staffJwt(), `rooms?id=eq.${roomA.id}`, { method: 'PATCH', body: { price: roomA.price } });
        expect(back.status).toBeLessThan(300);
    }
    for (const p of [page, guestPage]) await p?.context().close().catch(() => {});
});

test('the old Rooms page leads to Bookings → Rooms & prices; the menu has no Rooms item', async () => {
    await page.goto('/admin/rooms');
    await page.waitForURL((url) => url.pathname === '/admin/bookings' && url.searchParams.get('view') === 'rooms');
    await expect(page.getByRole('button', { name: 'Rooms & prices', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sideBar').getByText('Rooms', { exact: true })).toHaveCount(0);
    // The page's description now covers the prices and the policy.
    await expect(page.getByText('Requests, payments, room prices and the cancellation policy.')).toBeVisible();
});

test('each room shows its price and how it is booked; the cancellation policy sits beside them', async () => {
    await expect(page.locator('.roomCard')).toHaveCount((await rooms()).length);
    for (const room of [roomA, roomB]) {
        await expect(card(room).locator('.roomPrice')).toContainText(vnd(room.price));
        await expect(card(room).locator('.roomFacts')).toContainText('This week');
        await expect(card(room).locator('.roomFacts')).toContainText('Revenue this month');
        await expect(card(room).getByRole('button', { name: 'See this room’s calendar' })).toBeVisible();
    }
    const policy = page.locator('.bkPolicyCard');
    await expect(policy).toContainText('Cancellation policy');
    await expect(policy).toContainText('Cancel 24 hours or more ahead: 50% back');
    // Staff read it; only admins edit it.
    await expect(policy).toContainText('Only an admin can change the policy.');
    // The filters belong to the calendar and the table, not to the rooms.
    await expect(page.getByRole('group', { name: 'Room' })).toHaveCount(0);
});

test('staff change a room’s hourly price and put it back', async () => {
    const raised = Number(roomA.price) + 10000;
    for (const price of [raised, Number(roomA.price)]) {
        await card(roomA).getByRole('button', { name: `Edit ${roomA.name}` }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Price per hour (VND)').fill(String(price));
        await dialog.getByRole('button', { name: 'Update Room' }).click();
        await expectToast(page, 'Room updated.');
        await expect(dialog).toHaveCount(0);
        await expect(card(roomA).locator('.roomPrice')).toContainText(vnd(price));
        await expect.poll(async () => Number((await rest(null, `rooms?select=price&id=eq.${roomA.id}`)).data[0].price)).toBe(price);
    }
});

test('"See this room’s calendar" shows the calendar of that room alone', async () => {
    await card(roomB).getByRole('button', { name: 'See this room’s calendar' }).click();
    await expect(calendar()).toBeVisible();
    expect(new URL(page.url()).searchParams.get('view')).toBeNull(); // the week calendar
    await expect(page.getByRole('group', { name: 'Room' }).getByRole('button', { name: new RegExp(roomB.name) })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // One room: no lane per room.
    await expect(calendar().locator('.calLane')).toHaveCount(0);
    await expect(calendar().locator('.calWeekHead .calDayHead.isToday')).toHaveCount(1);
});

test('a booking ahead paid in full is completed by itself: solid with "Paid up", no "Mark completed"', async () => {
    const paid = await rpc(await staffJwt(), 'booking_record_payment', { p_booking: paidUp.id, p_amount: Number(paidUp.full_payment), p_method: 'cash', p_note: NOTE });
    expect(paid.status, JSON.stringify(paid.data)).toBe(200);
    expect((await bookingNow(paidUp.id)).status).toBe('completed');

    await page.goto(`/admin/bookings?booking=${paidUp.id}`);
    await expect(details()).toContainText(`Booking #${paidUp.id}`);
    await expect(details().locator('.bdHeader')).toContainText('completed');
    await expect(details().locator('.bkPaidUp')).toHaveText('Paid up');
    const footer = details().locator('.bdFooter');
    await expect(footer.getByRole('button', { name: 'Cancel booking' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Mark completed' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(details()).toHaveCount(0);

    // Its week is behind the dialog: the block is solid (not muted like a past completed one), badged.
    const block = calendar().getByRole('button', { name: new RegExp(`${slotOf.start}–${slotOf.end} ${GUEST_NAME}`) });
    await expect(block).toHaveClass(/status-completed/);
    await expect(block).toHaveClass(/tone-solid/);
    await expect(block).toContainText('Paid up');
});

test('the guest still sees it ahead and can cancel it (the dialog quotes the policy)', async () => {
    await guestPage.goto('/profile/my-bookings');
    const row = guestPage.getByRole('row').filter({ hasText: `#${paidUp.id}` });
    await expect(row).toContainText('completed');
    await row.getByRole('button', { name: 'Cancel', exact: true }).click();
    const dialog = guestPage.locator('.rfCancelModal');
    await expect(dialog.locator('.rfHero')).toContainText('Cancel 24 hours or more ahead: 50% back');
    await expect(dialog.locator('.rfHero')).toContainText(`(you paid ${vnd(paidUp.full_payment)})`);
    await dialog.getByRole('button', { name: 'Keep the booking' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await bookingNow(paidUp.id)).status).toBe('completed');
});

test('staff cancel it as the studio: everything goes back', async () => {
    await page.goto(`/admin/bookings?booking=${paidUp.id}`);
    await details().locator('.bdFooter').getByRole('button', { name: 'Cancel booking' }).click();
    const cancel = page.locator('.scCancelDialog');
    await cancel.getByRole('button', { name: /^Studio cancels/ }).click();
    await expect(cancel.getByLabel('Refund (VND)')).toHaveValue(String(Number(paidUp.full_payment)));
    await cancel.getByRole('button', { name: 'Cancel booking' }).click();
    await expectToast(page, 'is now cancelled');
    expect(await bookingNow(paidUp.id)).toMatchObject({ status: 'cancelled', cancel_kind: 'studio', refund_due: Number(paidUp.full_payment) });
});
