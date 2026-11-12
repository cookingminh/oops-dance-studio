-- Rented studios' rooms and their name on the website (api-contract §3 venues / venue_rooms, §5 Venues):
--   * every studio has at least one room; staff give it rooms with their own rents (venue_save p_rooms); a room
--     left out goes, or turns inactive when a class was in it;
--   * a class in a room is at that room's studio; at a studio without a room picked it takes the first room;
--     moving it to another studio takes that one's first room; its sessions not started yet follow, and a
--     session's rent is its room's;
--   * the website and students see the studio's public name (its area), staff and instructors its own name.
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
create function tests.room(p_name text) returns bigint language sql stable security definer as $$
  select r.id from public.venue_rooms r join public.venues v on v.id = r.venue_id where v.name = 'Room Test Studio' and r.name = p_name;
$$;
create function tests.rooms() returns text language sql stable security definer as $$
  select string_agg(r.name || ':' || r.rent_per_hour || ':' || r.active, ', ' order by r.position)
    from public.venue_rooms r join public.venues v on v.id = r.venue_id where v.name = 'Room Test Studio';
$$;
create function tests.swap_rooms() returns text language sql security definer as $$
  select string_agg(r.name || ':' || r.rent_per_hour, ', ' order by r.position)
    from public.venue_rooms r join public.venues v on v.id = r.venue_id where v.name = 'Room Swap Studio';
$$;
create function tests.swap_room(p_name text) returns bigint language sql stable security definer as $$
  select r.id from public.venue_rooms r join public.venues v on v.id = r.venue_id where v.name = 'Room Swap Studio' and r.name = p_name;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000261', 'rooms-staff@test.local', 'staff', 'Rooms Staff');
select tests.create_user('00000000-0000-4000-b000-000000000262', 'rooms-teacher@test.local', 'instructor', 'Rooms Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000263', 'rooms-guest@test.local', 'guest', 'Rooms Guest');

-- ---------------------------------------------------------------------------
-- Staff set the rooms
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000261');
select lives_ok($$ select public.venue_save(null, 'Room Test Studio', 'Phố Thử, Hà Nội', null, 150000, null, true, null,
  '[{"name": "Big room", "rent": 300000}, {"name": "Small room", "rent": 160000}]'::jsonb) $$,
  'staff add a studio with two rooms at their own rents');
select is(tests.rooms(), 'Big room:300000:true, Small room:160000:true', 'both rooms, in order');
select is((select public_name from public.venues where name = 'Room Test Studio'), 'Phố Thử',
  'left empty, its public name is its address''s first part');
select throws_like($$ select public.venue_save(null, 'Room Test Two', null, null, 0, null, true, null,
  '[{"name": "A"}, {"name": "a"}]'::jsonb) $$, 'INVALID_INPUT: two rooms have the same name', 'two rooms can''t share a name');
select throws_like($$ select public.venue_save(null, 'Room Test Empty', null, null, 0, null, true, null, '[]'::jsonb) $$,
  'INVALID_INPUT: a studio needs at least one room', 'a studio needs a room');
select lives_ok($$ select public.venue_save(null, 'Room Test Plain', 'Phố Một, Hà Nội', null, 120000) $$, 'a studio saved without its rooms list…');
select is((select string_agg(r.name || ':' || r.rent_per_hour, ', ') from public.venue_rooms_list() r join public.venues v on v.id = r.venue_id
            where v.name = 'Room Test Plain'), 'Phòng 1:120000', '…gets "Phòng 1" at that rent');

-- Names can swap, and a room removed can come back under its name, in one save.
select public.venue_save(null, 'Room Swap Studio', null, null, 0, null, true, null, '[{"name": "A", "rent": 1000}, {"name": "B", "rent": 2000}]'::jsonb);
select lives_ok($$ select public.venue_save((select id from public.venues where name = 'Room Swap Studio'), 'Room Swap Studio', null, null, 0, null, true, null,
  ('[{"id": ' || tests.swap_room('A') || ', "name": "B", "rent": 1000}, {"id": ' || tests.swap_room('B') || ', "name": "A", "rent": 2000}]')::jsonb) $$,
  'two rooms swap names in one save');
select is(tests.swap_rooms(), 'B:1000, A:2000', 'each keeps its rent under the other name');
select lives_ok($$ select public.venue_save((select id from public.venues where name = 'Room Swap Studio'), 'Room Swap Studio', null, null, 0, null, true, null,
  ('[{"id": ' || tests.swap_room('B') || ', "name": "B", "rent": 1000}, {"name": "A", "rent": 3000}]')::jsonb) $$,
  'a room removed and added again under its name, in one save');

-- ---------------------------------------------------------------------------
-- A class in a room
-- ---------------------------------------------------------------------------
select tests.logout();
insert into public.classes (id, name, instructor_id, price, starts_on)
values (900261, 'Room Class', '00000000-0000-4000-b000-000000000262', 500000, public.studio_today() - 30);
update public.classes set venue_id = (select id from public.venues where name = 'Room Test Studio') where id = 900261;
select is(((select venue_room_id from public.classes where id = 900261)), tests.room('Big room'),
  'a class put at a studio without a room picked is in its first room');
update public.classes set venue_room_id = tests.room('Big room') where id = 900261;
select is((select v.name from public.classes c join public.venues v on v.id = c.venue_id where c.id = 900261), 'Room Test Studio',
  'a class put in a room is at that room''s studio');

