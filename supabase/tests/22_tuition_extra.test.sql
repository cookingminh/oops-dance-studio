-- Extra tuition money (api-contract §5 Tuition, tuition_extra_moves):
--   * a transfer bigger than the invoice leaves extra on it; tuition_extra_list finds it
--   * staff move the extra onto another unpaid invoice, or record that it went back to the student
--   * each move / refund is one activity entry (no "payment undone" / "paid" noise behind it)
--   * undoing a payment takes back what was moved on, returns what was moved in, and is refused once
--     part of the money was given back
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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
create function tests.invoice(p_id bigint) returns public.tuition_invoices language sql stable security definer as $$
  select * from public.tuition_invoices where id = p_id;
$$;
create function tests.transfer(p_id bigint) returns public.bank_transfers language sql stable security definer as $$
  select * from public.bank_transfers where id = p_id;
$$;
create function tests.logged(p_id bigint, p_action text) returns public.activity_log language sql stable security definer as $$
  select a.* from public.activity_log a
   where a.entity = 'tuition_invoices' and a.entity_id = p_id::text and a.action = p_action order by a.id desc limit 1;
$$;
create function tests.moves(p_id bigint) returns bigint language sql stable security definer as $$
  select count(*) from public.tuition_extra_moves m where m.invoice_id = p_id or m.to_invoice = p_id;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000221', 'extra-staff@test.local', 'staff', 'Extra Staff');
select tests.create_user('00000000-0000-4000-b000-000000000222', 'extra-student@test.local', 'guest', 'Extra Student');

-- 900221: 950,000 (the transfer lands here by mistake). 900222: 1,200,000 (the course it was for).
-- 900223: already paid. 900224: 300,000, for the second move.
insert into public.tuition_invoices (id, student_id, student_name, class_name, lesson_title, month, amount, paid_amount, status, due_date, paid_at, method)
overriding system value values
  (900221, '00000000-0000-4000-b000-000000000222', 'Extra Student', 'Waacking', 'Vogue', date_trunc('month', current_date)::date, 950000, 0, 'unpaid', current_date + 10, null, null),
  (900222, '00000000-0000-4000-b000-000000000222', 'Extra Student', 'K-pop', 'Armageddon', date_trunc('month', current_date)::date, 1200000, 0, 'unpaid', current_date + 10, null, null),
  (900223, '00000000-0000-4000-b000-000000000222', 'Extra Student', 'K-pop', 'Older', date_trunc('month', current_date)::date, 500000, 500000, 'paid', current_date - 20, now() - interval '20 days', 'cash'),
  (900224, '00000000-0000-4000-b000-000000000222', 'Extra Student', 'Jazz', 'Next', date_trunc('month', current_date)::date, 300000, 0, 'unpaid', current_date + 10, null, null);
insert into public.bank_transfers (id, provider, provider_ref, amount, content, status)
overriding system value values (900221, 'test', 'extra-1', 1200000, 'hoc phi kpop', 'unmatched');

-- ---------------------------------------------------------------------------
-- A transfer bigger than the invoice
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000221');
select lives_ok($$ select public.tuition_assign_transfer(900221, 900221) $$, 'staff put the 1,200,000 transfer on the 950,000 invoice');
select is((tests.invoice(900221)).paid_amount, 1200000::numeric, 'the invoice holds all of it');
select ok(exists (select 1 from public.tuition_extra_list() i where i.id = 900221), 'it is listed as holding extra money');

-- ---------------------------------------------------------------------------
-- Who and what
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000222');
select throws_like($$ select public.tuition_move_extra(900221, 900222) $$, 'FORBIDDEN%', 'a student cannot move money');
select tests.login_as('00000000-0000-4000-b000-000000000221');
select throws_like($$ select public.tuition_move_extra(900221, 900222, 300000) $$, 'INVALID_INPUT: only 250000 is extra%', 'no more than the extra');
select throws_like($$ select public.tuition_move_extra(900221, 900221) $$, 'INVALID_INPUT%', 'not onto itself');
select throws_like($$ select public.tuition_move_extra(900221, 900223) $$, 'INVALID_STATE: that invoice is paid%', 'not onto a paid invoice');
select throws_like($$ select public.tuition_refund_extra(900222) $$, 'INVALID_STATE: this invoice has no extra money%', 'an invoice without extra has nothing to give back');

-- ---------------------------------------------------------------------------
-- Moving the extra
-- ---------------------------------------------------------------------------
select is((public.tuition_move_extra(900221, 900222)).paid_amount, 250000::numeric, 'the extra pays part of the other course');
select is((tests.invoice(900221)).paid_amount, 950000::numeric, 'the first invoice keeps its price');
select ok(not exists (select 1 from public.tuition_extra_list() i where i.id = 900221), 'and holds no extra any more');
select is((tests.logged(900221, 'extra_moved')).meta ->> 'to_course', 'Armageddon', 'the move is in the activity log');
select ok(tests.logged(900221, 'payment_undone') is null and tests.logged(900222, 'paid') is null, 'with nothing else logged behind it');

-- ---------------------------------------------------------------------------
-- Undoing a payment takes the moved money back
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.tuition_undo_payment(900221) $$, 'staff undo the wrong payment');
select is((tests.invoice(900222)).paid_amount, 0::numeric, 'the moved extra comes back off the other course');
select is((tests.transfer(900221)).status, 'unmatched', 'the transfer is back in the inbox');
select is(tests.moves(900221), 0::bigint, 'and the move is gone');

-- ---------------------------------------------------------------------------
-- Giving the extra back
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.tuition_assign_transfer(900221, 900221) $$, 'assigned again');
select is((public.tuition_refund_extra(900221, 100000, 'cash', 'gave it back at the desk')).paid_amount, 1100000::numeric, 'giving 100,000 back lowers what the invoice holds');
select is((tests.logged(900221, 'extra_refunded')).meta ->> 'note', 'gave it back at the desk', 'the refund is in the activity log');
select throws_like($$ select public.tuition_undo_payment(900221) $$, 'INVALID_STATE: part of this payment was given back%', 'a payment partly given back cannot be undone');

-- Extra moved in returns to where it came from when the other invoice's payment is undone.
select is((public.tuition_move_extra(900221, 900224, 150000)).status, 'unpaid'::public.tuition_status, 'the rest moves onto a 300,000 course');
select lives_ok($$ select public.tuition_undo_payment(900224) $$, 'undoing that course''s payment');
select is((tests.invoice(900221)).paid_amount, 1100000::numeric, 'puts the moved money back as extra where it came from');

-- Only staff see the moves.
select tests.login_as('00000000-0000-4000-b000-000000000222');
select is((select count(*) from public.tuition_extra_moves), 0::bigint, 'a student sees no moves');
select tests.login_as('00000000-0000-4000-b000-000000000221');
select ok((select count(*) from public.tuition_extra_moves where invoice_id = 900221) = 1, 'staff see the refund');

select tests.logout();
select * from finish();
rollback;
