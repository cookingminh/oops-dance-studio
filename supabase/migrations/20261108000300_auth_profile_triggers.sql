-- =============================================================================
-- 03 · Auth → profile triggers and the role guard
-- Contract: docs/architecture/api-contract.md §2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New auth user → profile. Role is ALWAYS 'guest' (legacy sign-up accepted a
-- `role` field; that bug is not carried over). Only username, full_name,
-- contact_number, date_of_birth are read from raw_user_meta_data.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  dob  date;
begin
  begin
    dob := nullif(btrim(meta ->> 'date_of_birth'), '')::date;
  exception when others then
    dob := null;  -- ignore malformed dates instead of failing sign-up
  end;

  insert into public.profiles (id, email, username, full_name, contact_number, date_of_birth, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(meta ->> 'username'), ''),
    coalesce(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'contact_number'), ''),
    dob,
    'guest'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- auth.users.email changes → profiles.email
-- -----------------------------------------------------------------------------
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = coalesce(new.email, '')
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Role guard on profiles.
--   * id, role, email can only change when is_admin() or in a service context
--     (service-role key, migrations/seed, GoTrue's email sync).
--   * Invariants enforced for every path:
--       - the last admin cannot be demoted
--       - an instructor who still teaches classes cannot lose that role
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'FORBIDDEN: profile id cannot change';
  end if;

  if (new.role is distinct from old.role or new.email is distinct from old.email)
     and not (private.is_service_context() or public.is_admin())
  then
    raise exception 'FORBIDDEN: only an admin can change role or email';
  end if;

  if new.role is distinct from old.role then
    if old.role = 'admin' and not exists (
      select 1 from public.profiles p where p.role = 'admin' and p.id <> old.id
    ) then
      raise exception 'INVALID_STATE: cannot demote the last admin';
    end if;

    if old.role = 'instructor' and exists (
      select 1 from public.classes c where c.instructor_id = old.id
    ) then
      raise exception 'INVALID_STATE: instructor still teaches classes; reassign them first';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_profile_changes
  before update on public.profiles
  for each row execute function private.guard_profile_changes();

revoke execute on all functions in schema private from public, anon, authenticated;
