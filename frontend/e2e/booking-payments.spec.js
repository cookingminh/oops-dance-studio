// Money on a room booking (supabase/migrations/20261117000500_booking_payments.sql): the dialog opened by
// ?booking=<id>, "Still to pay" with its QR (amount + code), a simulated bank transfer, "Received … in
// cash" and removing that entry, a refund with its reason, a price change with its reason (summary and
// receipt), the "still unpaid" prompt before completing, taking a transfer back and assigning it again
// from the tuition inbox by its code, the guest paying from My bookings, the new booking form (deposit in
// cash / nothing yet → QR / another price), and the "Owes money" list.
// Works on its own day far ahead, deletes its bookings and their transfers afterwards.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, expectToast, isoWeekday, login, pickOption, rest, rooms, rpc, staffJwt, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const GUEST = 'guest@demo.oopsdance.test';
const GUEST_NAME = 'Nguyễn Thảo Vy';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const vnd = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const QR_STUB = (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });

// Staff can't delete bank transfers (no RLS policy for it): the local service role can.
let serviceKeyCache;
function serviceKey() {
    if (serviceKeyCache !== undefined) return serviceKeyCache;
    serviceKeyCache = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
    if (!serviceKeyCache) {
        try {
            const env = execFileSync('supabase', ['status', '-o', 'env'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            serviceKeyCache = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m)?.[1] ?? null;
        } catch {
            serviceKeyCache = null;
        }
    }
    return serviceKeyCache;
}

let page;
let roomA;
let date;
let staffName;
let booking; // { id, payment_code, deposit, full_payment, list_price }
let transferId;

const content = () => `${booking.payment_code} dat phong ${date.slice(8, 10)}/${date.slice(5, 7)}`;
const details = () => page.locator('.bookingDetails');
const pay = () => details().locator('.bdPay');
const payDialog = () => page.locator('.bkPayModal');
const moneyDialog = () => page.locator('.bdMoneyDialog');
const bookingNow = async () =>
    (await rest(await staffJwt(), `bookings?select=status,bank_transfer,cash,real_income,deposit,deposit_status,full_payment,list_price,price_note&id=eq.${booking.id}`)).data[0];

async function closeDialogs(target = page) {
    while (await target.getByRole('dialog').count()) {
        await target.keyboard.press('Escape');
        await target.waitForTimeout(250);
    }
}

// Every booking of Room A on our day, and every transfer carrying one of their codes: gone.
async function cleanUp() {
    const jwt = await staffJwt();
    const leftovers = (await rest(jwt, `bookings?select=id,payment_code&date=eq.${date}&room_id=eq.${roomA.id}`)).data;
    const key = serviceKey();
    for (const row of leftovers) {
        for (const transfer of (await rest(jwt, `bank_transfers?select=id&content=ilike.*${row.payment_code}*`)).data) {
            const gone = key ? (await rest(key, `bank_transfers?id=eq.${transfer.id}`, { method: 'DELETE', prefer: 'return=representation' })).data : [];
            if (!Array.isArray(gone) || gone.length === 0) console.warn(`booking-payments: transfer #${transfer.id} is left in the inbox (no service role key).`);
        }
        await rest(jwt, `bookings?id=eq.${row.id}`, { method: 'DELETE' }); // payment entries go with it
    }
}

test.beforeAll(async ({ browser }) => {
    [roomA] = await rooms();
    const jwt = await staffJwt();
    const today = await studioToday();
    const guest = (await rest(jwt, `profiles?select=id&email=eq.${GUEST}`)).data[0];
    staffName = (await rest(jwt, 'profiles?select=full_name&email=eq.staff@demo.oopsdance.test')).data[0].full_name;
    // A day far ahead whose Room A has no class from 10:00 to 15:00.
    const slots = (await rest(jwt, 'class_schedules?select=day_of_week,start_time,end_time,class:classes!class_id(room_id)')).data.filter((slot) => slot.class?.room_id === roomA.id);
    let offset = 55;
    while (slots.some((slot) => slot.day_of_week === isoWeekday(addDays(today, offset)) && slot.start_time < '15:00' && slot.end_time > '10:00')) offset += 1;
    date = addDays(today, offset);
    await cleanUp();

    const created = await rpc(jwt, 'create_booking', { p_room_id: roomA.id, p_date: date, p_start: '10:00', p_end: '12:00', p_details: 'E2E booking payments', p_guest_id: guest.id });
    expect(created.status, JSON.stringify(created.data)).toBe(200);
    booking = created.data;
    expect(Number(booking.deposit)).toBeGreaterThan(0);

    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    await page.route('**/img.vietqr.io/**', QR_STUB);
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close();
    if (!date) return;
    await cleanUp();
    expect((await rest(await staffJwt(), `bookings?select=id&date=eq.${date}&room_id=eq.${roomA.id}`)).data).toEqual([]);
});

test('?booking=<id> opens the booking on its week; still to pay = the price, the deposit first, with its QR and code', async () => {
    await page.goto(`/admin/bookings?booking=${booking.id}`);
    await expect(details()).toContainText(`Booking #${booking.id}`);
    await expect(details().locator('.bdCode')).toHaveText(booking.payment_code);
    await expect(page.locator(`.calDay[data-date="${date}"]`)).toHaveCount(1); // its week behind the dialog
    await expect(pay().locator('.bdPill')).toHaveText('Deposit due');
    // Still to pay is the whole price; the deposit is what to pay first (and the default pick).
    await expect(pay().locator('.bdDueAmount')).toHaveText(vnd(booking.full_payment));
    await expect(pay().locator('.bdDepositLine')).toContainText(`Deposit to pay first: ${vnd(booking.deposit)} (50%)`);
    await expect(pay().locator('.bdMatchLine')).toContainText(content());

    await pay().getByRole('button', { name: `Show QR for ${vnd(booking.deposit)}` }).click();
    const qr = payDialog().locator('.tuQrFrame img');
    await expect(qr).toHaveAttribute('src', new RegExp(`amount=${Number(booking.deposit)}&`));
    await expect(qr).toHaveAttribute('src', new RegExp(`addInfo=${booking.payment_code}`));
    await expect(payDialog().locator('.tuCopyRow.isKey')).toContainText(content());
    await payDialog().getByRole('button', { name: /^Full amount/ }).click();
    await expect(payDialog().locator('.tuQrAmount')).toHaveText(vnd(booking.full_payment));
    await payDialog().getByRole('button', { name: /^Deposit/ }).click();
});

test('a simulated transfer pays the deposit; the history shows the transfer content', async () => {
    await payDialog().getByRole('button', { name: 'Simulate the transfer' }).click();
    await expectToast(page, 'Transfer received. Thank you!');
    await expect(payDialog().locator('.tuQrAmount')).toHaveText(vnd(booking.full_payment - booking.deposit));
    await payDialog().locator('.tuPayFoot').getByRole('button', { name: 'Close' }).click();
    await expect(payDialog()).toHaveCount(0);

    await expect(pay().locator('.bdPill')).toHaveText('Deposit paid');
    await expect(pay().locator('.bdDueAmount')).toHaveText(vnd(booking.full_payment - booking.deposit));
    await expect(pay().locator('.bdDepositLine')).toContainText('Deposit paid');
    const line = pay().locator('.bdHistory li[data-transfer]').first();
    await expect(line).toContainText(content());
    expect(await bookingNow()).toMatchObject({ bank_transfer: Number(booking.deposit), deposit_status: 'completed' });
    transferId = Number(await line.getAttribute('data-transfer'));
});

test('"Received … in cash" settles the balance: fully paid, a cash line by the staff member, receipt balance 0', async () => {
    const balance = booking.full_payment - booking.deposit;
    await pay().getByRole('button', { name: `Received ${vnd(balance)} in cash` }).click();
    await expect(moneyDialog().getByLabel('Amount received (VND)')).toHaveValue(String(balance));
    await moneyDialog().getByRole('button', { name: 'Confirm' }).click();
    await expectToast(page, 'Payment recorded.');
    await expect(pay().locator('.bdDueHero.isPaid')).toContainText('Fully paid');
    await expect(pay().locator('.bdPill')).toHaveText('Fully paid');
    const cashLine = pay().locator('.bdHistory li[data-payment^="entry-"]');
    await expect(cashLine).toContainText('Cash');
    await expect(cashLine).toContainText(`recorded by ${staffName}`);
    expect(await bookingNow()).toMatchObject({ cash: balance, real_income: Number(booking.full_payment) });

    await pay().getByRole('button', { name: 'See the receipt' }).click();
    const receipt = page.locator('.bkReceipt');
    await expect(receipt).toContainText(`Room hire · ${roomA.name}`);
    await expect(receipt).toContainText(GUEST_NAME);
    await expect(receipt).toContainText(content());
    await expect(receipt.locator('tr', { hasText: 'Paid so far' })).toContainText(vnd(booking.full_payment));
    await expect(receipt.locator('tr', { hasText: 'Balance due' })).toContainText(vnd(0));
    await page.locator('.bkReceiptActions').getByRole('button', { name: 'Close' }).click();
});

test('removing the cash entry makes the balance due again', async () => {
    await pay().locator('.bdHistory li[data-payment^="entry-"]').getByRole('button', { name: /^Remove/ }).click();
    await expectToast(page, 'Payment entry removed.');
    await expect(pay().locator('.bdDueAmount')).toHaveText(vnd(booking.full_payment - booking.deposit));
    expect(await bookingNow()).toMatchObject({ cash: 0, bank_transfer: Number(booking.deposit) });
});

test('a refund needs its reason; it lowers what was received (then it is removed again)', async () => {
    await pay().getByRole('button', { name: 'Record payment' }).click();
    await moneyDialog().getByRole('button', { name: 'Refund', exact: true }).click();
    await moneyDialog().getByRole('button', { name: 'Bank transfer', exact: true }).click();
    await moneyDialog().getByLabel('Amount given back (VND)').fill('50000');
    await expect(moneyDialog().getByRole('button', { name: 'Record refund' })).toBeDisabled();
    await moneyDialog().getByLabel('Why it goes back').fill('E2E overpaid');
    await moneyDialog().getByRole('button', { name: 'Record refund' }).click();
    await expectToast(page, 'Refund recorded.');
    const refund = pay().locator('.bdHistory li.isRefund');
    await expect(refund).toContainText('Refund');
    await expect(refund).toContainText('E2E overpaid');
    expect(await bookingNow()).toMatchObject({ bank_transfer: Number(booking.deposit) - 50000 });

    await refund.getByRole('button', { name: /^Remove/ }).click();
    await expectToast(page, 'Payment entry removed.');
    expect(await bookingNow()).toMatchObject({ bank_transfer: Number(booking.deposit) });
});

test('completing a booking with money still due asks first', async () => {
    await details().getByRole('button', { name: 'Mark completed' }).click();
    const prompt = page.locator('.bdCompleteDialog');
    await expect(prompt).toContainText(`${vnd(booking.full_payment - booking.deposit)} still unpaid`);
    await expect(prompt.getByRole('button', { name: /in cash$/ })).toBeVisible();
    await expect(prompt.getByRole('button', { name: /by transfer$/ })).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'Complete anyway' })).toBeVisible();
    await prompt.getByRole('button', { name: 'Cancel' }).click();
    expect((await bookingNow()).status).toBe('approved');
});

