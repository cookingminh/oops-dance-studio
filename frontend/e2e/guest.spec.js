import { test, expect } from '@playwright/test';
import { deleteBookingsOn, expectToast, freeDate, login, pathname, rest, rooms, rpc, searchRooms, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const EMAIL = 'guest@demo.oopsdance.test';
let page;
let me;
let bookingDate;

test.beforeAll(async ({ browser }) => {
    bookingDate = await freeDate(22);
    await deleteBookingsOn(bookingDate);
    me = await token(EMAIL);
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
});
test.afterAll(() => page.close());

test('guest lands on /profile', async () => {
    await login(page, EMAIL);
    expect(pathname(page)).toBe('/profile');
});

test('overview shows the guest my_stats (classes, attended, absent)', async () => {
    await expect(page.getByText('My Stats')).toBeVisible();
    await expect(page.getByText('Attended').first()).toBeVisible();
});

test('my classes lists enrolments', async () => {
    await page.goto('/profile/my-classes');
    await expect(page.getByText('Your Classes')).toBeVisible();
    await expect(page.locator('.singleItem').first()).toBeVisible();
});

test('my attendance page renders', async () => {
    await page.goto('/profile/my-attendance');
    await expect(page.getByText('Your Attendance')).toBeVisible();
});

for (const target of ['/admin', '/admin/users', '/profile/attendance']) {
    test(`guest ${target} redirects to /profile`, async () => {
        await page.goto(target);
        await page.waitForURL((url) => url.pathname === '/profile');
    });
}

test('settings: profile update is saved', async () => {
    await page.goto('/profile/my-profile');
    await page.getByLabel('Contact Number').fill('0987 333 101');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToast(page, 'Profile updated.');
});

test('books a room from the homepage (create_booking)', async () => {
    await page.goto('/home');
    const search = await searchRooms(page, bookingDate, '21:00', '22:00');
    await search.getByRole('button', { name: 'Book Now' }).first().click();
    await expect(page.getByRole('heading', { name: 'Your Booking', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();
    const confirmation = page.locator('.confirmation');
    await expect(confirmation.getByText('Booking request sent!')).toBeVisible();
    await expect(confirmation).toContainText(bookingDate);
    await expect(confirmation).toContainText('pending');
});

test('cancels the pending booking from My Bookings (cancel_booking)', async () => {
    await page.getByRole('link', { name: 'See my bookings' }).click();
    await page.waitForURL('**/profile/my-bookings');
    // The new booking is the only one on its date (Awaiting Deposit + All Bookings both list it).
    await page.getByRole('row').filter({ hasText: bookingDate }).getByRole('button', { name: 'Cancel' }).first().click();
    await expectToast(page, 'Booking cancelled.');
    const res = await rest(me.jwt, `bookings?select=status&date=eq.${bookingDate}`);
    expect(res.data).toEqual([{ status: 'cancelled' }]);
});

test('RLS: guest sees only own bookings', async () => {
    const res = await rest(me.jwt, 'bookings?select=guest_id');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((b) => b.guest_id === me.id)).toBe(true);
});

test('RLS: guest sees only own profile', async () => {
    const res = await rest(me.jwt, 'profiles?select=id');
    expect(res.data).toEqual([{ id: me.id }]);
});

test('guest cannot change own role', async () => {
    const res = await rest(me.jwt, `profiles?id=eq.${me.id}`, { method: 'PATCH', body: { role: 'admin' }, prefer: 'return=representation' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.data)).toContain('FORBIDDEN');
});

test('guest dashboard_stats is FORBIDDEN', async () => {
    const res = await rpc(me.jwt, 'dashboard_stats');
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/^FORBIDDEN/);
});

test('guest admin_set_role is rejected', async () => {
    const res = await rpc(me.jwt, 'admin_set_role', { p_user: me.id, p_role: 'admin' });
    expect(res.status).toBeGreaterThanOrEqual(400);
});

test('RLS: guest sees only own student_attendance', async () => {
    const res = await rest(me.jwt, 'student_attendance?select=student_id');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((r) => r.student_id === me.id)).toBe(true);
});

test('RLS: guest sees no instructor_attendance', async () => {
    const res = await rest(me.jwt, 'instructor_attendance?select=id');
    expect(res.data).toEqual([]);
});

test('booking in the past is PAST_DATE', async () => {
    const [room] = await rooms();
    const res = await rpc(me.jwt, 'create_booking', { p_room_id: room.id, p_date: '2020-01-01', p_start: '10:00', p_end: '11:00' });
    expect(res.data.message).toMatch(/^PAST_DATE/);
});
