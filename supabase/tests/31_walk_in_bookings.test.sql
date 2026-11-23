-- Bookings for anyone (20261117002900_walk_in_bookings; api-contract §3 bookings, §5 booking_staff_create):
--   * staff book for any account (an instructor here), or for a walk-in with no account (name + phone)
--   * exactly one of the two; a walk-in needs a phone; only staff book for others
--   * the activity log names the walk-in; guests still book for themselves (pending)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000311', 'walk-staff@test.local', 'staff', 'Walk Staff');
select tests.create_user('00000000-0000-4000-b000-000000000312', 'walk-teacher@test.local', 'instructor', 'Walk Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000313', 'walk-guest@test.local', 'guest', 'Walk Guest');
insert into public.rooms (id, name, price) values (900311, 'Walk-in Room', 200000);

-- ---------------------------------------------------------------------------
-- Staff: a walk-in, an instructor's account
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000311');
create temporary table walk_in on commit drop as
select * from public.booking_staff_create(null, 900311, public.studio_today() + 20, '09:00', '10:30', null, 'approved', null, null,
                                          100000, 'cash', null, '  Chị Lan  ', '0912 345 678');
select tests.logout();

select is((select guest_id from walk_in), null, 'a walk-in booking has no account');
select is((select walk_in_name || ' / ' || walk_in_phone from walk_in), 'Chị Lan / 0912 345 678', 'it keeps the walk-in''s name and phone');
select is((select status::text || ' ' || full_payment || ' ' || cash from walk_in), 'approved 300000 100000',
          'approved, priced from the room, with the cash taken');
select is((select label from public.activity_log where entity = 'bookings' and entity_id = (select id::text from walk_in)
            and action = 'created'), 'Chị Lan', 'the activity log names the walk-in');
select is((select label from public.activity_log where entity = 'bookings' and entity_id = (select id::text from walk_in)
            and action = 'paid'), 'Chị Lan', 'and so does the line for the money taken');

select tests.login_as('00000000-0000-4000-b000-000000000311');
select is((select guest_id from public.booking_staff_create('00000000-0000-4000-b000-000000000312', 900311, public.studio_today() + 20,
                                                            '11:00', '12:00')),
          '00000000-0000-4000-b000-000000000312'::uuid, 'staff book for an instructor''s account too');
select throws_like($$select public.booking_staff_create('00000000-0000-4000-b000-000000000312', 900311, public.studio_today() + 21,
                     '09:00', '10:00', p_walk_in_name => 'Chị Lan', p_walk_in_phone => '0912345678')$$,
                   '%INVALID_INPUT%', 'an account and a walk-in at once is refused');
select throws_like($$select public.booking_staff_create(null, 900311, public.studio_today() + 21, '09:00', '10:00')$$,
                   '%INVALID_INPUT%', 'and so is neither');
select throws_like($$select public.booking_staff_create(null, 900311, public.studio_today() + 21, '09:00', '10:00',
                     p_walk_in_name => 'Anh Tuấn')$$,
                   '%INVALID_INPUT%', 'a walk-in needs a phone number');
select throws_like($$select public.booking_staff_create(null, 900311, public.studio_today() + 20, '10:00', '11:00',
                     p_walk_in_name => 'Anh Tuấn', p_walk_in_phone => '0987654321')$$,
                   '%SLOT_TAKEN%', 'a walk-in can''t take a slot that is already booked');
select tests.logout();

-- ---------------------------------------------------------------------------
-- Guests
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000313');
select throws_like($$select public.booking_staff_create(null, 900311, public.studio_today() + 22, '09:00', '10:00',
                     p_walk_in_name => 'Bạn tôi', p_walk_in_phone => '0987654321')$$,
                   '%FORBIDDEN%', 'a guest can''t book for a walk-in');
select is((select status::text || ' ' || (guest_id = '00000000-0000-4000-b000-000000000313')::text
             from public.create_booking(900311, public.studio_today() + 22, '09:00', '10:00')),
          'pending true', 'a guest still books for themselves, waiting for approval');
select is((select count(*)::int from public.bookings where room_id = 900311 and walk_in_name is not null), 0,
          'and doesn''t see walk-ins'' bookings');
select throws_like(format('select public.booking_payments(%s)', (select id from walk_in)), '%NOT_FOUND%',
                   'nor their payments');
select throws_like(format('select public.booking_cancel_quote(%s)', (select id from walk_in)), '%NOT_FOUND%',
                   'nor can cancel one');
select tests.logout();

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
select throws_ok($$insert into public.bookings (room_id, date, start_time, end_time) values (900311, public.studio_today() + 23, '09:00', '10:00')$$,
                 '23514', null, 'a booking is for an account or a walk-in');

select * from finish();
rollback;
