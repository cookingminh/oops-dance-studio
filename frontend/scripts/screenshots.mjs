// README screenshots (docs/images/) from the local stack at deviceScaleFactor 2.
// Needs the stack seeded (`supabase db reset && node scripts/demo-images.mjs --local`)
// and the dev server on :5173 (`npm run dev`). Run: npm run screenshots
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const PASSWORD = process.env.E2E_PASSWORD ?? 'OopsDemo@2026';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'images');
const ONLY = process.argv.slice(2);

async function login(page, email) {
    await page.goto(`${BASE}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

// Lets images, charts and entrance animations settle.
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(1500));

const SHOTS = {
    home: async (page) => {
        await page.goto(`${BASE}/home`);
        await settle(page);
    },
    timetable: async (page) => {
        await page.goto(`${BASE}/home`);
        await page.locator('.timeTableDiv').scrollIntoViewIfNeeded();
        await settle(page);
    },
    dashboard: async (page) => {
        await login(page, 'staff@demo.oopsdance.test');
        await page.getByText('Studio Stats').waitFor();
        await settle(page);
    },
    'instructor-checkin': async (page) => {
        await login(page, 'instructor@demo.oopsdance.test');
        await page.goto(`${BASE}/profile/attendance`);
        await page.getByText('Your Classes Today').waitFor();
        await settle(page);
    },
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [name, shoot] of Object.entries(SHOTS)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await shoot(page);
    const png = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: png });
    // WebP keeps the README light; cwebp ships with libwebp (brew install webp).
    execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', path.join(OUT, `${name}.webp`)]);
    rmSync(png);
    console.log(`✓ docs/images/${name}.webp`);
    await page.close();
}
await browser.close();
