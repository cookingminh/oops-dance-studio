-- Tuition (api-contract §3 Tuition, §5 tuition_* / finance_*):
--   * enrolling bills the month; students read only their own invoices; writes go through RPCs
--   * cash by staff, transfers by the webhook (matched on the OOPS code, idempotent), assign/undo
--   * renewal continue/stop, the daily cycle ends unanswered unpaid enrolments
--   * finance report is admin only; sandbox transfers only on the demo
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

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
create function tests.inv(p_student uuid, p_class bigint, p_month date default date_trunc('month', public.studio_today())::date)
returns bigint language sql stable security definer as $$
  select id from public.tuition_invoices where student_id = p_student and class_id = p_class and month = p_month;
$$;
create function tests.row(p_id bigint) returns public.tuition_invoices language sql stable security definer as $$
  select * from public.tuition_invoices where id = p_id;
$$;
create function tests.enrolled(p_student uuid, p_class bigint) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.class_students where student_id = p_student and class_id = p_class);
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000101', 'fee-admin@test.local', 'admin', 'Fee Admin');
select tests.create_user('00000000-0000-4000-b000-000000000102', 'fee-staff@test.local', 'staff', 'Fee Staff');
select tests.create_user('00000000-0000-4000-b000-000000000103', 'fee-teacher@test.local', 'instructor', 'Fee Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000104', 'fee-vy@test.local', 'guest', 'Fee Vy');
select tests.create_user('00000000-0000-4000-b000-000000000105', 'fee-an@test.local', 'guest', 'Fee An');
insert into public.classes (id, name, instructor_id, price)
values (900101, 'Fee Class', '00000000-0000-4000-b000-000000000103', 900000),
       (900102, 'Fee Class Two', '00000000-0000-4000-b000-000000000103', 1200000);
-- Tuition is per course: each class has a course running this month (no schedule: nothing held yet).
insert into public.class_lessons (class_id, starts_on, title, session_count) values
  (900101, date_trunc('month', public.studio_today())::date, 'Fee Course', 8),
  (900102, date_trunc('month', public.studio_today())::date, 'Fee Course Two', 8);

-- ---------------------------------------------------------------------------
-- Enrolling bills the month
-- ---------------------------------------------------------------------------
insert into public.class_students (class_id, student_id) values
  (900101, '00000000-0000-4000-b000-000000000104'),
  (900101, '00000000-0000-4000-b000-000000000105'),
  (900102, '00000000-0000-4000-b000-000000000104');

select isnt(tests.inv('00000000-0000-4000-b000-000000000104', 900101), null, 'enrolling creates this month''s invoice');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).amount, 900000::numeric, 'at the class price');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).status, 'unpaid'::public.tuition_status, 'unpaid');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).renewal, 'continue'::public.tuition_renewal, 'a new enrolment already said yes');
select matches((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).payment_code, '^OOPS[2-9A-HJ-NP-Z]{6}$', 'with a transfer code');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).class_name, 'Fee Class', 'and the class name kept on it');

-- ---------------------------------------------------------------------------
-- Who reads what
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000104');
select is((select count(*)::int from public.tuition_invoices where class_id in (900101, 900102)), 2, 'a student sees their own invoices');
select throws_ok($$update public.tuition_invoices set status = 'paid' where id = tests.inv('00000000-0000-4000-b000-000000000104', 900101)$$,
                 '42501', null, 'and can''t edit them');
select throws_like($$select public.tuition_mark_paid(tests.inv('00000000-0000-4000-b000-000000000104', 900101))$$,
                   '%FORBIDDEN%', 'or mark them paid');
select throws_ok($$select public.tuition_record_transfer('sepay', 'x1', 900000, 'hi', now(), null)$$,
                 '42501', null, 'or record bank transfers');
select is((select count(*)::int from public.bank_transfers), 0, 'students see no bank transfers');
select tests.login_as('00000000-0000-4000-b000-000000000105');
select is((select count(*)::int from public.tuition_invoices where class_id in (900101, 900102)), 1, 'another student sees only theirs');
select tests.login_as('00000000-0000-4000-b000-000000000103');
select is((select count(*)::int from public.tuition_invoices where class_id in (900101, 900102)), 0, 'instructors see no tuition');
select tests.logout();
set local role anon;
select throws_ok($$select count(*) from public.tuition_invoices$$, '42501', null, 'visitors can''t read invoices');
reset role;

-- ---------------------------------------------------------------------------
-- Cash at the desk (staff) and undo
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000102');
select lives_ok($$select public.tuition_mark_paid(tests.inv('00000000-0000-4000-b000-000000000105', 900101), 'cash', null, 'paid at the desk')$$,
                'staff record a cash payment');
select tests.logout();
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101))).status, 'paid'::public.tuition_status, 'the invoice is paid');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101))).method, 'cash'::public.payment_method, 'in cash');
select tests.login_as('00000000-0000-4000-b000-000000000102');
select lives_ok($$select public.tuition_undo_payment(tests.inv('00000000-0000-4000-b000-000000000105', 900101))$$, 'staff can undo it');
select tests.logout();
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101))).paid_amount, 0::numeric, 'back to nothing paid');

-- ---------------------------------------------------------------------------
-- Bank transfers (webhook = service context)
-- ---------------------------------------------------------------------------
select is(
  (select public.tuition_record_transfer('sepay', 'tx-1', 900000,
     'MBVCB.123 ' || lower(regexp_replace((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).payment_code, '^OOPS', 'oops ')) || ' hoc phi', now(), null)) ->> 'status',
  'matched', 'a transfer with the code (any case, spaces) is matched');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).status, 'paid'::public.tuition_status, 'and pays the invoice');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).method, 'transfer'::public.payment_method, 'by transfer');
