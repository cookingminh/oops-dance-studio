# Oops Dance Studio — Supabase backend

Postgres + RLS + Auth + Storage + RPC + Edge Functions + pg_cron. This replaces the legacy
Django / MySQL / Celery / Cloudinary backend of the original app (not part of this repository).

The API the frontend codes against is specified in
[`../docs/architecture/api-contract.md`](../docs/architecture/api-contract.md). Change the
contract (and its Changelog) whenever the behaviour here changes.

## What is where

| Path | Contents |
|---|---|
| `migrations/20261108000100_extensions_enums_helpers.sql` | `btree_gist`, enums, schema `private`, `studio_today()`, `is_admin()`, `is_staff()`, `current_app_role()` |
| `migrations/20261108000200_tables.sql` | tables, constraints (booking exclusion), indexes, `updated_at` and domain triggers, table privileges |
| `migrations/20261108000300_auth_profile_triggers.sql` | sign-up → profile (always `guest`), email sync, role guard |
| `migrations/20261108000400_rls_policies.sql` | RLS on every table (deny by default) |
| `migrations/20261108000500_rpc_functions.sql` | all RPCs (`get_available_slots`, `create_booking`, check-in/out, generators, stats, …) |
| `migrations/20261108000600_views.sql` | `v_revenue_monthly` (security invoker, staff-only) |
| `migrations/20261108000700_storage.sql` | buckets `avatars`, `class-images`, `attendance-proofs`, `site-assets` + policies |
| `migrations/20261108000800_cron_jobs.sql` | pg_cron jobs that generate attendance |
| `migrations/20261108000900_demo_instance.sql` | marker that lets `seed-demo.mjs --reset` wipe a project (public demo only) |
| `migrations/20261109000100_class_lessons.sql` | `class_lessons` (the piece each class learns per month) + trigger that mirrors the latest title into `classes.lesson` |
| `migrations/20261110000100_payroll.sql` | payroll (admin only): default and per-class session rates, staff salaries, bonuses/deductions, payslips + `payroll_*` RPCs |
| `migrations/20261111000100_class_videos.sql` | `class_lessons.video_url`: each month's end-of-month class video (YouTube links only), shown on /classes |
| `migrations/20261112000100_tuition.sql` | tuition: monthly invoices per enrolment, renewal + daily cycle (`tuition-cycle` cron), bank transfers matched by invoice code, sandbox simulation, admin finance report (`finance_monthly`, `finance_by_class`) |
| `migrations/20261113000100_switch_and_expenses.sql` | class switches carry tuition across (`tuition_switch_class`), expenses + recurring expenses (`expenses-recurring` cron) with receipts (bucket `receipts`), profit = revenue − payroll − expenses, per-person student movement |
| `migrations/20261114000100_class_lifecycle.sql` | classes run from `starts_on` to `ended_on`: end / reopen a class, daily wrap-up (`class-endings` cron), no deleting a class with history |
| `migrations/20261115000100_routines.sql` | routines by number of sessions (`lesson_progress`), make-up sessions (`class_add_session`), `lessons-refresh` cron |
| `migrations/20261116000100_course_tuition.sql` | tuition per course (khoá): invoices per routine, renewal when 2 sessions are left, pro-rated late joins, per-course switch, finance by course span |
| `migrations/20261116000200_course_seed_and_skips.sql` | course-based demo tuition; deleted recurring copies stay skipped that month |
| `migrations/20261116000300_oauth_profiles.sql` | Google / Facebook sign-ups get their name from `full_name` or `name` |
| `migrations/20261116000400_switch_after_course.sql` | class switches between courses (`leaves_after`, future `joined_at`), no refunds mid-course |
| `migrations/20261117000100_routine_order_and_waive.sql` | one routine at a time (the next starts after the last one's shoot day); reopening a waived invoice drops the waive reason; demo routines fitted to their month |
| `migrations/20261117000200_activity_log.sql` | `activity_log` (who did what) written by one trigger on the studio tables, admin-only read, `activity_summary`, nightly prune, demo activity |
| `migrations/20261117000300_booking_free_slots.sql` | a cancelled class session frees its room; it can't be reopened once booked |
| `migrations/20261117000400_activity_seed_lint.sql` | the demo activity seed without a temporary table (db lint) |
| `migrations/20261117000500_booking_payments.sql` | room bookings paid by transfer: payment code, webhook matching, payment history, assign / take back, sandbox |
| `migrations/20261117000600_invoice_notes.sql` | staff write a note on an invoice on its own (`tuition_set_note`) |
| `migrations/20261117001100_checkin_window.sql` | check-in from 15 minutes before the session to its end, late check-out mark (> 10 min after), staff corrections logged (`session_edit_check`) |
| `migrations/20261117001000_booking_auto_complete.sql` | an approved booking paid in full becomes completed by itself; completed bookings ahead hold their room |
| `migrations/20261117000900_session_changes.sql` | call a session off with a reason (also ahead), move it to another day in one step, close the studio for a day, what changed for the class (`my_session_changes`) |
| `migrations/20261117000800_booking_refunds.sql` | the cancellation policy (`booking_settings`), refunds owed and paid on bookings, guests cancel approved bookings, kept money counts as revenue |
| `migrations/20261117001200_tuition_extra.sql` | extra tuition money (an invoice paid more than it costs): move it to another unpaid invoice or record it given back (`tuition_extra_moves`); undoing a payment takes moves back |
| `migrations/20261117001300_venues.sql` | rented studios (`venues`): a class is taught in a room or at a venue, its sessions follow; each session taught at a venue becomes a `venue_rent` expense (daily job `venue-rent`); demo classes moved to two venues (`seed_demo_venues`) |
| `migrations/20261117001400_demo_november.sql` | the demo becomes the studio's November timetable (classes, teachers, six rented studios; Newbie classes opening next month) |
| `migrations/20261117001500_timetable_templates.sql` | the website timetable's two looks: `site_settings.timetable_template` (`poster` = the printed schedule's grid, `brush` = the red card), switched by admins and staff with `site_set_timetable_template` (logged as `settings · timetable_template`); `classes.level` (`newbie` / `basic` / `advanced`, the poster's colours), returned by `list_public_classes`; demo levels (`seed_demo_levels`) |
| `migrations/20261117001600_timetable_photos.sql` | how a class's pictures are framed on the website: `classes.image_pos_x` / `_y` (which part of the image the class card shows, CSS object-position %) and the class's own round photo on the poster timetable, `timetable_photo_path` (bucket `class-images`; null = the instructor's avatar) with its frame `timetable_photo_x` / `_y` / `_zoom`; `list_public_classes` returns all six |
| `migrations/20261117001700_session_catch_up.sql` | sessions and roll calls follow changes made after the jobs ran: a weekly session added / moved / removed or a class's first / last day changed makes or removes this week's sessions from now on (untouched ones only); a student joining today is put on today's roll call; not logged on their own |
| `migrations/20261117001800_venue_rooms.sql` | rented studios' rooms and public names: `venues.public_name` (what the website and students see — visitors can't read the studio's own name), `venue_rooms` (each with its rent per hour), `classes.venue_room_id` / `instructor_attendance.venue_room_id`, a session's rent from its room; `venue_save` takes the public name and the rooms, `venue_rooms_list()`, `session_set_venue_room()`; demo `seed_demo_venue_rooms()` |
| `migrations/20261117000700_routine_promos.sql` | a routine's promo: the instructor's clip (bucket `class-promos`) or a YouTube link, set with `lesson_set_promo` |
| `functions/bank-webhook/` | Edge Function: SePay webhook → `tuition_record_transfer` (API key in `BANK_WEBHOOK_KEY`). `handler_test.ts` unit-tests it |
| `functions/admin-users/` | Edge Function: admin creates / re-emails / deletes auth users (and names the admin in the activity log). `handler.ts` holds the logic, `index.ts` serves it, `handler_test.ts` unit-tests it |
| `tests/*.test.sql` | pgTAP tests (RLS matrix, slots, bookings, attendance/admin/stats, timetable clashes, demo marker, monthly lessons, payroll, class videos, tuition, class switches and expenses, class lifecycle, routines, tuition per course, routine order and the activity log, booking payments, routine promos, booking refunds, session changes, paid = completed, check-in window, tuition extra money, rented studios, website timetable looks and class levels, session catch-up between the jobs, rented studios' rooms and public names) |
| `seed.sql` | local demo data (runs on `supabase db reset`) |
| `../scripts/demo-images.mjs` | uploads demo photos to Storage (instructor avatars, class photo, room photos) and sets `avatar_path` / `image_path` / `image_paths` |
| `../scripts/demo-assets/` | the demo photos, WebP (instructor cut-outs keep their transparency) |
| `../scripts/seed-demo.mjs` | demo data for a **hosted** project, through the admin API (calls `demo-images.mjs`); `--reset` wipes and re-seeds the public demo |

## Prerequisites

- Docker Desktop, running.
- Supabase CLI ≥ 3.0 (`supabase --version`). `brew install supabase/tap/supabase` needs an
  up-to-date Xcode; if brew refuses, download `supabase_darwin_arm64.tar.gz` from
  <https://github.com/supabase/cli/releases>, check it against `checksums.txt`, and put the
  binary on your `PATH` (e.g. `~/.local/bin`).
- Node ≥ 20.12 for `scripts/` (demo photos, hosted demo seed). Run `cd scripts && npm install` once.
- Demo photo sources (committed): `scripts/demo-assets/*.webp` (instructor cut-outs, class photos)
  and the room photos in `frontend/src/assets/images/room*.webp`. A missing folder is skipped; the
  demo still works with `null` / empty image paths.

## Run locally

All commands run from the repo root.

```sh
supabase start                           # first run pulls images; applies migrations + seed.sql
node scripts/demo-images.mjs --local     # instructor avatars, class photo, room photos (seed.sql cannot upload files)
supabase status                          # URLs and keys (anon/publishable for the frontend, service role for scripts)
```

| Service | URL |
|---|---|
| API (REST, Auth, Storage, Functions) | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Mail catcher (password-reset emails) | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Frontend `frontend/.env.local`:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY or PUBLISHABLE_KEY from `supabase status`>
```

Stop with `supabase stop` (data is kept; `supabase stop --no-backup` wipes it).

## Reset, seed, test, lint

```sh
supabase db reset                       # re-apply every migration, then seed.sql
node scripts/demo-images.mjs --local    # re-upload demo photos (a reset drops Storage metadata)
supabase test db                        # pgTAP: 6 files, 195 tests
supabase db lint                        # plpgsql / schema errors
supabase db advisors --level info       # security + performance advisors
deno test --no-lock --config supabase/functions/admin-users/deno.json supabase/functions/admin-users/   # Edge Function unit tests
deno test --no-lock --config supabase/functions/bank-webhook/deno.json supabase/functions/bank-webhook/   # bank webhook unit tests
```

The browser tests (Playwright, every role) live in `../frontend/e2e/` and run against this
stack: `cd frontend && npm run test:e2e` (see the frontend README). CI runs all of the above on
every push (`.github/workflows/ci.yml`).

Each test file runs in a transaction that is rolled back, so tests never change the seeded data.
Expected advisor output on a fresh database: only `unused_index` INFO notes (the FK/RLS indexes
are intentional; they become used once there is real traffic).

## Demo logins (local seed)

Password for every demo account: **`OopsDemo@2026`** (local only — never reuse it on a hosted project).

| Email | Role |
|---|---|
| `admin@demo.oopsdance.test` | admin |
| `staff@demo.oopsdance.test` | staff |
| `instructor@demo.oopsdance.test` | instructor **Đỗ Linh** — Trending, Choreo CG (and Newbie 1 from next month) |
| `guest@demo.oopsdance.test` | guest — has enrolments, past and upcoming bookings |
| `instructor2@` Soleck · `instructor3@` An Trinh · `instructor4@` Vân Anh · `instructor5@` Đức Anh | instructors |
| `guest02@…` … `guest15@demo.oopsdance.test` | guests |

The five instructors are the studio's teachers as named on the legacy homepage, with their
photos from `scripts/demo-assets/` as avatars (no personal details are made up for them).

The seed is relative to today (bookings from 90 days ago to 14 days ahead, 8 weeks of instructor
sessions, 4 weeks of roll calls), so `supabase db reset` always gives fresh-looking data.

## Edge Function `admin-users`

`supabase start` serves every function in `functions/`. After **adding** a function, restart the
stack (`supabase stop && supabase start`); after **editing** one, restart the runtime:

```sh
docker restart supabase_edge_runtime_oops-dance-studio
```

Try it (admin token from a password sign-in):

```sh
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
TOKEN=$(curl -s "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.oopsdance.test","password":"OopsDemo@2026"}' | jq -r .access_token)
curl -s -X POST "$API_URL/functions/v1/admin-users" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"create","email":"new.staff@demo.oopsdance.test","password":"Passw0rd!x","full_name":"Nhân viên Mới","role":"staff"}'
```

A guest token gets `403 { "error": "FORBIDDEN: admin only" }`. Request/response shapes: api-contract §6.

Function secrets (none are needed locally):

| Secret | Effect |
|---|---|
| `DEMO_MODE=true` | public demo: `update` / `delete` on `@demo.oopsdance.test` accounts → `403 FORBIDDEN: demo account` |
| `ALLOWED_ORIGINS` | comma-separated frontend origins for CORS (plus `localhost:5173`); unset = `*` |

To try them locally: `supabase functions serve admin-users --env-file <file>` (stop it with
Ctrl-C, then `supabase stop && supabase start` to bring the normal runtime back). Note that the
local gateway always answers CORS with `*`; the allow-list only shows on a hosted project.

## Deploy to a hosted project

> The public demo runs on a hosted project in the Singapore region (`ap-southeast-1`). Never run
> the demo seed or its `--reset` against a production project.

1. **Link** (once):
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   ```
2. **Database** — migrations, RLS, RPCs, buckets, storage policies and cron jobs. Since CLI 3,
   `db` commands target the **local** stack unless you pass `--remote`:
   ```sh
   supabase db push --remote --dry-run    # review
   supabase db push --remote
   supabase migration list --remote       # local and remote columns should match
   ```
   Do **not** use `--include-seed` on production: `seed.sql` creates demo users with the password above.
3. **Edge Function**:
   ```sh
   supabase functions deploy admin-users
   supabase functions deploy bank-webhook --no-verify-jwt
   ```
   `verify_jwt = false` comes from `config.toml`; the function verifies the caller and the admin
   role itself. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
   by the platform. Restrict CORS to the deployed frontend, and on the public demo protect the
   demo accounts:
   ```sh
   supabase secrets set ALLOWED_ORIGINS=https://<frontend-domain>
   supabase secrets set DEMO_MODE=true          # public demo project only
   supabase secrets set BANK_WEBHOOK_KEY=<key>  # the API key you give SePay's webhook (tuition payments by QR)
   ```
   Secrets never go in the repo. `.github/workflows/deploy-db.yml` (manual) repeats steps 2–3
   from GitHub with `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.
4. **Auth settings** (Dashboard → Authentication):
   - URL Configuration: Site URL = the deployed frontend; Redirect URLs include `<site>/reset-password`.
   - Production: **enable "Confirm email"** and configure custom SMTP (the built-in sender is rate-limited).
   - Demo project: leave email confirmation off (api-contract §9).
   - Minimum password length 8.
   - Prefer the dashboard over `supabase config push` here, so the local `localhost` URLs never reach a hosted project.
5. **Verify**: `supabase db advisors --remote`, `supabase db lint --remote`, and in the dashboard
   check Database → Cron Jobs shows `generate-instructor-attendance` and `generate-student-attendance`.
6. **Demo data (demo project only)** — copy `.env.example` to `.env` at the repo root and fill in
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and a strong `DEMO_PASSWORD`, then:
   ```sh
   cd scripts && npm install && npm run seed-demo
   DEMO_MODE=true node seed-demo.mjs --mark-demo-project   # allows the scheduled reset to wipe THIS project
   ```
   The script is idempotent (re-running resets demo passwords and skips existing history). It
   ends by uploading the demo photos (api-contract §11); `npm run demo-images` repeats just that step.
7. **Scheduled reset (public demo only)** — `.github/workflows/reset-demo.yml` runs every 6 hours
   (and on demand) with the repository secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
   `DEMO_PASSWORD`:
   ```sh
   DEMO_MODE=true node seed-demo.mjs --reset --i-know-this-wipes
   ```
   It empties every bucket, deletes all app data and every auth user that is not a demo account
   (visitors' sign-ups included), then re-seeds with dates relative to today and restores the demo
   passwords. It refuses to run without `--i-know-this-wipes`, without `DEMO_MODE` set, or when the
   database is not marked as the demo (`public.is_demo_instance()`, step 6).
   GitHub pauses scheduled workflows after 60 days without repository activity; re-enable it in
   the Actions tab if the demo stops resetting.

## Enable Google / Facebook sign-in

The login and sign-up pages show "Continue with Google / Facebook" only for the providers listed in
the frontend's `VITE_AUTH_PROVIDERS`. Accounts made this way start as guests like any sign-up; the
name comes from the provider (the profile trigger reads `full_name` or `name`), and the profile
overview asks them once to add a username and phone number. The provider sends people back to
Supabase Auth, which returns them to `<site>/login`; from there they land where a password login
lands them.

Each provider needs Supabase Auth's callback URL:

| Project | Callback URL |
|---|---|
| Hosted | `https://<project-ref>.supabase.co/auth/v1/callback` |
| Local | `http://127.0.0.1:54321/auth/v1/callback` |

1. **Google**: Google Cloud Console → APIs & Services → Credentials → Create credentials →
   OAuth client ID, type *Web application* (set up the OAuth consent screen first if asked). Add the
   callback URL under *Authorized redirect URIs*, then copy the client ID and secret.
2. **Facebook**: Facebook Developers → My Apps → Create app with Facebook Login. In Facebook Login →
   Settings, add the same callback URL to *Valid OAuth Redirect URIs*, and make sure the `email`
   permission is requested. Copy the App ID and App secret (App settings → Basic). Switch the app to
   Live mode before real users sign in.
3. **Switch them on in Supabase**
   - Hosted: Dashboard → Authentication → Sign In / Providers → Google / Facebook: enable, paste the
     ID and secret, save.
   - Local: put the values in `supabase/.env` (git-ignored), set `enabled = true` under
     `[auth.external.google]` / `[auth.external.facebook]` in `config.toml`, then
     `supabase stop && supabase start`:
     ```sh
     SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…
     SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…
     SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID=…
     SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET=…
     ```
4. **Redirect allow-list**: the app asks Auth to come back to `<site>/login`. Hosted: Authentication →
   URL Configuration, Site URL = the frontend, and add `https://<site>/login` to Redirect URLs (plus
   any other domain the app runs on, e.g. previews). Local: `additional_redirect_urls` in
   `config.toml` must contain `http://127.0.0.1:5173/login`; a URL that is not allowed sends people
   back to the Site URL instead.
5. **Frontend**: set `VITE_AUTH_PROVIDERS=google,facebook` (only the providers you switched on) in
   `frontend/.env.local` or the host's environment, then restart Vite / redeploy.

Check: the buttons appear on /login and /register. A provider that is listed but still switched off
shows "Sign-in with … isn’t switched on yet" on the form instead of leaving the app.

## Turning the demo project into production

The demo project can later become the studio's real one. Do the steps in this order, so the
scheduled reset can never touch real data:

1. **Stop the reset.** Remove the marker first; from then on `--reset` refuses to run against this
   database, even if the workflow is still enabled:
   ```sh
   node scripts/seed-demo.mjs --unmark-demo-project      # with the project's URL + service role key in .env
   ```
   Then disable `.github/workflows/reset-demo.yml` in the Actions tab and delete the repository
   secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DEMO_PASSWORD`.
2. **Edge Function:** `supabase secrets unset DEMO_MODE`, and set `ALLOWED_ORIGINS` to the
   production domain.
3. **Remove the demo data.** Dashboard → SQL editor:
   ```sql
   truncate public.student_attendance, public.instructor_attendance, public.class_students,
            public.bookings, public.class_schedules, public.classes, public.rooms restart identity;
   ```
   Then empty the four Storage buckets and delete the `@demo.oopsdance.test` users
   (Authentication → Users). Create the real admin account first (sign up, then
   `update public.profiles set role = 'admin' where email = '…'` in the SQL editor).
4. **Auth:** enable "Confirm email", configure custom SMTP, set the Site URL and redirect URLs to the
   production domain, and rotate the service role key if it was ever shared.
5. **Frontend:** remove `VITE_DEMO_MODE` and `VITE_DEMO_PASSWORD` from the hosting environment and
   redeploy. The login page loses its demo buttons and banner.

## Security notes

- RLS is on for every table; anything not granted by a policy is denied. `anon` has no privilege
  at all on profiles, enrolments, bookings and attendance.
- Only `get_available_slots`, `list_public_classes`, `is_username_available` and `studio_today`
  are executable by `anon` (a pgTAP test enforces this list).
- Every function pins `search_path = ''`; internal helpers live in schema `private`, which the
  Data API does not expose.
- Roles change only through `admin_set_role` / the service role; sign-up always creates `guest`.
- The service-role key lives only in the gitignored `.env` and in the Edge Function runtime.
