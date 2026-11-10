# Oops! Dance Studio — frontend

Web app for a dance studio: visitors browse classes and book rehearsal rooms; instructors check in to their sessions with a photo; staff run rooms, bookings, classes and attendance; admins also manage accounts.

React 18 + Vite, Tailwind CSS + NextUI + SCSS, talking directly to **Supabase** (Auth, Postgres with row-level security, RPC functions, Storage and one Edge Function). The backend lives in [`../supabase`](../supabase) and its API is specified in [`../docs/architecture/api-contract.md`](../docs/architecture/api-contract.md).

## What each role can do

| Role | Area | Highlights |
|---|---|---|
| Visitor | `/home`, `/classes`, `/rooms`, `/about` | Home (perks, class teaser, next class), classes (weekly timetable, all classes, last month's class videos from YouTube, instructors), rooms (availability search and booking), About us (Oops! Crew story), sign up / log in, password reset |
| Guest | `/profile` | Overview of the week, one page per class (current routine: sessions held, shoot day), tuition **per course** (pay by VietQR — marked paid automatically by the bank webhook — renew or stop the next course, history), attendance calendar, book a room, cancel pending bookings |
| Instructor | `/profile` | Today's sessions (make-ups with their own times), check in / out with a proof photo, one page per class (routine progress, roster with recent attendance, joining/leaving dates) |
| Staff | `/admin` | Dashboard, **class hub** `/admin/classes` (today / this month / upcoming / past; one page per class: students, sessions & roll calls, substitutes, make-up sessions, tuition by course, routines, setup, end / reopen), bookings, rooms, students, instructor attendance, tuition (by course, renewals, bank-transfer inbox, switches between courses), their own expenses, charts |
| Admin | `/admin` | Everything staff can do, plus users, payroll, tuition payment settings (bank account, renewal rules, SePay webhook), all expenses (recurring, receipts, class-tied) and the finance report (revenue − payroll − expenses, per-class margin, per-person student movement) |

Every screen is available in English and Vietnamese (EN | VI switch in the navbar, the auth pages and the workspace top bar).

Access is enforced twice: route guards in the app, and RLS / role checks in the database. The role always comes from the user's `profiles` row, never from the client.

## Run it locally

Prerequisites: Node 20.12+, and the local Supabase stack from [`../supabase/README.md`](../supabase/README.md) (`supabase start` in the repository root).

```bash
npm install
cp .env.example .env.local     # then paste the values printed by `supabase status`
npm run dev                    # http://localhost:5173
```

The dev server is pinned to port **5173** because the Auth redirect URLs (password reset, email confirmation) in `supabase/config.toml` point there. Password-reset emails sent by the local stack can be read in Mailpit at http://127.0.0.1:54324.

Demo accounts (admin, staff, instructor, guest) and their password are listed in [`../supabase/README.md`](../supabase/README.md#demo-logins-local-seed).

### Environment variables

| Variable | Example | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` | API URL of the Supabase project |
| `VITE_SUPABASE_ANON_KEY` | `eyJ…` / `sb_publishable_…` | Anon (publishable) key. **Never** put the service-role / secret key in the frontend. |
| `VITE_DEMO_MODE` | `true` | Public demo only: one-click demo logins, a "Demo data, resets every 6 hours" banner, and `@demo.oopsdance.test` accounts can't change their password or email. Unset = normal app. |
| `VITE_DEMO_PASSWORD` | | Public demo only: the shared demo password the one-click logins use (public on purpose: demo accounts, fake data). |
| `VITE_AUTH_PROVIDERS` | `google,facebook` | "Continue with Google / Facebook" buttons on the login and sign-up pages, in this order. Only list a provider once it is switched on in Supabase Auth ([Enable Google / Facebook sign-in](../supabase/README.md#enable-google--facebook-sign-in)). Unset = email and password only, no buttons. |

`.env.local` is git-ignored; only `.env.example` is committed.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run test:e2e` | Playwright end-to-end tests against the local stack (below) |

### End-to-end tests

`e2e/` drives the real app in Chromium against the local Supabase stack, one spec per role plus
auth and timetable clashes, and checks RLS with each role's own JWT:

| Spec | Covers |
|---|---|
| `anon.spec.js` | public pages and navbar, classes, rooms, photos, timetable, About page, visitor booking prompt, route guards |
| `guest.spec.js` | book from /rooms and cancel, profile settings, RLS on bookings / profiles / attendance |
| `instructor.spec.js` | check-in / check-out with a proof photo, signed proof URLs, no access to others' sessions |
| `staff.spec.js` | dashboard, rooms, bookings (overlap → `SLOT_TAKEN`), classes with images, schedules, enrolments, the Attendance page, charts |
| `admin.spec.js` | user management through the `admin-users` Edge Function and `admin_set_role` |
| `auth.spec.js` | sign-up (always guest), taken username, wrong password, password reset through Mailpit, change password |
| `clash.spec.js` | schedule and room-move forms explain clashes with bookings |
| `demo-mode.spec.js` | the `VITE_DEMO_MODE` build on port 5174: banner, one-click logins, locked demo accounts |
| `i18n.spec.js` | the EN / VI switch on the public site and in the workspace |
| `payroll.spec.js` | payroll is admin only; a deduction, finalize and reopen; the payslip's month calendar and legend |
| `tuition-student.spec.js` | a student's tuition: VietQR dialog, sandbox transfer marks it paid, renewal stop / continue |
| `tuition-staff.spec.js` | the lean Tuition page (to do, by class, search by name / code), cash and undo, transfers, notes, payment settings are admin only |
| `finance.spec.js` | the admin finance report matches `finance_monthly` / `finance_by_class`; staff are refused; CSV exports |
| `expenses.spec.js` | expenses with class + receipt, staff see only their own, recurring costs |
| `class-switch.spec.js` | joining another class's upcoming course: finish the paid course, leave after it |
| `routines.spec.js` | routines by sessions, renewal opening, make-up session with roll call |
| `class-hub.spec.js` | the class hub: views, new-class wizard, students, make-up, end / reopen, delete guard |
| `routine-order.spec.js` | the next routine starts after the current one's shoot day (form + server); a routine to-do opens the class's Routines tab |
| `bookings-calendar.spec.js` | the bookings calendar: class sessions behind, a free-slot click prefills a booking, pending style and chip, dialog actions, month / list |
| `attendance.spec.js` | the one Attendance page: today, review queue and badge, roll call and session actions in the modal, calendar / list, deep link |
| `activity.spec.js` | the admin's Activity log: day groups, collapsed bursts, filters in the URL, a staff action shows up, staff have no access |
| `booking-payments.spec.js` | booking QR / transfer content with its code, sandbox payment, still-to-pay vs deposit, cash and refunds, price change with a reason, receipt, the new add-booking form, inbox assign to a booking |

```bash
# from the repository root, once per stack reset
supabase db reset && node scripts/demo-images.mjs --local
cd frontend
npx playwright install chromium   # first time only
npm run test:e2e                  # starts Vite on :5173 and :5174 if they aren't running
```

The specs share one database, so they run serially and clean up after themselves (bookings go on
dates after the seeded ones; created users and classes are deleted). They can be re-run without a
reset. CI runs them on every push.

## Project layout

```
src/
  App.jsx                 routes + guards (lazy-loaded areas)
  lib/                    supabase client, image preparation (HEIC → JPEG, resize, WebP), formatting
  services/               the only code that talks to Supabase: auth, users, rooms, classes,
                          schedules, bookings, attendance, stats, storage, studio, errors
  auth/                   AuthProvider (session + profile), RequireRole, PublicOnly, roles
  hooks/useAsync.js       loading / error / reload state for service calls
  i18n/                   English / Vietnamese: provider, t()/tn(), date formatting, vi/*.js dictionaries
  ui/                     shared UI: toasts, loading/empty/error states, pickers, avatars, demo banner
  assets/                 compressed images (WebP) and videos (720p MP4); room*.webp are not
                          bundled — ../scripts/demo-images.mjs uploads them to site-assets for the seed
  Components/
    HomePage/             public site: PublicLayout (navbar, footer, page transitions), pages/ (one per
                          route), Components/ (sections; About/aboutContent.js holds the About copy)
    Login, Register, ResetPassword, Logout
    Table                 table template
    users/admin-staff/    /admin area
    users/instructor-guest/  /profile area
e2e/                      Playwright specs + fixtures (see above)
```

Conventions:
- Components never import the Supabase client; they call `src/services/*`.
- Service errors are `AppError`s with a stable `code` (`SLOT_TAKEN`, `FORBIDDEN`, `PAST_DATE`, …) and a message that is safe to show. RPC error prefixes and Postgres codes are mapped in `src/services/errors.js`.
- Dates that mean "today" come from the `studio_today()` RPC (Asia/Ho_Chi_Minh), not the browser clock. Weekdays are ISO (1 = Monday … 7 = Sunday).
- UI text is written in English and passed through `t()` from `useI18n()` (`src/i18n/i18nContext.js`); the English
  text is the key into the Vietnamese dictionaries in `src/i18n/vi/` (one file per area, glossary in `common.js`).
  Use `{placeholders}` for values (`t('Booking #{id} is now {status}.', { id, status })`), `tn()` for plurals and
  `formatDate()` / `dayName()` / `monthName()` for dates. Data (class, room and people names, songs) is not translated.
  In development, `window.__i18nMissing` lists Vietnamese lookups that have no translation yet. The EN | VI switch
  is stored in `localStorage` (`oops-lang`); first-time visitors get Vietnamese if their browser language is Vietnamese.
- Images are stored as Storage paths. Public buckets use `getPublicUrl`; attendance proofs are private and shown through signed URLs. Room photos come from `rooms.image_paths` (bucket `site-assets`); a room without photos shows the studio photo.

## Deploy

Any static host works; `vercel.json` already rewrites every route to `index.html`.

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the hosted project in the host's environment settings (plus `VITE_DEMO_MODE=true` and `VITE_DEMO_PASSWORD` for the public demo).
2. In Supabase → Authentication → URL configuration, set the site URL to the deployed origin and add `<origin>/reset-password` (and `<origin>/login` if Google / Facebook sign-in is on) to the redirect URLs.
3. `npm run build` and publish `dist/`.

Bundle (gzip): the homepage loads about 400 KB of JS (React, NextUI, supabase-js and the app). The admin and profile areas, the charts and the HEIC converter are separate chunks loaded on demand. Bundled media is about 11 MB, mostly the three background videos; they can move to the public `site-assets` bucket if the build should be smaller.

## Known follow-ups

- Upgrade NextUI 2.4 → HeroUI; then drop the Avatar workaround in `src/ui/PlainImg.jsx`.
- Upload / reorder room photos from the admin Rooms page (staff upload to `site-assets/rooms/{room_id}/` and update `rooms.image_paths`; no backend change needed).
- UI redesign (dashboards still have decorative search boxes and message/notification icons; footer links are placeholders).
