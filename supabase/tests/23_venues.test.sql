-- Rented studios (api-contract §3 venues, §5 Venues):
--   * everyone sees a venue's name and address, only staff its rent; staff add / change / remove venues
--   * a class is taught in a room or at a venue, never both; its sessions follow it
--   * an ended session at a venue becomes a rent expense once; calling it off removes the rent
--   * the public timetable names the venue and gives its address
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

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
create function tests.session(p_id bigint) returns public.instructor_attendance language sql stable security definer as $$
  select * from public.instructor_attendance where id = p_id;
$$;
create function tests.rent(p_session bigint) returns public.expenses language sql stable security definer as $$
  select * from public.expenses where session_id = p_session;
$$;
create function tests.logged_venue(p_name text) returns text language sql stable security definer as $$
  select a.action from public.activity_log a
   where a.entity = 'venues' and a.entity_id = (select v.id::text from public.venues v where v.name = p_name) order by a.id desc limit 1;
$$;
create function tests.rents(p_session bigint) returns bigint language sql stable security definer as $$
  select count(*) from public.expenses where session_id = p_session;
$$;
create function tests.venue_id(p_name text) returns bigint language sql stable security definer as $$
  select id from public.venues where name = p_name;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000231', 'venue-staff@test.local', 'staff', 'Venue Staff');
select tests.create_user('00000000-0000-4000-b000-000000000232', 'venue-teacher@test.local', 'instructor', 'Venue Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000233', 'venue-guest@test.local', 'guest', 'Venue Guest');
insert into public.rooms (id, name, size, price) overriding system value values (900231, 'Venue Test Room', '20m2', 100000);
insert into public.classes (id, name, instructor_id, room_id, price, starts_on)
values (900231, 'Venue Class', '00000000-0000-4000-b000-000000000232', 900231, 500000, public.studio_today() - 30);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
values (900231, extract(isodow from public.studio_today() + 2)::smallint, '18:00', '19:30');
-- A session two days ahead (in the room), and one taught yesterday 18:00–19:30. (Adding the weekly session may
-- have made this week's session already; the test's own rows replace it.)
delete from public.instructor_attendance where class_id = 900231;
insert into public.instructor_attendance (id, class_id, instructor_id, room_id, date, status)
overriding system value values (900231, 900231, '00000000-0000-4000-b000-000000000232', 900231, public.studio_today() + 2, 'pending');

-- ---------------------------------------------------------------------------
-- Managing venues
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000233');
select throws_like($$ select public.venue_save(null, 'Studio Guest', null, null, 100000) $$, 'FORBIDDEN%', 'a guest cannot add a studio');
select tests.login_as('00000000-0000-4000-b000-000000000231');
select is((public.venue_save(null, '  Studio Test Thuê  ', 'Số 1 Phố Test', 'https://maps.example/test', 240000)).name, 'Studio Test Thuê', 'staff add a rented studio');
select throws_like($$ select public.venue_save(null, 'studio test thuê', null, null, 100000) $$, 'INVALID_INPUT: there is already a studio%', 'names are unique (any case)');
select throws_like($$ select public.venue_save(null, 'Studio Bad Link', null, 'http://x', 100000) $$, 'INVALID_INPUT: the map link%', 'map links are https');
select throws_like($$ select public.venue_save(null, 'Studio Negative', null, null, -1) $$, 'INVALID_INPUT: the rent%', 'no negative rent');
select is(tests.logged_venue('Studio Test Thuê'), 'venue_added', 'adding it is in the activity log');
select is((select v.rent_per_hour from public.venues_list() v where v.name = 'Studio Test Thuê'), 240000::numeric, 'staff see the rent');

select tests.login_as('00000000-0000-4000-b000-000000000233');
select is((select v.address from public.venues v where v.name = 'Studio Test Thuê'), 'Số 1 Phố Test', 'a guest sees where it is');
select throws_like($$ select v.rent_per_hour from public.venues v $$, '%permission denied%', 'but not the rent');
select is((select count(*) from public.venues_list()), 0::bigint, 'nor the staff list');
select tests.login_anon();
select is((select count(*) from public.venues v where v.public_name = 'Số 1 Phố Test'), 1::bigint,
  'a visitor sees the studio by its public name (its address''s first part)');
select throws_like($$ select v.name from public.venues v $$, '%permission denied%', 'never by its own name (another studio''s brand)');

-- ---------------------------------------------------------------------------
-- A class moves to the venue
-- ---------------------------------------------------------------------------
select tests.logout();
select throws_like($$ update public.classes set venue_id = (select id from public.venues where name = 'Studio Test Thuê') where id = 900231 $$,
                   '%classes_one_place%', 'a class is not in a room and at a venue at once');
select tests.login_as('00000000-0000-4000-b000-000000000231');
update public.classes set room_id = null, venue_id = tests.venue_id('Studio Test Thuê') where id = 900231;
select is((tests.session(900231)).venue_id, tests.venue_id('Studio Test Thuê'), 'its coming session follows to the venue');
select ok((tests.session(900231)).room_id is null, 'and leaves the room');
select tests.logout();
insert into public.instructor_attendance (id, class_id, instructor_id, date, status, start_time, end_time)
overriding system value values (900232, 900231, '00000000-0000-4000-b000-000000000232', public.studio_today() - 1, 'completed', '18:00', '19:30');
select is((tests.session(900232)).venue_id, tests.venue_id('Studio Test Thuê'), 'a new session takes the class''s venue');

select tests.login_anon();
select is((select c.room_name from public.list_public_classes() c where c.id = 900231), 'Số 1 Phố Test',
  'the timetable names the venue by its public name, not the studio''s own');
select is((select c.venue_address from public.list_public_classes() c where c.id = 900231), 'Số 1 Phố Test', 'with its address');

-- ---------------------------------------------------------------------------
-- The rent
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000232');
select throws_like($$ select public.venue_rent_run() $$, 'FORBIDDEN%', 'an instructor cannot charge rent');
select tests.login_as('00000000-0000-4000-b000-000000000231');
select ok(public.venue_rent_run() >= 1, 'staff charge the rent of sessions that ended');
select is((tests.rent(900232)).amount, 360000::numeric, 'yesterday''s 1.5 hours at 240,000 an hour: 360,000');
select is((tests.rent(900232)).class_id, 900231::bigint, 'on the class, for its direct costs');
select ok(tests.rent(900231) is null, 'a session still to come costs nothing yet');
select is(public.venue_rent_run(), 0, 'charging again charges nothing new');
select is(tests.rents(900232), 1::bigint, 'one rent per session');

-- The studio didn't charge for one: deleting its rent is remembered.
select tests.logout();
insert into public.instructor_attendance (id, class_id, instructor_id, date, status, start_time, end_time)
overriding system value values (900233, 900231, '00000000-0000-4000-b000-000000000232', public.studio_today() - 3, 'completed', '18:00', '19:00');
select public.venue_rent_run();
delete from public.expenses where session_id = 900233;
select is(public.venue_rent_run(), 0, 'a deleted rent is not charged again');

update public.instructor_attendance set status = 'cancelled', cancel_reason = 'Studio flooded' where id = 900232;
select ok(tests.rent(900232) is null, 'calling the session off removes its rent');

select tests.login_as('00000000-0000-4000-b000-000000000231');
select throws_like($$ select public.venue_delete(tests.venue_id('Studio Test Thuê')) $$, 'INVALID_STATE%', 'a studio classes used can only be set inactive');

select tests.logout();
select * from finish();
rollback;
