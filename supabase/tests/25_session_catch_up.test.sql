-- Sessions and roll calls follow changes made after the scheduled jobs ran (api-contract §8):
--   * a weekly session added mid-week makes the rest of this week's sessions, never a day already past;
--   * moving or removing it takes away the untouched sessions it no longer asks for, never one that started;
--   * a class's last day brought in takes away its untouched sessions after it;
--   * a student joining today is on today's roll call while today's session isn't over;
--   * none of it fills the Activity page (the change that caused it is logged once).
-- Written for any weekday: what needs a later (or earlier) day this week is skipped when there isn't one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
create function tests.dow() returns int language sql stable as $$ select extract(isodow from public.studio_today())::int; $$;
create function tests.has_session(p_class bigint, p_date date) returns boolean language sql stable as $$
  select exists (select 1 from public.instructor_attendance where class_id = p_class and date = p_date);
$$;
create function tests.on_roll(p_class bigint, p_student uuid) returns boolean language sql stable as $$
  select exists (select 1 from public.student_attendance where class_id = p_class and student_id = p_student and date = public.studio_today());
$$;

select tests.create_user('00000000-0000-4000-b000-000000000251', 'catch-teacher@test.local', 'instructor', 'Catch Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000252', 'catch-student@test.local', 'guest', 'Catch Student');
select tests.create_user('00000000-0000-4000-b000-000000000253', 'catch-late@test.local', 'guest', 'Catch Later');
select tests.create_user('00000000-0000-4000-b000-000000000254', 'catch-third@test.local', 'guest', 'Catch Third');
insert into public.classes (id, name, instructor_id, price, starts_on)
values (900251, 'Catch Class', '00000000-0000-4000-b000-000000000251', 500000, public.studio_today() - 30),
       (900252, 'Roll Class',  '00000000-0000-4000-b000-000000000251', 500000, public.studio_today() - 30);

-- ---------------------------------------------------------------------------
-- A weekly session added mid-week
-- ---------------------------------------------------------------------------
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select 900251, tests.dow() + 1, '18:00', '19:30' where tests.dow() < 7;
select case when tests.dow() < 7
  then ok(tests.has_session(900251, tests.today() + 1), 'a weekly session added mid-week has its session this week at once')
  else skip('Sunday: no later day this week', 1) end;
select ok(not tests.has_session(900251, tests.today() + 8), 'next week''s waits for Monday''s job');

insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select 900251, tests.dow() - 1, '18:00', '19:30' where tests.dow() > 1;
select case when tests.dow() > 1
  then ok(not tests.has_session(900251, tests.today() - 1), 'a day already past gets no session (nothing to review)')
  else skip('Monday: no earlier day this week', 1) end;

select is((select count(*)::int from public.activity_log where class_id = 900251 and area = 'sessions'), 0,
  'the sessions made add nothing to the Activity page');

-- ---------------------------------------------------------------------------
-- Moving and removing it
-- ---------------------------------------------------------------------------
update public.class_schedules set day_of_week = tests.dow() + 2
 where class_id = 900251 and day_of_week = tests.dow() + 1 and tests.dow() < 6;
select case when tests.dow() < 6
  then ok(not tests.has_session(900251, tests.today() + 1), 'moved to another day: the old day''s untouched session goes')
  else skip('Saturday or Sunday: no two later days this week', 1) end;
select case when tests.dow() < 6
  then ok(tests.has_session(900251, tests.today() + 2), 'and the new day has its session')
  else skip('Saturday or Sunday: no two later days this week', 1) end;

-- A session with a check-in stays when its weekly session goes.
update public.instructor_attendance set checkin_at = now(), status = 'in_progress'
 where class_id = 900251 and date = tests.today() + 2;
delete from public.class_schedules where class_id = 900251 and day_of_week = tests.dow() + 2;
select case when tests.dow() < 6
  then ok(tests.has_session(900251, tests.today() + 2), 'a session that started stays when its weekly session is removed')
  else skip('Saturday or Sunday: no two later days this week', 1) end;

-- An untouched one goes.
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select 900251, tests.dow() + 1, '20:00', '21:00' where tests.dow() < 7;
delete from public.class_schedules where class_id = 900251 and day_of_week = tests.dow() + 1;
select case when tests.dow() < 7
  then ok(not tests.has_session(900251, tests.today() + 1), 'an untouched session goes with its weekly session')
  else skip('Sunday: no later day this week', 1) end;

-- ---------------------------------------------------------------------------
-- The class's last day brought in
-- ---------------------------------------------------------------------------
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select 900251, tests.dow() + 1, '20:00', '21:00' where tests.dow() < 7;
update public.classes set ended_on = public.studio_today() where id = 900251;
select case when tests.dow() < 7
  then ok(not tests.has_session(900251, tests.today() + 1), 'ending the class today takes away its untouched sessions after today')
  else skip('Sunday: no later day this week', 1) end;
update public.classes set ended_on = null where id = 900251;
select case when tests.dow() < 7
  then ok(tests.has_session(900251, tests.today() + 1), 'and reopening it brings them back')
  else skip('Sunday: no later day this week', 1) end;

-- ---------------------------------------------------------------------------
-- A student joining today
-- ---------------------------------------------------------------------------
insert into public.instructor_attendance (class_id, instructor_id, date, status)
values (900252, '00000000-0000-4000-b000-000000000251', public.studio_today(), 'pending');
insert into public.class_students (class_id, student_id, joined_at)
values (900252, '00000000-0000-4000-b000-000000000252', public.studio_today());
select ok(tests.on_roll(900252, '00000000-0000-4000-b000-000000000252'), 'a student who joins today is on today''s roll call');

insert into public.class_students (class_id, student_id, joined_at)
values (900252, '00000000-0000-4000-b000-000000000253', public.studio_today() + 1);
select ok(not tests.on_roll(900252, '00000000-0000-4000-b000-000000000253'), 'one who joins from tomorrow isn''t');

update public.instructor_attendance set status = 'completed', checkin_at = now() - interval '2 hours', checkout_at = now()
 where class_id = 900252 and date = public.studio_today();
insert into public.class_students (class_id, student_id, joined_at)
values (900252, '00000000-0000-4000-b000-000000000254', public.studio_today());
select ok(not tests.on_roll(900252, '00000000-0000-4000-b000-000000000254'), 'nor one who joins after today''s session is over');

select is((select count(*)::int from public.student_attendance where class_id = 900252 and date = public.studio_today()), 1,
  'today''s roll call has just the one who joined in time');

select * from finish();
rollback;