test('changing the price needs a reason; the summary and the receipt read list → reason → total', async () => {
    const list = Number(booking.list_price ?? booking.full_payment);
    const agreed = Math.round((list * 0.9) / 1000) * 1000;
    await pay().getByRole('button', { name: 'Change price' }).click();
    await moneyDialog().getByLabel('New total (VND)').fill(String(agreed));
    await expect(moneyDialog().getByRole('button', { name: 'Save price' })).toBeDisabled();
    await moneyDialog().getByRole('button', { name: 'Regular customer −10%' }).click();
    await moneyDialog().getByRole('button', { name: 'Save price' }).click();
    await expectToast(page, 'Price changed.');
    await expect(pay().locator('.bdPayLines .isList')).toContainText('List price');
    await expect(pay().locator('.bdPayLines .isList dd')).toHaveText(vnd(list));
    await expect(pay().locator('.bdPriceNote')).toContainText('Regular customer −10%');
    await expect(pay().locator('.bdPriceNote')).toContainText(vnd(list - agreed));
    await expect(pay().locator('.bdPayLines .isTotal')).toContainText(vnd(agreed));
    expect(await bookingNow()).toMatchObject({ full_payment: agreed, price_note: 'Regular customer −10%' });

    await pay().getByRole('button', { name: 'Receipt' }).click();
    const receipt = page.locator('.bkReceipt');
    await expect(receipt.locator('.bkChange')).toContainText('Regular customer −10%');
    await expect(receipt.locator('tr', { hasText: 'Total' }).first()).toContainText(vnd(agreed));
    await page.locator('.bkReceiptActions').getByRole('button', { name: 'Close' }).click();

    // Back to the list price (no reason needed).
    await pay().getByRole('button', { name: 'Change price' }).click();
    await moneyDialog().getByRole('button', { name: 'Back to the list price' }).click();
    await moneyDialog().getByRole('button', { name: 'Save price' }).click();
    await expectToast(page, 'Price changed.');
    expect(await bookingNow()).toMatchObject({ full_payment: list, price_note: null });
});

