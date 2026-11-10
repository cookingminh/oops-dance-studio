// Routine promos: the instructor films a short clip of their class's next routine; students watch it in
// their class and before they renew, visitors on /classes; staff are reminded, see who made it, can
// swap it for a YouTube Short and take it off. The routine ends without a promo, as it started.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { API, ANON, expectToast, login, rest, rpc, studioToday, token } from './support.js';

const CLIP = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'promo.webm');
const SHORT = 'https://youtube.com/shorts/mxHD5wW5NuY';
const CAPTION = 'Lots of footwork, beginners welcome!';
const song = (title) => title.split(' — ')[0];

// The demo instructor's class with the soonest planned routine, and a student still asked to renew for it.
async function target() {
    const { jwt, id } = await token('instructor@demo.oopsdance.test');
    const classes = (await rest(jwt, `classes?select=id,name&instructor_id=eq.${id}`)).data;
    const progress = (await rpc(jwt, 'lesson_progress', { p_class_ids: classes.map((cls) => cls.id) })).data;
    const next = progress.filter((row) => row.status === 'planned').sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
    const cls = classes.find((row) => row.id === next.class_id);
    const staff = (await token('staff@demo.oopsdance.test')).jwt;
    const asked = (
        await rest(staff, `tuition_invoices?select=student:profiles!student_id(email)&lesson_id=eq.${next.lesson_id}&status=eq.unpaid&renewal=is.null&limit=1`)
    ).data;
    return { jwt, cls, next, student: asked[0]?.student?.email ?? null };
}

// Files left in the routine's promo folder.
async function promoFiles(jwt, cls, next) {
    const res = await fetch(`${API}/storage/v1/object/list/class-promos`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: `${cls.id}/${next.lesson_id}/`, limit: 100 }),
    });
    return (await res.json()).map((row) => `${cls.id}/${next.lesson_id}/${row.name}`);
}

// No promo on the routine and nothing in its folder.
async function clearPromo({ jwt, cls, next }) {
    await rpc(jwt, 'lesson_set_promo', { p_lesson: next.lesson_id });
    const files = await promoFiles(jwt, cls, next);
    if (files.length) {
        await fetch(`${API}/storage/v1/object/class-promos`, {
            method: 'DELETE',
            headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: files }),
        });
    }
}

