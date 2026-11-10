-- Payroll (api-contract §3 payroll tables, §5 payroll RPCs):
--   * admins only (tables and RPCs)
--   * instructors: completed sessions × class rate or the default rate
--   * staff: monthly salary; bonuses/deductions with a reason
--   * finalize freezes the numbers and locks adjustments; reopen; mark paid / unpaid
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
-- One row of payroll_month for the test month.
create function tests.pay(p_uid uuid) returns setof record language sql as $$
  select m.sessions, m.session_pay, m.base_salary, m.bonuses, m.deductions, m.total, m.status
    from public.payroll_month('2030-03-01') m where m.profile_id = p_uid;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- People
select tests.create_user('00000000-0000-4000-b000-000000000081', 'pay-admin@test.local', 'admin', 'Pay Admin');
select tests.create_user('00000000-0000-4000-b000-000000000082', 'pay-staff@test.local', 'staff', 'Pay Staff');
select tests.create_user('00000000-0000-4000-b000-000000000083', 'pay-teacher@test.local', 'instructor', 'Pay Teacher');

-- Two classes; one with its own rate. Sessions in March 2030: 3 completed, 1 cancelled, 1 pending.
insert into public.classes (id, name, instructor_id, price) values
  (900081, 'Pay Class Default', '00000000-0000-4000-b000-000000000083', 100000),
  (900082, 'Pay Class Special', '00000000-0000-4000-b000-000000000083', 100000);
insert into public.class_pay_rates (class_id, session_rate) values (900082, 450000);
insert into public.instructor_attendance (class_id, instructor_id, date, status) values
  (900081, '00000000-0000-4000-b000-000000000083', '2030-03-04', 'completed'),
  (900081, '00000000-0000-4000-b000-000000000083', '2030-03-11', 'completed'),
  (900082, '00000000-0000-4000-b000-000000000083', '2030-03-05', 'completed'),
  (900082, '00000000-0000-4000-b000-000000000083', '2030-03-12', 'cancelled'),
  (900081, '00000000-0000-4000-b000-000000000083', '2030-03-18', 'pending'),
  (900081, '00000000-0000-4000-b000-000000000083', '2030-04-01', 'completed'); -- next month
insert into public.staff_salaries (profile_id, monthly_salary) values ('00000000-0000-4000-b000-000000000082', 8000000);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000082');
select throws_like($$select * from public.payroll_month('2030-03-01')$$, 'FORBIDDEN:%', 'staff cannot read payroll');
select is((select count(*)::int from public.staff_salaries), 0, 'staff see no salaries (RLS)');
select throws_ok(
  $$insert into public.payroll_adjustments (profile_id, month, amount, reason) values ('00000000-0000-4000-b000-000000000083', '2030-03-01', -50000, 'x')$$,
  '42501', null, 'staff cannot add a deduction');
select tests.login_as('00000000-0000-4000-b000-000000000083');
select throws_like($$select public.payroll_finalize('00000000-0000-4000-b000-000000000083', '2030-03-01')$$, 'FORBIDDEN:%', 'an instructor cannot finalize');

-- ---------------------------------------------------------------------------
-- Live (draft) numbers
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000081');
select results_eq(
  $$select * from tests.pay('00000000-0000-4000-b000-000000000083') as (s int, sp numeric, b numeric, plus numeric, minus numeric, t numeric, st text)$$,
  $$values (3, 1050000::numeric, 0::numeric, 0::numeric, 0::numeric, 1050000::numeric, 'draft')$$,
  'instructor: 3 completed sessions = 2 × 300,000 (default) + 1 × 450,000 (class rate)');
select results_eq(
  $$select * from tests.pay('00000000-0000-4000-b000-000000000082') as (s int, sp numeric, b numeric, plus numeric, minus numeric, t numeric, st text)$$,
  $$values (0, 0::numeric, 8000000::numeric, 0::numeric, 0::numeric, 8000000::numeric, 'draft')$$,
  'staff: monthly salary');
select is(
  (select count(*)::int from public.payroll_month('2030-03-01') m where m.profile_id = '00000000-0000-4000-b000-000000000081'),
  0, 'an admin without a salary is not listed');

