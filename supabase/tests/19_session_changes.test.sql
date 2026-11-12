-- Session changes (api-contract §3 instructor_attendance cancel_reason / makes_up, §5 Session changes):
--   * staff call off a session ahead (even before its row exists) with a reason; not one that happened
--   * moving it adds a make-up that says which day it replaces; the class's usual days are refused
--   * the class (members that day, the teacher) sees what changed, with the reason; others don't
--   * closing the studio for a day calls off every session and cancels that day's bookings as the studio
--   * a called-off day gets no roll call; reopening forgets the reason
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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
-- The first day after today with this ISO weekday (1 = Monday), plus p_weeks weeks.
create function tests.next_dow(p_dow int, p_weeks int default 0) returns date language sql stable as $$
  select public.studio_today() + ((p_dow - extract(isodow from public.studio_today())::int + 6) % 7 + 1) + 7 * p_weeks;
$$;
create function tests.session(p_class bigint, p_date date) returns public.instructor_attendance language sql stable security definer as $$
  select * from public.instructor_attendance where class_id = p_class and date = p_date;
$$;
create function tests.logged(p_action text, p_entity_id text) returns public.activity_log language sql stable security definer as $$
  select a.* from public.activity_log a where a.action = p_action and a.entity_id = p_entity_id order by a.id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000191', 'move-staff@test.local', 'staff', 'Move Staff');
select tests.create_user('00000000-0000-4000-b000-000000000192', 'move-teacher@test.local', 'instructor', 'Move Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000193', 'move-student@test.local', 'guest', 'Move Student');
select tests.create_user('00000000-0000-4000-b000-000000000194', 'move-other@test.local', 'guest', 'Move Other');

-- A class on Wednesdays and Fridays 18:00–19:30 in its own room, one student.
insert into public.rooms (id, name, size, price) overriding system value values (900191, 'Move Room', '20m2', 100000);
insert into public.classes (id, name, instructor_id, room_id, price, starts_on)
values (900191, 'Move Class', '00000000-0000-4000-b000-000000000192', 900191, 500000, public.studio_today() - 30);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
values (900191, 3, '18:00', '19:30'), (900191, 5, '18:00', '19:30');
insert into public.class_students (class_id, student_id, joined_at)
values (900191, '00000000-0000-4000-b000-000000000193', public.studio_today() - 30);

-- ---------------------------------------------------------------------------
-- Calling a session off
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000193');
select throws_like($$ select public.session_cancel(900191, tests.next_dow(3), 'Storm') $$, 'FORBIDDEN:%', 'students can''t call a session off');

select tests.login_as('00000000-0000-4000-b000-000000000191');
select throws_like($$ select public.session_cancel(900191, tests.next_dow(3), '  ') $$, 'INVALID_INPUT:%', 'a reason is needed');
select throws_like($$ select public.session_cancel(900191, public.studio_today() - 1, 'Storm') $$, 'INVALID_INPUT:%', 'not a past day');
select throws_like($$ select public.session_cancel(900191, tests.next_dow(2), 'Storm') $$, 'INVALID_STATE:%', 'not a day the class doesn''t meet');
select is((public.session_cancel(900191, tests.next_dow(3), 'Big storm')).status::text, 'cancelled', 'a session ahead is called off before its row exists');
select tests.logout();
select is((tests.session(900191, tests.next_dow(3))).cancel_reason, 'Big storm', 'with its reason');
select is((tests.logged('cancelled', (tests.session(900191, tests.next_dow(3))).id::text)).meta ->> 'reason', 'Big storm', 'the activity log says why');

-- The class sees it; someone else doesn't.
select tests.login_as('00000000-0000-4000-b000-000000000193');
select is((select kind || ' · ' || reason from public.my_session_changes() where class_id = 900191 and date = tests.next_dow(3)),
          'cancelled · Big storm', 'the student sees the session is off, and why');
