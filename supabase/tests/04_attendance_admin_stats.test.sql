-- Attendance generation / check-in-out, admin_set_role, stats (api-contract §5, §7)
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
select tests.create_user('d0000000-0000-4000-8000-000000000001', 'att.admin@test.local',  'admin',      'Admin Att');
select tests.create_user('d0000000-0000-4000-8000-000000000002', 'att.staff@test.local',  'staff',      'Staff Att');
select tests.create_user('d0000000-0000-4000-8000-000000000003', 'att.inst1@test.local',  'instructor', 'Thầy Một');
select tests.create_user('d0000000-0000-4000-8000-000000000004', 'att.inst2@test.local',  'instructor', 'Cô Hai');
select tests.create_user('d0000000-0000-4000-8000-000000000005', 'att.guest1@test.local', 'guest',      'Học viên Một');
select tests.create_user('d0000000-0000-4000-8000-000000000006', 'att.guest2@test.local', 'guest',      'Học viên Hai');

insert into public.rooms (id, name, price) values (900041, 'Attendance Room', 200000);
insert into public.classes (id, name, instructor_id, room_id, price) values
  (900041, 'Attendance Class 1', 'd0000000-0000-4000-8000-000000000003', 900041, 800000),
  (900042, 'Attendance Class 2', 'd0000000-0000-4000-8000-000000000004', 900041, 800000);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values
  (900041, 1, '08:00', '09:30'),
  (900041, 1, '18:00', '19:30'),   -- second Monday session: still one row per (class, date)
  (900041, 3, '18:00', '19:30'),
  (900042, 5, '18:00', '19:30');
insert into public.class_students (class_id, student_id, joined_at) values
  (900041, 'd0000000-0000-4000-8000-000000000005', public.studio_today() - 30),
  (900041, 'd0000000-0000-4000-8000-000000000006', public.studio_today() + 365);  -- joins in the future

-- A week far enough ahead that seed data never generated it.
create function tests.far_monday() returns date language sql stable as $$
  select date_trunc('week', public.studio_today())::date + 70;
$$;
grant execute on function tests.far_monday() to authenticated;

-- ---------------------------------------------------------------------------
-- generate_instructor_attendance
-- ---------------------------------------------------------------------------
select is(
  public.generate_instructor_attendance(tests.far_monday()),
  (select count(distinct (c.id, s.day_of_week))::int
     from public.classes c join public.class_schedules s on s.class_id = c.id),
  'generate_instructor_attendance: one row per (class, scheduled weekday)');
select results_eq(
  $$select date, status::text, instructor_id, room_id from public.instructor_attendance
    where class_id = 900041 and date >= tests.far_monday() order by date$$,
  $$values (tests.far_monday(),     'pending'::text, 'd0000000-0000-4000-8000-000000000003'::uuid, 900041::bigint),
           (tests.far_monday() + 2, 'pending'::text, 'd0000000-0000-4000-8000-000000000003'::uuid, 900041::bigint)$$,
  'rows land on Monday (ISO 1) and Wednesday (ISO 3) of that week');
select is(public.generate_instructor_attendance(tests.far_monday()), 0,
  'generate_instructor_attendance is idempotent');
select is(public.generate_instructor_attendance(tests.far_monday() + 4), 0,
  'a mid-week p_week_start is normalised to its Monday');

-- ---------------------------------------------------------------------------
-- generate_student_attendance
-- ---------------------------------------------------------------------------
select is(
  public.generate_student_attendance(tests.far_monday()),
  (select count(*)::int from public.class_students cs
    where cs.joined_at <= tests.far_monday()
      and exists (select 1 from public.class_schedules s
                  where s.class_id = cs.class_id and s.day_of_week = 1)),
  'generate_student_attendance: one row per enrolled student of classes on that weekday');
select set_eq(
  $$select student_id from public.student_attendance where class_id = 900041 and date = tests.far_monday()$$,
  array['d0000000-0000-4000-8000-000000000005']::uuid[],
  'students who join after the date are skipped');
select is(public.generate_student_attendance(tests.far_monday()), 0,
  'generate_student_attendance is idempotent');
