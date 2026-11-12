// Session changes (supabase/migrations/20261117000900_session_changes.sql): staff call a class session off
// with a reason the class sees and, in the same step, move it to another day (the make-up says which day it
// replaces); the attendance calendar shows the day called off with its reason and the make-up tagged; a
// member student sees "Called off" and the make-up in My Classes and in the bell (it counts until seen).
// Then a session ahead is only called off and its make-up scheduled later from the session dialog; a session
// called off on a day already past gets its make-up the same way (it says which day it replaces); and the
// studio is closed for a whole day far ahead (preview of classes and bookings with the money back, summary
// with a make-up button per class).
// Works on a demo class with guest@ as a member (days in the next week; a class at a rented studio or in a
// room) and on a day 5–6 weeks ahead; every session row and booking it creates is removed afterwards (a row
// that was already there is put back).
import { test, expect } from '@playwright/test';
import { addDays, expectToast, isoWeekday, login, pickOption, rest, rpc, staffJwt, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

const GUEST = 'guest@demo.oopsdance.test';
const BOOKER = 'guest02@demo.oopsdance.test';
const NOTE = 'E2E session changes';
const STORM = 'Storm / bad weather';
const OWN_REASON = 'E2E: the teacher is at a competition';
const HOLIDAY = 'Public holiday';
const ROW = 'id,class_id,date,status,is_extra,start_time,end_time,cancel_reason,makes_up';

// "Mon 16 Nov" (how the app writes a day in English) and "Mon 16/11" (badges).
const short = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));
const badgeDay = (iso) => `${new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(`${iso}T00:00:00`))} ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
const vnd = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let staff;
let today;
let cls; // a demo class guest@ dances in: { id, name, room_id, venue_id, schedules }
let moved; // { date, newDate, start, end } — called off and made up in one step
let later; // { date, newDate, start, end } — called off first, made up afterwards
let pastOff; // { date, newDate, start, end } — a past session called off earlier, made up now
let closed; // { date, classes (that meet then), bookingId }
const existing = new Map(); // `${class_id}|${date}` → the row that was there before (put back afterwards)
const created = []; // [class_id, date] of rows the spec may create

const meets = (c, date) => c.starts_on <= date && (!c.ended_on || c.ended_on >= date) && c.schedules.some((s) => s.day_of_week === isoWeekday(date));
const rowOn = async (classId, date) => (await rest(staff, `instructor_attendance?select=${ROW}&class_id=eq.${classId}&date=eq.${date}`)).data[0] ?? null;
const sessionModal = (page) => page.locator('.sessionModal');
const changeDialog = (page) => page.locator('.scgDialog:not(.scgClose)');
const reasonField = (scope) => scope.getByRole('textbox', { name: /^Reason/ });

// A free stretch of `minutes` in the class's room on `date` (from the server's free slots), starting on the half
// hour. A class at a rented studio has no room to check: the morning will do.
async function freeSlot(date, minutes) {
    if (!cls.room_id) return { start: '10:00', end: toClock(toMinutes('10:00') + minutes) };
    const slots = (await rpc(staff, 'get_available_slots', { p_date: date })).data.filter((slot) => slot.room_id === cls.room_id);
    for (const slot of slots) {
        const from = Math.ceil(toMinutes(slot.start_time) / 30) * 30;
        if (from + minutes <= toMinutes(slot.end_time)) return { start: toClock(from), end: toClock(from + minutes) };
    }
    return null;
}

// A day the class doesn't meet in [from, until] with a free stretch: { newDate, start, end }.
async function makeUpDay(from, until, minutes, skip = []) {
    for (let date = from; date <= until; date = addDays(date, 1)) {
        if (meets(cls, date) || skip.includes(date) || (await rowOn(cls.id, date))) continue;
        const slot = await freeSlot(date, minutes);
        if (slot) return { newDate: date, ...slot };
    }
    return null;
}

async function remember(classId, date) {
    const key = `${classId}|${date}`;
    if (existing.has(key)) return;
    existing.set(key, (await rest(staff, `instructor_attendance?select=*&class_id=eq.${classId}&date=eq.${date}`)).data[0] ?? null);
    created.push([classId, date]);
}

async function cleanUp() {
    for (const [classId, date] of created) {
        const before = existing.get(`${classId}|${date}`);
        if (before) {
            // Put it back as it was (reopening clears the reason).
            const res = await rest(staff, `instructor_attendance?id=eq.${before.id}`, { method: 'PATCH', body: { status: before.status, cancel_reason: before.cancel_reason, makes_up: before.makes_up } });
            expect(res.status, JSON.stringify(res.data)).toBeLessThan(300);
            // A make-up added on its day (another id) goes too.
            await rest(staff, `instructor_attendance?class_id=eq.${classId}&date=eq.${date}&id=neq.${before.id}`, { method: 'DELETE' });
        } else {
            const res = await rest(staff, `instructor_attendance?class_id=eq.${classId}&date=eq.${date}`, { method: 'DELETE' });
            expect(res.status, JSON.stringify(res.data)).toBe(204);
        }
    }
    for (const row of (await rest(staff, `bookings?select=id&details=eq.${encodeURIComponent(NOTE)}`)).data) {
        await rest(staff, `bookings?id=eq.${row.id}`, { method: 'DELETE' });
    }
}

test.beforeAll(async () => {
    staff = await staffJwt();
    today = await studioToday();
    const guest = (await rest(staff, `profiles?select=id&email=eq.${GUEST}`)).data[0];
    const memberships = (
        await rest(
            staff,
            `class_students?select=joined_at,leaves_after,class:classes!class_id(id,name,room_id,venue_id,starts_on,ended_on,schedules:class_schedules(day_of_week,start_time,end_time))&student_id=eq.${guest.id}`
        )
    ).data;
    const candidates = memberships
        .filter((m) => m.joined_at <= today && !m.leaves_after && m.class.starts_on <= today && !m.class.ended_on && m.class.schedules.length)
        .map((m) => m.class)
        .sort((a, b) => a.id - b.id);
    expect(candidates.length, 'guest@ dances in a running demo class').toBeGreaterThan(0);

    // A weekly session in the next 6 days (one in next week whose record doesn't exist yet, if there is one)
    // and a day without a class in those days for its make-up, so the student's 7-day views show both.
    const nextMonday = addDays(today, 8 - isoWeekday(today));
    for (const c of candidates) {
        cls = c;
        const days = Array.from({ length: 6 }, (_, i) => addDays(today, i + 1)).filter((date) => meets(c, date));
        const rows = new Map();
        for (const date of days) rows.set(date, await rowOn(c.id, date));
        const usable = days.filter((date) => !rows.get(date) || rows.get(date).status === 'pending');
        const date = usable.find((day) => day >= nextMonday && !rows.get(day)) ?? usable.find((day) => !rows.get(day)) ?? usable[0];
        if (!date) continue;
        const slot = c.schedules.find((s) => s.day_of_week === isoWeekday(date));
        const minutes = toMinutes(slot.end_time) - toMinutes(slot.start_time);
        const target = await makeUpDay(addDays(today, 1), addDays(today, 6), minutes);
        if (target) {
            moved = { date, ...target };
            break;
        }
    }
    expect(moved, 'a session and a free day for its make-up in the next week').toBeTruthy();

    // The next weekly session after that one (no record, or pending): only called off, made up later.
    for (let date = addDays(moved.date, 1); date <= addDays(today, 20) && !later; date = addDays(date, 1)) {
        if (!meets(cls, date)) continue;
        const row = await rowOn(cls.id, date);
        if (row && row.status !== 'pending') continue;
        const slot = cls.schedules.find((s) => s.day_of_week === isoWeekday(date));
        const target = await makeUpDay(addDays(date, 1), addDays(date, 10), toMinutes(slot.end_time) - toMinutes(slot.start_time), [moved.newDate]);
        if (target) later = { date, ...target };
    }

    // A weekly session of the last two weeks that happened (called off for this test) and a free day ahead
    // for its make-up.
    for (let date = addDays(today, -1); date >= addDays(today, -14) && !pastOff; date = addDays(date, -1)) {
        if (!meets(cls, date)) continue;
        const row = await rowOn(cls.id, date);
        if (!row || row.status === 'cancelled' || row.is_extra) continue;
        if ((await rest(staff, `instructor_attendance?select=id&class_id=eq.${cls.id}&makes_up=eq.${date}`)).data.length) continue;
        const slot = cls.schedules.find((s) => s.day_of_week === isoWeekday(date));
        const skip = [moved.newDate, later?.newDate].filter(Boolean);
        const target = await makeUpDay(addDays(today, 1), addDays(today, 12), toMinutes(slot.end_time) - toMinutes(slot.start_time), skip);
        if (target) pastOff = { date, ...target };
    }

    // A day 5–6 weeks ahead on which the most classes meet.
    const classes = (await rest(staff, 'classes?select=id,name,starts_on,ended_on,schedules:class_schedules(day_of_week,start_time,end_time)')).data;
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, 35 + i)).map((date) => ({ date, classes: classes.filter((c) => meets(c, date)) }));
    closed = days.sort((a, b) => b.classes.length - a.classes.length)[0];

    for (const [classId, date] of [
        [cls.id, moved.date],
        [cls.id, moved.newDate],
        ...(later ? [[cls.id, later.date], [cls.id, later.newDate]] : []),
        ...(pastOff ? [[cls.id, pastOff.date], [cls.id, pastOff.newDate]] : []),
    ]) await remember(classId, date);
    for (const c of closed.classes) await remember(c.id, closed.date);
    // Leftovers of an interrupted run go first.
    await cleanUp();
});

test.afterAll(async () => {
    if (!staff || !cls) return;
    await cleanUp();
    for (const [classId, date] of created) {
        const before = existing.get(`${classId}|${date}`);
        const now = (await rest(staff, `instructor_attendance?select=*&class_id=eq.${classId}&date=eq.${date}`)).data;
        expect(now).toEqual(before ? [before] : []);
    }
});

test('staff move next week’s session to a free day in one step; the calendar shows both', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/attendance?class=${cls.id}&day=${moved.date}`);
    const modal = sessionModal(page);
    await expect(modal).toContainText(cls.name);
    await modal.getByRole('button', { name: 'Call off / move' }).click();

    const dialog = changeDialog(page);
    await expect(dialog).toContainText('Call off or move the session');
    await expect(dialog.getByRole('button', { name: /^Make it up on another day/ })).toHaveAttribute('aria-pressed', 'true');
    // Nothing goes without a reason.
    await expect(dialog.getByRole('button', { name: 'Move the session' })).toBeDisabled();
    await dialog.getByRole('group', { name: 'Ready-made reasons' }).getByRole('button', { name: STORM }).click();
    await expect(reasonField(dialog)).toHaveValue(STORM);
    // The make-up's day is suggested (a day without a class); the spec picks its own free one.
    await expect(dialog.getByLabel('Date', { exact: true })).not.toHaveValue('');
    await dialog.getByLabel('Date', { exact: true }).fill(moved.newDate);
    // Picking the start keeps the session's length, so the end follows (re-picking it would clear it).
    await pickOption(page, dialog, 'From', moved.start);
    await dialog.getByRole('button', { name: 'Move the session' }).click();
    await expectToast(page, 'Moved to');
    await expect(dialog).toHaveCount(0);

    expect(await rowOn(cls.id, moved.date)).toMatchObject({ status: 'cancelled', cancel_reason: STORM });
    expect(await rowOn(cls.id, moved.newDate)).toMatchObject({ status: 'pending', is_extra: true, makes_up: moved.date, start_time: `${moved.start}:00`, end_time: `${moved.end}:00` });

    // The session dialog now says why, and when it is made up.
    await expect(modal).toContainText(`Called off: ${STORM}`);
    await expect(modal).toContainText(`Made up on ${short(moved.newDate)}, ${moved.start}–${moved.end}`);
    await expect(modal.getByRole('button', { name: 'Call off / move' })).toHaveCount(0);
    await modal.getByRole('button', { name: 'Close' }).last().click();
    await expect(modal).toHaveCount(0);

    // The calendar: the day called off with its reason, the make-up tagged with the day it replaces.
    for (const [day, name] of [
        [moved.date, new RegExp(`^${escape(short(moved.date))} .*${escape(cls.name)}, ${escape(STORM)}.*Cancelled`)],
        [moved.newDate, new RegExp(`^${escape(short(moved.newDate))} ${moved.start}–${moved.end} ${escape(cls.name)}.*Make-up · ${escape(badgeDay(moved.date))}`)],
    ]) {
        await page.goto(`/admin/attendance?day=${day}`);
        await pickOption(page, page.locator('.atFilters'), 'Class', cls.name);
        await expect(page.getByRole('region', { name: 'Sessions calendar' }).getByRole('button', { name })).toBeVisible();
    }

    // The make-up's own dialog names the day it replaces.
    await page.getByRole('region', { name: 'Sessions calendar' }).getByRole('button', { name: new RegExp(`Make-up · ${escape(badgeDay(moved.date))}`) }).click();
    await expect(sessionModal(page)).toContainText(`Make-up for ${short(moved.date)}`);
    await page.context().close();
});

