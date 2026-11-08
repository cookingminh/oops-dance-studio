-- =============================================================================
-- 09 · Public demo marker
-- Contract: docs/architecture/api-contract.md §11
-- `scripts/seed-demo.mjs --reset` wipes the whole project. It only runs when the
-- database itself says it is the public demo, so a reset that still points at a
-- project after it became production (or at the wrong project) deletes nothing.
-- The marker is set and cleared on purpose, with the service role:
--   node seed-demo.mjs --mark-demo-project / --unmark-demo-project
-- =============================================================================

create table private.demo_instance (
  id boolean primary key default true check (id),  -- at most one row
  marked_at timestamptz not null default now()
);

create function public.is_demo_instance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.demo_instance);
$$;

create function public.set_demo_instance(p_enabled boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_enabled then
    insert into private.demo_instance default values on conflict (id) do nothing;
  else
    delete from private.demo_instance where id;  -- a WHERE clause keeps pg-safeupdate happy
  end if;
  return p_enabled;
end;
$$;

-- Service role only: no user (not even an admin) can read or flip the marker.
revoke all on table private.demo_instance from public, anon, authenticated;
revoke execute on function public.is_demo_instance(), public.set_demo_instance(boolean)
  from public, anon, authenticated;
grant execute on function public.is_demo_instance(), public.set_demo_instance(boolean)
  to service_role;
