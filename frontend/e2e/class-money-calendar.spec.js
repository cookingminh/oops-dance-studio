// A class's Money tab as a calendar (page/money: services/classDay.js, session_set_venue_room() in
// supabase/migrations/20261117001800_venue_rooms.sql): an admin opens the day of a taught session of a class at a
// rented studio with rooms, moves the session to another room (the rent already charged follows that room's price),
// lowers the rent by hand, adds a cost ("Water") on that day — it shows in the day, the month's total and the table
// above — and deletes it. The session's room and the rent row are put back afterwards.
import { test, expect } from '@playwright/test';
import { expectToast, login, rest, rpc, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const ADMIN_EMAIL = 'admin@demo.oopsdance.test';
// Demo classes at a rented studio with rooms (seed_demo_venue_rooms()): the first one found is used.
const CLASSES = ['K-pop Dance', 'Trending'];
const WATER = `Water E2E ${Date.now()}`;

let page;
let admin; // JWT
let cls; // { id, name, venue_id }
let target; // { rent (expense row), session (instructor_attendance row), minutes, month }
let rooms; // the studio's active rooms [{ id, name, rent_per_hour }]
let other; // the room the session moves to
let original; // the rent row and the session's room before the run

const dots = (amount) => String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const rentFor = (perHour, minutes) => Math.round((Number(perHour) * minutes) / 60 / 1000) * 1000;
const longDate = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00:00`));
const dayMonth = (iso) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00:00`));
const monthYear = (iso) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));
const minutesOf = (time) => {
    const [hours, minutes] = String(time).split(':').map(Number);
    return hours * 60 + minutes;
};
const isoWeekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() || 7;
const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);

const RENT = 'id,amount,vendor,description,spent_on,month,session_id,class_id';
const rentRow = async () => (await rest(admin, `expenses?select=${RENT}&id=eq.${target.rent.id}`)).data[0];
const sessionRow = async () => (await rest(admin, `instructor_attendance?select=id,venue_room_id&id=eq.${target.session.id}`)).data[0];
const waterRows = async () => (await rest(admin, `expenses?select=id,amount,spent_on,class_id,category&description=eq.${encodeURIComponent(WATER)}`)).data;

// "November 2026: 2.000.000 ₫ in · 939.000 ₫ out" → 939000
const outOf = (text) => Number((/([\d.]+)\s*₫\s*out/.exec(text)?.[1] ?? '').replace(/\./g, ''));

test.beforeAll(async ({ browser }) => {
    admin = (await token(ADMIN_EMAIL)).jwt;
    const today = await studioToday();
    const allRooms = (await rpc(admin, 'venue_rooms_list')).data;

    for (const name of CLASSES) {
        const row = (await rest(admin, `classes?select=id,name,venue_id&name=eq.${encodeURIComponent(name)}`)).data[0];
        const studioRooms = row?.venue_id ? allRooms.filter((room) => room.venue_id === row.venue_id && room.active) : [];
        if (studioRooms.length < 2) continue;
        // The latest automatic rent of a session that wasn't called off, this month or before.
        const rents = (
            await rest(
                admin,
                `expenses?select=${RENT}&class_id=eq.${row.id}&category=eq.venue_rent&session_id=not.is.null&created_by=is.null&spent_on=lte.${today}&order=spent_on.desc&limit=5`
            )
        ).data;
        for (const rent of rents) {
            const session = (await rest(admin, `instructor_attendance?select=id,date,status,venue_id,venue_room_id,start_time,end_time&id=eq.${rent.session_id}`)).data[0];
            if (!session || session.status === 'cancelled' || session.venue_id !== row.venue_id) continue;
            let minutes;
            if (session.start_time && session.end_time) minutes = minutesOf(session.end_time) - minutesOf(session.start_time);
            else {
                const slots = (await rest(admin, `class_schedules?select=day_of_week,start_time,end_time&class_id=eq.${row.id}&day_of_week=eq.${isoWeekday(session.date)}`)).data;
                if (!slots.length) continue;
                minutes = Math.max(...slots.map((slot) => minutesOf(slot.end_time))) - Math.min(...slots.map((slot) => minutesOf(slot.start_time)));
            }
            cls = row;
            rooms = studioRooms;
            target = { rent, session, minutes, month: `${session.date.slice(0, 7)}-01` };
            break;
        }
        if (target) break;
    }
    test.skip(!target, 'needs a demo class at a rented studio with two rooms and a charged session');

    // At a studio a session is always in one of its rooms.
    expect(target.session.venue_room_id, 'the session’s room').toBeTruthy();
    original = { room: target.session.venue_room_id, amount: Number(target.rent.amount), vendor: target.rent.vendor, description: target.rent.description };
    // Another room than the session's, whose price gives another rent than the one charged.
    other = rooms.find((room) => room.id !== original.room && rentFor(room.rent_per_hour, target.minutes) !== original.amount) ?? rooms.find((room) => room.id !== original.room);
    // A leftover of an interrupted run would change the day's totals.
    await rest(admin, `expenses?description=like.${encodeURIComponent('Water E2E *')}`, { method: 'DELETE' });

    page = await browser.newPage();
    await login(page, ADMIN_EMAIL);
});

