import { test, expect } from '@playwright/test';
import { addDays, expectToast, login, pickOption, rest, rpc, studioToday, token } from './support.js';

// Rented studios (venues): staff add one in Bookings → Rooms & prices and change its rent, move a class there
// in its Setup tab, and the class header and the instructor's page name it with its address and map link. Once
// a session there has ended, its rent is an expense of the class, marked "Automatic" (admins see those rows).
// Independent of the demo data: the spec makes its own studio, takes any running class and puts it back,
// and removes what it added (studio, the past session it adds, its rent).

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const MARK = 'E2E Studio';
const VENUE = `${MARK} ${RUN}`;
const ADDRESS = `${RUN % 1000} Phố E2E, Hà Nội`;

let staff;
let admin;
let today;
let cls; // { id, name, room_id, venue_id, instructor_id, instructor: { email } }
let venueId = null;
let sessionId = null;

const venueByName = async (name) => ((await rpc(staff.jwt, 'venues_list')).data ?? []).find((venue) => venue.name === name) ?? null;

// Takes out an earlier, interrupted run's studios (only those no class was taught at can go).
async function removeOldStudios() {
    const old = ((await rpc(staff.jwt, 'venues_list')).data ?? []).filter((venue) => venue.name.startsWith(MARK) && venue.name !== VENUE);
    for (const venue of old) await rpc(staff.jwt, 'venue_delete', { p_id: venue.id });
}

test.beforeAll(async () => {
    staff = await token('staff@demo.oopsdance.test');
    admin = await token('admin@demo.oopsdance.test');
    today = await studioToday();
    await removeOldStudios();
    // Any running class with weekly sessions whose instructor can sign in with the demo password.
    const classes = (await rest(staff.jwt,
        `classes?select=id,name,room_id,venue_id,instructor_id,instructor:profiles!instructor_id(email),schedules:class_schedules(id)&ended_on=is.null&starts_on=lte.${today}&order=id`)).data;
    cls = classes.find((row) => row.instructor?.email?.endsWith('@demo.oopsdance.test') && row.schedules.length > 0);
    expect(cls, 'a running class with weekly sessions').toBeTruthy();
});

test.afterAll(async () => {
    if (sessionId) {
        // The rent goes with the session; an admin removes it first (system rows aren't staff's).
        await rest(admin.jwt, `expenses?session_id=eq.${sessionId}`, { method: 'DELETE' });
        await rest(staff.jwt, `instructor_attendance?id=eq.${sessionId}`, { method: 'DELETE' });
    }
    if (cls) {
        const back = await rest(staff.jwt, `classes?id=eq.${cls.id}`, { method: 'PATCH', body: { room_id: cls.room_id, venue_id: cls.venue_id } });
        expect(back.status).toBe(204);
    }
    const venue = venueId ? { id: venueId } : await venueByName(VENUE);
    if (venue) expect([200, 204]).toContain((await rpc(staff.jwt, 'venue_delete', { p_id: venue.id })).status);
});

