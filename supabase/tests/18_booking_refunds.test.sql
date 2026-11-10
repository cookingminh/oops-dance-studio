-- Booking cancellations and refunds (api-contract §3 bookings, booking_settings, §5 Booking refunds):
--   * the policy: everything back long enough ahead (when set), a part back a day ahead, nothing later;
--     a pending booking and a studio cancellation get everything back
--   * guests cancel their approved bookings before they start; the refund becomes a debt staff pay back
--   * staff override the refund with a reason; rejecting / cancelling by hand makes everything due back
--   * what the studio keeps counts as income
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

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
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function tests.booking(p_id bigint) returns public.bookings language sql stable security definer as $$
  select * from public.bookings where id = p_id;
$$;
-- The quote for cancelling `p_id` this many hours before it starts.
create function tests.quote(p_id bigint, p_hours numeric, p_studio boolean default false) returns jsonb language sql stable security definer as $$
  select private.booking_refund_quote(b, p_studio, private.booking_starts_at(b) - make_interval(secs => p_hours * 3600))
    from public.bookings b where b.id = p_id;
$$;
create function tests.logged(p_id bigint, p_action text) returns public.activity_log language sql stable security definer as $$
  select a.* from public.activity_log a where a.entity = 'bookings' and a.entity_id = p_id::text and a.action = p_action order by a.id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000181', 'refund-admin@test.local', 'admin', 'Refund Admin');
select tests.create_user('00000000-0000-4000-b000-000000000182', 'refund-staff@test.local', 'staff', 'Refund Staff');
select tests.create_user('00000000-0000-4000-b000-000000000183', 'refund-guest@test.local', 'guest', 'Refund Guest');
select tests.create_user('00000000-0000-4000-b000-000000000184', 'refund-other@test.local', 'guest', 'Other Guest');

insert into public.rooms (id, name, size, price) overriding system value values (900181, 'Refund Room', '20m2', 100000);
-- 2 hours at 100,000: 200,000, deposit 100,000. 900181: deposit paid by transfer. 900182: paid in full, cash.
-- 900183: pending with a paid deposit. 900184: started yesterday. 900185: rejected by hand later.
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status, deposit, full_payment, bank_transfer, cash, deposit_status, real_income)
overriding system value values
  (900181, 900181, '00000000-0000-4000-b000-000000000183', public.studio_today() + 20, '10:00', '12:00', 'approved', 100000, 200000, 100000, 0, 'completed', 100000),
  (900182, 900181, '00000000-0000-4000-b000-000000000183', public.studio_today() + 21, '10:00', '12:00', 'approved', 100000, 200000, 0, 200000, 'completed', 200000),
  (900183, 900181, '00000000-0000-4000-b000-000000000183', public.studio_today() + 22, '10:00', '12:00', 'pending', 100000, 200000, 100000, 0, 'completed', 100000),
  (900184, 900181, '00000000-0000-4000-b000-000000000183', public.studio_today() - 1, '10:00', '12:00', 'approved', 100000, 200000, 100000, 0, 'completed', 100000),
  (900185, 900181, '00000000-0000-4000-b000-000000000184', public.studio_today() + 23, '10:00', '12:00', 'approved', 100000, 200000, 0, 150000, 'completed', 150000);

-- ---------------------------------------------------------------------------
-- The policy (default: half back from 24 hours ahead, nothing later, no full step)
-- ---------------------------------------------------------------------------
select is(tests.quote(900181, 48) ->> 'tier', 'partial', 'two days ahead: part of it back');
select is((tests.quote(900181, 48) ->> 'refund')::numeric, 50000::numeric, 'half of the 100,000 paid');
select is((tests.quote(900181, 10) ->> 'refund')::numeric, 0::numeric, 'ten hours ahead: nothing back');
select is(tests.quote(900181, 10) ->> 'tier', 'none', 'the late step');
select is((tests.quote(900181, 10, true) ->> 'refund')::numeric, 100000::numeric, 'the studio cancelling gives everything back');
select is((tests.quote(900183, 1) ->> 'refund')::numeric, 100000::numeric, 'a booking not approved yet gives everything back');

