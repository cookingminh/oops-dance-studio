// The admin's Activity page (/admin/activity): the seeded demo feed in day groups with a roll call
// collapsed into one row, the person and area filters kept in the URL, a booking approved by staff
// (REST) showing at the top with its "what changed" table, and staff kept out (page and REST).
// The booking goes back to pending and the demo activity is seeded again (psql in the local database
// container, as the brief's restore command: over REST, pg-safeupdate refuses its unfiltered DELETE).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { login, rest, rpc, studioToday, token } from './support.js';

test.describe.configure({ mode: 'serial' });

// seed_demo_activity() as the database owner (the service context), in the local Supabase container.
const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_oops-dance-studio';
function canSeed() {
    try {
        execFileSync('docker', ['exec', DB_CONTAINER, 'true'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
const seedActivity = () => {
    const out = execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-c', 'select public.seed_demo_activity();'], { encoding: 'utf8' });
    expect(Number(out.trim()), 'seeded activity rows').toBeGreaterThan(0);
};

test.skip(!canSeed(), `needs the local database container (${DB_CONTAINER}) to seed the demo activity again`);

const ok = (res, label) => expect(res.status, `${label}: ${JSON.stringify(res.data)}`).toBeLessThan(300);

let page;
let staff; // { jwt, id, name }
let ami; // { id, name }
let booking; // a future pending booking, approved by the test and put back
let entries;

test.beforeAll(async ({ browser }) => {
    seedActivity();
    const today = await studioToday();
    staff = await token('staff@demo.oopsdance.test');
    const people = (await rest(staff.jwt, 'profiles?select=id,full_name,email&email=in.(staff@demo.oopsdance.test,instructor@demo.oopsdance.test)')).data;
    staff.name = people.find((p) => p.email.startsWith('staff@')).full_name;
    const instructor = people.find((p) => p.email.startsWith('instructor@'));
    ami = { id: instructor.id, name: instructor.full_name };
    // The last pending request on the calendar, far from the other specs' dates.
    booking = (await rest(staff.jwt, `bookings?select=id,date,status,guest:profiles!guest_id(full_name)&status=eq.pending&date=gt.${today}&order=date.desc,id.desc&limit=1`)).data[0];
    expect(booking, 'the seed has a future pending booking').toBeTruthy();

    page = await browser.newPage();
    await login(page, 'admin@demo.oopsdance.test');
    entries = page.locator('.alogFeed .alogEntry');
});

test.afterAll(async () => {
    if (booking) {
        ok(await rest(staff.jwt, `bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { status: booking.status } }), 'restore booking');
        const back = (await rest(staff.jwt, `bookings?select=status&id=eq.${booking.id}`)).data[0];
        expect(back.status).toBe(booking.status);
    }
    seedActivity();
    await page?.close();
});

test('the admin sees the seeded feed by day, with a roll call collapsed into one row', async () => {
    await page.locator('.adminSidebar').getByRole('link', { name: 'Activity' }).click();
    await page.waitForURL('**/admin/activity');
    await expect(page.locator('.alogOverview')).toContainText('Last 7 days');
    await expect(page.locator('.alogTotal strong')).not.toHaveText('…');

    const days = page.locator('.alogDayHead');
    await expect(days.filter({ hasText: /^Yesterday · / })).toHaveCount(1);
    expect(await days.count()).toBeGreaterThan(1);

    // A roll call is one row ("… took the roll call for … : 8 attended, 1 absent") until expanded.
    const rollCall = page.locator('.alogItem.isBurst').filter({ hasText: /took the roll call for .+: \d+ attended/ }).first();
    for (let tries = 0; tries < 3 && !(await rollCall.count()); tries += 1) await page.getByRole('button', { name: 'Load more' }).click();
    await expect(rollCall).toBeVisible();
    const toggle = rollCall.locator(':scope > .alogEntry');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(rollCall.locator('.alogChild')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await rollCall.locator('.alogChild').count()).toBeGreaterThan(1);
    await expect(rollCall.locator('.alogChild').first()).toContainText(/marked .+ (present|absent) in/);
});

test('filters by person and area, and the URL keeps them', async () => {
    await page.getByRole('button', { name: /Person/ }).click();
    await page.getByRole('option', { name: new RegExp(`^${ami.name}\\b`) }).click();
    await expect(page).toHaveURL(new RegExp(`person=${ami.id}`));

    await page.locator('.alogOverview .alogAreas').getByRole('button', { name: /^Roll call/ }).click();
    await expect(page).toHaveURL(/area=roll_call/);

    const check = async () => {
        await expect(page.locator('.alogOverview .alogAreas').getByRole('button', { name: /^Roll call/ })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: /Person/ })).toContainText(ami.name);
        await expect(entries.first()).toBeVisible();
        for (const text of await page.locator('.alogFeed .alogSentence').allTextContents()) expect(text.startsWith(`${ami.name} `), text).toBe(true);
        await expect(page.locator('.alogFeed .alogAreaBadge[data-area]:not([data-area="roll_call"])')).toHaveCount(0);
    };
    await check();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`person=${ami.id}.*area=roll_call|area=roll_call.*person=${ami.id}`));
    await check();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/person=|area=/);
});

test('a booking staff approve (REST) shows at the top, with what changed', async () => {
    const approved = await rest(staff.jwt, `bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { status: 'approved' }, prefer: 'return=representation' });
    ok(approved, 'approve booking');
    expect(approved.data[0].status).toBe('approved');

    await page.getByRole('button', { name: 'Refresh' }).click();
    const top = entries.first();
    await expect(top).toContainText(`${staff.name} approved ${booking.guest.full_name}’s booking`);
    await expect(top).toContainText('Staff');

    await top.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText(`${staff.name} approved ${booking.guest.full_name}’s booking`);
    const changed = drawer.getByRole('table');
    await expect(changed.getByRole('row', { name: /Status/ })).toContainText('Pending');
    await expect(changed.getByRole('row', { name: /Status/ })).toContainText('Approved');
    await expect(drawer.locator('.alogHistory li.isCurrent')).toContainText('approved');
    // The calendar opens on that booking's week.
    await expect(drawer.getByRole('link', { name: 'Open in Bookings' })).toHaveAttribute('href', `/admin/bookings?booking=${booking.id}&date=${booking.date}`);
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toHaveCount(0);
});

test('staff get no access: the page is guarded and REST returns nothing', async ({ browser }) => {
    const rows = await rest(staff.jwt, 'activity_log?select=id&limit=5');
    expect(rows.status).toBe(200);
    expect(rows.data).toEqual([]);
    const summary = await rpc(staff.jwt, 'activity_summary', { p_from: '2026-01-01T00:00:00Z', p_to: '2099-01-01T00:00:00Z' });
    expect(summary.status).toBeGreaterThanOrEqual(400);

    const staffPage = await browser.newPage();
    await login(staffPage, 'staff@demo.oopsdance.test');
    await expect(staffPage.locator('.adminSidebar').getByText('Activity', { exact: true })).toHaveCount(0);
    await staffPage.goto('/admin/activity');
    await staffPage.waitForURL((url) => url.pathname === '/admin');
    await staffPage.close();
});
