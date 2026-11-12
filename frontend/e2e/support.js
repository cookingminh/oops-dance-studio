// Shared helpers for the E2E specs: env, sign-in, REST calls with a real user JWT,
// and test data read from the running stack (so the specs survive a re-seed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Same values the Vite dev server uses; real environment variables win.
const envFile = path.join(FRONTEND, '.env.local');
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
}

export const API = process.env.VITE_SUPABASE_URL;
export const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!API || !ANON) throw new Error('Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (frontend/.env.local).');

// Password of every demo account in supabase/seed.sql.
export const PASSWORD = process.env.E2E_PASSWORD ?? 'OopsDemo@2026';
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
export const PROOF = path.join(FRONTEND, 'e2e', 'fixtures', 'proof.jpg');
// Accounts created by the specs; never @demo.oopsdance.test, which demo mode protects.
export const testEmail = (label) => `e2e.${label}.${Date.now()}@e2e.oopsdance.test`;

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------
export async function login(page, email, password = PASSWORD) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

export const pathname = (page) => new URL(page.url()).pathname;

export async function expectToast(page, text) {
    await expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
}

// NextUI Select names its trigger "<value> <label>" (or "<label> <value>"). An option already shown is left as
// it is (picking it again would clear it, or leave the list open).
export async function pickOption(page, scope, label, option) {
    const trigger = scope.getByRole('button', { name: new RegExp(`(^${label}\\*?(\\s|$))|(\\s${label}\\*?$)`) });
    if ((await trigger.locator('[data-slot="value"]').textContent())?.trim() === option) return;
    await trigger.click();
    await page.getByRole('option', { name: option, exact: true }).click();
}

// Homepage room search: date picker (dd/MM/yyyy) + time range.
export async function searchRooms(page, isoDate, start, end) {
    const search = page.locator('.search');
    await search.scrollIntoViewIfNeeded();
    const [y, m, d] = isoDate.split('-');
    const dateInput = search.locator('.react-datepicker__input-container input');
    await dateInput.fill(`${d}/${m}/${y}`);
    await dateInput.press('Escape');
    await search.getByLabel('Check-in time').selectOption(start);
    await search.getByLabel('Check-out time').selectOption(end);
    await search.getByRole('button', { name: /search room/i }).click();
    await page.locator('.searchResult.visible').waitFor();
    return search;
}

// ---------------------------------------------------------------------------
// REST with a real user JWT (RLS checks)
// ---------------------------------------------------------------------------
export async function token(email, password = PASSWORD) {
    const res = await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    return { jwt: body.access_token, id: body.user?.id };
}

export async function rest(jwt, pathAndQuery, { method = 'GET', body, prefer } = {}) {
    const headers = { apikey: ANON, 'Content-Type': 'application/json' };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${API}/rest/v1/${pathAndQuery}`, { method, headers, body: body && JSON.stringify(body) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
}

export const rpc = (jwt, name, args = {}) => rest(jwt, `rpc/${name}`, { method: 'POST', body: args });

export async function adminUsers(jwt, body) {
    const res = await fetch(`${API}/functions/v1/admin-users`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// Dates (studio time, ISO weekday 1 = Monday)
// ---------------------------------------------------------------------------
export const studioToday = async () => (await rpc(null, 'studio_today')).data;

export function addDays(iso, days) {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export const isoWeekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() || 7;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// A date after the seeded bookings (they end 14 days ahead), so every room is free
// from 21:00 on that day. Each spec uses its own offset to stay independent.
export const freeDate = async (offset) => addDays(await studioToday(), offset);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
export const staffJwt = async () => (await token('staff@demo.oopsdance.test')).jwt;
export const rooms = async () => (await rest(null, 'rooms?select=*&order=id')).data;
export const publicClasses = async () => (await rpc(null, 'list_public_classes')).data;

// How many class videos the /classes showcase should list: the latest finished month that has any.
export async function lastMonthVideos() {
    const today = (await rpc(null, 'studio_today')).data;
    const thisMonth = `${today.slice(0, 7)}-01`;
    const rows = (await rest(await staffJwt(), `class_lessons?select=month&video_url=not.is.null&month=lt.${thisMonth}&order=month.desc`)).data;
    return rows.filter((row) => row.month === rows[0]?.month).length;
}

export async function people(role) {
    return (await rest(await staffJwt(), `profiles?select=id,email,full_name,avatar_path&role=eq.${role}&order=email`)).data;
}

// Removes leftovers of an earlier, interrupted run on a spec's own date.
export async function deleteBookingsOn(date) {
    const res = await rest(await staffJwt(), `bookings?date=eq.${date}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
}

export async function todaysSessions() {
    const today = await studioToday();
    return (await rest(await staffJwt(),
        `instructor_attendance?select=id,class_id,status,instructor_id,checkin_proof_path,class:classes!class_id(name),instructor:profiles!instructor_id(email)&date=eq.${today}`)).data;
}

// Puts a session back to "pending" so check-in can be exercised again.
// Back to "not checked in". Check-in opens 15 minutes before a session and closes at its end
// (20261117001100_checkin_window), so `open: true` gives the session its own times around now
// (studio time), whatever hour the tests run; without it the session keeps the class's weekly slot.
export async function resetSession(id, { open = false } = {}) {
    const body = { status: 'pending', checkin_at: null, checkout_at: null, checkin_proof_path: null, checkout_proof_path: null };
    if (open) Object.assign(body, sessionTimesAroundNow());
    else Object.assign(body, { start_time: null, end_time: null });
    return rest(await staffJwt(), `instructor_attendance?id=eq.${id}`, { method: 'PATCH', body });
}

