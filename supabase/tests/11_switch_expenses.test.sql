-- Class switches, expenses and the fuller finance report (api-contract §3 Tuition / Expenses, §5):
--   * a switch happens between courses: the student joins the new class's upcoming course (full
--     price) and finishes the paid course in the old class (no refund), leaving after its last
--     session; money paid for the old class's next course moves; reports count it as a switch
--   * expenses: admins see all, staff only their own, students nothing; recurring costs land once
--   * profit = revenue − payroll − expenses; a class's margin subtracts costs tied to it
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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
-- A student's invoice for a course, by the course's title.
create function tests.inv(p_student uuid, p_title text) returns public.tuition_invoices language sql stable security definer as $$
  select i.* from public.tuition_invoices i join public.class_lessons l on l.id = i.lesson_id
   where i.student_id = p_student and l.title = p_title;
$$;
create function tests.leaves(p_student uuid, p_class bigint) returns date language sql stable security definer as $$
  select leaves_after from public.class_students where student_id = p_student and class_id = p_class;
$$;
create function tests.enrolled(p_student uuid, p_class bigint) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.class_students where student_id = p_student and class_id = p_class);
$$;
create function tests.month() returns date language sql stable as $$ select date_trunc('month', public.studio_today())::date; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000111', 'sw-admin@test.local', 'admin', 'Sw Admin');
select tests.create_user('00000000-0000-4000-b000-000000000112', 'sw-staff@test.local', 'staff', 'Sw Staff');
select tests.create_user('00000000-0000-4000-b000-000000000113', 'sw-staff2@test.local', 'staff', 'Sw Staff Two');
select tests.create_user('00000000-0000-4000-b000-000000000114', 'sw-teacher@test.local', 'instructor', 'Sw Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000115', 'sw-student@test.local', 'guest', 'Sw Student');
insert into public.classes (id, name, instructor_id, price) values
  (900111, 'Switch From', '00000000-0000-4000-b000-000000000114', 800000),
  (900112, 'Switch To', '00000000-0000-4000-b000-000000000114', 1200000),
  (900113, 'Switch Cheap', '00000000-0000-4000-b000-000000000114', 500000);
-- Daily classes (no room). "From A" started today (8 sessions: last one in a week); "To" has a
-- course running for a while and no upcoming one yet; "From A next" is planned after "From A".
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select c, d, '10:00', '11:00' from unnest(array[900111, 900112, 900113]) c, generate_series(1, 7) d;
insert into public.class_lessons (class_id, starts_on, title, session_count) values
  (900111, public.studio_today(), 'From A', 8),
  (900111, public.studio_today() + 8, 'From A next', 8),
  (900112, public.studio_today() - 10, 'To running', 30);
insert into public.class_students (class_id, student_id) values (900111, '00000000-0000-4000-b000-000000000115');
select public.tuition_record_transfer('sepay', 'sw-tx-1', 800000,
  (tests.inv('00000000-0000-4000-b000-000000000115', 'From A')).payment_code, now(), null);
-- They had already paid the old class's next course too.
select public.tuition_open_course((select id from public.class_lessons where title = 'From A next'));
select public.tuition_mark_paid((tests.inv('00000000-0000-4000-b000-000000000115', 'From A next')).id, 'cash');

-- ---------------------------------------------------------------------------
-- Switching class, between courses
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000115');
select throws_like($$select public.tuition_switch_class('00000000-0000-4000-b000-000000000115', 900111, 900112)$$,
                   '%FORBIDDEN%', 'students can''t switch class themselves');
select tests.login_as('00000000-0000-4000-b000-000000000112');
select throws_like($$select public.tuition_switch_class('00000000-0000-4000-b000-000000000115', 900112, 900113)$$,
                   '%INVALID_STATE%', 'switching from a class they aren''t in is refused');
select throws_like($$select public.tuition_switch_class('00000000-0000-4000-b000-000000000115', 900111, 900112)$$,
                   '%upcoming course%', 'not into the middle of a course: the new class needs an upcoming one');
select tests.logout();
insert into public.class_lessons (class_id, starts_on, title, session_count)
values (900112, public.studio_today() + 3, 'To next', 8);
select tests.login_as('00000000-0000-4000-b000-000000000112');
select lives_ok($$select public.tuition_switch_class('00000000-0000-4000-b000-000000000115', 900111, 900112, 'wants harder routines')$$,
                'staff move the student to the new class''s upcoming course');
select tests.logout();