test('a member student sees the day off and the make-up in My Classes and in the bell', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, GUEST);
    await page.goto(`/profile/my-classes?class=${cls.id}`);

    const notice = page.locator('.pfChangeNotice');
    await expect(notice).toContainText('Schedule changes');
    await expect(notice).toContainText(`Off on ${short(moved.date)}`);
    await expect(notice).toContainText(STORM);
    await expect(notice).toContainText(`Make-up ${short(moved.newDate)}, ${moved.start}–${moved.end}`);
    await expect(notice).toContainText(`Instead of ${short(moved.date)}`);
    const week = page.locator('.pfClassView .pfWeek');
    await expect(week.locator('.pfDay.isOff')).toHaveCount(1);
    await expect(week.locator('.pfDay.isOff')).toContainText('Called off');
    await expect(week.locator('.pfDay.isMakeUp')).toContainText(moved.start);
    await expect(week.locator('.pfDay.isMakeUp')).toContainText('Make-up');

    // The bell counts both changes until it is opened.
    const bell = page.getByRole('button', { name: /^Notifications: .*2 schedule changes$/ });
    await expect(bell).toBeVisible();
    await bell.click();
    const changes = page.locator('.duesPanel .duesChanges');
    await expect(changes).toContainText(`${cls.name} is off on ${short(moved.date)}`);
    await expect(changes).toContainText(`${cls.name}: make-up ${short(moved.newDate)}, ${moved.start}–${moved.end}`);
    await expect(changes.locator('.duesNew')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Notifications/ })).not.toHaveAccessibleName(/schedule change/);

    // A row opens the class.
    await page.goto('/profile');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page.locator('.duesPanel .duesChanges .taskItem').filter({ hasText: 'make-up' }).click();
    await expect(page).toHaveURL(new RegExp(`/profile/my-classes\\?class=${cls.id}$`));
    await expect(page.locator('.pfChangeNotice')).toBeVisible();
    await page.context().close();
});

