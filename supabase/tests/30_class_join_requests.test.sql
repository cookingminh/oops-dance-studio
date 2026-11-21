-- Asking to join a class (api-contract §3 class_join_requests, §5 Join requests):
--   * a student asks (now / next, a note), one waiting request per class, up to 3 waiting; they can take it back
--   * staff approve (now: billed for the running course — in full by default, for the sessions left with pro-rata on;
--     next: from the next course, billed in full) or decline
--   * staff adding the student directly approves the request; the class ending declines it
--   * students read their own requests, staff all of them, nobody writes the table directly; every step is logged
-- The classes meet every day and dates are relative to studio_today(): nothing depends on the weekday.
begin;
create extension if not exists pgtap with schema extensions;
select plan(67);

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
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
-- A student's latest request for a class.
create function tests.req(p_class bigint, p_student uuid) returns public.class_join_requests language sql stable security definer as $$
  select * from public.class_join_requests where class_id = p_class and student_id = p_student order by id desc limit 1;
$$;
create function tests.member(p_class bigint, p_student uuid) returns public.class_students language sql stable security definer as $$
  select * from public.class_students where class_id = p_class and student_id = p_student;
$$;
create function tests.inv(p_student uuid, p_title text) returns public.tuition_invoices language sql stable security definer as $$
  select i.* from public.tuition_invoices i join public.class_lessons l on l.id = i.lesson_id
   where i.student_id = p_student and l.title = p_title;
$$;
create function tests.on_roll(p_class bigint, p_student uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.student_attendance
                  where class_id = p_class and student_id = p_student and date = public.studio_today());
$$;
create function tests.logged(p_request bigint, p_action text) returns public.activity_log language sql stable security definer as $$
  select * from public.activity_log
   where entity = 'class_join_requests' and entity_id = p_request::text and action = p_action order by id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000301', 'join-staff@test.local', 'staff', 'Join Staff');
select tests.create_user('00000000-0000-4000-b000-000000000302', 'join-admin@test.local', 'admin', 'Join Admin');
select tests.create_user('00000000-0000-4000-b000-000000000303', 'join-teacher@test.local', 'instructor', 'Join Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000304', 'join-a@test.local', 'guest', 'Join A');
select tests.create_user('00000000-0000-4000-b000-000000000305', 'join-b@test.local', 'guest', 'Join B');
select tests.create_user('00000000-0000-4000-b000-000000000306', 'join-c@test.local', 'guest', 'Join C');
select tests.create_user('00000000-0000-4000-b000-000000000307', 'join-d@test.local', 'guest', 'Join D');
select tests.create_user('00000000-0000-4000-b000-000000000308', 'join-e@test.local', 'guest', 'Join E');

-- "Join Daily" meets every day: its course "Join Now" started 5 days ago (8 sessions: 5 held, 3 left), "Join Next"
-- starts in 3 days (4 sessions). "Join Running" has a course running and none planned. "Join Ended" ended yesterday.
-- The three spare classes have no course.
insert into public.classes (id, name, instructor_id, price, starts_on, ended_on) values
  (900301, 'Join Daily',   '00000000-0000-4000-b000-000000000303', 800000, tests.today() - 30, null),
  (900302, 'Join Running', '00000000-0000-4000-b000-000000000303', 600000, tests.today() - 30, null),
  (900303, 'Join Ended',   '00000000-0000-4000-b000-000000000303', 600000, tests.today() - 60, tests.today() - 1),
  (900304, 'Join Spare 1', '00000000-0000-4000-b000-000000000303', 500000, tests.today() - 30, null),
  (900305, 'Join Spare 2', '00000000-0000-4000-b000-000000000303', 500000, tests.today() - 30, null),
  (900306, 'Join Spare 3', '00000000-0000-4000-b000-000000000303', 500000, tests.today() - 30, null);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select c, d, '10:00', '11:00' from unnest(array[900301, 900302]) c, generate_series(1, 7) d;
insert into public.class_lessons (class_id, starts_on, title, session_count) values
  (900301, tests.today() - 5, 'Join Now', 8),
  (900301, tests.today() + 3, 'Join Next', 4),
  (900302, tests.today() - 5, 'Join Running Now', 8);
-- Today's session of Join Daily, not held yet (the roll call a student joining now is put on).
insert into public.instructor_attendance (class_id, instructor_id, date, status)
values (900301, '00000000-0000-4000-b000-000000000303', tests.today(), 'pending');
-- Join A is already in Join Running.
insert into public.class_students (class_id, student_id) values (900302, '00000000-0000-4000-b000-000000000304');
-- New students pay the full course by default; pro-rata is turned on here to check the sessions-left amount, then
-- back to the default for "Approving from now: the full course".
update public.tuition_settings set prorate_late_join = true where id = 1;