select ok(tests.enrolled('00000000-0000-4000-b000-000000000115', 900111), 'they finish the course they paid for');
select is(tests.leaves('00000000-0000-4000-b000-000000000115', 900111), public.studio_today() + 7,
          'and leave after its last session');
select is((tests.inv('00000000-0000-4000-b000-000000000115', 'From A')).paid_amount, 800000::numeric,
          'what they paid for it stays (no refund, nothing moves)');
select is((tests.inv('00000000-0000-4000-b000-000000000115', 'From A next')).void_reason, 'switched',
          'the old class''s next course is cancelled as a switch');
select is((tests.inv('00000000-0000-4000-b000-000000000115', 'To next')).amount, 1200000::numeric,
          'the new course is billed in full');
select is((tests.inv('00000000-0000-4000-b000-000000000115', 'To next')).paid_amount, 800000::numeric,
          'with the money paid for the old next course');
select is((tests.inv('00000000-0000-4000-b000-000000000115', 'To next')).switched_from,
          (tests.inv('00000000-0000-4000-b000-000000000115', 'From A next')).id, 'and remembers where it came from');
select is((tests.inv('00000000-0000-4000-b000-000000000115', 'To running')).id, null, 'the running course of the new class isn''t billed');
select is((select joined_at from public.class_students where student_id = '00000000-0000-4000-b000-000000000115' and class_id = 900112),
          public.studio_today() + 3, 'they join the new class when its course starts');
select public.tuition_run_cycle(public.studio_today() + 8);
select ok(not tests.enrolled('00000000-0000-4000-b000-000000000115', 900111), 'the day after, they''re out of the old class');

-- ---------------------------------------------------------------------------
-- Expenses: who sees what; recurring costs land once
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000112');
select lives_ok($$insert into public.expenses (spent_on, category, amount, description) values (public.studio_today(), 'supplies', 150000, 'Nước uống')$$,
                'staff record a petty cost');
select throws_ok($$insert into public.expenses (spent_on, category, amount, description) values (public.studio_today(), 'snacks', 1000, 'x')$$,
                 '23514', null, 'with a known category only');
select is((select count(*)::int from public.expenses where description = 'Nước uống'), 1, 'and see it');
select tests.login_as('00000000-0000-4000-b000-000000000113');
select is((select count(*)::int from public.expenses where description = 'Nước uống'), 0, 'other staff don''t see it');
select throws_like($$select public.expenses_run_recurring()$$, '%FORBIDDEN%', 'staff can''t run recurring costs');
select tests.login_as('00000000-0000-4000-b000-000000000115');
select is((select count(*)::int from public.expenses), 0, 'students see no expenses');
select tests.login_as('00000000-0000-4000-b000-000000000111');
select cmp_ok((select count(*)::int from public.expenses where description = 'Nước uống'), '=', 1, 'admins see every expense');
insert into public.recurring_expenses (category, amount, description, day_of_month) values ('rent', 10000000, 'Test rent', 1);
select tests.logout();
select is(public.expenses_run_recurring(public.studio_today()) >= 1, true, 'recurring costs land on their day');
select is(public.expenses_run_recurring(public.studio_today()), 0, 'and only once a month');

-- ---------------------------------------------------------------------------
-- Finance with expenses
-- ---------------------------------------------------------------------------
insert into public.expenses (spent_on, category, amount, description, class_id)
values (public.studio_today(), 'costumes', 250000, 'Costumes for Switch Cheap', 900113);
select tests.login_as('00000000-0000-4000-b000-000000000111');
select is((select f.profit from public.finance_monthly(tests.month(), tests.month()) f),
          (select f.revenue - f.payroll_cost - f.expenses_total from public.finance_monthly(tests.month(), tests.month()) f),
          'profit = revenue − payroll − expenses');
select cmp_ok((select sum(f.class_switches)::int from public.finance_monthly(tests.month(), tests.month() + 31) f), '>=', 1,
              'switches are counted as switches');
select is((select c.direct_costs from public.finance_by_class(tests.month()) c where c.class_id = 900113), 250000::numeric,
          'costs tied to a class count against it');
select is((select c.margin from public.finance_by_class(tests.month()) c where c.class_id = 900113),
          (select c.collected - c.instructor_pay - c.direct_costs from public.finance_by_class(tests.month()) c where c.class_id = 900113),
          'margin = collected − instructor pay − direct costs');
select tests.logout();

select * from finish();
rollback;