insert into public.instructor_attendance (class_id, instructor_id, date, status, start_time, end_time, is_extra)
values (900261, '00000000-0000-4000-b000-000000000262', public.studio_today() + 1, 'pending', '18:00', '19:00', true);
select is((select venue_room_id from public.instructor_attendance where class_id = 900261 and date = public.studio_today() + 1),
  tests.room('Big room'), 'a new session takes the class''s room');

update public.classes set venue_room_id = tests.room('Small room') where id = 900261;
select is((select venue_room_id from public.instructor_attendance where class_id = 900261 and date = public.studio_today() + 1),
  tests.room('Small room'), 'moving the class to another room moves its sessions not started yet');

-- The rent of a session taught yesterday in the small room.
insert into public.instructor_attendance (class_id, instructor_id, date, status, start_time, end_time, is_extra)
values (900261, '00000000-0000-4000-b000-000000000262', public.studio_today() - 1, 'completed', '18:00', '19:30', true);
select private.charge_venue_rent(a) from public.instructor_attendance a where a.class_id = 900261 and a.date = public.studio_today() - 1;
select is((select amount from public.expenses e join public.instructor_attendance a on a.id = e.session_id
            where a.class_id = 900261 and a.date = public.studio_today() - 1), 240000::numeric,
  'its rent is the room''s: 1.5 h × 160,000');
select is((select vendor from public.expenses e join public.instructor_attendance a on a.id = e.session_id
            where a.class_id = 900261 and a.date = public.studio_today() - 1), 'Room Test Studio · Small room',
  'paid to the studio, room named');

-- That day the studio gave the big room instead: the rent follows.
select tests.login_as('00000000-0000-4000-b000-000000000261');
select lives_ok($$ select public.session_set_venue_room(
  (select id from public.instructor_attendance where class_id = 900261 and date = public.studio_today() - 1), tests.room('Big room')) $$,
  'staff move one session to another room');
select tests.logout();
select is((select amount from public.expenses e join public.instructor_attendance a on a.id = e.session_id
            where a.class_id = 900261 and a.date = public.studio_today() - 1), 450000::numeric,
  'its rent is worked out again: 1.5 h × 300,000');
select tests.login_as('00000000-0000-4000-b000-000000000261');
select throws_like($$ select public.session_set_venue_room(
  (select id from public.instructor_attendance where class_id = 900261 and date = public.studio_today() - 1), null) $$,
  'INVALID_INPUT: pick a room', 'a session is always in a room');
select tests.login_as('00000000-0000-4000-b000-000000000262');
select throws_like($$ select public.session_set_venue_room(
  (select id from public.instructor_attendance where class_id = 900261 and date = public.studio_today() - 1), null) $$,
  'FORBIDDEN%', 'an instructor can''t');
select tests.logout();

-- Leaving the small room out: it was used, so it stays, inactive.
select tests.login_as('00000000-0000-4000-b000-000000000261');
select lives_ok($$ select public.venue_save((select id from public.venues where name = 'Room Test Studio'), 'Room Test Studio',
  'Phố Thử, Hà Nội', null, 150000, null, true, 'Phố Thử', ('[{"id": ' || tests.room('Big room') || ', "name": "Big room", "rent": 320000}]')::jsonb) $$,
  'staff save the studio without the small room');
select is(tests.rooms(), 'Big room:320000:true, Small room:160000:false', 'a used room turns inactive instead of going');

-- Moving the class to another studio takes that studio's first room.
select tests.logout();
update public.classes set venue_id = (select id from public.venues where name = 'Room Swap Studio') where id = 900261;
select is((select venue_room_id from public.classes where id = 900261), tests.swap_room('B'),
  'moving the class to another studio puts it in that studio''s first room');

-- ---------------------------------------------------------------------------
-- Who sees which name
-- ---------------------------------------------------------------------------
update public.classes set venue_room_id = tests.room('Big room') where id = 900261;
select tests.login_anon();
select is((select room_name from public.list_public_classes() where id = 900261), 'Phố Thử', 'the website shows the public name');
select throws_like($$ select name from public.venues $$, '%permission denied%', 'a visitor can''t read the studio''s own name');
select throws_like($$ select rent_per_hour from public.venue_rooms $$, '%permission denied%', 'nor the rooms');

-- A make-up session (a session change) as the instructor and as a student sees it.
select tests.logout();
insert into public.class_students (class_id, student_id, joined_at) values (900261, '00000000-0000-4000-b000-000000000263', public.studio_today() - 10);
update public.instructor_attendance set venue_id = c.venue_id, venue_room_id = c.venue_room_id
  from public.classes c where c.id = 900261 and instructor_attendance.class_id = 900261 and instructor_attendance.date = public.studio_today() + 1;
select tests.login_as('00000000-0000-4000-b000-000000000262');
select is((select room_name from public.my_session_changes() where class_id = 900261 limit 1), 'Room Test Studio · Big room',
  'the instructor sees the studio''s own name and the room');
select tests.login_as('00000000-0000-4000-b000-000000000263');
select is((select room_name from public.my_session_changes() where class_id = 900261 limit 1), 'Phố Thử',
  'a student sees its public name');

select * from finish();
rollback;
