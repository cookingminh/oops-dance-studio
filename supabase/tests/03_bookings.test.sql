-- create_booking / cancel_booking (api-contract §5 "Bookings")
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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
create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Date of ISO weekday p_dow (1 = Mon … 7 = Sun) in NEXT week (always future).
create function tests.next_week(p_dow int) returns date language sql stable as $$
  select date_trunc('week', public.studio_today())::date + 7 + (p_dow - 1);
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
select tests.create_user('c0000000-0000-4000-8000-000000000001', 'book.inst@test.local',   'instructor', 'Thầy Booking');
select tests.create_user('c0000000-0000-4000-8000-000000000002', 'book.staff@test.local',  'staff',      'Staff Booking');
select tests.create_user('c0000000-0000-4000-8000-000000000003', 'book.guest1@test.local', 'guest',      'Khách Một');
select tests.create_user('c0000000-0000-4000-8000-000000000004', 'book.guest2@test.local', 'guest',      'Khách Hai');

insert into public.rooms (id, name, price) values (900021, 'Booking Room', 200000);
insert into public.classes (id, name, instructor_id, room_id, price)
values (900021, 'Booking Monday Class', 'c0000000-0000-4000-8000-000000000001', 900021, 800000);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
values (900021, 1, '18:00', '20:00');

-- Pre-existing bookings for the cancel tests (Thursday next week).
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status) values
  (900031, 900021, 'c0000000-0000-4000-8000-000000000003', tests.next_week(4), '10:00', '12:00', 'pending'),
  (900032, 900021, 'c0000000-0000-4000-8000-000000000003', tests.next_week(4), '14:00', '16:00', 'approved');

-- ---------------------------------------------------------------------------
-- create_booking
-- ---------------------------------------------------------------------------
select tests.login_as('c0000000-0000-4000-8000-000000000003');

select results_eq(
  $$select guest_id, status::text, room_id, start_time, end_time, details, full_payment, deposit
    from public.create_booking(900021, tests.next_week(2), '10:00', '12:00', 'Tập nhóm 6 người')$$,
  $$values ('c0000000-0000-4000-8000-000000000003'::uuid, 'pending'::text, 900021::bigint,
            time '10:00', time '12:00', 'Tập nhóm 6 người'::text, 400000::numeric, 200000::numeric)$$,
  'create_booking: pending booking owned by the caller; full_payment = 2h × 200,000, deposit = 50 %');

select throws_like(
  $$select public.create_booking(900021, tests.next_week(3), '08:00', '09:00', null, 'c0000000-0000-4000-8000-000000000004')$$,
  'FORBIDDEN:%', 'a guest cannot book on behalf of another user');

select results_eq(
  $$select full_payment, deposit
    from public.create_booking(900021, tests.next_week(3), '09:00', '10:30')$$,
  $$values (300000::numeric, 150000::numeric)$$,
  'create_booking: 1.5h → full_payment 300,000, deposit 150,000');

select tests.login_as('c0000000-0000-4000-8000-000000000004');

select throws_like(
  $$select public.create_booking(900021, tests.next_week(2), '11:00', '13:00')$$,
  'SLOT_TAKEN:%', 'overlap with an existing booking → SLOT_TAKEN');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(2), '09:00', '13:00')$$,
  'SLOT_TAKEN:%', 'booking that contains an existing booking → SLOT_TAKEN');
select lives_ok(
  $$select public.create_booking(900021, tests.next_week(2), '12:00', '13:00')$$,
  'back-to-back booking (12:00 right after 10:00–12:00) is allowed');

select throws_like(
  $$select public.create_booking(900021, tests.next_week(1), '19:00', '21:00')$$,
  'SLOT_TAKEN:%', 'overlap with a class schedule → SLOT_TAKEN');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(1), '17:30', '18:30')$$,
  'SLOT_TAKEN:%', 'partial overlap with class start → SLOT_TAKEN');
select lives_ok(
  $$select public.create_booking(900021, tests.next_week(1), '20:00', '21:00')$$,
  'booking right after the class is allowed');
select lives_ok(
  $$select public.create_booking(900021, tests.next_week(2), '19:00', '20:00')$$,
  'class on Monday does not block Tuesday');

select throws_like(
  $$select public.create_booking(900021, public.studio_today() - 1, '10:00', '11:00')$$,
  'PAST_DATE:%', 'past date → PAST_DATE');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(3), '12:00', '11:00')$$,
  'INVALID_INPUT:%', 'end before start → INVALID_INPUT');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(3), '07:00', '09:00')$$,
  'INVALID_INPUT:%', 'before 08:00 → INVALID_INPUT');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(3), '21:00', '22:30')$$,
  'INVALID_INPUT:%', 'after 22:00 → INVALID_INPUT');