test('staff call a session ahead off without a make-up, then schedule it from the cancelled session', async ({ browser }) => {
    test.skip(!later, 'no later session with a free day after it');
    const page = await (await browser.newContext()).newPage();
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/attendance?class=${cls.id}&day=${later.date}`);
    const modal = sessionModal(page);
    await modal.getByRole('button', { name: 'Call off / move' }).click();

    let dialog = changeDialog(page);
    await dialog.getByRole('button', { name: /^Only call it off/ }).click();
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveCount(0);
    await reasonField(dialog).fill(OWN_REASON);
    await dialog.getByRole('button', { name: 'Call off the session' }).click();
    await expectToast(page, 'Session called off.');
    expect(await rowOn(cls.id, later.date)).toMatchObject({ status: 'cancelled', cancel_reason: OWN_REASON });
    expect(await rowOn(cls.id, later.newDate)).toBeNull();

    await expect(modal).toContainText(`Called off: ${OWN_REASON}`);
    await expect(modal).toContainText('This session was cancelled.');
    await modal.getByRole('button', { name: 'Add a make-up session' }).click();
    dialog = changeDialog(page);
    await expect(dialog).toContainText('Schedule the make-up');
    await expect(reasonField(dialog)).toHaveValue(OWN_REASON);
    await dialog.getByLabel('Date', { exact: true }).fill(later.newDate);
    await pickOption(page, dialog, 'From', later.start);
    await dialog.getByRole('button', { name: 'Add the make-up' }).click();
    await expectToast(page, 'Make-up added on');
    await expect(modal).toContainText(`Made up on ${short(later.newDate)}, ${later.start}–${later.end}`);
    expect(await rowOn(cls.id, later.newDate)).toMatchObject({ status: 'pending', is_extra: true, makes_up: later.date });
    expect(await rowOn(cls.id, later.date)).toMatchObject({ status: 'cancelled', cancel_reason: OWN_REASON });
    await page.context().close();
});

test('a session called off on a day already past gets its make-up from its dialog, which says the day it replaces', async ({ browser }) => {
    test.skip(!pastOff, 'no past session with a free day ahead for its make-up');
    // Called off back then (the studio forgot to schedule the make-up).
    const off = await rest(staff, `instructor_attendance?class_id=eq.${cls.id}&date=eq.${pastOff.date}`, { method: 'PATCH', body: { status: 'cancelled', cancel_reason: STORM } });
    expect(off.status, JSON.stringify(off.data)).toBeLessThan(300);

    const page = await (await browser.newContext()).newPage();
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto(`/admin/attendance?class=${cls.id}&day=${pastOff.date}`);
    const modal = sessionModal(page);
    await expect(modal).toContainText(`Called off: ${STORM}`);
    await modal.getByRole('button', { name: 'Add a make-up session' }).click();
    const dialog = changeDialog(page);
    await expect(dialog).toContainText('Schedule the make-up');
    await expect(reasonField(dialog)).toHaveValue(STORM);
    await dialog.getByLabel('Date', { exact: true }).fill(pastOff.newDate);
    await pickOption(page, dialog, 'From', pastOff.start);
    await dialog.getByRole('button', { name: 'Add the make-up' }).click();
    await expectToast(page, 'Make-up added on');
    await expect(modal).toContainText(`Made up on ${short(pastOff.newDate)}, ${pastOff.start}–${pastOff.end}`);
    expect(await rowOn(cls.id, pastOff.newDate)).toMatchObject({ status: 'pending', is_extra: true, makes_up: pastOff.date });
    expect(await rowOn(cls.id, pastOff.date)).toMatchObject({ status: 'cancelled', cancel_reason: STORM });
    await page.context().close();
});

test('close the studio for a day far ahead: the preview, the bookings refunded, then a make-up per class', async ({ browser }) => {
    // One approved booking that day with 100.000 paid: the studio cancels it, everything goes back.
    const slots = (await rpc(staff, 'get_available_slots', { p_date: closed.date })).data.sort((a, b) => a.room_id - b.room_id);
    const slot = slots.find((row) => toMinutes(row.end_time) - Math.ceil(toMinutes(row.start_time) / 60) * 60 >= 60);
    const start = toClock(Math.ceil(toMinutes(slot.start_time) / 60) * 60);
    const booker = (await rest(staff, `profiles?select=id&email=eq.${BOOKER}`)).data[0];
    const booking = await rpc(staff, 'booking_staff_create', {
        p_guest: booker.id, p_room: slot.room_id, p_date: closed.date, p_start: start, p_end: toClock(toMinutes(start) + 60), p_details: NOTE, p_status: 'approved', p_paid: 100000, p_method: 'transfer',
    });
    expect(booking.status, JSON.stringify(booking.data)).toBe(200);
    closed.bookingId = booking.data.id;
    // What the studio cancels that day: pending, approved and paid-up (completed) bookings.
    const bookings = (await rest(staff, `bookings?select=id,bank_transfer,cash&date=eq.${closed.date}&status=in.(pending,approved,completed)`)).data;
    const live = bookings.length;
    const back = bookings.reduce((sum, row) => sum + Number(row.bank_transfer ?? 0) + Number(row.cash ?? 0), 0);

    const page = await (await browser.newContext()).newPage();
    await login(page, 'staff@demo.oopsdance.test');
    await page.goto('/admin/attendance');
    await page.getByRole('button', { name: 'Close for a day' }).click();
    const dialog = page.locator('.scgClose');
    await expect(dialog).toContainText('Close the studio for a day');
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue(today);
    await dialog.getByLabel('Date', { exact: true }).fill(closed.date);
    await dialog.getByRole('group', { name: 'Ready-made reasons' }).getByRole('button', { name: HOLIDAY }).click();

    const preview = dialog.locator('.scgPreview');
    const count = closed.classes.length;
    await expect(preview).toContainText(count ? `${count} ${count === 1 ? 'class is' : 'classes are'} called off` : 'No class to call off');
    for (const c of closed.classes) await expect(preview).toContainText(c.name);
    await expect(preview).toContainText(`${live} room ${live === 1 ? 'booking' : 'bookings'} that day`);
    await expect(preview).toContainText(`Goes back to the guests: ${vnd(back)}`);
    await expect(dialog.getByRole('checkbox', { name: /Also cancel that day’s room bookings/ })).toBeChecked();

    await dialog.getByRole('button', { name: `Close on ${short(closed.date)}` }).click();
    await expectToast(page, `The studio is closed on ${short(closed.date)}.`);
    const done = dialog.locator('.scgDone');
    await expect(done).toContainText(`Closed on ${short(closed.date)}`);
    await expect(done).toContainText(`${count} ${count === 1 ? 'session' : 'sessions'} called off`);
    await expect(done).toContainText(`${live} ${live === 1 ? 'booking' : 'bookings'} cancelled`);

    const rows = (await rest(staff, `instructor_attendance?select=${ROW}&date=eq.${closed.date}&status=eq.cancelled`)).data;
    expect(rows.filter((row) => row.cancel_reason === HOLIDAY).length).toBe(count);
    expect((await rest(staff, `bookings?select=status,cancel_kind,refund_due&id=eq.${closed.bookingId}`)).data[0]).toMatchObject({ status: 'cancelled', cancel_kind: 'studio', refund_due: 100000 });
    const log = (await rest((await token('admin@demo.oopsdance.test')).jwt, `activity_log?select=meta,label&area=eq.sessions&action=eq.day_closed&entity_id=eq.${closed.date}&order=at.desc&limit=1`)).data[0];
    expect(log).toMatchObject({ label: HOLIDAY, meta: { date: closed.date, sessions: count, bookings: live } });

    // Each class gets a "Schedule the make-up" (the make-up dialog for that class and day).
    test.skip(!count, 'no class meets that day');
    const first = [...closed.classes].sort((a, b) => a.name.localeCompare(b.name))[0];
    await dialog.getByRole('button', { name: `Schedule the make-up for ${first.name}` }).click();
    const makeUp = changeDialog(page);
    await expect(makeUp).toContainText('Schedule the make-up');
    await expect(makeUp).toContainText(first.name);
    await expect(reasonField(makeUp)).toHaveValue(HOLIDAY);
    await makeUp.getByRole('button', { name: 'Close' }).last().click();
    await expect(makeUp).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toHaveCount(0);
    await page.context().close();
});
