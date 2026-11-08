-- =============================================================================
-- 01 · Extensions, enums, helper functions
-- Contract: docs/architecture/api-contract.md §0, §2
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Helpers below reference tables created in the next migration.
-- Disable body validation for this file only (same trick pg_dump uses).
set check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'staff', 'instructor', 'guest');
create type public.booking_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'completed');
create type public.deposit_status as enum ('waiting', 'completed', 'cancelled');
create type public.instructor_attendance_status as enum ('pending', 'waiting', 'in_progress', 'completed', 'cancelled');
create type public.student_attendance_status as enum ('pending', 'absent', 'attend');

-- -----------------------------------------------------------------------------
-- `private` schema: trigger functions and internal helpers.
-- Not exposed through the Data API (only `public` and `graphql_public` are).
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Public helpers (api-contract §2, §5)
-- -----------------------------------------------------------------------------

-- "Today" in the studio's timezone. Never trust the client clock.
create or replace function public.studio_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- Role of the calling user (null for anon / service role / direct DB sessions).
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- True for admin OR staff.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('admin', 'staff') from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Private helpers
-- -----------------------------------------------------------------------------

-- True when the current statement does NOT come from an end user's JWT:
--   * Data API calls made with the service-role key (claim role = service_role)
--   * direct DB sessions without JWT claims: migrations, seed.sql, pg_cron,
--     Studio's SQL editor, GoTrue's own writes to auth.users.
-- Based on JWT claims rather than current_user on purpose: inside a
-- security definer function current_user is always the owner, so a
-- current_user check would let every definer function bypass the guards.
create or replace function private.is_service_context()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.role(), 'service_role') = 'service_role';
$$;

-- Generic updated_at maintenance.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

reset check_function_bodies;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke execute on function public.studio_today()      from public, anon, authenticated;
revoke execute on function public.current_app_role()  from public, anon, authenticated;
revoke execute on function public.is_admin()          from public, anon, authenticated;
revoke execute on function public.is_staff()          from public, anon, authenticated;

grant execute on function public.studio_today()     to anon, authenticated, service_role;
-- Role helpers are used inside RLS policies evaluated as `authenticated`.
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.is_admin()         to authenticated, service_role;
grant execute on function public.is_staff()         to authenticated, service_role;

revoke execute on all functions in schema private from public, anon, authenticated;
