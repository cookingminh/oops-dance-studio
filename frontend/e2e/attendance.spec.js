// The Attendance page (/admin/attendance): student roll calls and instructor check-ins in one place.
// Today's sessions with their roll call, a planned session handled from the calendar (note,
// substitute, call off with a reason, reopen) in the session dialog, the list with its CSV export, and a
// deep link.
// Everything it changes (one session row, one roll-call mark) is put back exactly as it was. On a day no
// class meets, it adds a session today for the run (and removes it again).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { dropSessionToday, expectToast, isoWeekday, login, pickOption, rest, sessionToday, staffJwt, studioToday } from './support.js';

test.describe.configure({ mode: 'serial' });

const NOTE = 'E2E attendance note';
const SESSION = 'id,class_id,instructor_id,date,status,details,is_extra';

let page;
let dialog;
let staff;
let today;
let planned; // a pending weekly session after today: { row, cls: { id, name }, start, end }
let substitute; // another instructor: { id, full_name }
let rollMark; // one of today's roll-call marks: { id, status, class_id }
let rollClass; // { id, name }
let closed; // a past completed session, briefly reopened for the review queue: { original, name }
let todaySession; // a session today (sessionToday)

// "Thu 12 Nov 18:30–19:45 <class>…" (how the calendar names its items).
const short = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));
const mondayOf = (iso) => {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (isoWeekday(iso) - 1));
    return date.toISOString().slice(0, 10);
};
const sessionRow = async () => (await rest(staff, `instructor_attendance?select=${SESSION}&id=eq.${planned.row.id}`)).data[0];

test.beforeAll(async ({ browser }) => {
    staff = await staffJwt();
    today = await studioToday();
    todaySession = await sessionToday();

    // A planned weekly session (the week's records exist from today on) of a class with a weekly slot that day.
    const rows = (
        await rest(
            staff,
            `instructor_attendance?select=${SESSION},class:classes!class_id(id,name,instructor_id,ended_on,schedules:class_schedules(day_of_week,start_time,end_time))&date=gt.${today}&status=eq.pending&is_extra=eq.false&order=date,id&limit=20`
        )
    ).data;
    const row = rows.find((item) => !item.class.ended_on && item.class.schedules.some((slot) => slot.day_of_week === isoWeekday(item.date)));
    if (row) {
        const slot = row.class.schedules.find((item) => item.day_of_week === isoWeekday(row.date));
        planned = { row, cls: { id: row.class.id, name: row.class.name }, start: slot.start_time.slice(0, 5), end: slot.end_time.slice(0, 5) };
        planned.original = (await rest(staff, `instructor_attendance?select=*&id=eq.${row.id}`)).data[0];
        substitute = (await rest(staff, `profiles?select=id,full_name&role=eq.instructor&id=neq.${row.instructor_id}&order=full_name&limit=1`)).data[0];
    }

    // One of today's roll calls (created by "Create today's roll calls" or the daily job).
    const marks = (await rest(staff, `student_attendance?select=id,status,class_id,class:classes!class_id(id,name)&date=eq.${today}&order=id&limit=1`)).data;
    if (marks.length) {
        rollMark = { id: marks[0].id, status: marks[0].status, class_id: marks[0].class_id };
        rollMark.original = (await rest(staff, `student_attendance?select=*&id=eq.${rollMark.id}`)).data[0];
        rollClass = marks[0].class;
    }

    // A past weekly session that was completed (with its check-in).
    const done = (await rest(staff, `instructor_attendance?select=*,class:classes!class_id(name)&date=lt.${today}&status=eq.completed&is_extra=eq.false&checkin_at=not.is.null&order=date.desc&limit=1`)).data[0];
    if (done) {
        const { class: cls, ...original } = done;
        closed = { original, name: cls.name };
    }

    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
    dialog = page.getByRole('dialog');
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close().catch(() => {});
    if (planned) {
        const { status, instructor_id, details } = planned.row;
        const res = await rest(staff, `instructor_attendance?id=eq.${planned.row.id}`, { method: 'PATCH', body: { status, instructor_id, details } });
        expect(res.status).toBeLessThan(300);
        expect((await rest(staff, `instructor_attendance?select=*&id=eq.${planned.row.id}`)).data).toEqual([planned.original]);
    }
    if (closed) {
        const { status, checkin_at, checkout_at } = closed.original;
        await rest(staff, `instructor_attendance?id=eq.${closed.original.id}`, { method: 'PATCH', body: { status, checkin_at, checkout_at } });
        expect((await rest(staff, `instructor_attendance?select=*&id=eq.${closed.original.id}`)).data).toEqual([closed.original]);
    }
    if (rollMark) {
        await rest(staff, `student_attendance?id=eq.${rollMark.id}`, { method: 'PATCH', body: { status: rollMark.status } });
        expect((await rest(staff, `student_attendance?select=*&id=eq.${rollMark.id}`)).data).toEqual([rollMark.original]);
    }
    await dropSessionToday(todaySession);
});