test('Take back puts the transfer back in the inbox; the deposit is due again', async () => {
    await pay().locator('.bdHistory li[data-transfer]').getByRole('button', { name: /^Take back/ }).click();
    await expectToast(page, 'Transfer taken back');
    await expect(pay().locator('.bdPill')).toHaveText('Deposit due');
    expect(await bookingNow()).toMatchObject({ bank_transfer: 0, deposit_status: 'waiting' });
    const transfer = (await rest(await staffJwt(), `bank_transfers?select=status,booking_id,note&id=eq.${transferId}`)).data[0];
    expect(transfer).toMatchObject({ status: 'unmatched', booking_id: null, note: 'Taken back by staff.' });
});

test('the tuition inbox puts the transfer on the booking by its code, and takes it back', async () => {
    await page.goto('/admin/tuition');
    const card = page.locator(`.tuTransfer[data-transfer="${transferId}"]`);
    await expect(card).toContainText(content());
    await card.getByRole('button', { name: 'Assign to a booking' }).click();
    const assign = page.locator('.tuBookingAssign');
    await expect(assign.getByLabel('Booking number or code')).toHaveValue(booking.payment_code);
    await assign.getByRole('button', { name: 'Find', exact: true }).click();
    await expect(assign.locator('.tuBookingCard')).toContainText(`Booking #${booking.id} · ${GUEST_NAME}`);
    await assign.getByRole('button', { name: `Assign ${vnd(booking.deposit)} to booking #${booking.id}` }).click();
    await expectToast(page, `assigned to booking #${booking.id}.`);
    await expect(card).toHaveCount(0);
    expect(await bookingNow()).toMatchObject({ bank_transfer: Number(booking.deposit), deposit_status: 'completed' });

    // Matched transfers are in the tuition page's transfer history.
    await page.getByRole('button', { name: 'Transfer history' }).click();
    await page.locator('#tuition-history .tuTabs').getByRole('button', { name: /^Matched/ }).click();
    const row = page.locator(`#tuition-history [data-transfer="${transferId}"]`);
    await expect(row).toContainText(`Booking #${booking.id} · ${GUEST_NAME}`);
    await row.getByRole('button', { name: /^Take back/ }).click();
    await expectToast(page, 'Transfer taken back');
    expect(await bookingNow()).toMatchObject({ bank_transfer: 0, deposit_status: 'waiting' });
});