select tests.login_as('00000000-0000-4000-b000-000000000182');
select throws_ok($$ select public.booking_set_refund_policy(72, 24, 50) $$, 'P0001',
  'FORBIDDEN: only admins can change the cancellation policy', 'staff can''t change the policy');
select tests.login_as('00000000-0000-4000-b000-000000000181');
select throws_like($$ select public.booking_set_refund_policy(12, 24, 50) $$, 'INVALID_INPUT:%', 'the full step needs more hours than the part one');
select lives_ok($$ select public.booking_set_refund_policy(72, 24, 50) $$, 'admins set a full refund from three days ahead');
select is(tests.quote(900181, 100) ->> 'tier', 'full', 'four days ahead: everything back');
select ok(exists (select 1 from public.activity_log where action = 'refund_policy' and entity = 'booking_settings'), 'the policy change is logged');
select lives_ok($$ select public.booking_set_refund_policy(null, 24, 50) $$, 'and turn the full step off again');
select tests.login_anon();
select is((select refund_partial_percent from public.booking_settings), 50::smallint, 'everyone can read the policy');

-- ---------------------------------------------------------------------------
-- The guest cancels
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000184');
select throws_like($$ select public.cancel_booking(900181) $$, 'NOT_FOUND:%', 'not someone else''s booking');
select throws_like($$ select public.booking_cancel_quote(900181) $$, 'NOT_FOUND:%', 'nor its quote');

select tests.login_as('00000000-0000-4000-b000-000000000183');
select is((public.booking_cancel_quote(900181) ->> 'refund')::numeric, 50000::numeric, 'the guest sees what they''ll get back');
select is((public.cancel_booking(900181, p_refund => 0, p_refund_to => 'VCB 0123 Refund Guest')).status::text, 'cancelled',
  'the guest cancels an approved booking (a refund they pass is ignored)');
select throws_like($$ select public.cancel_booking(900184) $$, 'INVALID_STATE:%', 'not one that has started');
select tests.logout();
select is((tests.booking(900181)).refund_due, 50000::numeric, 'half is due back');
select is((tests.booking(900181)).real_income, 50000::numeric, 'the other half is the studio''s income');
select is((tests.booking(900181)).refund_to, 'VCB 0123 Refund Guest', 'with where to send it');
select is((tests.logged(900181, 'cancelled')).meta ->> 'refund', '50000', 'the log says what is due back');

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000182');
select is((public.booking_refund(900181)).refund_paid, 50000::numeric, 'staff pay it back by transfer');
select throws_like($$ select public.booking_refund(900181) $$, 'INVALID_STATE:%', 'once');
select throws_like($$ select public.cancel_booking(900182, p_refund => 150000) $$, 'INVALID_INPUT:%', 'a different refund needs a reason');
select is((public.cancel_booking(900182, p_by_studio => true)).refund_due, 200000::numeric, 'the studio cancels: everything back');
select throws_like($$ select public.booking_set_refund(900182, 120000, '') $$, 'INVALID_INPUT:%', 'changing the refund needs a reason');
select is((public.booking_set_refund(900182, 120000, 'Moved 80k to the next booking')).real_income, 80000::numeric,
  'staff change it with a reason; the rest is income');
-- By hand: reject a paid booking, then bring it back.
update public.bookings set status = 'rejected' where id = 900185;
select tests.logout();
select is((tests.booking(900185)).refund_due, 150000::numeric, 'rejecting a paid booking by hand makes everything due back');
select is((tests.booking(900185)).cancel_kind, 'studio', 'as the studio''s cancellation');
select tests.login_as('00000000-0000-4000-b000-000000000182');
update public.bookings set status = 'approved' where id = 900185;
select tests.logout();
select is((tests.booking(900185)).refund_due, 0::numeric, 'bringing it back clears the refund');
select is((tests.booking(900185)).real_income, 150000::numeric, 'and the money is income again');
select is((tests.booking(900181)).bank_transfer, 50000::numeric, 'the transfer refund left by transfer');

-- ---------------------------------------------------------------------------
-- Income
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000182');
select is((select sum(real_income_sum) from public.v_revenue_monthly where room_id = 900181), 380000::numeric,
  'revenue counts what the studio keeps from cancelled bookings (50k + 80k) with the rest (100k + 150k)');

select * from finish();
rollback;