select tests.login_as('00000000-0000-4000-b000-000000000194');
select is((select count(*)::int from public.my_session_changes() where class_id = 900191), 0, 'someone outside the class doesn''t');
select tests.login_as('00000000-0000-4000-b000-000000000192');
select is((select count(*)::int from public.my_session_changes() where class_id = 900191), 1, 'the teacher does');

-- ---------------------------------------------------------------------------
-- Moving it
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000191');
select throws_like($$ select public.session_move(900191, tests.next_dow(3), tests.next_dow(3), '10:00', '11:30', 'Storm') $$,
  'INVALID_INPUT:%', 'the make-up is on another day');
select throws_like($$ select public.session_move(900191, tests.next_dow(3), tests.next_dow(5), '10:00', '11:30', 'Storm') $$,
  'INVALID_STATE:%', 'not on a day the class already meets');
select is((public.session_move(900191, tests.next_dow(3), tests.next_dow(6), '10:00', '11:30', 'Big storm')) -> 'make_up' ->> 'makes_up',
  tests.next_dow(3)::text, 'the already called-off session gets its make-up on Saturday, saying which day it replaces');
select tests.logout();
select is((tests.session(900191, tests.next_dow(6))).is_extra, true, 'the make-up is an extra session');
select tests.login_as('00000000-0000-4000-b000-000000000193');
select is((select reason from public.my_session_changes() where class_id = 900191 and kind = 'make_up'), 'Big storm',
  'the student sees the make-up, with why the class moved');
select is((select start_time from public.my_session_changes() where class_id = 900191 and kind = 'make_up'), '10:00'::time, 'and its time');

-- Next week's Wednesday: called off and moved in one step.
select tests.login_as('00000000-0000-4000-b000-000000000191');
select lives_ok($$ select public.session_move(900191, tests.next_dow(3, 1), tests.next_dow(4, 1), '18:00', '19:30', 'Teacher ill') $$,
  'one step: off on Wednesday, on Thursday');
select tests.logout();
select is((tests.session(900191, tests.next_dow(3, 1))).status::text, 'cancelled', 'Wednesday is off');

-- A session that happened can't be called off; reopening forgets the reason.
insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status)
values (900191, '00000000-0000-4000-b000-000000000192', 900191, tests.next_dow(5), 'completed')
on conflict (class_id, date) do update set status = excluded.status;  -- this week's may exist already
select tests.login_as('00000000-0000-4000-b000-000000000191');
select throws_like($$ select public.session_cancel(900191, tests.next_dow(5), 'Storm') $$, 'INVALID_STATE:%', 'not one that happened');
update public.instructor_attendance set status = 'pending' where class_id = 900191 and date = tests.next_dow(3, 1);
select tests.logout();
select is((tests.session(900191, tests.next_dow(3, 1))).cancel_reason, null, 'reopening forgets why it was called off');

-- ---------------------------------------------------------------------------
-- Closing the studio for a day
-- ---------------------------------------------------------------------------
insert into public.bookings (id, room_id, guest_id, date, start_time, end_time, status, deposit, full_payment, bank_transfer, deposit_status, real_income)
overriding system value values
  (900191, 900191, '00000000-0000-4000-b000-000000000194', tests.next_dow(3, 3), '10:00', '12:00', 'approved', 100000, 200000, 100000, 'completed', 100000);
select tests.login_as('00000000-0000-4000-b000-000000000191');
select is((public.studio_close_day(tests.next_dow(3, 3), 'Typhoon warning') ->> 'bookings')::int, 1,
  'closing the studio cancels that day''s booking');
select tests.logout();
select is((tests.session(900191, tests.next_dow(3, 3))).cancel_reason, 'Typhoon warning', 'and calls the class off');
select is((select refund_due from public.bookings where id = 900191), 100000::numeric, 'the guest gets everything back');
select ok((tests.logged('day_closed', tests.next_dow(3, 3)::text)).id is not null, 'the closure is logged');
select is(public.generate_student_attendance(tests.next_dow(3, 3)) >= 0 and not exists (
            select 1 from public.student_attendance where class_id = 900191 and date = tests.next_dow(3, 3)),
          true, 'a called-off day gets no roll call');

select * from finish();
rollback;
