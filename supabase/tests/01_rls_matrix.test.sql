-- RLS matrix: anon / guest / instructor / staff / admin × every table (api-contract §4)
begin;
create extension if not exists pgtap with schema extensions;
select plan(85);

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
-- Rows affected by a DML statement run as the current role.
create function tests.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
-- Date of ISO weekday p_dow (1 = Mon … 7 = Sun) in NEXT week (always future).
create function tests.next_week(p_dow int) returns date language sql stable as $$
  select date_trunc('week', public.studio_today())::date + 7 + (p_dow - 1);
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
select tests.create_user('a0000000-0000-4000-8000-000000000001', 'rls.admin@test.local',  'admin',      'RLS Admin');
select tests.create_user('a0000000-0000-4000-8000-000000000002', 'rls.staff@test.local',  'staff',      'RLS Staff');
select tests.create_user('a0000000-0000-4000-8000-000000000003', 'rls.inst1@test.local',  'instructor', 'RLS Instructor 1');
select tests.create_user('a0000000-0000-4000-8000-000000000004', 'rls.inst2@test.local',  'instructor', 'RLS Instructor 2');
select tests.create_user('a0000000-0000-4000-8000-000000000005', 'rls.guest1@test.local', 'guest',      'RLS Guest 1');
select tests.create_user('a0000000-0000-4000-8000-000000000006', 'rls.guest2@test.local', 'guest',      'RLS Guest 2');

insert into public.rooms (id, name, size, price) values
  (900001, 'RLS Room A', '80m2', 200000),
  (900002, 'RLS Room B', '50m2', 150000);
insert into public.classes (id, name, instructor_id, room_id, price) values
  (900001, 'RLS Class 1', 'a0000000-0000-4000-8000-000000000003', 900001, 800000),
  (900002, 'RLS Class 2', 'a0000000-0000-4000-8000-000000000004', 900002, 900000);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values
  (900001, 1, '18:00', '20:00'),
  (900002, 3, '18:00', '20:00');
insert into public.class_students (class_id, student_id) values
  (900001, 'a0000000-0000-4000-8000-000000000005'),
  (900002, 'a0000000-0000-4000-8000-000000000006');
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status) values
  (900001, 900001, 'a0000000-0000-4000-8000-000000000005', tests.next_week(2), '10:00', '12:00', 'pending'),
  (900002, 900001, 'a0000000-0000-4000-8000-000000000006', tests.next_week(2), '13:00', '15:00', 'approved');
insert into public.instructor_attendance (id, class_id, instructor_id, room_id, date) values
  (900001, 900001, 'a0000000-0000-4000-8000-000000000003', 900001, tests.next_week(1)),
  (900002, 900002, 'a0000000-0000-4000-8000-000000000004', 900002, tests.next_week(3));
insert into public.student_attendance (id, class_id, student_id, date) values
  (900001, 900001, 'a0000000-0000-4000-8000-000000000005', tests.next_week(1)),
  (900002, 900002, 'a0000000-0000-4000-8000-000000000006', tests.next_week(3));

-- ---------------------------------------------------------------------------
-- Structural guarantees
-- ---------------------------------------------------------------------------
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  'RLS is enabled on every public table');

select set_eq(
  $$select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')$$,
  array['get_available_slots', 'list_public_classes', 'is_username_available', 'studio_today'],
  'anon can execute only the public lookup functions');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')$$,
  'every public/private function pins search_path');

-- Sign-up trigger ignores a client-supplied role.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-0000000000ff', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'rls.sneaky@test.local',
        '{"username":"sneaky","full_name":"Sneaky","role":"admin","contact_number":"0901234567"}');