-- ---------------------------------------------------------------------------
-- Asking
-- ---------------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$ select * from public.class_join_requests $$, '42501', null, 'a visitor cannot read join requests');
select throws_ok($$ select public.class_join_request(900301) $$, '42501', null, 'nor ask to join');

select tests.login_as('00000000-0000-4000-b000-000000000303');
select throws_ok($$ select public.class_join_request(900301) $$, 'P0001',
  'FORBIDDEN: only students can ask to join a class', 'an instructor cannot ask');
select tests.login_as('00000000-0000-4000-b000-000000000301');
select throws_ok($$ select public.class_join_request(900301) $$, 'P0001',
  'FORBIDDEN: only students can ask to join a class', 'nor can staff');

select tests.login_as('00000000-0000-4000-b000-000000000304');
select throws_ok($$ select public.class_join_request(900399) $$, 'P0001', 'NOT_FOUND: class', 'the class must exist');
select throws_ok($$ select public.class_join_request(900303) $$, 'P0001',
  'INVALID_STATE: this class is not taking new students', 'an ended class takes nobody');
select throws_ok($$ select public.class_join_request(900301, 'later') $$, 'P0001',
  'INVALID_INPUT: start must be now or next', 'start is now or next');
select throws_ok($$ select public.class_join_request(900301, 'now', repeat('x', 501)) $$, 'P0001',
  'INVALID_INPUT: the note is up to 500 characters', 'the note is up to 500 characters');
select throws_ok($$ select public.class_join_request(900302) $$, 'P0001',
  'INVALID_STATE: already in this class', 'nobody asks for a class they are in');
select results_eq(
  $$ select status::text, start_pref, note, decided_at is null from public.class_join_request(900301, 'now', '  Em học K-pop 6 tháng  ') $$,
  $$ values ('pending', 'now', 'Em học K-pop 6 tháng', true) $$,
  'a student asks to join: waiting, the note trimmed');
select is((public.class_join_request(900304, 'next', '   ')).note, null, 'an empty note is no note');
select throws_ok($$ select public.class_join_request(900301) $$, 'P0001',
  'INVALID_STATE: already asked to join this class', 'one waiting request per class');
select lives_ok($$ select public.class_join_request(900305) $$, 'a third request');
select throws_ok($$ select public.class_join_request(900306) $$, 'P0001',
  'INVALID_STATE: too many open requests', 'but not a fourth while three wait');

-- ---------------------------------------------------------------------------
-- Who reads, who writes
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000305');
select lives_ok($$ select public.class_join_request(900301, 'next') $$, 'another student asks for the same class');
select is((select count(*)::int from public.class_join_requests), 1, 'a student sees only their own requests');

select tests.login_as('00000000-0000-4000-b000-000000000304');
select results_eq($$ select count(*)::int, count(*) filter (where student_id = '00000000-0000-4000-b000-000000000304')::int
                       from public.class_join_requests $$,
  $$ values (3, 3) $$, 'all three of theirs, nobody else''s');
select throws_ok($$ insert into public.class_join_requests (class_id, student_id) values (900306, '00000000-0000-4000-b000-000000000304') $$,
  '42501', null, 'a student cannot write the table directly');
select throws_ok($$ update public.class_join_requests set status = 'approved' where student_id = '00000000-0000-4000-b000-000000000304' $$,
  '42501', null, 'nor approve their own request');
select throws_ok($$ delete from public.class_join_requests where student_id = '00000000-0000-4000-b000-000000000304' $$,
  '42501', null, 'nor delete it');

select tests.login_as('00000000-0000-4000-b000-000000000303');
select is((select count(*)::int from public.class_join_requests), 0, 'an instructor sees no requests');

select tests.login_as('00000000-0000-4000-b000-000000000301');
select is((select count(*)::int from public.class_join_requests where class_id between 900301 and 900306), 4, 'staff see them all');
select throws_ok($$ update public.class_join_requests set status = 'approved' where class_id = 900301 $$,
  '42501', null, 'but answer only through the RPCs');
select tests.login_as('00000000-0000-4000-b000-000000000302');
select is((select count(*)::int from public.class_join_requests where class_id between 900301 and 900306), 4, 'so do admins');

