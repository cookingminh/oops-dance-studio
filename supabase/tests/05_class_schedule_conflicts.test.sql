-- Class timetable conflicts (api-contract §3 class_schedules / classes):
--   * two classes may not overlap in the same room on the same weekday
--   * adding/editing a schedule (or moving a class to a room) may not overlap a
--     pending/approved booking dated today or later → SLOT_TAKEN
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
create function tests.login_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures: room R1 with class A (Mon 18:00–19:30); class B in R1 without
-- schedules; class C in R2 (Mon 18:00–19:30); classes D, E without a room.
-- ---------------------------------------------------------------------------
select tests.create_user('f0000000-0000-4000-8000-000000000001', 'tt.staff@test.local', 'staff',      'Staff TKB');
select tests.create_user('f0000000-0000-4000-8000-000000000002', 'tt.inst@test.local',  'instructor', 'Giáo viên TKB');
select tests.create_user('f0000000-0000-4000-8000-000000000003', 'tt.guest@test.local', 'guest',      'Khách TKB');

insert into public.rooms (id, name, price) values (900051, 'Timetable R1', 200000), (900052, 'Timetable R2', 150000);
insert into public.classes (id, name, instructor_id, room_id, price) values
  (900051, 'TT Class A', 'f0000000-0000-4000-8000-000000000002', 900051, 800000),
  (900052, 'TT Class B', 'f0000000-0000-4000-8000-000000000002', 900051, 800000),
  (900053, 'TT Class C', 'f0000000-0000-4000-8000-000000000002', 900052, 800000),
  (900054, 'TT Class D', 'f0000000-0000-4000-8000-000000000002', null,   800000),
  (900055, 'TT Class E', 'f0000000-0000-4000-8000-000000000002', null,   800000);
insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time) values
  (900051, 900051, 1, '18:00', '19:30'),
  (900053, 900053, 1, '18:00', '19:30');

-- Bookings in R1: future approved (Wed), future pending (Thu), future cancelled
-- (Fri), and a past approved one on last week's Saturday.
insert into public.bookings (room_id, guest_id, date, start_time, end_time, status) values
  (900051, 'f0000000-0000-4000-8000-000000000003', tests.next_week(3), '10:00', '12:00', 'approved'),
  (900051, 'f0000000-0000-4000-8000-000000000003', tests.next_week(4), '14:00', '15:00', 'pending'),
  (900051, 'f0000000-0000-4000-8000-000000000003', tests.next_week(5), '10:00', '11:00', 'cancelled'),
  (900051, 'f0000000-0000-4000-8000-000000000003', date_trunc('week', public.studio_today())::date - 2, '10:00', '11:00', 'approved');

select tests.login_as('f0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Class vs class in the same room
-- ---------------------------------------------------------------------------
select throws_like(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 1, '19:00', '20:00')$$,
  'SLOT_TAKEN:%', 'second class overlapping another class in the same room → SLOT_TAKEN');
select throws_like(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 1, '17:00', '21:00')$$,
  'SLOT_TAKEN:%', 'schedule that contains another class → SLOT_TAKEN');
select lives_ok(
  $$insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time) values (900052, 900052, 1, '19:30', '20:30')$$,
  'back-to-back classes in the same room are allowed');
select lives_ok(
  $$insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time) values (900054, 900052, 2, '18:00', '19:30')$$,
  'same time on another weekday is allowed');
select throws_like(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900051, 1, '19:00', '19:30')$$,
  'SLOT_TAKEN:%', 'a class cannot overlap its own schedule either');
select throws_like(
  $$update public.class_schedules set day_of_week = 1, start_time = '18:30', end_time = '19:00' where id = 900054$$,
  'SLOT_TAKEN:%', 'editing a schedule onto another class → SLOT_TAKEN');
select lives_ok(
  $$update public.class_schedules set start_time = '18:00', end_time = '20:00' where id = 900054$$,
  'editing a schedule without conflict is allowed (its own old slot is ignored)');
select is(
  (select count(*) from public.class_schedules where class_id = 900053 and day_of_week = 1 and start_time = '18:00'),
  1::bigint,
  'the same time in a different room is fine (class C, R2)');
select lives_ok(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900051, 1, '18:00', '19:30')
    on conflict (class_id, day_of_week, start_time) do update set end_time = excluded.end_time$$,
  'upserting an existing schedule does not clash with itself');

-- ---------------------------------------------------------------------------
-- Schedule vs future bookings
-- ---------------------------------------------------------------------------
select throws_like(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 3, '11:00', '12:30')$$,
  'SLOT_TAKEN:%', 'schedule over a future approved booking → SLOT_TAKEN');
select throws_like(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 4, '14:30', '15:30')$$,
  'SLOT_TAKEN:%', 'schedule over a future pending booking → SLOT_TAKEN');
select lives_ok(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 3, '12:00', '13:00')$$,
  'schedule right after a booking is allowed');
select lives_ok(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 5, '10:00', '11:00')$$,
  'a cancelled booking does not block a schedule');
select lives_ok(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900052, 6, '10:00', '11:00')$$,
  'a past booking does not block a schedule');
select throws_like(
  $$update public.class_schedules set day_of_week = 3, start_time = '09:00', end_time = '10:30' where id = 900054$$,
  'SLOT_TAKEN:%', 'moving a schedule onto a future booking → SLOT_TAKEN');

-- ---------------------------------------------------------------------------
-- Moving a whole class to a room
-- ---------------------------------------------------------------------------
select throws_like(
  $$update public.classes set room_id = 900051 where id = 900053$$,
  'SLOT_TAKEN:%', 'moving class C into R1 where class A has the same slot → SLOT_TAKEN');
select lives_ok(
  $$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900054, 1, '18:00', '19:30')$$,
  'a class without a room blocks nothing');
select throws_like(
  $$update public.classes set room_id = 900052 where id = 900054$$,
  'SLOT_TAKEN:%', 'giving room R2 to class D clashes with class C → SLOT_TAKEN');

insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900055, 3, '10:30', '11:00');
select throws_like(
  $$update public.classes set room_id = 900051 where id = 900055$$,
  'SLOT_TAKEN:%', 'moving a class into a room with a future booking at that time → SLOT_TAKEN');
select lives_ok(
  $$update public.classes set room_id = 900052 where id = 900055$$,
  'moving a class into a free room is allowed');

select tests.logout();
select * from finish();
rollback;