select results_eq(
  $$select role::text, username, full_name, contact_number from public.profiles
    where id = 'a0000000-0000-4000-8000-0000000000ff'$$,
  $$values ('guest', 'sneaky', 'Sneaky', '0901234567')$$,
  'sign-up: profile created with role guest whatever metadata says');

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$select 1 from public.profiles$$, '42501', null, 'anon: cannot read profiles');
select ok((select count(*) from public.rooms where id = 900001) = 1, 'anon: can read rooms');
select is((select image_paths from public.rooms where id = 900001), '{}'::text[], 'anon: can read rooms.image_paths (empty by default)');
select throws_ok($$insert into public.rooms (name, price) values ('anon room', 1)$$, '42501', null, 'anon: cannot insert rooms');
select ok((select count(*) from public.classes where id = 900001) = 1, 'anon: can read classes');
select throws_ok($$update public.classes set price = 1 where id = 900001$$, '42501', null, 'anon: cannot update classes');
select ok((select count(*) from public.class_schedules where class_id = 900001) = 1, 'anon: can read class_schedules');
select throws_ok($$delete from public.class_schedules where class_id = 900001$$, '42501', null, 'anon: cannot delete class_schedules');
select throws_ok($$select 1 from public.class_students$$, '42501', null, 'anon: cannot read class_students');
select throws_ok($$select 1 from public.bookings$$, '42501', null, 'anon: cannot read bookings');
select throws_ok($$select 1 from public.instructor_attendance$$, '42501', null, 'anon: cannot read instructor_attendance');
select throws_ok($$select 1 from public.student_attendance$$, '42501', null, 'anon: cannot read student_attendance');
select throws_ok($$select 1 from public.v_revenue_monthly$$, '42501', null, 'anon: cannot read v_revenue_monthly');
select throws_ok($$select public.create_booking(900001, tests.next_week(4), '10:00', '11:00')$$, '42501', null,
  'anon: cannot call create_booking');

-- ---------------------------------------------------------------------------
-- guest (a…05)
-- ---------------------------------------------------------------------------
select tests.login_as('a0000000-0000-4000-8000-000000000005');
select is((select count(*) from public.profiles), 1::bigint, 'guest: sees only own profile');
select is(tests.affected($$update public.profiles set full_name = 'Khách Một' where id = 'a0000000-0000-4000-8000-000000000005'$$),
  1, 'guest: can update own profile fields');
select throws_like($$update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000005'$$,
  'FORBIDDEN:%', 'guest: cannot change own role');
select throws_like($$update public.profiles set email = 'x@x.test' where id = 'a0000000-0000-4000-8000-000000000005'$$,
  'FORBIDDEN:%', 'guest: cannot change own email');
select is(tests.affected($$update public.profiles set full_name = 'hacked' where id = 'a0000000-0000-4000-8000-000000000006'$$),
  0, 'guest: cannot update another profile');
select is(tests.affected($$delete from public.profiles where id = 'a0000000-0000-4000-8000-000000000005'$$),
  0, 'guest: cannot delete profiles');
select ok((select count(*) from public.rooms where id = 900001) = 1, 'guest: can read rooms');
select throws_ok($$insert into public.rooms (name, price) values ('guest room', 1)$$, '42501', null, 'guest: cannot insert rooms');
select is(tests.affected($$update public.rooms set image_paths = array['rooms/900001/x.webp'] where id = 900001$$), 0,
  'guest: cannot set room photos');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('site-assets', 'rooms/900001/x.webp')$$,
  '42501', null, 'guest: cannot upload to site-assets/rooms/');
select is(tests.affected($$update public.classes set price = 1 where id = 900001$$), 0, 'guest: cannot update classes');
select throws_ok($$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900001, 2, '08:00', '09:00')$$,
  '42501', null, 'guest: cannot insert class_schedules');
select is((select count(*) from public.class_students), 1::bigint, 'guest: sees only own enrolments');
select throws_ok($$insert into public.class_students (class_id, student_id) values (900002, 'a0000000-0000-4000-8000-000000000005')$$,
  '42501', null, 'guest: cannot self-enrol');
select is((select count(*) from public.bookings), 1::bigint, 'guest: sees only own bookings');
select is((select count(*) from public.bookings where id = 900002), 0::bigint, 'guest: cannot see another guest''s booking');
select throws_ok(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time)
    values (900002, 'a0000000-0000-4000-8000-000000000005', tests.next_week(4), '08:00', '09:00')$$,
  '42501', null, 'guest: cannot insert bookings directly (must use create_booking)');
