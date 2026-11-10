-- One routine at a time, a waive that comes off cleanly, and the activity log (api-contract §3, §5):
--   * staff can't start a routine before the one before it ends, or stretch one into the next
--   * reopening a waived invoice drops the waive reason and brings the earlier note back
--   * a cancelled class session frees its room for bookings; it can't come back once booked
--   * people's actions are logged with their name; generated rows and plain system writes aren't;
--     only admins read the log
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
-- The instructor's check-in RPC needs an uploaded photo; act as them without RLS instead.
create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
create function tests.logged(p_action text, p_entity_id text) returns public.activity_log language sql stable security definer as $$
  select a.* from public.activity_log a where a.action = p_action and a.entity_id = p_entity_id order by a.id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000151', 'order-admin@test.local', 'admin', 'Order Admin');
select tests.create_user('00000000-0000-4000-b000-000000000152', 'order-staff@test.local', 'staff', 'Order Staff');
select tests.create_user('00000000-0000-4000-b000-000000000153', 'order-teacher@test.local', 'instructor', 'Order Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000154', 'order-student@test.local', 'guest', 'Order Student');

-- A class that meets every day; "Now" started 2 days ago with 5 sessions → its last session is in 2 days.
insert into public.classes (id, name, instructor_id, price, starts_on)
values (900151, 'Order Class', '00000000-0000-4000-b000-000000000153', 500000, tests.today() - 30);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select 900151, d, '10:00', '11:00' from generate_series(1, 7) d;
insert into public.class_lessons (id, class_id, starts_on, title, session_count)
overriding system value values (900151, 900151, tests.today() - 2, 'Now', 5);

-- ---------------------------------------------------------------------------
-- One routine at a time
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000152');
select throws_like(
  $$insert into public.class_lessons (class_id, starts_on, title, session_count) values (900151, public.studio_today() + 1, 'Too soon', 4)$$,
  'INVALID_STATE: routine order:%', 'the next routine can''t start before the current one''s last session');
select lives_ok(
  $$insert into public.class_lessons (class_id, starts_on, title, session_count) values (900151, public.studio_today() + 3, 'Next', 4)$$,
  'it can start the day after');
select throws_like(
  $$update public.class_lessons set session_count = 8 where id = 900151$$,
  'INVALID_STATE: routine order:%', 'and the current one can''t be stretched into it');
select lives_ok($$update public.class_lessons set title = 'Now — renamed' where id = 900151$$, 'renaming is fine');
select tests.logout();
select lives_ok(
  $$insert into public.class_lessons (class_id, starts_on, title, session_count) values (900151, public.studio_today() + 4, 'Seeded', 1)$$,
  'seeds and jobs aren''t checked');
delete from public.class_lessons where title = 'Seeded';

-- ---------------------------------------------------------------------------
-- Waive and reopen
-- ---------------------------------------------------------------------------
insert into public.class_students (class_id, student_id) values (900151, '00000000-0000-4000-b000-000000000154');
update public.tuition_invoices set note = 'Joined late'
 where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151;
select tests.login_as('00000000-0000-4000-b000-000000000152');
select public.tuition_waive((select id from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151),
                            'Free trial course');
select is((select note from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151),
          'Free trial course', 'waiving shows its reason');
select public.tuition_reopen((select id from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151));
select is((select note from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151),
          'Joined late', 'reopening drops the reason and brings the earlier note back');

-- ---------------------------------------------------------------------------
-- The activity log
-- ---------------------------------------------------------------------------
select is((tests.logged('waived', (select id::text from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151))).actor_name,
          'Order Staff', 'a waive is logged with who did it');
select is((tests.logged('waived', (select id::text from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151))).meta ->> 'note',
          'Free trial course', 'and its reason');
select isnt((tests.logged('reopened', (select id::text from public.tuition_invoices where student_id = '00000000-0000-4000-b000-000000000154' and lesson_id = 900151))).id,
            null, 'reopening is logged too');
select isnt((tests.logged('planned', (select id::text from public.class_lessons where title = 'Next'))).id, null, 'planning a routine is logged');
select is((select count(*)::int from public.activity_log where entity = 'class_lessons' and label = 'Seeded'), 0,
          'a seed''s routine isn''t');

-- A session: the instructor checks in, staff approve it.
select tests.logout();
insert into public.instructor_attendance (id, class_id, instructor_id, date)
overriding system value values (900151, 900151, '00000000-0000-4000-b000-000000000153', tests.today());
select is((select count(*)::int from public.activity_log where entity = 'instructor_attendance' and entity_id = '900151'), 0,
          'a generated session isn''t logged');
select tests.act_as('00000000-0000-4000-b000-000000000153');
update public.instructor_attendance set status = 'in_progress', checkin_at = now() where id = 900151;
select tests.login_as('00000000-0000-4000-b000-000000000152');
update public.instructor_attendance set status = 'completed', checkout_at = now() where id = 900151;
select is((tests.logged('checked_in', '900151')).actor_role, 'instructor'::public.app_role, 'the instructor''s check-in is logged');
select is((tests.logged('approved', '900151')).actor_name, 'Order Staff', 'staff completing it is an approval');

-- A booking edited by staff: the change is kept.
select tests.logout();
insert into public.rooms (id, name, size, price) overriding system value values (900151, 'Order Room', '20m2', 100000);
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status)
overriding system value values (900151, 900151, '00000000-0000-4000-b000-000000000154', tests.today() + 20, '08:00', '09:00', 'pending');
select tests.login_as('00000000-0000-4000-b000-000000000152');
update public.bookings set status = 'approved' where id = 900151;
select is((tests.logged('approved', '900151')).changes -> 'status' ->> 'from', 'pending', 'an approval keeps what changed');
select is((tests.logged('approved', '900151')).label, 'Order Student', 'and whose booking it is');

-- A cancelled session frees its room (the class now meets in Order Room, every day 10:00–11:00).
select tests.logout();
update public.classes set room_id = 900151 where id = 900151;
insert into public.instructor_attendance (id, class_id, instructor_id, room_id, date, status)
overriding system value values (900152, 900151, '00000000-0000-4000-b000-000000000153', 900151, tests.today() + 5, 'cancelled');
select lives_ok(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time, status)
    values (900151, '00000000-0000-4000-b000-000000000154', public.studio_today() + 5, '10:00', '11:00', 'pending')$$,
  'a cancelled class session frees its room');
select throws_like(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time, status)
    values (900151, '00000000-0000-4000-b000-000000000154', public.studio_today() + 6, '10:00', '11:00', 'pending')$$,
  'SLOT_TAKEN:%', 'a session that runs still holds it');
select throws_like($$update public.instructor_attendance set status = 'pending' where id = 900152$$,
  'SLOT_TAKEN:%', 'the cancelled session can''t come back once its slot is booked');

-- Sign-ups are logged as the system; plain system writes elsewhere aren't.
select tests.logout();
select is((tests.logged('account_created', '00000000-0000-4000-b000-000000000154')).actor_id, null, 'a new account is logged as the system');
update public.rooms set price = 120000 where id = 900151;
select is((select count(*)::int from public.activity_log where entity = 'rooms' and entity_id = '900151'), 0,
          'a job changing a room isn''t');

-- Only admins read it.
select tests.login_as('00000000-0000-4000-b000-000000000152');
select is((select count(*)::int from public.activity_log), 0, 'staff can''t read the log');
select tests.login_as('00000000-0000-4000-b000-000000000151');
select ok((select count(*) from public.activity_log) > 0, 'admins can');
select tests.logout();

select * from finish();
rollback;
