-- Room bookings paid by transfer, and notes on invoices (api-contract §3 bookings, §5 Booking payments,
-- tuition_set_note):
--   * every booking has its own payment code, which can't be changed
--   * the bank webhook pays a booking by its code; the deposit becomes paid; the transfer is its history
--   * a cancelled booking's transfer waits in the inbox; staff assign / take back transfers
--   * the sandbox simulates what is due; only the guest and staff see a booking's payments
--   * the price follows the room and times until staff change it (with a reason); money taken by hand
--     (cash, refunds) is recorded as entries
--   * staff write a note on an invoice on its own
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

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
create function tests.booking(p_id bigint) returns public.bookings language sql stable security definer as $$
  select * from public.bookings where id = p_id;
$$;
create function tests.transfer(p_ref text) returns public.bank_transfers language sql stable security definer as $$
  select * from public.bank_transfers where provider_ref = p_ref;
$$;
-- The log is admin-only: read it as the owner.
create function tests.logged(p_entity_id text, p_action text, p_actor uuid) returns integer language sql stable security definer as $$
  select count(*)::int from public.activity_log
   where entity = 'bookings' and entity_id = p_entity_id and action = p_action and actor_id is not distinct from p_actor;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000161', 'pay-staff@test.local', 'staff', 'Pay Staff');
select tests.create_user('00000000-0000-4000-b000-000000000162', 'pay-guest@test.local', 'guest', 'Pay Guest');
select tests.create_user('00000000-0000-4000-b000-000000000163', 'pay-other@test.local', 'guest', 'Pay Other');

insert into public.rooms (id, name, size, price) overriding system value values (900161, 'Pay Room', '20m2', 200000);
-- 2 hours at 200,000: 400,000, deposit 200,000.
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status, deposit, full_payment)
overriding system value values
  (900161, 900161, '00000000-0000-4000-b000-000000000162', public.studio_today() + 30, '08:00', '10:00', 'approved', 200000, 400000),
  (900162, 900161, '00000000-0000-4000-b000-000000000162', public.studio_today() + 31, '08:00', '10:00', 'cancelled', 200000, 400000),
  (900163, 900161, '00000000-0000-4000-b000-000000000163', public.studio_today() + 32, '08:00', '10:00', 'pending', 200000, 400000);

-- ---------------------------------------------------------------------------
-- The code
-- ---------------------------------------------------------------------------
select matches((tests.booking(900161)).payment_code, '^OOPS[2-9A-HJ-NP-Z]{6}$', 'a booking gets a payment code');
select isnt((tests.booking(900161)).payment_code, (tests.booking(900162)).payment_code, 'its own');
update public.bookings set payment_code = 'OOPS222222' where id = 900161;
select isnt((tests.booking(900161)).payment_code, 'OOPS222222', 'and it can''t be changed');

-- ---------------------------------------------------------------------------
-- The bank pays the deposit
-- ---------------------------------------------------------------------------
select public.tuition_record_transfer('sepay', 'pay-1', 200000,
  'CK ' || lower((tests.booking(900161)).payment_code) || ' dat coc phong');
select is((tests.transfer('pay-1')).booking_id, 900161::bigint, 'the transfer is matched to the booking by its code');
select is((tests.booking(900161)).bank_transfer, 200000::numeric, 'the money is on the booking');
select is((tests.booking(900161)).deposit_status, 'completed'::public.deposit_status, 'the deposit is paid');
select is((tests.booking(900161)).real_income, 200000::numeric, 'real income follows');
select is((select count(*)::int from public.activity_log where entity = 'bookings' and entity_id = '900161' and action = 'paid' and actor_id is null),
          1, 'the activity log says the bank paid it');

select public.tuition_record_transfer('sepay', 'pay-2', 250000, (tests.booking(900161)).payment_code);
select is((tests.transfer('pay-2')).note, 'Paid 50000 more than was due.', 'paying more than the rest is noted');