test('one Attendance page in the sidebar; the old addresses lead to it', async () => {
    await page.goto('/admin/students');
    await expect(page).toHaveURL(/\/admin\/attendance$/);
    const sideBar = page.locator('.sideBar');
    await expect(sideBar.getByRole('link', { name: /^Attendance/ })).toBeVisible();
    await expect(sideBar.getByText('Instructor Attendance', { exact: true })).toHaveCount(0);
    await expect(sideBar.getByText('Students', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sessions calendar' })).toBeVisible();
});

test('today lists the sessions in time order, each with its roll call', async () => {
    const rows = page.locator('.atTodayRow');
    await expect(rows.first()).toBeVisible();
    const starts = await rows.locator('.atTime strong').allTextContents();
    expect(starts).toEqual([...starts].sort());

    test.skip(!rollMark, 'no roll call today');
    const marks = (await rest(staff, `student_attendance?select=status&date=eq.${today}&class_id=eq.${rollClass.id}`)).data;
    const marked = marks.filter((mark) => mark.status !== 'pending').length;
    const row = rows.filter({ hasText: rollClass.name });
    await expect(row.locator('.atRoll')).toContainText(`${marked}/${marks.length} marked`);
});

test('an earlier session left open waits for review, and the sidebar badge counts it', async () => {
    test.skip(!closed, 'no completed session before today');
    const badge = page.locator('.sideBar').getByRole('link', { name: /^Attendance/ }).locator('.navBadge');
    const before = Number((await badge.count()) ? await badge.textContent() : 0);

    // The instructor checked in but never checked out (as if nobody closed it).
    await rest(staff, `instructor_attendance?id=eq.${closed.original.id}`, { method: 'PATCH', body: { status: 'in_progress' } });
    await page.goto('/admin/attendance');
    const item = page.locator('.reviewCard .reviewItem').filter({ hasText: closed.name }).filter({ hasText: 'never checked out' });
    await expect(item).toBeVisible();
    await expect(badge).toHaveText(String(before + 1));

    await item.getByRole('button', { name: 'Mark completed' }).click();
    await expectToast(page, 'Marked as completed.');
    await expect(item).toHaveCount(0);
    expect((await rest(staff, `instructor_attendance?select=status&id=eq.${closed.original.id}`)).data).toEqual([{ status: 'completed' }]);
});

test('take the roll call in the session dialog', async () => {
    test.skip(!rollMark, 'no roll call today');
    const row = page.locator('.atTodayRow').filter({ hasText: rollClass.name });
    await row.getByRole('button', { name: `Take the roll call for ${rollClass.name}` }).click();
    await expect(dialog.getByRole('heading', { name: 'Roll call' })).toBeVisible();

    // Mark the first student the other way round (restored afterwards).
    const next = rollMark.status === 'attend' ? 'absent' : 'attend';
    const student = (await rest(staff, `student_attendance?select=student:profiles!student_id(full_name)&id=eq.${rollMark.id}`)).data[0].student.full_name;
    const roster = dialog.locator('.smRosterRow', { hasText: student });
    const button = roster.getByRole('button', { name: next === 'attend' ? 'Mark attended' : 'Mark absent' });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await rest(staff, `student_attendance?select=status&id=eq.${rollMark.id}`)).data[0].status).toBe(next);

    await dialog.getByRole('button', { name: 'Close' }).last().click();
    await expect(dialog).toHaveCount(0);
});

