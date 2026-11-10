-- =============================================================================
-- Sign-in with Google / Facebook (Supabase OAuth) — api-contract §9
--   OAuth sign-ups have no username or phone; their name comes as full_name or name.
--   They start as guests like any sign-up and can add the rest in their profile.
-- =============================================================================
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
    left(coalesce(nullif(btrim(meta ->> 'full_name'), ''), nullif(btrim(meta ->> 'name'), ''), ''), 120),
    nullif(btrim(meta ->> 'contact_number'), ''),
    dob,
    'guest'
  );
  return new;
end;
$$;