select public.tuition_record_transfer('sepay', 'pay-3', 200000, (tests.booking(900162)).payment_code || ' dat phong');
select is((tests.transfer('pay-3')).status, 'unmatched', 'a cancelled booking''s transfer waits in the inbox');
select is((tests.transfer('pay-3')).note, 'Booking #900162 is cancelled.', 'saying why');

-- ---------------------------------------------------------------------------
-- Who sees the payments; staff assign and take back
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000162');
select is((select count(*)::int from public.booking_payments(900161)), 2, 'the guest sees their booking''s transfers');
select tests.login_as('00000000-0000-4000-b000-000000000163');
select throws_like($$select * from public.booking_payments(900161)$$, 'NOT_FOUND:%', 'another guest doesn''t');
select throws_like($$select public.booking_assign_transfer((tests.transfer('pay-3')).id, 900163)$$, 'FORBIDDEN:%',
                   'guests can''t assign transfers');

select tests.login_as('00000000-0000-4000-b000-000000000161');
select public.booking_assign_transfer((tests.transfer('pay-3')).id, 900163);
select is((tests.booking(900163)).deposit_status, 'completed'::public.deposit_status, 'staff put the transfer on the right booking');
select public.booking_unassign_transfer((tests.transfer('pay-3')).id);
select is((tests.booking(900163)).bank_transfer, 0::numeric, 'taking it back removes the money');
select is((tests.booking(900163)).deposit_status, 'waiting'::public.deposit_status, 'and opens the deposit again');
select is((tests.transfer('pay-3')).status, 'unmatched', 'the transfer is back in the inbox');

-- ---------------------------------------------------------------------------
-- The sandbox sends what is due
-- ---------------------------------------------------------------------------
select tests.logout();
insert into private.payment_sandbox default values on conflict do nothing;
select tests.login_as('00000000-0000-4000-b000-000000000163');
select public.booking_simulate_transfer(900163);
select is((tests.booking(900163)).bank_transfer, 200000::numeric, 'a simulated transfer pays the deposit due');

-- ---------------------------------------------------------------------------
-- The price, and money taken by hand
-- ---------------------------------------------------------------------------
select tests.logout();
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status)
overriding system value values (900164, 900161, '00000000-0000-4000-b000-000000000162', public.studio_today() + 33, '08:00', '10:00', 'approved');
select is(((tests.booking(900164)).list_price, (tests.booking(900164)).full_payment, (tests.booking(900164)).deposit),
          (400000::numeric, 400000::numeric, 200000::numeric), 'a new booking is priced from the room: 2 h × 200,000, half as deposit');
select tests.login_as('00000000-0000-4000-b000-000000000161');
update public.bookings set end_time = '11:00' where id = 900164;
select is(((tests.booking(900164)).list_price, (tests.booking(900164)).full_payment, (tests.booking(900164)).deposit),
          (600000::numeric, 600000::numeric, 300000::numeric), 'an extra hour moves the price and the open deposit');
select throws_like($$select public.booking_set_price(900164, 500000)$$, 'INVALID_INPUT:%', 'another price needs a reason');
select public.booking_set_price(900164, 500000, 'Regular customer');
select is(((tests.booking(900164)).full_payment, (tests.booking(900164)).deposit, (tests.booking(900164)).price_note),
          (500000::numeric, 250000::numeric, 'Regular customer'::text), 'staff agree another price with a reason');
update public.bookings set end_time = '10:00' where id = 900164;
select is(((tests.booking(900164)).list_price, (tests.booking(900164)).full_payment), (400000::numeric, 500000::numeric),
          'moving it then keeps the agreed price');

select public.booking_record_payment(900164, 250000);
select is(((tests.booking(900164)).cash, (tests.booking(900164)).deposit_status), (250000::numeric, 'completed'::public.deposit_status),
          'cash at the counter pays the deposit');