test('a planned session from the calendar: note, substitute, call off and reopen', async () => {
    test.skip(!planned || !substitute, 'no planned session after today');
    // Only that class, then the week of the session.
    await pickOption(page, page.locator('.atFilters'), 'Class', planned.cls.name);
    const calendar = page.getByRole('region', { name: 'Sessions calendar' });
    for (let week = mondayOf(today); week < mondayOf(planned.row.date); week = new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10)) {
        await calendar.getByRole('button', { name: 'Next week' }).click();
    }
    await calendar.getByRole('button', { name: new RegExp(`^${short(planned.row.date)} ${planned.start}–${planned.end} ${planned.cls.name}`) }).click();
    await expect(dialog).toContainText(planned.cls.name);
    await expect(dialog.locator('.phaseBadge')).toHaveText('Planned');

    await dialog.getByLabel('Session note').fill(NOTE);
    await dialog.getByRole('button', { name: 'Save note' }).click();
    await expectToast(page, 'Note saved.');
    expect((await sessionRow()).details).toBe(NOTE);

    await dialog.getByRole('button', { name: 'Substitute for this session' }).click();
    await pickOption(page, dialog, 'Who teaches this session', substitute.full_name);
    await dialog.getByRole('button', { name: 'Change instructor' }).click();
    await expectToast(page, 'Instructor changed.');
    await expect(dialog.locator('.smWho')).toContainText(substitute.full_name);
    await expect(dialog.locator('.smWho')).toContainText('Substitute');
    expect((await sessionRow()).instructor_id).toBe(substitute.id);

    // Calling it off asks why (the class sees it); here without a make-up.
    await dialog.getByRole('button', { name: 'Call off / move' }).click();
    const change = page.locator('.scgDialog');
    await change.getByRole('button', { name: /^Only call it off/ }).click();
    await change.getByRole('group', { name: 'Ready-made reasons' }).getByRole('button', { name: 'Storm / bad weather' }).click();
    await change.getByRole('button', { name: 'Call off the session' }).click();
    await expectToast(page, 'Session called off.');
    await expect(change).toHaveCount(0);
    await expect(dialog).toContainText('This session was cancelled.');
    await expect(dialog).toContainText('Called off: Storm / bad weather');
    expect((await rest(staff, `instructor_attendance?select=status,cancel_reason&id=eq.${planned.row.id}`)).data[0]).toEqual({ status: 'cancelled', cancel_reason: 'Storm / bad weather' });

    await dialog.getByRole('button', { name: 'Reopen session' }).click();
    await expectToast(page, 'Session reopened.');
    await expect(dialog.locator('.phaseBadge')).toHaveText('Planned');
    expect((await sessionRow()).status).toBe('pending');

    await dialog.getByRole('button', { name: 'Close' }).last().click();
    await expect(dialog).toHaveCount(0);
});

test('the list: every recorded session, searchable, as a CSV file', async () => {
    await page.goto('/admin/attendance');
    await page.getByRole('group', { name: 'Show sessions as' }).getByRole('button', { name: 'List' }).click();
    const table = page.getByRole('grid', { name: 'Instructor attendance' });
    await expect(table).toBeVisible();
    await page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'All dates' }).click();
    test.skip(!planned, 'no planned session after today');
    await page.getByPlaceholder('Search...').fill(planned.cls.name);
    await expect(table.getByRole('row').nth(1)).toContainText(planned.cls.name);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^sessions-all\.csv$/);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    expect(csv).toMatch(/^\uFEFFDate,Start,End,Class,Place,Instructor,Check-in,Check-out,Late check-out,Status,Make-up,Note\r\n/);
    expect(csv.split('\r\n').slice(1).every((line) => line.includes(planned.cls.name))).toBe(true);
});

test('a link to one session opens it', async () => {
    test.skip(!planned, 'no planned session after today');
    await page.goto(`/admin/attendance?class=${planned.cls.id}&day=${planned.row.date}`);
    await expect(dialog).toContainText(planned.cls.name);
    await expect(dialog).toContainText(`${planned.start}–${planned.end}`);
    await dialog.getByRole('button', { name: 'Close' }).last().click();
    await expect(page).toHaveURL(/\/admin\/attendance$/);
});