test('staff add a rented studio and change its rent', async ({ page }) => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/bookings?view=rooms');
    const section = page.locator('.venueSection');
    await section.getByRole('button', { name: 'Add a rented studio' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Studio name').fill(VENUE);
    await dialog.getByLabel('Address').fill(ADDRESS);
    await dialog.getByLabel('Map link').fill('http://maps.example/e2e');
    await dialog.getByLabel('Rent per hour (VND)').fill('240000');
    await dialog.getByRole('button', { name: 'Add studio' }).click();
    // Map links are https only (checked before it is sent).
    await expect(dialog.getByText('The map link must start with https://.')).toBeVisible();
    await dialog.getByLabel('Map link').fill('');
    await dialog.getByRole('button', { name: 'Add studio' }).click();
    await expectToast(page, `${VENUE} added.`);

    const venue = await venueByName(VENUE);
    expect(venue).toMatchObject({ address: ADDRESS, rent_per_hour: 240000, active: true });
    venueId = venue.id;

    const card = section.locator(`[data-venue="${venueId}"]`);
    await expect(card).toContainText(ADDRESS);
    await expect(card).toContainText(/240[.,]000/);
    // Without a map link, "Open in Maps" searches the address.
    await expect(card.getByRole('link', { name: `Open ${VENUE} in Maps` })).toHaveAttribute('href', /google\.com\/maps\/search\/.*query=/);

    await card.getByRole('button', { name: `Edit ${VENUE}` }).click();
    await dialog.getByLabel('Rent per hour (VND)').fill('260000');
    await dialog.getByRole('button', { name: 'Save studio' }).click();
    await expectToast(page, `${VENUE} saved.`);
    await expect(card).toContainText(/260[.,]000/);
    expect((await venueByName(VENUE)).rent_per_hour).toBe(260000);
});

test('staff move a class there in Setup; the header and the instructor name it with its address', async ({ page, browser }) => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/classes/${cls.id}?tab=setup`);
    const form = page.locator('.hubForm');
    await pickOption(page, form, 'Where it’s taught', VENUE);
    // Under a rented studio: its rent becomes the class's cost.
    await expect(form.getByText(/Its rent \(260[.,]000.*\/h × each session’s length\)/)).toBeVisible();
    await form.getByRole('button', { name: 'Save details' }).click();
    await expectToast(page, 'Class updated.');

    const saved = (await rest(staff.jwt, `classes?select=room_id,venue_id&id=eq.${cls.id}`)).data[0];
    expect(saved).toEqual({ room_id: null, venue_id: venueId });

    const meta = page.locator('.hubMeta');
    await expect(meta).toContainText(VENUE);
    await expect(meta).toContainText(ADDRESS);
    await expect(meta.getByRole('link', { name: `Open ${VENUE} in Maps` })).toBeVisible();

    // The instructor's class page: the banner names the studio, the next class gives its address.
    const context = await browser.newContext();
    const teacher = await context.newPage();
    await login(teacher, cls.instructor.email);
    await teacher.goto(`/profile/my-classes?class=${cls.id}`);
    await expect(teacher.locator('.pfBannerMeta')).toContainText(VENUE);
    await expect(teacher.locator('.pfNextPlace')).toContainText(ADDRESS);
    await expect(teacher.locator('.pfNextPlace').getByRole('link', { name: `Open ${VENUE} in Maps` })).toBeVisible();
    await context.close();
});

test('a session that ended at the studio becomes an automatic rent expense of the class', async ({ page }) => {
    // A make-up a few days back the class has no session on, 10:00–11:30, at the studio.
    const taken = new Set((await rest(staff.jwt, `instructor_attendance?select=date&class_id=eq.${cls.id}&date=gte.${addDays(today, -12)}`)).data.map((row) => row.date));
    const date = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((back) => addDays(today, -back)).find((day) => !taken.has(day));
    expect(date, 'a free day in the last two weeks').toBeTruthy();
    const added = await rest(staff.jwt, 'instructor_attendance?select=id,venue_id', {
        method: 'POST',
        prefer: 'return=representation',
        body: { class_id: cls.id, instructor_id: cls.instructor_id, date, status: 'pending', is_extra: true, start_time: '10:00', end_time: '11:30' },
    });
    expect(added.status).toBe(201);
    sessionId = added.data[0].id;
    // A new session takes its class's place.
    expect(added.data[0].venue_id).toBe(venueId);

    // The nightly job does this too; staff can run it now.
    const charged = await rpc(staff.jwt, 'venue_rent_run');
    expect(charged.status).toBe(200);
    expect(charged.data).toBeGreaterThanOrEqual(1);
    const rent = (await rest(admin.jwt, `expenses?select=id,amount,category,class_id,vendor,created_by,month&session_id=eq.${sessionId}`)).data;
    expect(rent).toHaveLength(1);
    // 1.5 hours at 260,000 an hour.
    expect(rent[0]).toMatchObject({ category: 'venue_rent', amount: 390000, class_id: cls.id, vendor: VENUE, created_by: null });

    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/expenses');
    // The rent is in the month of the session (it may be last month early in a month).
    if (rent[0].month !== `${today.slice(0, 7)}-01`) await page.getByRole('button', { name: 'Previous month' }).click();
    const row = page.locator(`[data-expense="${rent[0].id}"]`);
    await expect(row).toContainText(`Rent at ${VENUE}: ${cls.name}, 10:00–11:30`);
    await expect(row).toContainText('Studio rent');
    await expect(row).toContainText('Automatic');
    // It follows its session: no edit, only the explanation.
    await expect(row.getByRole('button', { name: /^Edit / })).toHaveCount(0);
    await expect(row.getByRole('button', { name: /Added by itself after each session at a rented studio/ })).toBeVisible();

    // The class's Activity says where it moved (a run of edits within half an hour is folded: open it).
    await page.goto(`/admin/activity?class=${cls.id}&days=1`);
    await expect(page.locator('.alogItem').first()).toBeVisible();
    const folded = page.locator('.alogItem.isBurst > button.alogEntry[aria-expanded="false"]');
    for (let i = await folded.count(); i > 0; i -= 1) await folded.first().click();
    await expect(page.locator('.alogSentence, .alogChildText').filter({ hasText: `moved ${cls.name} to ${VENUE}` }).first()).toBeVisible();
});
