import { test, expect } from '@playwright/test';
import { addDays, expectToast, login, pickOption, rest, rpc, studioToday, token } from './support.js';

// Rented studios (venues): staff add one in Bookings → Rooms & prices with the name the website shows, change its
// rent and give it rooms (each with its own rent), put a class in one of the rooms in its Setup tab, and the class
// header and the instructor's page name it "Studio · Room" with its address and map link — while the website and
// the class's students only ever see its public name (the studio's own name is another studio's brand). Once a
// session in the room has ended, the room's rent is an expense of the class, marked "Automatic" (admins see those
// rows). A room a class was in can't be deleted: it is set inactive.
// Independent of the demo data: the spec makes its own studio, takes any running class and puts it back,
// and removes what it added (studio and its rooms, the past session it adds, its rent).

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const MARK = 'E2E Studio';
const VENUE = `${MARK} ${RUN}`;
const PUBLIC = `E2E Area ${RUN}`;
const ADDRESS = `${RUN % 1000} Phố E2E, Hà Nội`;
const ROOM = `Phòng E2E ${RUN % 1000}`;
const ROOM_2 = `Phòng nhỏ E2E ${RUN % 1000}`;
// The demo's rented studios with rooms: their own names never reach the website or the students.
const STUDIO_NAMES = ['Studio Thỏ', 'Studio Baladi'];

let staff;
let admin;
let today;
let cls; // { id, name, room_id, venue_id, venue_room_id, instructor_id, instructor: { email }, student }
let venueId = null;
let roomId = null;
let sessionId = null;

const venueByName = async (name) => ((await rpc(staff.jwt, 'venues_list')).data ?? []).find((venue) => venue.name === name) ?? null;
const roomsOf = async (id) => ((await rpc(staff.jwt, 'venue_rooms_list')).data ?? []).filter((room) => room.venue_id === id);

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
    // Any running class with weekly sessions whose instructor and one of whose students can sign in with the demo
    // password.
    const classes = (await rest(staff.jwt,
        `classes?select=id,name,room_id,venue_id,venue_room_id,instructor_id,instructor:profiles!instructor_id(email),schedules:class_schedules(id),` +
        `students:class_students(joined_at,leaves_after,student:profiles!student_id(email))&ended_on=is.null&starts_on=lte.${today}&order=id`)).data;
    const demoStudent = (row) =>
        row.students.find((member) => member.student?.email?.endsWith('@demo.oopsdance.test') && member.joined_at <= today && (!member.leaves_after || member.leaves_after >= today));
    cls = classes.find((row) => row.instructor?.email?.endsWith('@demo.oopsdance.test') && row.schedules.length > 0 && demoStudent(row));
    expect(cls, 'a running class with weekly sessions and a demo student').toBeTruthy();
    cls.student = demoStudent(cls).student.email;
});

test.afterAll(async () => {
    if (sessionId) {
        // The rent goes with the session; an admin removes it first (system rows aren't staff's).
        await rest(admin.jwt, `expenses?session_id=eq.${sessionId}`, { method: 'DELETE' });
        await rest(staff.jwt, `instructor_attendance?id=eq.${sessionId}`, { method: 'DELETE' });
    }
    if (cls) {
        const back = await rest(staff.jwt, `classes?id=eq.${cls.id}`, {
            method: 'PATCH',
            body: { room_id: cls.room_id, venue_id: cls.venue_id, venue_room_id: cls.venue_room_id },
        });
        expect(back.status).toBe(204);
    }
    // Its rooms go with it.
    const venue = venueId ? { id: venueId } : await venueByName(VENUE);
    if (venue) expect([200, 204]).toContain((await rpc(staff.jwt, 'venue_delete', { p_id: venue.id })).status);
});

