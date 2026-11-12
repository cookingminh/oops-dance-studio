-- Sessions and roll calls follow changes made after the scheduled jobs ran.
--
-- The Monday 00:00 job makes the week's sessions and the 00:05 job today's roll calls. Until now a change made
-- later (a class created or a weekly session added mid-week, a student joining after 00:05) waited for the
-- next run, unless staff pressed "Create this week's records" / "Create today's roll calls". Now:
--   * a weekly session added, moved or removed → that class's sessions for the rest of this week follow: the
--     missing ones are made (from now on: a day already past, or today's session that has already started,
--     is left alone — nothing to review for a session that never happened), and the untouched ones that no
--     longer fit any weekly session are removed (still pending, not a make-up, no check-in, no student marked);
--   * a class's first day or last day changes (an upcoming class brought forward, a class reopened) → the same;
--   * a student joins a class that meets today and whose session hasn't finished → they are on today's roll call.
-- Done behind the change that caused it, so the Activity page shows that change, not each session.
-- The jobs and the "create" RPCs stay (a catch-up for data from before, or a day the jobs didn't run).

-- Studio time of day, for "today's session has already started".
create function private.studio_time_now()
returns time
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::time; $$;

-- One class: the rest of this week's sessions as its weekly sessions say, and today's roll call.
create function private.class_catch_up(p_class bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today  date := public.studio_today();
  v_monday date := date_trunc('week', public.studio_today())::date;
  v_sunday date := date_trunc('week', public.studio_today())::date + 6;
  v_now    time := private.studio_time_now();
  v_quiet  text := current_setting('oops.activity', true);
begin
  perform set_config('oops.activity', 'off', true);

  -- Missing sessions, from now on.
  insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status)
  select distinct on (c.id, v_monday + (s.day_of_week - 1))
         c.id, c.instructor_id, c.room_id, v_monday + (s.day_of_week - 1), 'pending'
    from public.classes c
    join public.class_schedules s on s.class_id = c.id
   where c.id = p_class
     and (v_monday + (s.day_of_week - 1) > v_today
          or (v_monday + (s.day_of_week - 1) = v_today and s.start_time > v_now))
     and v_monday + (s.day_of_week - 1) >= c.starts_on
     and (c.ended_on is null or v_monday + (s.day_of_week - 1) <= c.ended_on)
   order by c.id, v_monday + (s.day_of_week - 1), s.start_time
  on conflict (class_id, date) do nothing;

  -- Untouched sessions from now on that no weekly session (or the class's run) asks for any more.
  delete from public.student_attendance sa
   using public.instructor_attendance a
   where a.class_id = p_class and sa.class_id = a.class_id and sa.date = a.date
     and a.date between v_today and v_sunday
     and a.status = 'pending' and not a.is_extra and a.checkin_at is null
     and not exists (select 1 from public.student_attendance m
                      where m.class_id = a.class_id and m.date = a.date and m.status <> 'pending')
     and not private.class_meets_on(a.class_id, a.date);  -- (session_changes: a weekly session that day, inside the run)
  delete from public.instructor_attendance a
   where a.class_id = p_class
     and a.date between v_today and v_sunday
     and a.status = 'pending' and not a.is_extra and a.checkin_at is null
     and not exists (select 1 from public.student_attendance m
                      where m.class_id = a.class_id and m.date = a.date and m.status <> 'pending')
     and not private.class_meets_on(a.class_id, a.date);

  -- Today's roll call, when the class has a session today that is still to come or going on.
  insert into public.student_attendance (class_id, student_id, date, status)
  select cs.class_id, cs.student_id, v_today, 'pending'
    from public.class_students cs
    join public.instructor_attendance a on a.class_id = cs.class_id and a.date = v_today
   where cs.class_id = p_class
     and cs.joined_at <= v_today
     and (cs.leaves_after is null or cs.leaves_after >= v_today)
     and a.status in ('pending', 'waiting', 'in_progress')
  on conflict (class_id, student_id, date) do nothing;

  perform set_config('oops.activity', coalesce(v_quiet, ''), true);
end;
$$;

create function private.schedule_catch_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.class_catch_up(old.class_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.class_id is distinct from old.class_id) then
    perform private.class_catch_up(new.class_id);
  end if;
  return null;
end;
$$;

create trigger schedule_catch_up
  after insert or update of class_id, day_of_week, start_time, end_time or delete on public.class_schedules
  for each row execute function private.schedule_catch_up();

create function private.class_run_catch_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.class_catch_up(new.id);
  return null;
end;
$$;

create trigger class_run_catch_up
  after update of starts_on, ended_on on public.classes
  for each row
  when (old.starts_on is distinct from new.starts_on or old.ended_on is distinct from new.ended_on)
  execute function private.class_run_catch_up();

-- A student who joins today is on today's roll call (when the class's session today isn't over yet).
create function private.enrolment_catch_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
begin
  if new.joined_at > v_today or (new.leaves_after is not null and new.leaves_after < v_today) then
    return null;
  end if;
  insert into public.student_attendance (class_id, student_id, date, status)
  select new.class_id, new.student_id, v_today, 'pending'
    from public.instructor_attendance a
   where a.class_id = new.class_id and a.date = v_today
     and a.status in ('pending', 'waiting', 'in_progress')
  on conflict (class_id, student_id, date) do nothing;
  return null;
end;
$$;

create trigger enrolment_catch_up
  after insert on public.class_students
  for each row execute function private.enrolment_catch_up();

revoke execute on function private.studio_time_now(), private.class_catch_up(bigint),
  private.schedule_catch_up(), private.class_run_catch_up(), private.enrolment_catch_up()
  from public, anon, authenticated;
