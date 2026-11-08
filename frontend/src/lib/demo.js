// Public demo (VITE_DEMO_MODE=true): one-click logins with the shared demo password,
// a "resets every 6 hours" banner, and demo accounts that keep their password and email.
// Outside demo mode nothing here changes the app's behaviour.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Shared on purpose: these are demo accounts on fake data (scripts/seed-demo.mjs).
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? '';

export const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@demo.oopsdance.test' },
    { label: 'Staff', email: 'staff@demo.oopsdance.test' },
    { label: 'Instructor', email: 'instructor@demo.oopsdance.test' },
    { label: 'Guest', email: 'guest@demo.oopsdance.test' },
];

const DEMO_DOMAIN = '@demo.oopsdance.test';

// Demo accounts are shared by every visitor, so their login details are locked in demo mode.
export const isLockedDemoAccount = (email) => DEMO_MODE && Boolean(email?.toLowerCase().endsWith(DEMO_DOMAIN));