select public.generate_student_attendance(tests.far_monday() + 1);
select is(
  (select count(*) from public.student_attendance where class_id = 900041 and date = tests.far_monday() + 1),
  0::bigint,
  'weekday filter: a Mon/Wed class gets no Tuesday roll call');

select tests.login_as('d0000000-0000-4000-8000-000000000005');
select throws_like($$select public.generate_instructor_attendance()$$, 'FORBIDDEN:%',
  'guest cannot generate instructor attendance');
select throws_like($$select public.generate_student_attendance()$$, 'FORBIDDEN:%',
  'guest cannot generate student attendance');
select tests.login_as('d0000000-0000-4000-8000-000000000002');
select lives_ok($$select public.generate_student_attendance(tests.far_monday())$$,
  'staff can generate attendance');
select tests.logout();

-- ---------------------------------------------------------------------------
-- instructor_check_in / instructor_check_out
-- ---------------------------------------------------------------------------
insert into public.instructor_attendance (id, class_id, instructor_id, room_id, date) values
  (900041, 900041, 'd0000000-0000-4000-8000-000000000003', 900041, public.studio_today()),
  (900042, 900041, 'd0000000-0000-4000-8000-000000000003', 900041, public.studio_today() + 1),
  (900043, 900042, 'd0000000-0000-4000-8000-000000000004', 900041, public.studio_today());
-- Proof photos "uploaded" to the private bucket.
insert into storage.objects (bucket_id, name, owner) values
  ('attendance-proofs', 'd0000000-0000-4000-8000-000000000003/900041/checkin.jpg',  'd0000000-0000-4000-8000-000000000003'),
  ('attendance-proofs', 'd0000000-0000-4000-8000-000000000003/900041/checkout.jpg', 'd0000000-0000-4000-8000-000000000003'),
  ('attendance-proofs', 'd0000000-0000-4000-8000-000000000003/900042/checkin.jpg',  'd0000000-0000-4000-8000-000000000003');

select tests.login_as('d0000000-0000-4000-8000-000000000004');
select throws_like(
  $$select public.instructor_check_in(900041, 'd0000000-0000-4000-8000-000000000004/900041/checkin.jpg')$$,
  'FORBIDDEN:%', 'instructor cannot check in another instructor''s session');
select ok(not private.can_write_attendance_proof('d0000000-0000-4000-8000-000000000003/900041/checkin.jpg'),
  'storage: instructor cannot upload into another instructor''s folder');
select ok(not private.can_write_attendance_proof('d0000000-0000-4000-8000-000000000004/900041/checkin.jpg'),
  'storage: instructor cannot upload proof for a session that is not theirs');
select ok(private.can_write_attendance_proof('d0000000-0000-4000-8000-000000000004/900043/checkin.jpg'),
  'storage: instructor can upload check-in proof for own pending session');
select ok(not private.can_write_attendance_proof('d0000000-0000-4000-8000-000000000004/900043/checkout.jpg'),
  'storage: check-out proof only once the session is in progress');

select tests.login_as('d0000000-0000-4000-8000-000000000003');
select throws_like(
  $$select public.instructor_check_in(900042, 'd0000000-0000-4000-8000-000000000003/900042/checkin.jpg')$$,
  'INVALID_STATE:%', 'instructor cannot check in on the wrong date');
select throws_like(
  $$select public.instructor_check_in(900041, 'd0000000-0000-4000-8000-000000000003/900041/checkin.png')$$,
  'INVALID_INPUT:%', 'check-in needs the proof photo to be uploaded first');
select throws_like(
  $$select public.instructor_check_in(900041, 'someone-else/900041/checkin.jpg')$$,
  'INVALID_INPUT:%', 'check-in proof path must be in the caller''s folder');
select throws_like(
  $$select public.instructor_check_out(900041, 'd0000000-0000-4000-8000-000000000003/900041/checkout.jpg')$$,
  'INVALID_STATE:%', 'cannot check out before checking in');
select results_eq(
  $$select status::text, checkin_at is not null, checkin_proof_path
    from public.instructor_check_in(900041, 'd0000000-0000-4000-8000-000000000003/900041/checkin.jpg')$$,
  $$values ('in_progress'::text, true, 'd0000000-0000-4000-8000-000000000003/900041/checkin.jpg'::text)$$,
  'check-in: pending → in_progress, checkin_at set server-side');
