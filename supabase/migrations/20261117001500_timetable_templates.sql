-- The website timetable: two looks to choose from, and class levels to colour it by.
--
--   * classes.level: 'newbie' | 'basic' | 'advanced' (null = not set). The poster timetable colours each class
--     by it (Newbie red, Basic brown, Advanced yellow, as on the studio's printed schedule) and keys the colours
--     under the grid. Set in the class form like the rest of a class (RLS: staff write classes).
--   * site_settings (one row) holds the website's choices; for now timetable_template:
--       'poster' — the grid of the printed schedule (days across, a round photo per class, level colours);
--       'brush'  — the red card with brush-stroke badges, one column per day (the first design).
--     Everyone reads it (the public Classes page); admins and staff change it with site_set_timetable_template(),
--     which logs it on the Activity page (area 'settings', action 'timetable_template').
--   * list_public_classes() also returns the level.
--   * seed_demo_levels() gives the demo classes their levels (service role only).

alter table public.classes
  add column level text check (level in ('newbie', 'basic', 'advanced'));

create table public.site_settings (
  id                 smallint primary key default 1 check (id = 1),
  timetable_template text not null default 'poster' check (timetable_template in ('poster', 'brush')),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id) on delete set null
);
insert into public.site_settings (id) values (1);

alter table public.site_settings enable row level security;
create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

-- Pick the website timetable's look. Returns the settings row; picking the one in use changes (and logs) nothing.
create function public.site_set_timetable_template(p_template text)
returns public.site_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.site_settings;
  v_from text;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only admins and staff can change the website';
  end if;
  if p_template is null or p_template not in ('poster', 'brush') then
    raise exception 'INVALID_INPUT: the timetable template is poster or brush';
  end if;

  select * into s from public.site_settings where id = 1 for update;
  v_from := s.timetable_template;
  if v_from = p_template then
    return s;
  end if;

  update public.site_settings
     set timetable_template = p_template, updated_at = now(), updated_by = auth.uid()
   where id = 1
  returning * into s;

  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'settings', 'timetable_template', 'site_settings', '1', 'Website',
         jsonb_build_object('template', p_template, 'from', v_from);
  return s;
end;
$$;

revoke execute on function public.site_set_timetable_template(text) from public, anon;
grant execute on function public.site_set_timetable_template(text) to authenticated, service_role;

-- The public class list, now with each class's level.
drop function public.list_public_classes();
create function public.list_public_classes()
returns table (id bigint, name text, price numeric, lesson text, image_path text, room_name text, instructor_name text,
               instructor_avatar_path text, schedules jsonb, venue_address text, venue_map_url text, place_kind text,
               level text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         c.name,
         c.price,
         c.lesson,
         c.image_path,
         coalesce(r.name, v.name),
         p.full_name,
         p.avatar_path,
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'day_of_week', s.day_of_week,
                       'start_time',  s.start_time,
                       'end_time',    s.end_time)
                     order by s.day_of_week, s.start_time)
            from public.class_schedules s
            where s.class_id = c.id),
           '[]'::jsonb),
         v.address,
         v.map_url,
         case when r.id is not null then 'room' when v.id is not null then 'venue' end,
         c.level
  from public.classes c
  join public.profiles p on p.id = c.instructor_id
  left join public.rooms r on r.id = c.room_id
  left join public.venues v on v.id = c.venue_id
  where c.ended_on is null or c.ended_on >= public.studio_today()
  order by c.name;
$$;
grant execute on function public.list_public_classes() to anon, authenticated;

-- Demo: the levels of the November timetable (Newbie 1 / 2 newbie, the Choreo classes advanced, the rest basic).
create function public.seed_demo_levels()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with changed as (
    update public.classes
       set level = case when name ilike 'newbie%' then 'newbie'
                        when name ilike 'choreo%' then 'advanced'
                        else 'basic' end
     where level is null
    returning 1
  )
  select count(*)::integer from changed;
$$;

revoke execute on function public.seed_demo_levels() from public, anon, authenticated;
grant execute on function public.seed_demo_levels() to service_role;