function sessionTimesAroundNow() {
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const [h, m] = clock.split(':').map(Number);
    const start = Math.min(Math.max(h * 60 + m - 5, 0), 23 * 60);
    const end = Math.min(start + 60, 23 * 60 + 59);
    const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return { start_time: hhmm(start), end_time: hhmm(end) };
}

// A class session today, whatever the weekday (the demo instructors don't teach every day): the
// instructor's own (`email`; null = anyone's) if there is one, else a make-up added today for one of their
// running classes that doesn't meet today (class_add_session, which also makes its roll call), at 10:00–11:00
// (resetSession(id, { open: true }) moves it around now). → { id, class_id, added }. Pass it to
// dropSessionToday() afterwards: an added one goes again with its roll call.
export async function sessionToday(email = null) {
    const today = await studioToday();
    const jwt = await staffJwt();
    const own = (await todaysSessions()).find((s) => s.status !== 'cancelled' && (!email || s.instructor?.email === email));
    if (own) return { id: own.id, class_id: own.class_id, added: false };
    const classes = (await rest(jwt,
        `classes?select=id,instructor:profiles!instructor_id(email),schedules:class_schedules(day_of_week)&starts_on=lte.${today}&or=(ended_on.is.null,ended_on.gte.${today})&order=id`)).data;
    const cls = classes.find((c) => (!email || c.instructor?.email === email) && !c.schedules.some((slot) => slot.day_of_week === isoWeekday(today)));
    expect(cls, `a running class of ${email ?? 'anyone'} to add a session today to`).toBeTruthy();
    const added = await rpc(jwt, 'class_add_session', { p_class: cls.id, p_date: today, p_start: '10:00', p_end: '11:00', p_note: 'E2E session today' });
    expect(added.status, JSON.stringify(added.data)).toBe(200);
    return { id: added.data.id, class_id: cls.id, added: true };
}

export async function dropSessionToday(session) {
    if (!session?.added) return;
    const jwt = await staffJwt();
    const today = await studioToday();
    expect((await rest(jwt, `student_attendance?class_id=eq.${session.class_id}&date=eq.${today}`, { method: 'DELETE' })).status).toBe(204);
    expect((await rest(jwt, `instructor_attendance?id=eq.${session.id}`, { method: 'DELETE' })).status).toBe(204);
}

// Makes sure today has a checked-in session with a proof photo (staff views it). → the session added for it
// (see sessionToday) or null; dropSessionToday() takes it out again.
export async function ensureProofToday() {
    const sessions = await todaysSessions();
    if (sessions.some((s) => s.checkin_proof_path)) return null;
    const mine = await sessionToday('instructor@demo.oopsdance.test');
    await resetSession(mine.id, { open: true });
    const me = await token('instructor@demo.oopsdance.test');
    const proofPath = `${me.id}/${mine.id}/checkin.jpg`;
    const upload = await fetch(`${API}/storage/v1/object/attendance-proofs/${proofPath}`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${me.jwt}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: fs.readFileSync(PROOF),
    });
    expect(upload.ok, `proof upload ${upload.status}`).toBe(true);
    const checkIn = await rpc(me.jwt, 'instructor_check_in', { p_attendance_id: mine.id, p_proof_path: proofPath });
    expect(checkIn.status).toBe(200);
    return mine.added ? mine : null;
}

// The demo's classes are taught at rented studios: a spec that needs a class in a room puts one there. The
// first running class that fits into one of `roomList` (in order; the server refuses a room whose bookings
// overlap the class's weekly times) → { cls: { id, name, room_id, venue_id } as it was, room } or null.
// putClassBack() restores it (its sessions not started yet follow it both ways).
export async function putClassInRoom(roomList) {
    const jwt = await staffJwt();
    const today = await studioToday();
    const classes = (await rest(jwt, `classes?select=id,name,room_id,venue_id&starts_on=lte.${today}&ended_on=is.null&order=id`)).data;
    for (const cls of classes) {
        for (const room of roomList) {
            const moved = await rest(jwt, `classes?id=eq.${cls.id}`, { method: 'PATCH', body: { room_id: room.id, venue_id: null } });
            if (moved.status < 300) return { cls, room };
        }
    }
    return null;
}

export async function putClassBack(placed) {
    if (!placed) return;
    const { id, room_id, venue_id } = placed.cls;
    expect((await rest(await staffJwt(), `classes?id=eq.${id}`, { method: 'PATCH', body: { room_id, venue_id } })).status).toBe(204);
}

// A future live booking in a room that has classes: a class session over it must be refused.
export async function clashTarget() {
    const today = await studioToday();
    const jwt = await staffJwt();
    const classes = (await rest(jwt, 'classes?select=id,name,room_id&room_id=not.is.null')).data;
    const roomIds = [...new Set(classes.map((c) => c.room_id))].join(',');
    const bookings = (await rest(jwt,
        `bookings?select=date,start_time,end_time,room_id&status=in.(pending,approved)&date=gt.${today}&room_id=in.(${roomIds})&order=date&limit=20`)).data;
    const booking = bookings.find((b) => /:(00|30):00$/.test(b.start_time));
    if (!booking) return null;
    const cls = classes.find((c) => c.room_id === booking.room_id);
    return {
        className: cls.name,
        weekday: WEEKDAYS[isoWeekday(booking.date) - 1],
        start: booking.start_time.slice(0, 5),
        end: booking.end_time.slice(0, 5),
        booking,
    };
}