select throws_like(
  $$select public.instructor_check_in(900041, 'd0000000-0000-4000-8000-000000000003/900041/checkin.jpg')$$,
  'INVALID_STATE:%', 'cannot check in twice');
select ok(not private.can_write_attendance_proof('d0000000-0000-4000-8000-000000000003/900041/checkin.jpg'),
  'storage: check-in proof cannot be replaced after check-in');
select results_eq(
  $$select status::text, checkout_at is not null
    from public.instructor_check_out(900041, 'd0000000-0000-4000-8000-000000000003/900041/checkout.jpg')$$,
  $$values ('completed'::text, true)$$,
  'check-out: in_progress → completed, checkout_at set server-side');

-- ---------------------------------------------------------------------------
-- my_stats
-- ---------------------------------------------------------------------------
select is(public.my_stats(), '{"class_count": 1, "completed_sessions": 1}'::jsonb,
  'my_stats for an instructor');

select tests.login_as('d0000000-0000-4000-8000-000000000005');
select is(public.my_stats(), '{"class_count": 1, "attended_count": 0, "absent_count": 0}'::jsonb,
  'my_stats for a guest');

-- ---------------------------------------------------------------------------
-- dashboard_stats
-- ---------------------------------------------------------------------------
select throws_like($$select public.dashboard_stats()$$, 'FORBIDDEN:%', 'guest cannot read dashboard_stats');
select tests.login_as('d0000000-0000-4000-8000-000000000002');
select ok(public.dashboard_stats() ?& array['monthly_booking_count', 'total_students', 'classes_today', 'revenue_this_month'],
  'staff: dashboard_stats returns all keys');

-- ---------------------------------------------------------------------------
-- admin_set_role
-- ---------------------------------------------------------------------------
select throws_like(
  $$select public.admin_set_role('d0000000-0000-4000-8000-000000000006', 'staff')$$,
  'FORBIDDEN:%', 'staff cannot call admin_set_role');
select tests.login_as('d0000000-0000-4000-8000-000000000005');
select throws_like(
  $$select public.admin_set_role('d0000000-0000-4000-8000-000000000005', 'admin')$$,
  'FORBIDDEN:%', 'guest cannot promote themselves');

select tests.login_as('d0000000-0000-4000-8000-000000000001');
select results_eq(
  $$select role::text from public.admin_set_role('d0000000-0000-4000-8000-000000000006', 'instructor')$$,
  $$values ('instructor'::text)$$,
  'admin can change a role');
select throws_like(
  $$select public.admin_set_role('d0000000-0000-4000-8000-000000000003', 'guest')$$,
  'INVALID_STATE:%', 'instructor who still teaches classes cannot be demoted');
select throws_like(
  $$select public.admin_set_role('d0000000-0000-4000-8000-0000000000ee', 'staff')$$,
  'NOT_FOUND:%', 'unknown user → NOT_FOUND');

-- Make the test admin the only admin, then try to demote them.
select tests.logout();
update public.profiles set role = 'staff'
 where role = 'admin' and id <> 'd0000000-0000-4000-8000-000000000001';
select tests.login_as('d0000000-0000-4000-8000-000000000001');
select throws_like(
  $$select public.admin_set_role('d0000000-0000-4000-8000-000000000001', 'staff')$$,
  'INVALID_STATE:%', 'the last admin cannot be demoted');

-- Email sync from auth.users (GoTrue path, no JWT claims).
select tests.logout();
update auth.users set email = 'att.guest1.new@test.local' where id = 'd0000000-0000-4000-8000-000000000005';
select is((select email from public.profiles where id = 'd0000000-0000-4000-8000-000000000005'),
  'att.guest1.new@test.local', 'auth email change is synced to profiles');

-- is_username_available
update public.profiles set username = 'hocvien1' where id = 'd0000000-0000-4000-8000-000000000005';
select ok(not public.is_username_available('hocvien1'), 'is_username_available: taken');
select ok(public.is_username_available('hocvien-moi'), 'is_username_available: free');

select * from finish();
rollback;
