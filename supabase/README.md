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
| `functions/admin-users/` | Edge Function: admin creates / re-emails / deletes auth users. `handler.ts` holds the logic, `index.ts` serves it, `handler_test.ts` unit-tests it |
| `tests/*.test.sql` | pgTAP tests (RLS matrix, slots, bookings, attendance/admin/stats, timetable clashes, demo marker, monthly lessons) |
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
| `instructor@demo.oopsdance.test` | instructor **Ami** — teaches every day, so check-in works any day |
| `guest@demo.oopsdance.test` | guest — has enrolments, past and upcoming bookings |
| `instructor2@` Bin · `instructor3@` Đỗ Linh · `instructor4@` Chaeng · `instructor5@` Duc Bo | instructors |
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
   ```
   `verify_jwt = false` comes from `config.toml`; the function verifies the caller and the admin
   role itself. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
   by the platform. Restrict CORS to the deployed frontend, and on the public demo protect the
   demo accounts:
   ```sh
   supabase secrets set ALLOWED_ORIGINS=https://<frontend-domain>
   supabase secrets set DEMO_MODE=true          # public demo project only
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
