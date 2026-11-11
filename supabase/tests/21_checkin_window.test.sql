-- Check-in window and late check-out (api-contract §3 instructor_attendance.checkout_late, §5):
--   * check-in opens 15 minutes before the session and closes at its end
--   * check-out any time after check-in; more than 10 minutes after the end it is marked late
--   * staff correct the times (and the mark) with a reason, logged with before and after
-- Sessions get their own times around the current studio time, so the tests work at any hour; a case that
-- would cross midnight is skipped.
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
-- The studio's time of day now, shifted by p_minutes (whole minutes), or null when that crosses midnight.
create function tests.at(p_minutes int) returns time language sql stable as $$
  select case when x >= 0 and x < 1440 then make_time((x / 60)::int, (x % 60)::int, 0) end
    from (select (extract(hour from l)::int * 60 + extract(minute from l)::int + p_minutes) as x
            from (select (now() at time zone 'Asia/Ho_Chi_Minh')::time as l) n) m;
$$;
-- A session today for the teacher with its own times; returns its id (null when the times cross midnight).
create function tests.session(p_id bigint, p_start int, p_end int, p_status text default 'pending') returns bigint
language plpgsql security definer as $$
begin
  if tests.at(p_start) is null or tests.at(p_end) is null then return null; end if;
  insert into public.instructor_attendance (id, class_id, instructor_id, room_id, date, status, start_time, end_time, checkin_at)
  overriding system value
  values (p_id, p_id, '00000000-0000-4000-b000-000000000212', null, public.studio_today(), p_status::public.instructor_attendance_status,
          tests.at(p_start), tests.at(p_end), case when p_status = 'in_progress' then now() - interval '1 hour' end);
  insert into storage.objects (bucket_id, name) values
    ('attendance-proofs', '00000000-0000-4000-b000-000000000212/' || p_id || '/checkin.jpg'),
    ('attendance-proofs', '00000000-0000-4000-b000-000000000212/' || p_id || '/checkout.jpg');
  return p_id;
end $$;
create function tests.row(p_id bigint) returns public.instructor_attendance language sql stable security definer as $$
  select * from public.instructor_attendance where id = p_id;
$$;
create function tests.logged(p_id bigint) returns public.activity_log language sql stable security definer as $$
  select a.* from public.activity_log a where a.action = 'check_edited' and a.entity_id = p_id::text order by a.id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000211', 'win-staff@test.local', 'staff', 'Window Staff');
select tests.create_user('00000000-0000-4000-b000-000000000212', 'win-teacher@test.local', 'instructor', 'Window Teacher');

-- One class per session (instructor_attendance is unique per class and day); no weekly slots.
insert into public.classes (id, name, instructor_id, price, starts_on)
select g, 'Window Class ' || g, '00000000-0000-4000-b000-000000000212', 500000, public.studio_today() - 30
  from generate_series(900211, 900215) g;

-- 900211 starts in 30 min (too early) · 900212 starts in 10 min (open) · 900213 ended 30 min ago (over)
-- · 900214 checked in, ended 20 min ago (late check-out) · 900215 checked in, ends in an hour (early check-out)
select tests.session(900211, 30, 90);
select tests.session(900212, 10, 70);
select tests.session(900213, -90, -30);
select tests.session(900214, -80, -20, 'in_progress');
select tests.session(900215, -30, 60, 'in_progress');

select tests.login_as('00000000-0000-4000-b000-000000000212');
select case when tests.row(900211) is null then skip('too close to midnight', 1) else
  throws_like($$ select public.instructor_check_in(900211, '00000000-0000-4000-b000-000000000212/900211/checkin.jpg') $$,
              'INVALID_STATE: check-in opens at%', 'check-in isn''t open 30 minutes before') end;
select case when tests.row(900212) is null then skip('too close to midnight', 1) else
  is((public.instructor_check_in(900212, '00000000-0000-4000-b000-000000000212/900212/checkin.jpg')).status::text, 'in_progress',
     'it is open 10 minutes before') end;
select case when tests.row(900213) is null then skip('too close to midnight', 1) else
  throws_like($$ select public.instructor_check_in(900213, '00000000-0000-4000-b000-000000000212/900213/checkin.jpg') $$,
              'INVALID_STATE: the session is over%', 'not after the session ended') end;
select case when tests.row(900214) is null then skip('too close to midnight', 1) else
  is((public.instructor_check_out(900214, '00000000-0000-4000-b000-000000000212/900214/checkout.jpg')).checkout_late, true,
     'checking out 20 minutes after the end is late, but works') end;
select case when tests.row(900215) is null then skip('too close to midnight', 1) else
  is((public.instructor_check_out(900215, '00000000-0000-4000-b000-000000000212/900215/checkout.jpg')).checkout_late, false,
     'checking out early is fine') end;

-- Staff corrections
select throws_like($$ select public.session_edit_check(900215, now() - interval '1 hour', now(), null, 'x') $$,
  'FORBIDDEN:%', 'the teacher can''t correct their own times');
select tests.login_as('00000000-0000-4000-b000-000000000211');
select throws_like($$ select public.session_edit_check(900215, now() - interval '1 hour', now(), null, '') $$,
  'INVALID_INPUT:%', 'a correction needs a reason');
select throws_like($$ select public.session_edit_check(900215, now(), now() - interval '1 hour', null, 'Typo') $$,
  'INVALID_INPUT:%', 'check-out comes after check-in');
select case when tests.row(900214) is null then skip('too close to midnight', 1) else
  is((public.session_edit_check(900214, now() - interval '70 minutes', now() - interval '20 minutes', false, 'Studio kept her for a parent meeting')).checkout_late,
     false, 'staff excuse a late check-out') end;
select case when tests.row(900214) is null then skip('too close to midnight', 1) else
  is((tests.logged(900214)).changes -> 'checkout_late' ->> 'from', 'true', 'the log keeps what it was') end;
select case when tests.row(900211) is null then skip('too close to midnight', 1) else
  is((public.session_edit_check(900211, now() - interval '5 minutes', null, null, 'Checked in at the desk')).status::text,
     'in_progress', 'staff record a check-in for the teacher') end;
select case when tests.row(900211) is null then skip('too close to midnight', 1) else
  is((tests.logged(900211)).meta ->> 'reason', 'Checked in at the desk', 'with the reason in the log') end;

select * from finish();
rollback;