select is(tests.affected($$update public.bookings set status = 'approved' where id = 900001$$), 0,
  'guest: cannot update own booking directly');
select is((select count(*) from public.instructor_attendance), 0::bigint, 'guest: sees no instructor_attendance');
select is((select count(*) from public.student_attendance), 1::bigint, 'guest: sees only own student_attendance');
select is(tests.affected($$update public.student_attendance set status = 'attend' where id = 900001$$), 0,
  'guest: cannot mark own attendance');
select is((select count(*) from public.v_revenue_monthly), 0::bigint, 'guest: revenue view is empty');

-- ---------------------------------------------------------------------------
-- instructor (a…03, teaches RLS Class 1 with guest a…05)
-- ---------------------------------------------------------------------------
select tests.login_as('a0000000-0000-4000-8000-000000000003');
select set_eq($$select id from public.profiles$$,
  array['a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005']::uuid[],
  'instructor: sees own profile + students of own classes');
select is(tests.affected($$update public.profiles set full_name = 'x' where id = 'a0000000-0000-4000-8000-000000000005'$$), 0,
  'instructor: cannot update student profiles');
select throws_like($$update public.profiles set role = 'staff' where id = 'a0000000-0000-4000-8000-000000000003'$$,
  'FORBIDDEN:%', 'instructor: cannot change own role');
select is(tests.affected($$update public.classes set price = 1 where id = 900001$$), 0, 'instructor: cannot edit classes');
select is((select count(*) from public.class_students), 1::bigint, 'instructor: sees enrolments of own classes only');
select is((select count(*) from public.bookings), 0::bigint, 'instructor: sees only own bookings (none)');
select is((select count(*) from public.instructor_attendance), 1::bigint, 'instructor: sees own sessions only');
select is(tests.affected($$update public.instructor_attendance set status = 'completed' where id = 900001$$), 0,
  'instructor: cannot write instructor_attendance directly');
select throws_ok($$insert into public.instructor_attendance (class_id, instructor_id, date) values (900001, 'a0000000-0000-4000-8000-000000000003', tests.next_week(5))$$,
  '42501', null, 'instructor: cannot insert instructor_attendance');
select is((select count(*) from public.student_attendance), 1::bigint, 'instructor: sees roll rows of own classes only');
select is(tests.affected($$update public.student_attendance set status = 'attend', details = 'Đúng giờ' where id = 900001$$), 1,
  'instructor: can update status/details for own class');
select is(tests.affected($$update public.student_attendance set status = 'attend' where id = 900002$$), 0,
  'instructor: cannot update another class''s roll');
select throws_like($$update public.student_attendance set date = date '2000-01-01' where id = 900001$$,
  'FORBIDDEN:%', 'instructor: cannot change roll columns other than status/details');
select throws_ok($$insert into public.student_attendance (class_id, student_id, date) values (900001, 'a0000000-0000-4000-8000-000000000005', date '2000-01-01')$$,
  '42501', null, 'instructor: cannot insert roll rows');

-- ---------------------------------------------------------------------------
-- staff (a…02)
-- ---------------------------------------------------------------------------
select tests.login_as('a0000000-0000-4000-8000-000000000002');
select ok((select count(*) from public.profiles where email like 'rls.%@test.local') = 7, 'staff: sees all profiles');
select is(tests.affected($$update public.profiles set full_name = 'Đổi bởi staff' where id = 'a0000000-0000-4000-8000-000000000006'$$), 1,
  'staff: can update non-role fields of others');
select throws_like($$update public.profiles set role = 'staff' where id = 'a0000000-0000-4000-8000-000000000006'$$,
  'FORBIDDEN:%', 'staff: cannot change roles');
select is(tests.affected($$delete from public.profiles where id = 'a0000000-0000-4000-8000-000000000006'$$), 0,
  'staff: cannot delete users');
select lives_ok($$insert into public.rooms (id, name, price) values (900003, 'RLS Room C', 100000)$$, 'staff: can create rooms');
select is(tests.affected($$update public.rooms set price = 120000 where id = 900003$$), 1, 'staff: can update rooms');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('site-assets', 'rooms/900003/a.webp')$$,
  'staff: can upload to site-assets/rooms/{room_id}/');
