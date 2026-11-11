-- Paid in full = completed (api-contract §3 bookings status, migration 20261117001000):
--   * an approved booking becomes completed once everything is paid (cash, transfer); money taken back
--     before its day makes it approved again; a past booking marked completed by hand stays so
--   * a completed booking ahead still holds its room; it can still be cancelled (and refunded) before it starts
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
create function tests.status(p_id bigint) returns text language sql stable security definer as $$
  select status::text from public.bookings where id = p_id;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000201', 'paid-staff@test.local', 'staff', 'Paid Staff');
select tests.create_user('00000000-0000-4000-b000-000000000202', 'paid-guest@test.local', 'guest', 'Paid Guest');
select tests.create_user('00000000-0000-4000-b000-000000000203', 'paid-other@test.local', 'guest', 'Paid Other');

insert into public.rooms (id, name, size, price) overriding system value values (900201, 'Paid Room', '20m2', 100000);
-- 2 hours at 100,000 = 200,000 (deposit 100,000), 40 days ahead; a past one; an approved one paid by transfer.
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status, deposit, full_payment, deposit_status)
overriding system value values
  (900201, 900201, '00000000-0000-4000-b000-000000000202', public.studio_today() + 40, '10:00', '12:00', 'approved', 100000, 200000, 'waiting'),
  (900202, 900201, '00000000-0000-4000-b000-000000000202', public.studio_today() - 3, '10:00', '12:00', 'approved', 100000, 200000, 'waiting'),
  (900203, 900201, '00000000-0000-4000-b000-000000000202', public.studio_today() + 41, '10:00', '12:00', 'approved', 100000, 200000, 'waiting');

select tests.login_as('00000000-0000-4000-b000-000000000201');
select public.booking_record_payment(900201, 100000, 'cash', null);
select is(tests.status(900201), 'approved', 'the deposit alone keeps it approved');
select public.booking_record_payment(900201, 100000, 'cash', null);
select is(tests.status(900201), 'completed', 'paid in full: completed by itself');
select public.booking_record_payment(900201, -50000, 'cash', 'Gave 50k back by mistake');
select is(tests.status(900201), 'approved', 'money taken back before its day: approved again');
select public.booking_record_payment(900201, 50000, 'cash', null);
select is(tests.status(900201), 'completed', 'and completed again');

-- By bank transfer (the webhook), with the booking's code.
select tests.logout();
select public.tuition_record_transfer('sepay', 'paid-1', 200000, 'CK ' || (select payment_code from public.bookings where id = 900203) || ' dat phong');
select is(tests.status(900203), 'completed', 'a transfer of the whole price completes it too');

-- By hand, a past booking stays completed even if unpaid.
update public.bookings set status = 'completed' where id = 900202;
select is(tests.status(900202), 'completed', 'staff mark a past booking completed by hand');

-- A completed booking ahead still holds its room.
select tests.login_as('00000000-0000-4000-b000-000000000203');
select throws_like($$ select public.create_booking(900201, public.studio_today() + 40, '11:00', '12:00') $$, 'SLOT_TAKEN:%',
  'nobody can book over a booking paid in full');
select ok(not exists (select 1 from public.get_available_slots(public.studio_today() + 40)
                       where room_id = 900201 and start_time < '12:00' and end_time > '10:00'),
          'and its hours aren''t offered as free');
select lives_ok($$ select public.create_booking(900201, public.studio_today() + 40, '13:00', '14:00') $$, 'the hours around it are');

-- It can still be cancelled before it starts, on the policy.
select tests.login_as('00000000-0000-4000-b000-000000000202');
select is((public.cancel_booking(900201)).status::text, 'cancelled', 'the guest cancels a booking paid in full');
select tests.logout();
select is((select refund_due from public.bookings where id = 900201), 100000::numeric, 'half of the 200,000 comes back (40 days ahead, 50%)');
select tests.login_as('00000000-0000-4000-b000-000000000202');
select throws_like($$ select public.cancel_booking(900202) $$, 'INVALID_STATE:%', 'not one that already happened');

select * from finish();
rollback;