test('staff add a rented studio with its name on the website, change its rent and give it rooms', async ({ page }) => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/bookings?view=rooms');
    const section = page.locator('.venueSection');
    await section.getByRole('button', { name: 'Add a rented studio' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Studio name').fill(VENUE);
    await dialog.getByLabel('Name on the website').fill(PUBLIC);
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
    expect(venue).toMatchObject({ address: ADDRESS, public_name: PUBLIC, rent_per_hour: 240000, active: true });
    venueId = venue.id;

    const card = section.locator(`[data-venue="${venueId}"]`);
    await expect(card).toContainText(ADDRESS);
    await expect(card).toContainText(/240[.,]000/);
    await expect(card.locator('.venuePublic')).toContainText(PUBLIC);
    // Without a map link, "Open in Maps" searches the address.
    await expect(card.getByRole('link', { name: `Open ${VENUE} in Maps` })).toHaveAttribute('href', /google\.com\/maps\/search\/.*query=/);

    // A new rent, and two rooms with their own prices (two rooms can't share a name).
    await card.getByRole('button', { name: `Edit ${VENUE}` }).click();
    await dialog.getByLabel('Rent per hour (VND)').fill('260000');
    await dialog.getByRole('button', { name: 'Add a room' }).click();
    let row = dialog.locator('.venueRoomRow').last();
    await row.getByLabel('Room name').fill(ROOM);
    await row.getByLabel('Price per hour (VND)').fill('300000');
    await dialog.getByRole('button', { name: 'Add a room' }).click();
    row = dialog.locator('.venueRoomRow').last();
    await row.getByLabel('Room name').fill(ROOM);
    await row.getByLabel('Price per hour (VND)').fill('150000');
    await dialog.getByRole('button', { name: 'Save studio' }).click();
    await expect(dialog.getByText('Two rooms have this name.').first()).toBeVisible();
    await row.getByLabel('Room name').fill(ROOM_2);
    await dialog.getByRole('button', { name: 'Save studio' }).click();
    await expectToast(page, `${VENUE} saved.`);

    expect((await venueByName(VENUE)).rent_per_hour).toBe(260000);
    const rooms = await roomsOf(venueId);
    expect(rooms.map(({ name, rent_per_hour, active }) => ({ name, rent_per_hour, active }))).toEqual([
        { name: ROOM, rent_per_hour: 300000, active: true },
        { name: ROOM_2, rent_per_hour: 150000, active: true },
    ]);
    roomId = rooms[0].id;
    // The card lists the rooms with their prices; the studio's own rent is the price without a room.
    await expect(card.locator(`[data-room="${roomId}"]`)).toContainText(ROOM);
    await expect(card.locator(`[data-room="${roomId}"]`)).toContainText(/300[.,]000/);
    await expect(card.locator('.venueRoomFallback')).toContainText(/260[.,]000/);
});

test('staff put a class in one of its rooms in Setup; staff and the instructor see "Studio · Room"', async ({ page, browser }) => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/classes/${cls.id}?tab=setup`);
    const form = page.locator('.hubForm');
    await pickOption(page, form, 'Where it’s taught', ROOM);
    // In a room: the room's rent becomes the class's cost.
    await expect(form.getByText(/The room’s rent \(300[.,]000.*\/h × each session’s length\)/)).toBeVisible();
    await form.getByRole('button', { name: 'Save details' }).click();
    await expectToast(page, 'Class updated.');

    // The room's studio comes with it.
    const saved = (await rest(staff.jwt, `classes?select=room_id,venue_id,venue_room_id&id=eq.${cls.id}`)).data[0];
    expect(saved).toEqual({ room_id: null, venue_id: venueId, venue_room_id: roomId });

    const meta = page.locator('.hubMeta');
    await expect(meta).toContainText(`${VENUE} · ${ROOM}`);
    await expect(meta).toContainText(ADDRESS);
    await expect(meta.getByRole('link', { name: `Open ${VENUE} in Maps` })).toBeVisible();

    // The studio's card shows the class in its room.
    await page.goto('/admin/bookings?view=rooms');
    await expect(page.locator(`[data-venue="${venueId}"] [data-room="${roomId}"]`)).toContainText(cls.name);

    // The instructor's class page: the banner names the studio and the room, the next class gives its address.
    const context = await browser.newContext();
    const teacher = await context.newPage();
    await login(teacher, cls.instructor.email);
    await teacher.goto(`/profile/my-classes?class=${cls.id}`);
    await expect(teacher.locator('.pfBannerMeta')).toContainText(`${VENUE} · ${ROOM}`);
    await expect(teacher.locator('.pfNextPlace')).toContainText(ADDRESS);
    await expect(teacher.locator('.pfNextPlace').getByRole('link', { name: `Open ${VENUE} in Maps` })).toBeVisible();
    await context.close();
});

test('the website and the class’s students see only the public name', async ({ browser }) => {
    // A visitor: the class's card gives the public name and the address, never a studio's own name.
    const visitor = await browser.newContext();
    const site = await visitor.newPage();
    await site.goto('/classes');
    const card = site.locator(`#class-${cls.id}`);
    await expect(card).toContainText(PUBLIC);
    await expect(card).toContainText(ADDRESS);
    const body = site.locator('body');
    for (const name of [VENUE, ...STUDIO_NAMES]) await expect(body).not.toContainText(name);
    await visitor.close();

    // One of its students: the class page names the place by its public name too.
    const context = await browser.newContext();
    const student = await context.newPage();
    await login(student, cls.student);
    await student.goto(`/profile/my-classes?class=${cls.id}`);
    await expect(student.locator('.pfBannerMeta')).toContainText(PUBLIC);
    const page = student.locator('body');
    for (const name of [VENUE, ROOM, ...STUDIO_NAMES]) await expect(page).not.toContainText(name);
    await context.close();
});