select is(tests.affected($$update public.rooms set image_paths = array['rooms/900003/a.webp', 'rooms/900003/b.webp'] where id = 900003$$), 1,
  'staff: can set room photos');
select throws_ok($$update public.rooms set image_paths = array['rooms/900003/a.webp', null] where id = 900003$$,
  '23514', null, 'rooms.image_paths rejects null elements');
select lives_ok($$insert into public.classes (id, name, instructor_id, room_id, price) values (900003, 'RLS Class 3', 'a0000000-0000-4000-8000-000000000004', 900003, 500000)$$,
  'staff: can create classes');
select throws_like($$insert into public.classes (name, instructor_id, price) values ('RLS Bad Class', 'a0000000-0000-4000-8000-000000000005', 1)$$,
  'INVALID_INPUT:%', 'classes.instructor_id must be an instructor');
select lives_ok($$insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (900001, 2, '08:00', '09:00')$$,
  'staff: can add schedules');
select lives_ok($$insert into public.class_students (class_id, student_id) values (900001, 'a0000000-0000-4000-8000-000000000006')$$,
  'staff: can enrol students');
select is((select count(*) from public.bookings where id in (900001, 900002)), 2::bigint, 'staff: sees all bookings');
select is(tests.affected($$update public.bookings set status = 'approved', full_payment = 400000, real_income = 400000 where id = 900001$$), 1,
  'staff: can update bookings');
select is((select count(*) from public.instructor_attendance where id in (900001, 900002)), 2::bigint, 'staff: sees all sessions');
select is(tests.affected($$update public.instructor_attendance set status = 'cancelled' where id = 900002$$), 1,
  'staff: can update instructor_attendance');
select is((select count(*) from public.student_attendance where id in (900001, 900002)), 2::bigint, 'staff: sees all roll rows');
select lives_ok($$insert into public.student_attendance (class_id, student_id, date) values (900001, 'a0000000-0000-4000-8000-000000000006', tests.next_week(1))$$,
  'staff: can insert roll rows');
select is((select count(*) from public.v_revenue_monthly where room_id = 900001), 1::bigint, 'staff: sees revenue view');
select is((select bookings_count from public.v_revenue_monthly where room_id = 900001), 2,
  'revenue view counts approved bookings only');

-- ---------------------------------------------------------------------------
-- admin (a…01)
-- ---------------------------------------------------------------------------
select tests.login_as('a0000000-0000-4000-8000-000000000001');
select is(tests.affected($$update public.profiles set role = 'staff' where id = 'a0000000-0000-4000-8000-000000000006'$$), 1,
  'admin: can change roles');
select is(tests.affected($$update public.profiles set full_name = 'Admin sửa' where id = 'a0000000-0000-4000-8000-000000000005'$$), 1,
  'admin: can update any profile');
select lives_ok($$insert into public.rooms (id, name, price) values (900004, 'RLS Room D', 100000)$$, 'admin: can create rooms');
select is(tests.affected($$delete from public.rooms where id = 900004$$), 1, 'admin: can delete rooms');
select is(tests.affected($$delete from public.classes where id = 900003$$), 1, 'admin: can delete classes');
select is((select count(*) from public.bookings where id in (900001, 900002)), 2::bigint, 'admin: sees all bookings');
select is(tests.affected($$delete from public.student_attendance where class_id = 900001 and student_id = 'a0000000-0000-4000-8000-000000000006'$$), 1,
  'admin: can delete roll rows');
select is(tests.affected($$delete from public.class_students where class_id = 900001 and student_id = 'a0000000-0000-4000-8000-000000000006'$$), 1,
  'admin: can delete enrolments');
select is((select count(*) from public.instructor_attendance where id in (900001, 900002)), 2::bigint, 'admin: sees all sessions');
select is((select count(*) from public.v_revenue_monthly where room_id = 900001), 1::bigint, 'admin: sees revenue view');

select tests.logout();
select * from finish();
rollback;