test.afterAll(async () => {
    if (target) {
        ok(await rpc(admin, 'session_set_venue_room', { p_session: target.session.id, p_room: original.room }), 'put the room back');
        ok(
            await rest(admin, `expenses?id=eq.${target.rent.id}`, {
                method: 'PATCH',
                body: { amount: original.amount, vendor: original.vendor, description: original.description },
            }),
            'put the rent back'
        );
        await rest(admin, `expenses?description=eq.${encodeURIComponent(WATER)}`, { method: 'DELETE' });
        expect((await sessionRow()).venue_room_id).toBe(original.room);
        expect(Number((await rentRow()).amount)).toBe(original.amount);
        expect(await waterRows()).toHaveLength(0);
    }
    await page?.close();
});

const card = () => page.locator('.mcCard');
const dialog = () => page.locator('.mcDialog');
// By its label (the page behind an open dialog is hidden from the accessibility tree, so not by role).
const dayCell = () => card().locator(`.mcDay[aria-label^="${longDate(target.session.date)}"]`);
const rentItem = () => dialog().locator('.mcCost').filter({ hasText: 'Automatic' });

test('the Money tab shows the month as a calendar, a list on demand', async () => {
    await page.goto(`/admin/classes/${cls.id}?tab=money`);
    await expect(card().getByRole('heading', { name: 'Money by day' })).toBeVisible();
    await expect(card().getByRole('button', { name: 'Calendar', pressed: true })).toBeVisible();

    // Back to the session's month when it was an earlier one.
    const today = await studioToday();
    const monthIndex = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
    for (let step = monthIndex(today) - monthIndex(target.month); step > 0; step -= 1) {
        await card().getByRole('button', { name: 'Previous month' }).click();
    }
    await expect(card().locator('.cardTitles p')).toContainText(monthYear(target.month));

    const day = dayCell();
    await expect(day).toContainText(`−${dots(original.amount)}`);
    await expect(day.locator('.mcSession')).toBeVisible();

    // The list has the same month: the rent is there, and a row opens its day.
    await card().getByRole('button', { name: 'List' }).click();
    await expect(card().locator('.mcListRow').filter({ hasText: dayMonth(target.session.date) }).filter({ hasText: 'Automatic' }).first()).toBeVisible();
    await card().getByRole('button', { name: 'Calendar' }).click();
    await expect(day).toBeVisible();
});

