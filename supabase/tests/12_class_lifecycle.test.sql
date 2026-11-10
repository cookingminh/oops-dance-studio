-- Class lifecycle (api-contract §3 classes, §5 class_end / class_reopen / classes_run_endings):
--   * upcoming classes bill from their first month and have no sessions before it
--   * ending cancels what lies after the last day; the daily job wraps up (schedule kept,
--     room freed, students out) without cancelling months the class ran
--   * reopen restores the schedule; a class with history can't be deleted
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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
create function tests.month(p_offset int default 0) returns date language sql stable as $$
  select (date_trunc('month', public.studio_today()) + make_interval(months => p_offset))::date;
$$;
create function tests.inv(p_student uuid, p_class bigint, p_month date) returns public.tuition_invoices
language sql stable security definer as $$
  select * from public.tuition_invoices where student_id = p_student and class_id = p_class and month = p_month;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000121', 'life-staff@test.local', 'staff', 'Life Staff');
select tests.create_user('00000000-0000-4000-b000-000000000122', 'life-teacher@test.local', 'instructor', 'Life Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000123', 'life-a@test.local', 'guest', 'Life A');
select tests.create_user('00000000-0000-4000-b000-000000000124', 'life-b@test.local', 'guest', 'Life B');

-- A running class (no room: no clashes) with a Monday session, two students; and an upcoming one.
insert into public.classes (id, name, instructor_id, price, starts_on)
values (900121, 'Life Running', '00000000-0000-4000-b000-000000000122', 900000, tests.month(-2)),
       (900122, 'Life Upcoming', '00000000-0000-4000-b000-000000000122', 700000, tests.month(1));
insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values
  (900121, 1, '10:00', '11:00'),
  (900122, 1, '12:00', '13:00');
-- Courses (tuition is per course): the running class has this month's and next month's, the
-- upcoming class its first one.
insert into public.class_lessons (class_id, starts_on, title, session_count) values
  (900121, tests.month(0), 'Life This Month', 4),
  (900121, tests.month(1), 'Life Next Month', 4),
  (900122, tests.month(1), 'Life First', 4);
insert into public.class_students (class_id, student_id) values
  (900121, '00000000-0000-4000-b000-000000000123'),
  (900121, '00000000-0000-4000-b000-000000000124'),
  (900122, '00000000-0000-4000-b000-000000000123');

select ok((select bool_and(starts_on <= public.studio_today()) from public.classes where id <= 6),
          'existing classes got a start date on or before today');

-- ---------------------------------------------------------------------------
-- Upcoming classes
-- ---------------------------------------------------------------------------
select is((tests.inv('00000000-0000-4000-b000-000000000123', 900122, tests.month(0))).id, null,
          'joining an upcoming class bills nothing for this month');
select is((tests.inv('00000000-0000-4000-b000-000000000123', 900122, tests.month(1))).renewal, 'continue'::public.tuition_renewal,
          'but its first month, as a yes');
select is((select count(*)::int from public.instructor_attendance a where a.class_id = 900122
            and a.date < tests.month(1)) , 0, 'no sessions exist before it starts');
select public.generate_instructor_attendance(public.studio_today());
select is((select count(*)::int from public.instructor_attendance a where a.class_id = 900122), 0,
          'and generating this week makes none');

-- ---------------------------------------------------------------------------
-- Ending
-- ---------------------------------------------------------------------------
select public.tuition_open_month(tests.month(1));
select public.tuition_mark_paid((tests.inv('00000000-0000-4000-b000-000000000124', 900121, tests.month(1))).id);
insert into public.instructor_attendance (class_id, instructor_id, date, status)
values (900121, '00000000-0000-4000-b000-000000000122', tests.month(1) + 3, 'pending');

select tests.login_as('00000000-0000-4000-b000-000000000123');
select throws_like($$select public.class_end(900121, (date_trunc('month', public.studio_today()) + interval '1 month')::date - 1)$$,
                   '%FORBIDDEN%', 'students can''t end a class');
select tests.login_as('00000000-0000-4000-b000-000000000121');
select throws_like($$select public.class_end(900121, public.studio_today() - 1)$$, '%INVALID_INPUT%',
                   'the last day can''t be in the past');
select is(jsonb_array_length(public.class_end(900121, tests.month(1) - 1, 'Not enough students') -> 'paid_after'), 1,
          'ending after this month lists who already paid for next month');
select tests.logout();

select is((tests.inv('00000000-0000-4000-b000-000000000123', 900121, tests.month(1))).void_reason, 'class_ended',
          'unpaid months after the last day are cancelled');
select is((tests.inv('00000000-0000-4000-b000-000000000124', 900121, tests.month(1))).status, 'paid'::public.tuition_status,
          'paid ones stay for staff to switch or refund');
select is((tests.inv('00000000-0000-4000-b000-000000000123', 900121, tests.month(0))).status, 'unpaid'::public.tuition_status,
          'this month is still owed');
select is((select count(*)::int from public.instructor_attendance where class_id = 900121 and date > tests.month(1) - 1), 0,
          'pending sessions after the last day are dropped');
select ok(900121 in (select id from public.list_public_classes()), 'it is still listed until its last day');

-- ---------------------------------------------------------------------------
-- The day after: wrap-up
-- ---------------------------------------------------------------------------
select is(public.classes_run_endings(tests.month(1)), 1, 'the daily job wraps up the class the day after');
select is((select count(*)::int from public.class_schedules where class_id = 900121), 0, 'its weekly schedule is removed');
select is((select jsonb_array_length(final_schedule) from public.classes where id = 900121), 1, 'but kept on the class');
select is((select count(*)::int from public.class_students where class_id = 900121), 0, 'and its students leave');
select is((tests.inv('00000000-0000-4000-b000-000000000123', 900121, tests.month(0))).status, 'unpaid'::public.tuition_status,
          'without cancelling a month the class ran');

-- ---------------------------------------------------------------------------
-- Reopen; deleting
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000121');
select is(public.class_reopen(900121) ->> 'restored', '1', 'reopening restores the schedule');
select tests.logout();
select is((select ended_on from public.classes where id = 900121), null, 'and the class runs again');

update public.instructor_attendance set status = 'completed'
 where id = (select id from public.instructor_attendance where class_id = 900121 limit 1);
insert into public.instructor_attendance (class_id, instructor_id, date, status)
select 900121, '00000000-0000-4000-b000-000000000122', public.studio_today() - 7, 'completed'
 where not exists (select 1 from public.instructor_attendance where class_id = 900121 and status = 'completed');
select throws_like($$delete from public.classes where id = 900121$$, '%IN_USE%', 'a class with history can''t be deleted');
select lives_ok($$delete from public.classes where id = 900122$$, 'one without history can');

select * from finish();
rollback;
