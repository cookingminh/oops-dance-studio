-- seed_demo_venue_rooms(): its last UPDATE (each studio's rent = its first room's) had no WHERE.
-- The hosted project runs PostgREST with pg-safeupdate, which refuses an UPDATE or DELETE without
-- one, so `seed-demo.mjs --reset` stopped there (the local stack doesn't load safeupdate, so CI and
-- seed.sql never saw it). Same function, with the WHERE; the grants carry over (create or replace).

create or replace function public.seed_demo_venue_rooms()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tho bigint := (select id from public.venues where name = 'Studio Thỏ');
  v_baladi bigint := (select id from public.venues where name = 'Studio Baladi Vũ Thạnh');
  v_big bigint;
  v_small bigint;
  v_one bigint;
  v_made integer := 0;
begin
  perform set_config('oops.activity', 'off', true);
  if v_tho is not null and not exists (select 1 from public.venue_rooms where venue_id = v_tho) then
    insert into public.venue_rooms (venue_id, name, rent_per_hour, position) values (v_tho, 'Phòng lớn', 250000, 0) returning id into v_big;
    insert into public.venue_rooms (venue_id, name, rent_per_hour, position) values (v_tho, 'Phòng nhỏ', 180000, 1) returning id into v_small;
    update public.classes set venue_room_id = v_big where venue_id = v_tho and name in ('Trending', 'Girlstyle 1');
    update public.classes set venue_room_id = v_small where venue_id = v_tho and venue_room_id is null;
    v_made := v_made + 2;
  end if;
  if v_baladi is not null and not exists (select 1 from public.venue_rooms where venue_id = v_baladi) then
    insert into public.venue_rooms (venue_id, name, rent_per_hour, position) values (v_baladi, 'Phòng 1', 220000, 0) returning id into v_one;
    insert into public.venue_rooms (venue_id, name, rent_per_hour, position) values (v_baladi, 'Phòng 2', 200000, 1);
    update public.classes set venue_room_id = v_one where venue_id = v_baladi;
    v_made := v_made + 2;
  end if;
  -- Every other studio: one room at its rent.
  with made as (
    insert into public.venue_rooms (venue_id, name, rent_per_hour, position)
    select v.id, 'Phòng 1', v.rent_per_hour, 0 from public.venues v
     where not exists (select 1 from public.venue_rooms r where r.venue_id = v.id)
    returning 1)
  select v_made + count(*)::int into v_made from made;
  -- Classes and sessions there go in its first room (sessions not started yet follow their class's).
  update public.classes c set venue_room_id = (select r.id from public.venue_rooms r where r.venue_id = c.venue_id order by r.position, r.id limit 1)
   where c.venue_id is not null and c.venue_room_id is null;
  update public.instructor_attendance a set venue_room_id = coalesce(
           (select c.venue_room_id from public.classes c where c.id = a.class_id and c.venue_id = a.venue_id),
           (select r.id from public.venue_rooms r where r.venue_id = a.venue_id order by r.position, r.id limit 1))
   where a.venue_id is not null and a.venue_room_id is null;
  -- (PostgREST's safeupdate wants a WHERE; every studio has a room by now.)
  update public.venues v set rent_per_hour = (select r.rent_per_hour from public.venue_rooms r where r.venue_id = v.id order by r.position, r.id limit 1)
   where exists (select 1 from public.venue_rooms r where r.venue_id = v.id);
  perform set_config('oops.activity', '', true);
  return v_made;
end;
$$;