test.describe.serial('routine promos', () => {
    let t;

    test.beforeAll(async () => {
        t = await target();
        await clearPromo(t);
    });

    test.afterAll(async () => {
        await clearPromo(t);
    });

    test('staff are reminded while a routine starting soon has no promo', async ({ page }) => {
        const days = (Date.parse(t.next.starts_on) - Date.parse(await studioToday())) / 86_400_000;
        test.skip(days > 14, 'the next routine starts more than two weeks ahead');
        await login(page, 'staff@demo.oopsdance.test');
        await page.locator('.taskBell').click();
        await expect(page.getByText(`${t.cls.name} has no promo for its next routine`)).toBeVisible();
    });

    test('the instructor films it: the overview asks, the class card takes the clip', async ({ page }) => {
        await login(page, 'instructor@demo.oopsdance.test');
        const nudge = page.locator('.pfPromoNudge');
        await expect(nudge).toContainText(song(t.next.title));
        await nudge.getByRole('link', { name: `Upload the promo of “${t.next.title}”` }).click();
        await expect(page).toHaveURL(new RegExp(`class=${t.cls.id}&promo=1`));

        const card = page.locator('.pfPromo');
        await expect(card).toContainText('Promo for the next routine');
        await card.getByTestId('promo-file').setInputFiles(CLIP);
        await expect(card.locator('.prFile')).toContainText('promo.webm');
        await card.getByLabel('A line for students (optional)').fill(CAPTION);
        await card.getByRole('button', { name: 'Publish promo' }).click();
        await expectToast(page, `Promo published for “${t.next.title}”.`);
        await expect(card).toContainText('Published');
        await expect(card).toContainText(CAPTION);
        await expect(card.locator('video')).toHaveAttribute('src', /\/class-promos\//);

        await page.goto('/profile');
        await expect(page.locator('.pfSnapshotCard .pfLesson').first()).toBeVisible();
        await expect(page.locator('.pfPromoNudge').filter({ hasText: song(t.next.title) })).toHaveCount(0);
    });

    test('students watch it in their class and while deciding to renew', async ({ page }) => {
        test.skip(!t.student, 'nobody is still asked to renew for this course');
        await login(page, t.student);
        await page.goto(`/profile/my-classes?class=${t.cls.id}`);
        const card = page.locator('.pfPromo.isStudent');
        await expect(card).toContainText(song(t.next.title));
        await expect(card).toContainText(CAPTION);
        await card.getByRole('button', { name: 'Watch the promo', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.locator('video')).toHaveAttribute('src', /\/class-promos\//);
        await page.keyboard.press('Escape');

        await page.goto('/profile/tuition');
        const renewal = page.locator('.tuRenew').filter({ hasText: song(t.next.title) });
        await renewal.getByRole('button', { name: /Watch the promo/ }).click();
        await expect(page.getByRole('dialog')).toContainText(CAPTION);
    });

    test('visitors see it on /classes, with the way in', async ({ page }) => {
        await page.goto('/classes');
        await expect(page.locator('.pubPageJump').getByRole('link', { name: 'Coming next' })).toBeVisible();
        const section = page.locator('#next-routines');
        await section.getByRole('button', { name: `Play the promo of ${t.cls.name}: ${t.next.title}` }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText(CAPTION);
        await expect(dialog.getByRole('link', { name: /Claim my free class/ })).toHaveAttribute('href', '/register');
    });

    test('staff see who made it, swap it for a YouTube Short and take it off', async ({ page }) => {
        await login(page, 'staff@demo.oopsdance.test');
        await page.goto(`/admin/classes/${t.cls.id}?tab=routines`);
        const row = page.locator('.rtPromo').filter({ has: page.getByRole('button', { name: `Replace the promo of “${t.next.title}”` }) });
        await expect(row).toContainText('Uploaded by');
        await expect(row).toContainText(CAPTION);

        await row.getByRole('button', { name: `Replace the promo of “${t.next.title}”` }).click();
        const uploader = page.locator('.rtPromo.isUploading');
        await uploader.getByRole('button', { name: 'YouTube link' }).click();
        await uploader.getByLabel('YouTube link').fill(SHORT);
        await uploader.getByRole('button', { name: 'Publish promo' }).click();
        await expectToast(page, `Promo published for “${t.next.title}”.`);
        await expect(page.locator('.rtPromo').filter({ hasText: 'YouTube Short' })).toContainText(CAPTION);

        // The uploaded clip and its poster went with the swap.
        const staff = (await token('staff@demo.oopsdance.test')).jwt;
        await expect.poll(async () => (await promoFiles(staff, t.cls, t.next)).length).toBe(0);
        const lesson = (await rest(null, `class_lessons?select=promo_url,promo_path&id=eq.${t.next.lesson_id}`)).data[0];
        expect(lesson).toEqual({ promo_url: SHORT, promo_path: null });

        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: `Remove the promo of “${t.next.title}”` }).click();
        await expectToast(page, 'Promo removed.');
        await expect(page.locator('.rtPromo.isMissing').first()).toContainText('No promo yet');
    });

    test('an instructor can only touch their own class’s promo', async () => {
        const other = await token('instructor2@demo.oopsdance.test');
        const res = await rpc(other.jwt, 'lesson_set_promo', { p_lesson: t.next.lesson_id, p_url: SHORT });
        expect(res.data.message).toMatch(/^FORBIDDEN/);
        const lesson = (await rest(null, `class_lessons?select=promo_url&id=eq.${t.next.lesson_id}`)).data[0];
        expect(lesson.promo_url).toBeNull();
    });
});
