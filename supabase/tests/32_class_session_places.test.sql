-- A class session's own place (20261117003000_class_session_places; api-contract §3 instructor_attendance, §5):
--   * moving a class into a room booked on some of its days is refused and names the booking
--   * class_booking_clashes lists those days with the rooms still free; class_move_room places them and moves
--   * a placed session holds its room that day and frees the class's room; an unplaced one needs staff
--   * sessions with a place of their own stay when the class moves again; staff only
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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
-- The class's session next week (d1) and the week after (d2), on today's weekday.
create function tests.d(p_weeks int) returns date language sql stable as $$ select public.studio_today() + 7 * p_weeks; $$;
create function tests.session(p_weeks int) returns public.instructor_attendance language sql stable security definer as $$
  select * from public.instructor_attendance where class_id = 900321 and date = public.studio_today() + 7 * p_weeks;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000321', 'place-staff@test.local', 'staff', 'Place Staff');
select tests.create_user('00000000-0000-4000-b000-000000000322', 'place-teacher@test.local', 'instructor', 'Place Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000323', 'place-guest@test.local', 'guest', 'Place Guest');
insert into public.rooms (id, name, price) values
  (900321, 'Place Room 1', 200000), (900322, 'Place Room 2', 200000), (900323, 'Place Room 3', 200000);
-- "Place Class" meets on today's weekday, 18:00–19:30, in Room 1.
insert into public.classes (id, name, instructor_id, price, starts_on, room_id)
values (900321, 'Place Class', '00000000-0000-4000-b000-000000000322', 800000, public.studio_today() - 30, 900321);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
values (900321, extract(isodow from public.studio_today())::smallint, '18:00', '19:30');

-- Room 2 is booked at the class's time next week and the week after.
select tests.login_as('00000000-0000-4000-b000-000000000321');
create temporary table booked on commit drop as
select (public.booking_staff_create(null, 900322, tests.d(1), '18:30', '20:00', p_walk_in_name => 'Khách A', p_walk_in_phone => '0911111111')).id as first,
       (public.booking_staff_create(null, 900322, tests.d(2), '17:00', '18:30', p_walk_in_name => 'Khách B', p_walk_in_phone => '0922222222')).id as second;
grant select on booked to authenticated;

-- ---------------------------------------------------------------------------
-- The clash, named; the days it is on
-- ---------------------------------------------------------------------------
select throws_like($$update public.classes set room_id = 900322 where id = 900321$$,
                   '%SLOT_TAKEN: overlaps a booking on%[booking %]%', 'moving into a room booked on one of its days is refused and names the booking');
select is(jsonb_array_length(public.class_booking_clashes(900321, 900322)), 2, 'the clashes come one per day');
select is((public.class_booking_clashes(900321, 900322) -> 0 -> 'bookings' -> 0 ->> 'who'), 'Khách A', 'with who booked');
select is((select array_agg((r ->> 'id')::bigint order by (r ->> 'id')::bigint)
             from jsonb_array_elements(public.class_booking_clashes(900321, 900322) -> 0 -> 'free_rooms') r
            where (r ->> 'id')::bigint between 900321 and 900323),
          array[900321, 900323]::bigint[], 'and the rooms still free for the session that day (its own room too)');
select throws_like($$select public.class_move_room(900321, 900322, '[]'::jsonb)$$, '%SLOT_TAKEN%',
                   'moving without placing those sessions is refused');

-- ---------------------------------------------------------------------------
-- Placing them, then moving
-- ---------------------------------------------------------------------------
select is((public.class_move_room(900321, 900322, jsonb_build_array(
             jsonb_build_object('date', tests.d(1), 'room_id', 900323),
             jsonb_build_object('date', tests.d(2), 'room_id', null)))).room_id,
          900322::bigint, 'with the clashing sessions placed, the class moves');
select is((select room_id::text || ' ' || own_place || ' ' || needs_place from tests.session(1)), '900323 true false',
          'next week''s session is in Room 3 that day');
select is((select coalesce(room_id::text, '-') || ' ' || coalesce(venue_id::text, '-') || ' ' || needs_place from tests.session(2)),
          '- - true', 'the week after has no place yet: staff must place it');
select tests.logout();
select is(private.class_holds_room(900322, tests.d(1), '18:00', '19:30'), null, 'Room 2 stays the booking''s that day');
select is(private.class_holds_room(900323, tests.d(1), '18:00', '19:00'), 'Place Class', 'Room 3 is the class''s that day');
select is(private.class_holds_room(900322, tests.d(3), '18:00', '19:00'), 'Place Class', 'and Room 2 is the class''s on its other days');
select tests.login_as('00000000-0000-4000-b000-000000000321');
select throws_like($$select public.booking_staff_create(null, 900323, tests.d(1), '18:00', '19:00',
                     p_walk_in_name => 'Khách C', p_walk_in_phone => '0933333333')$$,
                   '%SLOT_TAKEN%', 'Room 3 can''t be booked over the session placed there');

-- Placed later: the unplaced session goes to Room 1, which is free then.
select ok((public.class_free_rooms(900321, tests.d(2)) @> '[{"id": 900321}]'::jsonb), 'Room 1 is free for the unplaced session');
select is(public.class_place_sessions(900321, jsonb_build_array(jsonb_build_object('date', tests.d(2), 'room_id', 900321))), 1,
          'staff place it');
select is((select room_id::text || ' ' || needs_place from tests.session(2)), '900321 false', 'and it is no longer a to-do');

-- The class moves back to Room 1: the sessions with a place of their own stay.
update public.classes set room_id = 900321 where id = 900321;
select is((tests.session(1)).room_id, 900323::bigint, 'a session with a place of its own stays when the class moves again');
select throws_like($$select public.class_place_sessions(900321, jsonb_build_array(jsonb_build_object('date', public.studio_today() + 8, 'room_id', 900323)))$$,
                   '%INVALID_INPUT%', 'a day the class doesn''t meet can''t be placed');
select tests.logout();

select tests.login_as('00000000-0000-4000-b000-000000000323');
select throws_like($$select public.class_place_sessions(900321, '[]'::jsonb)$$, '%FORBIDDEN%', 'only staff place sessions');
select tests.logout();

select * from finish();
rollback;
