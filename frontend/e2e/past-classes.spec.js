import { test, expect } from '@playwright/test';
import { login, rest, rpc, studioToday, token } from './support.js';

// "Classes you've taken" on My classes (students): every course they were billed for that has started
// (classes they're in, left or that ended), grouped by month, each with its class, teacher, song and
// tuition, a receipt per course, Pay while it's open and chips to narrow it to one class. Instructors
// don't get the button. Expectations are read through REST as the student, not fixed demo values
// (the demo makes some tuition late at random).

test.describe.configure({ mode: 'serial' });

const EMAIL = 'guest@demo.oopsdance.test';
const TITLE = /Classes you.ve taken/;
const FIELDS = 'id,class_id,class_name,lesson_id,lesson_title,month,amount,paid_amount,status,due_date,payment_code';

let page;
let today;
let started; // the student's invoices of courses that have started, as the dialog lists them
let pick; // { invoice, teacher }: the newest course of a class they're in, with a teacher to show

const song = (title) => title.split(/\s+[—–-]\s+/)[0];
const money = (amount) => String(Math.round(Number(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const monthLabel = (month) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
const dayMonth = (iso) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00:00`));
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The chip StatusPill shows for a live invoice (tuitionData.statusOf).
function statusText(invoice) {
    if (invoice.status === 'paid') return 'Paid';
    if (invoice.status === 'waived') return 'Waived';
    if (invoice.due_date < today) return 'Overdue';
    if (Number(invoice.paid_amount) > 0) return 'Part paid';
    return `Due by ${dayMonth(invoice.due_date)}`;
}

const dialogOf = (target) => target.getByRole('dialog', { name: TITLE });
const rowOf = (dialog, invoice) =>
    dialog
        .getByRole('region', { name: monthLabel(invoice.month) })
        .locator('.pcRow')
        .filter({ has: dialog.page().locator('.pcClass', { hasText: invoice.class_name }) })
        .filter({ hasText: song(invoice.lesson_title || invoice.course?.title || '') });

test.beforeAll(async ({ browser }) => {
    const me = await token(EMAIL);
    today = await studioToday();
    const invoices = (await rest(me.jwt, `tuition_invoices?select=${FIELDS},course:class_lessons!lesson_id(title,starts_on)&student_id=eq.${me.id}`)).data;
    const places = (await rest(me.jwt, `class_students?select=class_id&student_id=eq.${me.id}`)).data;
    const classIds = [...new Set(invoices.map((row) => row.class_id).filter((id) => id != null))];
    const progress = new Map((await rpc(me.jwt, 'lesson_progress', { p_class_ids: classIds })).data.map((row) => [row.lesson_id, row]));
    const listed = new Map((await rpc(me.jwt, 'list_public_classes')).data.map((cls) => [cls.id, cls]));

    // A course has started once its progress says so (no progress: its first day has passed).
    started = invoices.filter((invoice) => {
        const row = progress.get(invoice.lesson_id);
        return row ? row.status !== 'planned' : (invoice.course?.starts_on ?? invoice.month) <= today;
    });
    const startOf = (invoice) => progress.get(invoice.lesson_id)?.starts_on ?? invoice.course?.starts_on ?? invoice.month;
    const mine = new Set(places.map((place) => place.class_id));
    const candidate = started
        .filter((invoice) => mine.has(invoice.class_id) && invoice.status !== 'void' && listed.get(invoice.class_id)?.instructor_name)
        .sort((a, b) => startOf(b).localeCompare(startOf(a)))[0];
    expect(candidate, 'guest@ has a started course in a class they are in').toBeTruthy();
    pick = { invoice: candidate, teacher: listed.get(candidate.class_id).instructor_name };

    page = await browser.newPage();
});
test.afterAll(() => page.close());

test('opens "Classes you’ve taken" from My classes', async () => {
    await login(page, EMAIL);
    await page.goto('/profile/my-classes');
    await expect(page.locator('.singleItem').first()).toBeVisible();
    await page.getByRole('button', { name: TITLE }).click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    // Every started course, cancelled ones included; none that hasn't started.
    await expect(dialog.locator('.pcRow')).toHaveCount(started.length);
});

test('a course shows its class, teacher, song, month and invoice status', async () => {
    const row = rowOf(dialogOf(page), pick.invoice);
    await expect(row).toHaveCount(1);
    await expect(row.locator('.pcClass')).toHaveText(pick.invoice.class_name);
    await expect(row.locator('.pcTeacher')).toContainText(pick.teacher);
    await expect(row.locator('.pcSong')).toContainText(song(pick.invoice.lesson_title || pick.invoice.course.title));
    await expect(row.locator('.tuPill')).toHaveText(statusText(pick.invoice));
});

test('the receipt shows the payment code and the amount', async () => {
    const dialog = dialogOf(page);
    await rowOf(dialog, pick.invoice).getByRole('button', { name: 'Receipt' }).click();
    const receipt = page.getByRole('article', { name: `Receipt for ${pick.invoice.payment_code}` });
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText(pick.invoice.payment_code);
    await expect(receipt).toContainText(money(pick.invoice.amount));
    await expect(receipt).toContainText(pick.invoice.class_name);
    await page.keyboard.press('Escape');
    await expect(receipt).toBeHidden();
    await expect(dialog).toBeVisible();
});

test('an open course has a Pay button that opens the QR dialog', async () => {
    const open = started.find((invoice) => invoice.status === 'unpaid');
    test.skip(!open, 'no open course right now');
    await rowOf(dialogOf(page), open).getByRole('button', { name: /^Pay / }).click();
    const pay = page.getByRole('dialog', { name: /Pay (by bank transfer|at the studio desk)/ });
    await expect(pay).toBeVisible();
    await expect(pay).toContainText(open.payment_code);
    await page.keyboard.press('Escape');
    await expect(pay).toBeHidden();
    await expect(dialogOf(page)).toBeVisible();
});

test('the class chips narrow the list to one class', async () => {
    const counts = new Map();
    for (const invoice of started) counts.set(invoice.class_name, (counts.get(invoice.class_name) ?? 0) + 1);
    test.skip(counts.size < 2, 'only one class billed');
    const [other, count] = [...counts.entries()].find(([name]) => name !== pick.invoice.class_name);
    const dialog = dialogOf(page);
    const chips = dialog.getByRole('group', { name: 'Class' });

    await chips.getByRole('button', { name: new RegExp(`^${escape(other)}\\s*${count}$`) }).click();
    await expect(dialog.locator('.pcRow')).toHaveCount(count);
    expect(new Set(await dialog.locator('.pcClass').allTextContents())).toEqual(new Set([other]));
    await expect(rowOf(dialog, pick.invoice)).toHaveCount(0);

    await chips.getByRole('button', { name: /^All classes/ }).click();
    await expect(dialog.locator('.pcRow')).toHaveCount(started.length);
});

test('an instructor doesn’t get the button', async ({ browser }) => {
    const teacher = await browser.newPage();
    await login(teacher, 'instructor@demo.oopsdance.test');
    await teacher.goto('/profile/my-classes');
    await expect(teacher.locator('.singleItem').first()).toBeVisible();
    await expect(teacher.getByRole('button', { name: TITLE })).toHaveCount(0);
    await teacher.close();
});