select throws_like(
  $$select public.create_booking(99999999, tests.next_week(3), '10:00', '11:00')$$,
  'NOT_FOUND:%', 'unknown room → NOT_FOUND');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(3), '10:15', '11:00')$$,
  'INVALID_INPUT:%', 'start off the 30-minute grid → INVALID_INPUT');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(3), '10:00', '10:45')$$,
  'INVALID_INPUT:%', 'end off the 30-minute grid → INVALID_INPUT');
select results_eq(
  $$select status::text from public.create_booking(900021, tests.next_week(3), '14:00', '14:30', null, 'c0000000-0000-4000-8000-000000000004')$$,
  $$values ('pending'::text)$$,
  'a guest passing their own id as p_guest_id still gets a pending booking');

-- ---------------------------------------------------------------------------
-- cancel_booking
-- ---------------------------------------------------------------------------
-- guest2 is not the owner
select throws_like($$select public.cancel_booking(900031)$$, 'NOT_FOUND:%',
  'cancel_booking: another guest''s booking → NOT_FOUND');

select tests.login_as('c0000000-0000-4000-8000-000000000003');
select results_eq($$select status::text from public.cancel_booking(900031)$$, $$values ('cancelled'::text)$$,
  'cancel_booking: owner cancels a pending booking');
select throws_like($$select public.cancel_booking(900031)$$, 'INVALID_STATE:%',
  'cancel_booking: already cancelled → INVALID_STATE');
select is(public.booking_cancel_quote(900032) ->> 'tier', 'partial',
  'cancel_booking: an approved booking ahead can be cancelled by its owner, refunded on the policy (booking_refunds)');

select tests.login_as('c0000000-0000-4000-8000-000000000004');
select lives_ok($$select public.create_booking(900021, tests.next_week(4), '10:00', '12:00')$$,
  'a cancelled booking frees the slot for someone else');

select tests.login_as('c0000000-0000-4000-8000-000000000002');
select results_eq($$select status::text from public.cancel_booking(900032)$$, $$values ('cancelled'::text)$$,
  'cancel_booking: staff cancels an approved booking');

-- Staff booking on behalf of a guest
select results_eq(
  $$select guest_id, status::text
    from public.create_booking(900021, tests.next_week(5), '10:00', '11:00', 'Khách gọi điện đặt', 'c0000000-0000-4000-8000-000000000004')$$,
  $$values ('c0000000-0000-4000-8000-000000000004'::uuid, 'approved'::text)$$,
  'staff create_booking for a guest via p_guest_id → approved');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(1), '18:00', '19:00', null, 'c0000000-0000-4000-8000-000000000004')$$,
  'SLOT_TAKEN:%', 'staff booking for a guest still respects class schedules');
select throws_like(
  $$select public.create_booking(900021, tests.next_week(5), '12:00', '13:00', null, 'c0000000-0000-4000-8000-0000000000ee')$$,
  'NOT_FOUND:%', 'staff booking for an unknown user → NOT_FOUND');

-- Staff writing the table directly still hits the same guards.
select throws_like(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time)
    values (900021, 'c0000000-0000-4000-8000-000000000004', tests.next_week(1), '18:30', '19:00')$$,
  'SLOT_TAKEN:%', 'staff direct insert over a class → SLOT_TAKEN (trigger)');
select throws_ok(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time)
    values (900021, 'c0000000-0000-4000-8000-000000000004', tests.next_week(2), '10:30', '11:00')$$,
  '23P01', null, 'staff direct insert over a booking → exclusion violation 23P01');
select throws_like(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time)
    values (900021, 'c0000000-0000-4000-8000-000000000004', tests.next_week(6), '14:10', '15:00')$$,
  'INVALID_INPUT:%', 'staff direct insert off the 30-minute grid → INVALID_INPUT');
select throws_like(
  $$update public.bookings set start_time = '09:45' where id = 900032$$,
  'INVALID_INPUT:%', 'staff direct update off the 30-minute grid → INVALID_INPUT');

select tests.login_anon();
select throws_ok($$select public.create_booking(900021, tests.next_week(5), '10:00', '11:00')$$, '42501', null,
  'anon cannot call create_booking');

select tests.logout();
select * from finish();
rollback;
