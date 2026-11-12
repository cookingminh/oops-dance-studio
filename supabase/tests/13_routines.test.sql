-- Routines by sessions and make-up sessions (api-contract §3 class_lessons, §5 lesson_progress /
-- class_add_session):
--   * progress counts the class's sessions from the routine's start; the projected end moves
--     with cancelled sessions and make-ups
--   * a make-up session gets a roll call and blocks the room for bookings
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
create function tests.progress(p_title text) returns record language sql stable as $$
  select p.ends_on, p.status, p.sessions_held from public.lesson_progress(array[900131]::bigint[]) p where p.title = p_title;
$$;
create function tests.ends(p_title text) returns date language sql stable as $$
  select p.ends_on from public.lesson_progress(array[900131]::bigint[]) p where p.title = p_title;
$$;
create function tests.status(p_title text) returns text language sql stable as $$
  select p.status from public.lesson_progress(array[900131]::bigint[]) p where p.title = p_title;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000131', 'rt-staff@test.local', 'staff', 'Rt Staff');
select tests.create_user('00000000-0000-4000-b000-000000000132', 'rt-teacher@test.local', 'instructor', 'Rt Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000133', 'rt-student@test.local', 'guest', 'Rt Student');
insert into public.rooms (id, name, price) values (900131, 'Routine Test Room', 100000);

-- A class that meets once a week, on tomorrow's weekday, in its own room.
insert into public.classes (id, name, instructor_id, room_id, price, starts_on)
values (900131, 'Routine Class', '00000000-0000-4000-b000-000000000132', 900131, 900000, tests.today() - 30);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
values (900131, extract(isodow from tests.today() + 1)::smallint, '10:00', '11:00');
insert into public.class_students (class_id, student_id, joined_at)
values (900131, '00000000-0000-4000-b000-000000000133', tests.today() - 30);

-- ---------------------------------------------------------------------------
-- A 3-session routine starting today: tomorrow, +8, +15
-- ---------------------------------------------------------------------------
insert into public.class_lessons (class_id, starts_on, session_count, title) values (900131, tests.today(), 3, 'Now');
select is(tests.ends('Now'), tests.today() + 15, 'three weekly sessions end in two weeks');
select is(tests.status('Now'), 'planned', 'not started until its first session');
select is((select lesson from public.classes where id = 900131), 'Now', 'it is the class''s lesson');

-- ---------------------------------------------------------------------------
-- Make-up session today 20:00–21:00
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000133');
select throws_like($$select public.class_add_session(900131, public.studio_today(), '20:00', '21:00')$$, '%FORBIDDEN%',
                   'students can''t add sessions');
select tests.login_as('00000000-0000-4000-b000-000000000131');
select lives_ok($$select public.class_add_session(900131, public.studio_today(), '20:00', '21:00', 'Make-up')$$,
                'staff add a make-up session today');
select throws_like($$select public.class_add_session(900131, public.studio_today() + 1, '20:00', '21:00')$$, '%INVALID_STATE%',
                   'not on a day the class already meets');
select tests.logout();

select is(tests.ends('Now'), tests.today() + 8, 'the make-up brings the end a week closer');
select is(tests.status('Now'), 'current', 'and the routine has started');
select is((select count(*)::int from public.student_attendance where class_id = 900131 and date = tests.today()), 1,
          'the make-up has a roll call');
select throws_like(
  $$insert into public.bookings (room_id, guest_id, date, start_time, end_time, status)
    values (900131, '00000000-0000-4000-b000-000000000133', public.studio_today(), '20:30', '21:30', 'approved')$$,
  '%SLOT_TAKEN%', 'the room can''t be booked over a make-up session');

-- ---------------------------------------------------------------------------
-- A cancelled session pushes the end back
-- ---------------------------------------------------------------------------
-- (The weekly session may already have its session this week, made when the schedule was added.)
insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status)
values (900131, '00000000-0000-4000-b000-000000000132', 900131, tests.today() + 1, 'cancelled')
on conflict (class_id, date) do update set status = excluded.status;
select is(tests.ends('Now'), tests.today() + 15, 'a cancelled session pushes the end a week later');

-- ---------------------------------------------------------------------------
-- Routines with a gap: the next one is planned
-- ---------------------------------------------------------------------------
insert into public.class_lessons (class_id, starts_on, session_count, title) values (900131, tests.today() + 20, 4, 'Next');
select is(tests.status('Next'), 'planned', 'a routine starting later is planned');
select is((select lesson from public.classes where id = 900131), 'Now', 'the started routine stays the class''s lesson');

select * from finish();
rollback;