-- ---------------------------------------------------------------------------
-- Taking it back
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000305');
select throws_ok(format($$ select public.class_join_cancel(%s) $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'NOT_FOUND: request', 'a student cannot cancel someone else''s request');
select tests.login_as('00000000-0000-4000-b000-000000000304');
select results_eq(
  format($$ select status::text, decided_by, decided_at is not null from public.class_join_cancel(%s) $$,
         (tests.req(900304, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('cancelled', '00000000-0000-4000-b000-000000000304'::uuid, true) $$,
  'the student takes their request back');
select throws_ok(format($$ select public.class_join_cancel(%s) $$, (tests.req(900304, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'INVALID_STATE: this request is no longer waiting', 'once');
select lives_ok($$ select public.class_join_request(900306) $$, 'which frees a place for another request');

-- ---------------------------------------------------------------------------
-- Approving: from now
-- ---------------------------------------------------------------------------
select throws_ok(format($$ select public.class_join_approve(%s) $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'FORBIDDEN: only staff can answer a join request', 'a student cannot approve');
select tests.login_as('00000000-0000-4000-b000-000000000303');
select throws_ok(format($$ select public.class_join_approve(%s) $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'FORBIDDEN: only staff can answer a join request', 'nor can the class''s instructor');

select tests.login_as('00000000-0000-4000-b000-000000000301');
select throws_ok(format($$ select public.class_join_approve(%s, 'soon') $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'INVALID_INPUT: start must be now or next', 'staff start them now or from the next course');
select results_eq(
  format($$ select status::text, joined_at, decided_by, decided_at is not null from public.class_join_approve(%s) $$,
         (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('approved', public.studio_today(), '00000000-0000-4000-b000-000000000301'::uuid, true) $$,
  'staff approve: from now, as the student asked');
select is((tests.member(900301, '00000000-0000-4000-b000-000000000304')).joined_at, tests.today(), 'the student is in the class from today');
select is((tests.inv('00000000-0000-4000-b000-000000000304', 'Join Now')).amount, 300000::numeric,
  'with pro-rata on, billed for the 3 sessions left of the running course');
select is((tests.inv('00000000-0000-4000-b000-000000000304', 'Join Next')).id, null, 'not yet for the next one');
select ok(tests.on_roll(900301, '00000000-0000-4000-b000-000000000304'), 'and on today''s roll call');
select throws_ok(format($$ select public.class_join_approve(%s) $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'INVALID_STATE: this request is no longer waiting', 'a request is answered once');
select results_eq(
  format($$ select actor_id, area, label, class_id, subject_id, meta ->> 'class', meta ->> 'start', (meta ->> 'joined_at')::date
              from tests.logged(%s, 'join_approved') $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('00000000-0000-4000-b000-000000000301'::uuid, 'students', 'Join A', 900301::bigint,
             '00000000-0000-4000-b000-000000000304'::uuid, 'Join Daily', 'now', public.studio_today()) $$,
  'the approval is logged: who, the student, the class, from when');
select tests.logout();  -- (the log is the admin's to read)
select is((select count(*)::int from public.activity_log
            where entity = 'class_students' and action = 'enrolled' and entity_id = '900301:00000000-0000-4000-b000-000000000304'
              and actor_id = '00000000-0000-4000-b000-000000000301'), 1, 'and so is the enrolment, as usual');
select tests.login_as('00000000-0000-4000-b000-000000000301');

-- ---------------------------------------------------------------------------
-- Approving from now, by default: the full course
-- ---------------------------------------------------------------------------
select tests.logout();
update public.tuition_settings set prorate_late_join = default where id = 1;
select tests.login_as('00000000-0000-4000-b000-000000000308');
select public.class_join_request(900301, 'now');
select tests.login_as('00000000-0000-4000-b000-000000000301');
select public.class_join_approve((tests.req(900301, '00000000-0000-4000-b000-000000000308')).id);
select results_eq($$ select amount, sessions, note from tests.inv('00000000-0000-4000-b000-000000000308', 'Join Now') $$,
  $$ values (800000::numeric, 8::smallint, null::text) $$,
  'with pro-rata off a student approved from now pays the full running course, though 5 of its 8 sessions are held');

-- ---------------------------------------------------------------------------
-- Approving: from the next course
-- ---------------------------------------------------------------------------
select is((public.class_join_approve((tests.req(900301, '00000000-0000-4000-b000-000000000305')).id)).joined_at, tests.today() + 3,
  'a student who asked for the next course joins on its first day');
select is((tests.member(900301, '00000000-0000-4000-b000-000000000305')).joined_at, tests.today() + 3, 'in the class from then');
select results_eq($$ select amount, sessions from tests.inv('00000000-0000-4000-b000-000000000305', 'Join Next') $$,
  $$ values (800000::numeric, 4::smallint) $$, 'billed for the next course in full');
select is((tests.inv('00000000-0000-4000-b000-000000000305', 'Join Now')).id, null, 'nothing for the running one');
select ok(not tests.on_roll(900301, '00000000-0000-4000-b000-000000000305'), 'and not on today''s roll call');

select tests.login_as('00000000-0000-4000-b000-000000000306');
select public.class_join_request(900302, 'now');
select tests.login_as('00000000-0000-4000-b000-000000000301');
select throws_ok(format($$ select public.class_join_approve(%s, 'next') $$, (tests.req(900302, '00000000-0000-4000-b000-000000000306')).id),
  'P0001', 'INVALID_INPUT: this class has no next course planned', 'from the next course needs one planned');
select is((tests.req(900302, '00000000-0000-4000-b000-000000000306')).status, 'pending'::public.join_request_status, 'the request still waits');
select is((public.class_join_approve((tests.req(900302, '00000000-0000-4000-b000-000000000306')).id, 'now')).joined_at, tests.today(),
  'staff can start them now instead');

-- ---------------------------------------------------------------------------
-- Already in the class meanwhile; back after leaving
-- ---------------------------------------------------------------------------
-- Join D left Join Running yesterday (the nightly cycle hasn't removed them yet): they may ask again.
select tests.logout();
insert into public.class_students (class_id, student_id, joined_at, leaves_after)
values (900302, '00000000-0000-4000-b000-000000000307', tests.today() - 20, tests.today() - 1);
select tests.login_as('00000000-0000-4000-b000-000000000307');
select lives_ok($$ select public.class_join_request(900302, 'next') $$, 'someone who has left the class can ask to come back');
-- Staff keep them in the class meanwhile.
select tests.logout();
update public.class_students set leaves_after = null where class_id = 900302 and student_id = '00000000-0000-4000-b000-000000000307';
select tests.login_as('00000000-0000-4000-b000-000000000301');
select results_eq(
  format($$ select status::text, joined_at from public.class_join_approve(%s) $$, (tests.req(900302, '00000000-0000-4000-b000-000000000307')).id),
  $$ values ('approved', public.studio_today() - 20) $$,
  'already in the class: approved with the start they have (no next course needed)');
select results_eq(
  $$ select count(*)::int, min(joined_at) from public.class_students where class_id = 900302 and student_id = '00000000-0000-4000-b000-000000000307' $$,
  $$ values (1, public.studio_today() - 20) $$, 'and their place is untouched');

-- Join B left Join Running yesterday and is approved back from now: a fresh start today.
select tests.logout();
insert into public.class_students (class_id, student_id, joined_at, leaves_after)
values (900302, '00000000-0000-4000-b000-000000000305', tests.today() - 20, tests.today() - 1);
select tests.login_as('00000000-0000-4000-b000-000000000305');
select public.class_join_request(900302, 'now');
select tests.login_as('00000000-0000-4000-b000-000000000301');
select public.class_join_approve((tests.req(900302, '00000000-0000-4000-b000-000000000305')).id);
select results_eq(
  $$ select joined_at, leaves_after from public.class_students where class_id = 900302 and student_id = '00000000-0000-4000-b000-000000000305' $$,
  $$ values (public.studio_today(), null::date) $$, 'someone who had left is back from today, staying');

-- ---------------------------------------------------------------------------
-- Answered on their own
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000306');
select public.class_join_request(900304, 'now');
select tests.login_as('00000000-0000-4000-b000-000000000301');
insert into public.class_students (class_id, student_id) values (900304, '00000000-0000-4000-b000-000000000306');
select results_eq(
  $$ select status::text, decided_by, joined_at from tests.req(900304, '00000000-0000-4000-b000-000000000306') $$,
  $$ values ('approved', '00000000-0000-4000-b000-000000000301'::uuid, public.studio_today()) $$,
  'staff adding the student from the class hub approves their request');
select results_eq(
  format($$ select actor_id, meta ->> 'class', (meta ->> 'joined_at')::date from tests.logged(%s, 'join_approved') $$,
         (tests.req(900304, '00000000-0000-4000-b000-000000000306')).id),
  $$ values ('00000000-0000-4000-b000-000000000301'::uuid, 'Join Spare 1', public.studio_today()) $$, 'logged as approved by them');

select tests.login_as('00000000-0000-4000-b000-000000000306');
select public.class_join_request(900305, 'next');
select tests.login_as('00000000-0000-4000-b000-000000000301');
select public.class_end(900305, tests.today(), 'Closing');
select results_eq(
  $$ select status::text, decline_reason, decided_by from public.class_join_requests where class_id = 900305 order by student_id $$,
  $$ values ('declined', 'The class has ended.', '00000000-0000-4000-b000-000000000301'::uuid),
            ('declined', 'The class has ended.', '00000000-0000-4000-b000-000000000301'::uuid) $$,
  'ending the class declines its waiting requests');
select tests.logout();
select is((select count(*)::int from public.activity_log
            where entity = 'class_join_requests' and action = 'join_declined' and class_id = 900305
              and meta ->> 'reason' = 'The class has ended.' and meta ->> 'class' = 'Join Spare 2'), 2, 'each one logged');

-- ---------------------------------------------------------------------------
-- Declining
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000304');
select throws_ok(format($$ select public.class_join_decline(%s) $$, (tests.req(900306, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'FORBIDDEN: only staff can answer a join request', 'a student cannot decline');
select tests.login_as('00000000-0000-4000-b000-000000000301');
select throws_ok(format($$ select public.class_join_decline(%s, repeat('x', 301)) $$, (tests.req(900306, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'INVALID_INPUT: the reason is up to 300 characters', 'the reason is up to 300 characters');
select results_eq(
  format($$ select status::text, decline_reason, decided_by, joined_at from public.class_join_decline(%s, '  Lớp đang đủ người  ') $$,
         (tests.req(900306, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('declined', 'Lớp đang đủ người', '00000000-0000-4000-b000-000000000301'::uuid, null::date) $$,
  'staff decline, with a reason the student sees');
select throws_ok(format($$ select public.class_join_decline(%s) $$, (tests.req(900306, '00000000-0000-4000-b000-000000000304')).id),
  'P0001', 'INVALID_STATE: this request is no longer waiting', 'once');
select results_eq(
  format($$ select actor_id, meta ->> 'class', meta ->> 'reason' from tests.logged(%s, 'join_declined') $$,
         (tests.req(900306, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('00000000-0000-4000-b000-000000000301'::uuid, 'Join Spare 3', 'Lớp đang đủ người') $$, 'logged with the reason');
select tests.login_as('00000000-0000-4000-b000-000000000307');
select public.class_join_request(900306);
select tests.login_as('00000000-0000-4000-b000-000000000301');
select is((public.class_join_decline((tests.req(900306, '00000000-0000-4000-b000-000000000307')).id, '   ')).decline_reason, null,
  'an empty reason is no reason');

-- ---------------------------------------------------------------------------
-- The student's own steps on the Activity page
-- ---------------------------------------------------------------------------
select tests.logout();
select results_eq(
  format($$ select actor_id, area, label, class_id, subject_id, meta ->> 'class', meta ->> 'start', meta ->> 'note'
              from tests.logged(%s, 'join_requested') $$, (tests.req(900301, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('00000000-0000-4000-b000-000000000304'::uuid, 'students', 'Join A', 900301::bigint,
             '00000000-0000-4000-b000-000000000304'::uuid, 'Join Daily', 'now', 'Em học K-pop 6 tháng') $$,
  'asking is logged with the student as the actor');
select results_eq(
  format($$ select actor_id, label, meta ->> 'class' from tests.logged(%s, 'join_cancelled') $$,
         (tests.req(900304, '00000000-0000-4000-b000-000000000304')).id),
  $$ values ('00000000-0000-4000-b000-000000000304'::uuid, 'Join A', 'Join Spare 1') $$, 'so is taking it back');

-- ---------------------------------------------------------------------------
-- Privileges and names the app relies on
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'public.class_join_request(bigint, text, text)', 'execute')
          and has_function_privilege('authenticated', 'public.class_join_cancel(bigint)', 'execute')
          and has_function_privilege('authenticated', 'public.class_join_approve(bigint, text)', 'execute')
          and has_function_privilege('authenticated', 'public.class_join_decline(bigint, text)', 'execute'),
  'signed-in people call the four RPCs');
select ok(not (has_function_privilege('anon', 'public.class_join_request(bigint, text, text)', 'execute')
               or has_function_privilege('anon', 'public.class_join_cancel(bigint)', 'execute')
               or has_function_privilege('anon', 'public.class_join_approve(bigint, text)', 'execute')
               or has_function_privilege('anon', 'public.class_join_decline(bigint, text)', 'execute')
               or has_function_privilege('authenticated', 'public.seed_demo_class_join_requests()', 'execute')),
  'visitors call none of them; the demo seed is the service role''s');
select set_eq(
  $$ select conname::text from pg_constraint where conrelid = 'public.class_join_requests'::regclass and contype = 'f' $$,
  array['class_join_requests_class_id_fkey', 'class_join_requests_student_id_fkey', 'class_join_requests_decided_by_fkey'],
  'the foreign keys staff embed the people by');

select * from finish();
rollback;