test('a day: the session moves to another room and its rent follows', async () => {
    await dayCell().click();
    await expect(dialog()).toBeVisible();
    await expect(dialog().locator('.mcDialogTitle')).toHaveText(`${longDate(target.session.date)} · ${cls.name}`);
    await expect(rentItem()).toContainText(dots(original.amount));

    // The picker lists the studio's rooms only: a session at a studio is always in one of them.
    await expect(dialog().getByRole('radio')).toHaveCount(rooms.length);
    await expect(dialog().getByRole('radio', { name: /particular room/i })).toHaveCount(0);
    await expect(dialog().getByRole('radio', { checked: true })).toHaveCount(1);

    const expected = rentFor(other.rent_per_hour, target.minutes);
    const pick = dialog().getByRole('radio', { name: new RegExp(`^${other.name}`) });
    await expect(pick).toContainText(dots(expected));
    await pick.click();
    await expectToast(page, `This session is now in ${other.name}.`);
    await expect(pick).toHaveAttribute('aria-checked', 'true');
    await expect(rentItem()).toContainText(dots(expected));
    expect((await sessionRow()).venue_room_id).toBe(other.id);
    expect(Number((await rentRow()).amount)).toBe(expected);
    expect((await rentRow()).vendor).toContain(other.name);
});

test('the rent is lowered by hand', async () => {
    const lowered = rentFor(other.rent_per_hour, target.minutes) - 20000;
    await rentItem().getByRole('button', { name: /^Edit / }).click();
    const form = dialog().locator('.mcCostForm');
    await form.getByLabel('Amount').fill(String(lowered));
    await expect(form.getByLabel('Amount')).toHaveValue(dots(lowered));
    await form.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Expense saved.');
    await expect(form).toHaveCount(0);
    await expect(rentItem()).toContainText(dots(lowered));
    expect(Number((await rentRow()).amount)).toBe(lowered);
    await expect(dayCell()).toContainText(`−${dots(lowered)}`);
});

test('a cost is added on that day, counts in the month, and is deleted', async () => {
    const lowered = Number((await rentRow()).amount);
    const outBefore = outOf(await card().locator('.cardTitles p').textContent());
    const tableRow = page.locator('.hubMoneyTable tbody tr').filter({ hasText: monthYear(target.month) });
    const tableCostsBefore = await tableRow.locator('td').nth(3).textContent();

    await dialog().getByRole('button', { name: 'Add a cost' }).click();
    await dialog().getByRole('textbox', { name: 'Amount' }).fill('50000');
    await dialog().getByLabel('Description').fill(WATER);
    await dialog().locator('.exCatOption').filter({ hasText: 'Supplies' }).click();
    await dialog().getByRole('button', { name: 'Add cost' }).click();
    await expectToast(page, /50\.000\s₫ added\./);

    const water = dialog().locator('.mcCost').filter({ hasText: WATER });
    await expect(water).toContainText('50.000');
    await expect(dialog().locator('.mcSectionHead').filter({ hasText: 'Costs that day' })).toContainText(dots(lowered + 50000));
    await expect(dayCell()).toContainText(`−${dots(lowered + 50000)}`);
    await expect.poll(async () => outOf(await card().locator('.cardTitles p').textContent())).toBe(outBefore + 50000);
    await expect(tableRow.locator('td').nth(3)).not.toHaveText(tableCostsBefore);
    const added = await waterRows();
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ spent_on: target.session.date, class_id: cls.id, category: 'supplies' });
    expect(Number(added[0].amount)).toBe(50000);

    page.once('dialog', (confirm) => confirm.accept());
    await water.getByRole('button', { name: /^Delete / }).click();
    await expectToast(page, 'Expense deleted.');
    await expect(water).toHaveCount(0);
    await expect.poll(async () => outOf(await card().locator('.cardTitles p').textContent())).toBe(outBefore);
    await expect(tableRow.locator('td').nth(3)).toHaveText(tableCostsBefore);
    expect(await waterRows()).toHaveLength(0);

    await dialog().locator('.mcDialogFooter').getByRole('button', { name: 'Close' }).click();
    await expect(dialog()).toHaveCount(0);
});
