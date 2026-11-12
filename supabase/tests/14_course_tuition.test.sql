-- Tuition per course (api-contract §3 Tuition, §5 tuition_*):
--   * joining a course late pays for the sessions left; the next course opens with 2 sessions left
--   * stopping the next course leaves the class when it starts
--   * leaving clears unmarked roll calls; a deleted recurring cost isn't re-added
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
create function tests.inv(p_student uuid, p_title text) returns public.tuition_invoices language sql stable security definer as $$
  select i.* from public.tuition_invoices i join public.class_lessons l on l.id = i.lesson_id
   where i.student_id = p_student and l.title = p_title;
$$;
create function tests.enrolled(p_student uuid, p_class bigint) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.class_students where student_id = p_student and class_id = p_class);
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000141', 'course-staff@test.local', 'staff', 'Course Staff');
select tests.create_user('00000000-0000-4000-b000-000000000142', 'course-teacher@test.local', 'instructor', 'Course Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000143', 'course-a@test.local', 'guest', 'Course A');
select tests.create_user('00000000-0000-4000-b000-000000000144', 'course-b@test.local', 'guest', 'Course B');

-- A class that meets every day (no room); course "Daily A" started 5 days ago (8 sessions: 5 held,
-- 3 left), "Daily B" starts in 3 days (4 sessions).
insert into public.classes (id, name, instructor_id, price, starts_on)
values (900141, 'Daily Class', '00000000-0000-4000-b000-000000000142', 800000, tests.today() - 30),
       (900142, 'Other Class', '00000000-0000-4000-b000-000000000142', 600000, tests.today() - 30);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select 900141, d, '10:00', '11:00' from generate_series(1, 7) d;
insert into public.class_lessons (class_id, starts_on, title, session_count) values
  (900141, tests.today() - 5, 'Daily A', 8),
  (900141, tests.today() + 3, 'Daily B', 4),
  (900142, tests.today() - 5, 'Other A', 8);

-- ---------------------------------------------------------------------------
-- Joining late
-- ---------------------------------------------------------------------------
insert into public.class_students (class_id, student_id) values (900141, '00000000-0000-4000-b000-000000000143');
select is((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily A')).amount, 300000::numeric,
          'joining after 5 of 8 sessions pays for the 3 left');
select is((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily A')).sessions, 3::smallint, 'and says so');
select is((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily A')).renewal, 'continue'::public.tuition_renewal,
          'joining is a yes');
select is((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily B')).id, null,
          'the next course isn''t billed while 3 sessions are left');

-- ---------------------------------------------------------------------------
-- Renewal opens with 2 sessions left
-- ---------------------------------------------------------------------------
select public.tuition_run_cycle(tests.today() + 1);
select isnt((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily B')).id, null, 'with 2 sessions left the next course opens');
select is((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily B')).renewal, null,
          'and a member of the course has to answer');

-- ---------------------------------------------------------------------------
-- Stopping the next course: out when it starts
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000143');
select lives_ok($$select public.tuition_set_renewal((tests.inv('00000000-0000-4000-b000-000000000143', 'Daily B')).id, 'stop')$$,
                'the student stops after this course');
select tests.logout();
select ok(tests.enrolled('00000000-0000-4000-b000-000000000143', 900141), 'and keeps dancing until it ends');
select public.tuition_run_cycle(tests.today() + 4);
select ok(not tests.enrolled('00000000-0000-4000-b000-000000000143', 900141), 'once the next course runs, they''re out');

-- ---------------------------------------------------------------------------
-- Leaving a class clears today's unmarked roll call (no refund, nothing else changes)
-- ---------------------------------------------------------------------------
insert into public.class_students (class_id, student_id) values (900141, '00000000-0000-4000-b000-000000000144');
insert into public.student_attendance (class_id, student_id, date, status)
values (900141, '00000000-0000-4000-b000-000000000144', tests.today(), 'pending')
on conflict (class_id, student_id, date) do nothing;  -- joining today may have put them on it already
delete from public.class_students where class_id = 900141 and student_id = '00000000-0000-4000-b000-000000000144';
select is((select count(*)::int from public.student_attendance
            where class_id = 900141 and student_id = '00000000-0000-4000-b000-000000000144' and date >= tests.today()), 0,
          'their unmarked roll call is gone');

-- ---------------------------------------------------------------------------
-- A deleted recurring copy stays deleted that month
-- ---------------------------------------------------------------------------
insert into public.recurring_expenses (id, category, amount, description, day_of_month)
overriding system value values (900141, 'utilities', 300000, 'Test internet', 1);
select public.expenses_run_recurring(tests.today());
delete from public.expenses where recurring_id = 900141;
select is(public.expenses_run_recurring(tests.today()), 0, 'deleting this month''s copy skips the month');
select is((select count(*)::int from public.recurring_expense_skips where recurring_id = 900141), 1, 'the skip is remembered');

select * from finish();
rollback;