select is((select public.tuition_record_transfer('sepay', 'tx-1', 900000, 'again', now(), null)) ->> 'duplicate', 'true',
          'the same webhook twice is recorded once');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900101))).paid_amount, 900000::numeric, 'and doesn''t pay twice');

select is((select public.tuition_record_transfer('sepay', 'tx-2', 500000, 'chuyen tien', now(), null)) ->> 'status',
          'unmatched', 'a transfer without a code waits for staff');
select is(
  (select public.tuition_record_transfer('sepay', 'tx-3', 700000,
     (tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900102))).payment_code, now(), null)) ->> 'status',
  'matched', 'a partial transfer is matched');
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900102))).status, 'unpaid'::public.tuition_status, 'but the invoice stays unpaid');
select tests.login_as('00000000-0000-4000-b000-000000000102');
select lives_ok($$select public.tuition_assign_transfer((select id from public.bank_transfers where provider_ref = 'tx-2'),
                                                        tests.inv('00000000-0000-4000-b000-000000000104', 900102))$$,
                'staff assign the unmatched transfer');
select tests.logout();
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000104', 900102))).status, 'paid'::public.tuition_status, 'which completes the invoice');

-- ---------------------------------------------------------------------------
-- Renewal: next month opens; stop / continue
-- ---------------------------------------------------------------------------
insert into public.class_lessons (class_id, starts_on, title, session_count) values
  (900101, (date_trunc('month', public.studio_today()) + interval '1 month')::date, 'Fee Next', 8),
  (900102, (date_trunc('month', public.studio_today()) + interval '1 month')::date, 'Fee Next Two', 8);
select tests.login_as('00000000-0000-4000-b000-000000000102');
select cmp_ok(public.tuition_open_month((date_trunc('month', public.studio_today()) + interval '1 month')::date), '>=', 3,
              'staff open next month''s renewal');
select tests.logout();
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101, (date_trunc('month', public.studio_today()) + interval '1 month')::date))).renewal,
          null, 'nobody has answered yet');
select tests.login_as('00000000-0000-4000-b000-000000000105');
select lives_ok($$select public.tuition_set_renewal(tests.inv('00000000-0000-4000-b000-000000000105', 900101, (date_trunc('month', public.studio_today()) + interval '1 month')::date), 'stop')$$,
                'a student says they''ll stop');
select tests.logout();
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101, (date_trunc('month', public.studio_today()) + interval '1 month')::date))).void_reason,
          'stopped', 'next month is cancelled');
select ok(tests.enrolled('00000000-0000-4000-b000-000000000105', 900101), 'but they stay in class until it starts');
select tests.login_as('00000000-0000-4000-b000-000000000105');
select lives_ok($$select public.tuition_set_renewal(tests.inv('00000000-0000-4000-b000-000000000105', 900101, (date_trunc('month', public.studio_today()) + interval '1 month')::date), 'continue')$$,
                'and can change their mind');
select tests.logout();
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101, (date_trunc('month', public.studio_today()) + interval '1 month')::date))).status,
          'unpaid'::public.tuition_status, 'next month is open again');

-- ---------------------------------------------------------------------------
-- The daily cycle: unpaid + unanswered + past due → not renewed, enrolment ends
-- ---------------------------------------------------------------------------
update public.tuition_invoices set renewal = null, due_date = public.studio_today() - 1
 where id = tests.inv('00000000-0000-4000-b000-000000000105', 900101);
select public.tuition_run_cycle(public.studio_today());
select is((tests.row(tests.inv('00000000-0000-4000-b000-000000000105', 900101))).void_reason, 'not_renewed',
          'the cycle cancels an unanswered, unpaid, overdue month');
select ok(not tests.enrolled('00000000-0000-4000-b000-000000000105', 900101), 'and ends that enrolment');

-- ---------------------------------------------------------------------------
-- Finance report and sandbox
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000102');
select throws_like($$select * from public.finance_monthly(public.studio_today(), public.studio_today())$$, '%FORBIDDEN%',
                   'staff can''t see the finance report');
select tests.logout();

-- The local stack is seeded as a sandbox: switch it off to see the refusal, then on again.
delete from private.payment_sandbox where id;
select tests.login_as('00000000-0000-4000-b000-000000000102');
select throws_like($$select public.tuition_simulate_transfer(tests.inv('00000000-0000-4000-b000-000000000105', 900101))$$, '%FORBIDDEN%',
                   'simulated transfers are refused outside a sandbox');
select tests.logout();
insert into private.payment_sandbox default values;
select tests.login_as('00000000-0000-4000-b000-000000000102');
select is(public.tuition_simulate_transfer(tests.inv('00000000-0000-4000-b000-000000000105', 900101)) ->> 'status', 'matched',
          'in a sandbox a simulated transfer pays even a cancelled month');
select tests.logout();
select ok(tests.enrolled('00000000-0000-4000-b000-000000000105', 900101), 'and paying late puts the student back in the class');

select tests.login_as('00000000-0000-4000-b000-000000000101');
select is((select count(*)::int from public.finance_monthly((date_trunc('month', public.studio_today()) - interval '2 months')::date, public.studio_today())), 3,
          'admins get one finance row per month');
select tests.logout();

select * from finish();
rollback;