test('a session that ended in the room becomes an automatic rent expense of the class at the room’s rent', async ({ page }) => {
    // A make-up a few days back the class has no session on, 10:00–11:30, in the room.
    const taken = new Set((await rest(staff.jwt, `instructor_attendance?select=date&class_id=eq.${cls.id}&date=gte.${addDays(today, -12)}`)).data.map((row) => row.date));
    const date = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((back) => addDays(today, -back)).find((day) => !taken.has(day));
    expect(date, 'a free day in the last two weeks').toBeTruthy();
    const added = await rest(staff.jwt, 'instructor_attendance?select=id,venue_id,venue_room_id', {
        method: 'POST',
        prefer: 'return=representation',
        body: { class_id: cls.id, instructor_id: cls.instructor_id, date, status: 'pending', is_extra: true, start_time: '10:00', end_time: '11:30' },
    });
    expect(added.status).toBe(201);
    sessionId = added.data[0].id;
    // A new session takes its class's place: the studio and the room.
    expect(added.data[0]).toMatchObject({ venue_id: venueId, venue_room_id: roomId });

    // The nightly job does this too; staff can run it now.
    const charged = await rpc(staff.jwt, 'venue_rent_run');
    expect(charged.status).toBe(200);
    expect(charged.data).toBeGreaterThanOrEqual(1);
    const rent = (await rest(admin.jwt, `expenses?select=id,amount,category,class_id,vendor,created_by,month&session_id=eq.${sessionId}`)).data;
    expect(rent).toHaveLength(1);
    // 1.5 hours at the room's 300,000 an hour (not the studio's 260,000).
    expect(rent[0]).toMatchObject({ category: 'venue_rent', amount: 450000, class_id: cls.id, vendor: `${VENUE} · ${ROOM}`, created_by: null });

    await login(page, 'admin@demo.oopsdance.test');
    await page.goto('/admin/expenses');
    // The rent is in the month of the session (it may be last month early in a month).
    if (rent[0].month !== `${today.slice(0, 7)}-01`) await page.getByRole('button', { name: 'Previous month' }).click();
    const row = page.locator(`[data-expense="${rent[0].id}"]`);
    await expect(row).toContainText(`Rent at ${VENUE} · ${ROOM}: ${cls.name}, 10:00–11:30`);
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
    await expect(page.locator('.alogSentence, .alogChildText').filter({ hasText: `moved ${cls.name} to ${VENUE} · ${ROOM}` }).first()).toBeVisible();
});

test('a room a class was in can’t be deleted: removing it sets it inactive', async ({ page }) => {
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/bookings?view=rooms');
    const card = page.locator(`[data-venue="${venueId}"]`);
    await card.getByRole('button', { name: `Edit ${VENUE}` }).click();
    const dialog = page.getByRole('dialog');

    // The class is in it: removing it asks first.
    let asked = '';
    page.once('dialog', (confirm) => {
        asked = confirm.message();
        confirm.accept();
    });
    await dialog.getByRole('button', { name: `Remove ${ROOM}`, exact: true }).click();
    expect(asked).toContain(cls.name);
    await expect(dialog.getByText(/stays on record as inactive, out of the class pickers/)).toBeVisible();
    // Nothing was ever in the other one: it goes.
    await dialog.getByRole('button', { name: `Remove ${ROOM_2}`, exact: true }).click();
    await dialog.getByRole('button', { name: 'Save studio' }).click();
    await expectToast(page, `${VENUE} saved.`);

    expect((await roomsOf(venueId)).map(({ id, active }) => ({ id, active }))).toEqual([{ id: roomId, active: false }]);
    // The class is still in it, so the card keeps it, marked inactive.
    const room = card.locator(`[data-room="${roomId}"]`);
    await expect(room).toContainText('Inactive');
    await expect(room).toContainText(cls.name);
    await expect(card).not.toContainText(ROOM_2);
});