test('the guest pays the deposit from My bookings', async ({ browser }) => {
    const guestPage = await browser.newPage();
    await guestPage.route('**/img.vietqr.io/**', QR_STUB);
    try {
        await login(guestPage, GUEST);
        await guestPage.goto('/profile/my-bookings');
        const row = guestPage.getByRole('row').filter({ hasText: `#${booking.id}` });
        await expect(row.locator('.payState')).toHaveText('Deposit due');
        await row.getByRole('button', { name: `Pay deposit · #${booking.id}` }).click();
        const dialog = guestPage.locator('.bkPayModal');
        await expect(dialog.locator('.tuCopyRow.isKey')).toContainText(content());
        await dialog.getByRole('button', { name: 'Simulate the transfer' }).click();
        await expectToast(guestPage, 'Transfer received. Thank you!');
        await dialog.locator('.tuPayFoot').getByRole('button', { name: 'Close' }).click();
        await expect(row.locator('.payState')).toHaveText('Deposit paid');
        await row.getByRole('button', { name: `Receipt for booking #${booking.id}` }).click();
        await expect(guestPage.locator('.bkReceipt')).toContainText(content());
    } finally {
        await guestPage.close();
    }
    expect(await bookingNow()).toMatchObject({ bank_transfer: Number(booking.deposit), deposit_status: 'completed' });
    const me = await token(GUEST);
    const payments = await rpc(me.jwt, 'booking_payments', { p_booking: booking.id });
    expect(payments.data.map((row) => row.content)).toContain(content());
});

