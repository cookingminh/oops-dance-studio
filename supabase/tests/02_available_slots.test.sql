-- get_available_slots + list_public_classes (api-contract §5 "Public lookups")
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ---------------------------------------------------------------------------
-- Test helpers (rolled back with the transaction)
-- ---------------------------------------------------------------------------
create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_role public.app_role, p_name text)
returns uuid language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('full_name', p_name), '{}'::jsonb, now(), now());
  if p_role <> 'guest' then
    update public.profiles set role = p_role where id = p_id;
  end if;
  return p_id;
end $$;
create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Date of ISO weekday p_dow (1 = Mon … 7 = Sun) in NEXT week (always future).
create function tests.next_week(p_dow int) returns date language sql stable as $$
  select date_trunc('week', public.studio_today())::date + 7 + (p_dow - 1);
$$;
create function tests.slots(p_room bigint, p_date date) returns table (start_time time, end_time time)
language sql stable as $$
  select s.start_time, s.end_time from public.get_available_slots(p_date) s
  where s.room_id = p_room order by s.start_time;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures: one room with a Sunday class and a Monday class, plus a second
-- room whose Saturday class must not leak into the first room.
-- ---------------------------------------------------------------------------
select tests.create_user('b0000000-0000-4000-8000-000000000001', 'slots.inst@test.local',  'instructor', 'Cô Lan Slots');
select tests.create_user('b0000000-0000-4000-8000-000000000002', 'slots.guest@test.local', 'guest',      'Khách Slots');

insert into public.rooms (id, name, price) values
  (900011, 'Slots Room', 200000),
  (900012, 'Slots Room 2', 150000);
insert into public.classes (id, name, instructor_id, room_id, price) values
  (900011, 'Slots Sunday Class',   'b0000000-0000-4000-8000-000000000001', 900011, 800000),
  (900012, 'Slots Monday Class',   'b0000000-0000-4000-8000-000000000001', 900011, 800000),
  (900013, 'Slots Other Room',     'b0000000-0000-4000-8000-000000000001', 900012, 800000);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values
  (900011, 7, '10:00', '12:00'),   -- Sunday
  (900012, 1, '18:00', '20:00'),   -- Monday
  (900013, 6, '09:00', '21:00');   -- Saturday, other room

-- ---------------------------------------------------------------------------
-- Weekday correctness (legacy bug: %w Sunday = 0 compared to Monday = 0)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select * from tests.slots(900011, tests.next_week(7))$$,
  $$values (time '08:00', time '10:00'), (time '12:00', time '22:00')$$,
  'Sunday: only the day_of_week = 7 class blocks the room');

select results_eq(
  $$select * from tests.slots(900011, tests.next_week(1))$$,
  $$values (time '08:00', time '18:00'), (time '20:00', time '22:00')$$,
  'Monday: only the day_of_week = 1 class blocks the room');

select results_eq(
  $$select * from tests.slots(900011, tests.next_week(6))$$,
  $$values (time '08:00', time '22:00')$$,
  'free day: single merged window 08:00–22:00; other room''s class does not leak');

select results_eq(
  $$select * from tests.slots(900012, tests.next_week(6))$$,
  $$values (time '08:00', time '09:00'), (time '21:00', time '22:00')$$,
  'class in the other room blocks only that room');

-- ---------------------------------------------------------------------------
-- Bookings: boundaries, unaligned times, statuses
-- ---------------------------------------------------------------------------
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status) values
  (900011, 900011, 'b0000000-0000-4000-8000-000000000002', tests.next_week(2), '08:00', '09:00', 'pending'),
  (900012, 900011, 'b0000000-0000-4000-8000-000000000002', tests.next_week(2), '21:00', '22:00', 'approved'),
  (900013, 900011, 'b0000000-0000-4000-8000-000000000002', tests.next_week(2), '13:00', '14:00', 'pending'),
  (900014, 900011, 'b0000000-0000-4000-8000-000000000002', tests.next_week(2), '15:00', '16:00', 'rejected'),
  (900015, 900011, 'b0000000-0000-4000-8000-000000000002', tests.next_week(2), '16:00', '17:00', 'cancelled'),
  (900016, 900011, 'b0000000-0000-4000-8000-000000000002', tests.next_week(2), '17:00', '18:00', 'completed');

select results_eq(
  $$select * from tests.slots(900011, tests.next_week(2))$$,
  $$values (time '09:00', time '13:00'), (time '14:00', time '17:00'), (time '18:00', time '21:00')$$,
  'bookings at 08:00 and 22:00 edges trim the window; pending 13:00–14:00 splits it; rejected/cancelled do not block; completed ahead (paid in full) does');

update public.bookings set status = 'cancelled' where id = 900011;
select results_eq(
  $$select * from tests.slots(900011, tests.next_week(2))$$,
  $$values (time '08:00', time '13:00'), (time '14:00', time '17:00'), (time '18:00', time '21:00')$$,
  'cancelling a booking frees its slot');

select is(
  (select count(*) from public.get_available_slots(tests.next_week(2)) s
    where s.room_id = 900011 and (s.start_time < time '08:00' or s.end_time > time '22:00')),
  0::bigint,
  'no window outside 08:00–22:00');

select is(
  (select count(*) from public.get_available_slots(tests.next_week(2)) s
    where s.room_id = 900011
      and (extract(minute from s.start_time) not in (0, 30) or extract(minute from s.end_time) not in (0, 30))),
  0::bigint,
  'windows are on the 30-minute grid');

-- Fully booked room returns no row at all.
insert into public.bookings (room_id, guest_id, date, start_time, end_time, status)
values (900012, 'b0000000-0000-4000-8000-000000000002', tests.next_week(4), '08:00', '22:00', 'approved');
select is_empty($$select * from tests.slots(900012, tests.next_week(4))$$, 'fully booked room: no row');

select is_empty($$select * from public.get_available_slots(public.studio_today() - 1)$$, 'past date: no slots');

-- ---------------------------------------------------------------------------
-- Anonymous access
-- ---------------------------------------------------------------------------
select tests.login_anon();
select results_eq(
  $$select * from tests.slots(900011, tests.next_week(7))$$,
  $$values (time '08:00', time '10:00'), (time '12:00', time '22:00')$$,
  'anon can call get_available_slots');

select results_eq(
  $$select instructor_name, room_name, jsonb_array_length(schedules)
    from public.list_public_classes() where id = 900011$$,
  $$values ('Cô Lan Slots'::text, 'Slots Room'::text, 1)$$,
  'anon: list_public_classes exposes instructor name, room, schedules');

select results_eq(
  $$select schedules from public.list_public_classes() where id = 900012$$,
  $$values ('[{"day_of_week": 1, "start_time": "18:00:00", "end_time": "20:00:00"}]'::jsonb)$$,
  'list_public_classes schedules shape');

select tests.logout();
select * from finish();
rollback;
