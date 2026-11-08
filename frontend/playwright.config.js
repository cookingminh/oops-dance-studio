import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the local Supabase stack (`supabase start` + `supabase db reset`
// + `node scripts/demo-images.mjs --local`, run from the repository root).
// The specs share one database, so they run one file at a time.
const APP = 'http://127.0.0.1:5173';
// Same app built with VITE_DEMO_MODE=true (one-click logins, banner, locked demo accounts).
const DEMO = 'http://127.0.0.1:5174';
const DEMO_SPEC = /demo-mode\.spec\.js/;

export default defineConfig({
    testDir: './e2e',
    workers: 1,
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        ...devices['Desktop Chrome'],
        // The dashboards need a desktop-sized window (sidebar + tables).
        viewport: { width: 1440, height: 900 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'app', testIgnore: DEMO_SPEC, use: { baseURL: APP } },
        { name: 'demo-mode', testMatch: DEMO_SPEC, use: { baseURL: DEMO } },
    ],
    webServer: [
        {
            // Port 5173 matches the Auth redirect URLs in supabase/config.toml.
            command: 'npm run dev -- --host 127.0.0.1',
            url: APP,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        {
            command: 'npm run dev -- --host 127.0.0.1 --port 5174',
            url: DEMO,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { VITE_DEMO_MODE: 'true', VITE_DEMO_PASSWORD: process.env.E2E_PASSWORD ?? 'OopsDemo@2026' },
        },
    ],
});