// The new booking form: the guest, room, day and times of a free Room A hour.
async function startNewBooking(start, end) {
    await page.goto(`/admin/bookings?date=${date}`);
    await page.getByRole('button', { name: 'New booking' }).click();
    const form = page.locator('.bookingForm');
    await form.getByLabel('Guest').fill('Thảo Vy');
    await page.getByRole('option').first().click();
    await pickOption(page, form, 'Room', roomA.name);
    await form.getByLabel('Date').fill(date);
    await pickOption(page, form, 'Start', start);
    await pickOption(page, form, 'End', end);
    await expect(form.locator('.bfPriceLine')).toContainText(roomA.name);
    return form;
}

test('new booking with the deposit taken in cash: opens on its summary, deposit paid, a cash line', async () => {
    const form = await startNewBooking('12:00', '13:00');
    await form.getByRole('button', { name: /^Deposit · / }).click();
    await form.getByRole('button', { name: /^Add Booking · .* taken in cash$/ }).click();
    await expectToast(page, 'created · code OOPS');
    await expect(details()).toBeVisible();
    await expect(pay().locator('.bdPill')).toHaveText('Deposit paid');
    await expect(pay().locator('.bdHistory li[data-payment^="entry-"]')).toContainText(`recorded by ${staffName}`);
    await expect(payDialog()).toHaveCount(0);
    await closeDialogs();
});

test('new booking with nothing taken: opens on its QR with the code', async () => {
    const form = await startNewBooking('13:00', '14:00');
    await form.getByRole('button', { name: 'Add Booking', exact: true }).click();
    await expectToast(page, 'created · code OOPS');
    await expect(payDialog().locator('.tuCopyRow.isKey')).toContainText(/OOPS[2-9A-HJ-NP-Z]{6} dat phong/);
    await closeDialogs();
});

test('new booking at another price: the reason is required; the receipt reads list → reason → total', async () => {
    const form = await startNewBooking('14:00', '15:00');
    await form.getByRole('button', { name: 'Change price' }).click();
    await form.getByLabel('New total (VND)').fill(String(Number(roomA.price) + 50000));
    await expect(form.getByRole('button', { name: 'Add Booking', exact: true })).toBeDisabled(); // no reason yet
    // A higher price offers the surcharges only.
    await expect(form.getByRole('button', { name: 'Regular customer −10%' })).toHaveCount(0);
    await form.getByRole('button', { name: 'Late finish surcharge' }).click();
    await form.getByRole('button', { name: 'Add Booking', exact: true }).click();
    await expectToast(page, 'created · code OOPS');
    await expect(payDialog()).toBeVisible();
    await page.keyboard.press('Escape'); // closes the QR on top; the booking stays open
    await expect(payDialog()).toHaveCount(0);
    await expect(pay().locator('.bdPriceNote')).toContainText('Late finish surcharge');
    await pay().getByRole('button', { name: 'Receipt' }).click();
    const receipt = page.locator('.bkReceipt');
    await expect(receipt.locator('.bkChange')).toContainText('Late finish surcharge');
    await expect(receipt.locator('.bkChange')).toContainText(vnd(50000));
    await expect(receipt.locator('tr', { hasText: 'Total' }).first()).toContainText(vnd(Number(roomA.price) + 50000));
    await closeDialogs();
});

test('"Owes money" lists the past bookings that still have a balance', async () => {
    const jwt = await staffJwt();
    const today = await studioToday();
    const from = addDays(today, -60);
    const rows = (await rest(jwt, `bookings?select=id,full_payment,bank_transfer,cash&status=in.(approved,completed)&date=lt.${today}&date=gte.${from}`)).data;
    const owing = rows.filter((row) => Number(row.full_payment ?? 0) - Number(row.bank_transfer ?? 0) - Number(row.cash ?? 0) > 0);
    await page.goto('/admin/bookings?view=list&owing=1');
    await expect(page.getByRole('grid', { name: 'Bookings' })).toBeVisible();
    await expect(page.locator('.bookingsCard .cardTitles p')).toContainText(owing.length === 1 ? '1 past booking still owes money' : `${owing.length} past bookings still owe money`);
    if (owing.length) {
        await expect(page.locator('.awaitChip.isOwing')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.awaitChip.isOwing .segCount')).toHaveText(String(owing.length));
        // Every row on the page is in the past and approved or completed.
        await expect(page.locator('.bookingTable tbody tr').first()).toBeVisible();
        expect(await page.locator('.bookingTable tbody tr').count()).toBe(Math.min(owing.length, 10));
    }
});