update public.payroll_settings set default_session_rate = 320000 where id = 1;
select is(
  (select m.session_pay from public.payroll_month('2030-03-01') m where m.profile_id = '00000000-0000-4000-b000-000000000083'),
  1090000::numeric, 'changing the default rate updates a draft month');

-- ---------------------------------------------------------------------------
-- Bonuses and deductions
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.payroll_adjustments (profile_id, month, amount, reason) values ('00000000-0000-4000-b000-000000000083', '2030-03-01', -50000, 'Late check-in, 15 min')$$,
  'admin adds a deduction with a reason');
select lives_ok(
  $$insert into public.payroll_adjustments (profile_id, month, amount, reason) values ('00000000-0000-4000-b000-000000000083', '2030-03-01', 200000, 'Covered a class')$$,
  'admin adds a bonus');
select throws_ok(
  $$insert into public.payroll_adjustments (profile_id, month, amount, reason) values ('00000000-0000-4000-b000-000000000083', '2030-03-01', -50000, '  ')$$,
  '23514', null, 'a reason is required');
select throws_ok(
  $$insert into public.payroll_adjustments (profile_id, month, amount, reason) values ('00000000-0000-4000-b000-000000000083', '2030-03-01', 0, 'zero')$$,
  '23514', null, 'the amount cannot be zero');
select results_eq(
  $$select m.bonuses, m.deductions, m.total from public.payroll_month('2030-03-01') m where m.profile_id = '00000000-0000-4000-b000-000000000083'$$,
  $$values (200000::numeric, -50000::numeric, 1240000::numeric)$$,
  'total = sessions + bonuses + deductions');

-- ---------------------------------------------------------------------------
-- Finalize, lock, reopen, paid
-- ---------------------------------------------------------------------------
select lives_ok($$select public.payroll_finalize('00000000-0000-4000-b000-000000000083', '2030-03-15')$$, 'admin finalizes March (any day of the month)');
select is(
  (select m.status from public.payroll_month('2030-03-01') m where m.profile_id = '00000000-0000-4000-b000-000000000083'),
  'finalized', 'the month shows as finalized');
update public.payroll_settings set default_session_rate = 500000 where id = 1;
select is(
  (select m.total from public.payroll_month('2030-03-01') m where m.profile_id = '00000000-0000-4000-b000-000000000083'),
  1240000::numeric, 'a finalized month keeps its numbers when rates change');
select throws_like(
  $$insert into public.payroll_adjustments (profile_id, month, amount, reason) values ('00000000-0000-4000-b000-000000000083', '2030-03-01', -10000, 'late')$$,
  'INVALID_STATE:%', 'no new deductions once finalized');
select throws_like(
  $$delete from public.payroll_adjustments where profile_id = '00000000-0000-4000-b000-000000000083'$$,
  'INVALID_STATE:%', 'deductions of a finalized month cannot be removed');
select throws_like($$select public.payroll_finalize('00000000-0000-4000-b000-000000000083', '2030-03-01')$$, 'INVALID_STATE:%', 'finalizing twice is refused');

select lives_ok($$select public.payroll_set_paid('00000000-0000-4000-b000-000000000083', '2030-03-01', true)$$, 'admin marks it paid');
select throws_like($$select public.payroll_reopen('00000000-0000-4000-b000-000000000083', '2030-03-01')$$, 'INVALID_STATE:%', 'a paid month cannot be reopened');
select lives_ok($$select public.payroll_set_paid('00000000-0000-4000-b000-000000000083', '2030-03-01', false)$$, 'admin undoes paid');
select lives_ok($$select public.payroll_reopen('00000000-0000-4000-b000-000000000083', '2030-03-01')$$, 'admin reopens it');
select is(
  (select m.total from public.payroll_month('2030-03-01') m where m.profile_id = '00000000-0000-4000-b000-000000000083'),
  1600000::numeric, 'reopened: back to live numbers (now 2 × 500,000 + 450,000 + 200,000 − 50,000)');

select tests.logout();
select * from finish();
rollback;