select is(tests.logged('900164', 'paid', '00000000-0000-4000-b000-000000000161'), 1, 'logged with who took it');
select throws_like($$select public.booking_record_payment(900164, -50000)$$, 'INVALID_INPUT:%', 'a refund needs a note');
select throws_like($$select public.booking_record_payment(900164, -300000, 'cash', 'too much')$$, 'INVALID_INPUT:%',
                   'and can''t give back more than came in');
select public.booking_record_payment(900164, -50000, 'cash', 'Finished early');
select is((tests.booking(900164)).cash, 200000::numeric, 'a refund takes money off');
select is((select count(*)::int from public.booking_payments(900164)), 2, 'both lines are in the history');
select public.booking_delete_payment((select id from public.booking_payment_entries where booking_id = 900164 and amount < 0));
select is((tests.booking(900164)).cash, 250000::numeric, 'removing an entry puts the money back as it was');
select tests.login_as('00000000-0000-4000-b000-000000000162');
select throws_like($$select public.booking_record_payment(900164, 1000)$$, 'FORBIDDEN:%', 'guests can''t record payments');
select tests.logout();

-- ---------------------------------------------------------------------------
-- Staff book for a guest in one go
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000161');
select public.booking_staff_create('00000000-0000-4000-b000-000000000163', 900161, public.studio_today() + 34, '08:00', '10:00',
                                   'Walk-in', 'approved', 360000, 'Regular customer -10%', 180000, 'cash', null);
select is((select (status, full_payment, price_note, cash, deposit_status)::text from public.bookings
            where guest_id = '00000000-0000-4000-b000-000000000163' and date = public.studio_today() + 34),
          '(approved,360000,"Regular customer -10%",180000,completed)', 'booked, priced and the deposit taken in one go');
select matches((select payment_code from public.bookings
                 where guest_id = '00000000-0000-4000-b000-000000000163' and date = public.studio_today() + 34),
               '^OOPS', 'with its payment code');
select throws_like($$select public.booking_staff_create('00000000-0000-4000-b000-000000000163', 900161, public.studio_today() + 35,
                                                         '08:00', '10:00', null, 'approved', 300000, null)$$,
                   'INVALID_INPUT:%', 'another price still needs a reason, and nothing is booked');
select tests.login_as('00000000-0000-4000-b000-000000000162');
select throws_like($$select public.booking_staff_create('00000000-0000-4000-b000-000000000162', 900161, public.studio_today() + 36,
                                                         '08:00', '10:00')$$, 'FORBIDDEN:%', 'guests can''t');
select tests.logout();

-- ---------------------------------------------------------------------------
-- Notes on invoices
-- ---------------------------------------------------------------------------
select tests.logout();
select tests.create_user('00000000-0000-4000-b000-000000000164', 'pay-teacher@test.local', 'instructor', 'Pay Teacher');
insert into public.classes (id, name, instructor_id, price, starts_on)
values (900161, 'Pay Class', '00000000-0000-4000-b000-000000000164', 500000, public.studio_today() - 10);
insert into public.class_lessons (class_id, starts_on, title, session_count)
values (900161, date_trunc('month', public.studio_today())::date, 'Pay Course', 8);
insert into public.tuition_invoices (id, student_id, class_id, student_name, class_name, month, amount, due_date)
overriding system value values (900161, '00000000-0000-4000-b000-000000000162', 900161, 'Pay Guest', 'Pay Class',
                                date_trunc('month', public.studio_today())::date, 500000, public.studio_today() + 7);
select tests.login_as('00000000-0000-4000-b000-000000000161');
select public.tuition_set_note(900161, '  Promised to pay cash at the weekend  ');
select is((select note from public.tuition_invoices where id = 900161), 'Promised to pay cash at the weekend', 'staff write a note on its own');
select public.tuition_set_note(900161, '');
select is((select note from public.tuition_invoices where id = 900161), null, 'an empty note clears it');
select tests.login_as('00000000-0000-4000-b000-000000000162');
select throws_like($$select public.tuition_set_note(900161, 'mine')$$, 'FORBIDDEN:%', 'students can''t');
select tests.logout();

select * from finish();
rollback;
