-- =============================================================================
-- Session changes — api-contract §3 instructor_attendance (cancel_reason, makes_up), §5 Session changes
--
--   A storm on Wednesday: staff call the session off (with a reason the class sees) and, in the same step,
--   move it to another day as a make-up. Or close the whole studio for a day. Students and the teacher see
--   it in their schedule and their notifications.
--   * session_cancel()   cancels a class's session on a day — also one ahead whose row doesn't exist yet
--   * session_move()     cancels it and adds the make-up on another day (`makes_up` = the day it replaces);
--                        works for a session already cancelled too (scheduling its make-up later)
--   * studio_close_day() cancels every session that day and, if asked, the room bookings (the studio
--                        cancels them: everything paid goes back, booking_refunds)
--   * my_session_changes() what changed ahead in the caller's classes (as a member or the teacher)
--   The routine's end (and shoot day) follows by itself: a cancelled session doesn't count, a make-up does.
--   A cancelled day gets no roll call; reopening today's session brings it back.
-- =============================================================================

alter table public.instructor_attendance
  add column cancel_reason text check (char_length(cancel_reason) <= 200),
  add column makes_up date;

-- Does the class meet on p_date by its weekly timetable, while it runs?
create function private.class_meets_on(p_class bigint, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.class_schedules s
      join public.classes c on c.id = s.class_id
     where s.class_id = p_class and s.day_of_week = extract(isodow from p_date)
       and (c.starts_on is null or c.starts_on <= p_date) and (c.ended_on is null or c.ended_on >= p_date));
$$;

-- Reopening a cancelled session forgets why it was cancelled; today's gets its roll call back.
create function private.session_reopened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'cancelled' and new.status <> 'cancelled' then
    if tg_when = 'BEFORE' then
      new.cancel_reason := null;
      return new;
    end if;
    if new.date = public.studio_today() then
      insert into public.student_attendance (class_id, student_id, date, status)
      select cs.class_id, cs.student_id, new.date, 'pending'
        from public.class_students cs
       where cs.class_id = new.class_id and cs.joined_at <= new.date
      on conflict (class_id, student_id, date) do nothing;
    end if;
  end if;
  if tg_when = 'BEFORE' then
    return new;
  end if;
  return null;
end;
$$;

create trigger session_reopened_before before update of status on public.instructor_attendance
  for each row execute function private.session_reopened();
create trigger session_reopened_after after update of status on public.instructor_attendance
  for each row execute function private.session_reopened();

-- -----------------------------------------------------------------------------
-- Staff
-- -----------------------------------------------------------------------------

-- Call off a class's session on p_date (today or later; a past day only if it was already called off — its
-- make-up is being scheduled), with the reason the class sees ("Bão lớn").
-- A session ahead whose row isn't there yet is created as cancelled. One that started or happened can't be.
create function public.session_cancel(p_class bigint, p_date date, p_reason text)
returns public.instructor_attendance
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.classes;
  v public.instructor_attendance;
  v_reason text := left(nullif(btrim(p_reason), ''), 200);
  v_found boolean;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can call off a session';
  end if;
  if v_reason is null then
    raise exception 'INVALID_INPUT: say why the session is called off';
  end if;
  select * into c from public.classes where id = p_class;
  if not found then
    raise exception 'NOT_FOUND: no such class';
  end if;
  select * into v from public.instructor_attendance a where a.class_id = p_class and a.date = p_date for update;
  v_found := found;
  -- A past day only when it was already called off (its make-up is being scheduled later).
  if p_date is null or (p_date < public.studio_today() and not private.is_service_context()
                        and coalesce(v.status::text, '') <> 'cancelled') then
    raise exception 'INVALID_INPUT: pick today or a later day';
  end if;

  perform set_config('oops.activity', 'off', true); -- logged below, with the reason
  if v_found then
    if v.status in ('in_progress', 'completed') then
      raise exception 'INVALID_STATE: the session has already started';
    end if;
    update public.instructor_attendance a
       set status = 'cancelled', cancel_reason = v_reason
     where a.id = v.id
    returning * into v;
  else
    if not private.class_meets_on(p_class, p_date) then
      raise exception 'INVALID_STATE: the class doesn''t meet that day';
    end if;
    insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status, cancel_reason)
    values (p_class, c.instructor_id, c.room_id, p_date, 'cancelled', v_reason)
    returning * into v;
  end if;

  -- Nobody is expected that day: unmarked roll calls go (marked ones stay).
  delete from public.student_attendance sa where sa.class_id = p_class and sa.date = p_date and sa.status = 'pending';
  perform set_config('oops.activity', '', true);

  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'sessions', 'cancelled', 'instructor_attendance', v.id::text, v.class_id, v.instructor_id, c.name,
         jsonb_strip_nulls(jsonb_build_object('date', v.date, 'start', private.session_start(v.class_id, v.date, v.start_time),
                                              'make_up', v.is_extra, 'instructor', private.person_name(v.instructor_id),
                                              'reason', v_reason));
  return v;
end;
$$;

-- Move a class's session from p_date to p_new_date at p_start–p_end: it is called off (session_cancel, with
-- p_reason) and a make-up is added (class_add_session: same rules — another day the class doesn't meet, the
-- room free) that says which day it replaces. → { cancelled, make_up }
create function public.session_move(p_class bigint, p_date date, p_new_date date, p_start time, p_end time, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_off public.instructor_attendance;
  v_new public.instructor_attendance;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can move a session';
  end if;
  if p_new_date = p_date then
    raise exception 'INVALID_INPUT: pick another day for the make-up';
  end if;
  v_off := public.session_cancel(p_class, p_date, p_reason);
  v_new := public.class_add_session(p_class, p_new_date, p_start, p_end, null);
  update public.instructor_attendance a set makes_up = p_date where a.id = v_new.id returning * into v_new;
  return jsonb_build_object('cancelled', to_jsonb(v_off), 'make_up', to_jsonb(v_new));
end;
$$;

-- Close the studio on p_date (a storm, a power cut): every class session that day is called off with
-- p_reason and, with p_cancel_bookings, every pending / approved room booking that day is cancelled by the
-- studio (everything paid becomes due back). → { sessions, bookings, classes: [{ class_id, name }] }
create function public.studio_close_day(p_date date, p_reason text, p_cancel_bookings boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := left(nullif(btrim(p_reason), ''), 200);
  v_class record;
  v_booking record;
  v_sessions int := 0;
  v_bookings int := 0;
  v_classes jsonb := '[]'::jsonb;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can close the studio for a day';
  end if;
  if v_reason is null then
    raise exception 'INVALID_INPUT: say why the studio is closed';
  end if;
  if p_date is null or (p_date < public.studio_today() and not private.is_service_context()) then
    raise exception 'INVALID_INPUT: pick today or a later day';
  end if;

  for v_class in
    select c.id, c.name
      from public.classes c
     where (private.class_meets_on(c.id, p_date)
            or exists (select 1 from public.instructor_attendance a where a.class_id = c.id and a.date = p_date))
       and not exists (select 1 from public.instructor_attendance a
                        where a.class_id = c.id and a.date = p_date and a.status in ('cancelled', 'in_progress', 'completed'))
     order by c.name
  loop
    perform public.session_cancel(v_class.id, p_date, v_reason);
    v_sessions := v_sessions + 1;
    v_classes := v_classes || jsonb_build_object('class_id', v_class.id, 'name', v_class.name);
  end loop;

  if coalesce(p_cancel_bookings, true) then
    for v_booking in
      -- A booking paid in full (completed) only while it hasn't started: cancel_booking refuses it after that.
      select b.id from public.bookings b
       where b.date = p_date
         and (b.status in ('pending', 'approved') or (b.status = 'completed' and private.booking_starts_at(b) > now()))
       order by b.start_time
    loop
      perform public.cancel_booking(v_booking.id, true, null, v_reason, null);
      v_bookings := v_bookings + 1;
    end loop;
  end if;

  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'sessions', 'day_closed', 'studio', p_date::text, v_reason,
         jsonb_build_object('date', p_date, 'reason', v_reason, 'sessions', v_sessions, 'bookings', v_bookings);

  return jsonb_build_object('sessions', v_sessions, 'bookings', v_bookings, 'classes', v_classes);
end;
$$;

-- -----------------------------------------------------------------------------
-- The class
-- -----------------------------------------------------------------------------

-- What changed in the caller's classes from today to p_days ahead (students in the class that day, and the
-- teacher): kind 'cancelled' (with its reason) or 'make_up' (with the day it replaces and that day's reason).
create function public.my_session_changes(p_days integer default 21)
returns table (id bigint, class_id bigint, class_name text, date date, kind text, start_time time, end_time time,
               reason text, makes_up date, room_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.class_id, c.name, a.date,
         case when a.status = 'cancelled' then 'cancelled' else 'make_up' end,
         coalesce(a.start_time, (select min(s.start_time) from public.class_schedules s
                                  where s.class_id = a.class_id and s.day_of_week = extract(isodow from a.date))),
         coalesce(a.end_time, (select max(s.end_time) from public.class_schedules s
                                where s.class_id = a.class_id and s.day_of_week = extract(isodow from a.date))),
         case when a.status = 'cancelled' then a.cancel_reason
              else (select o.cancel_reason from public.instructor_attendance o
                     where o.class_id = a.class_id and o.date = a.makes_up and o.status = 'cancelled') end,
         a.makes_up,
         (select r.name from public.rooms r where r.id = coalesce(a.room_id, c.room_id))
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
   where a.date between public.studio_today() and public.studio_today() + least(greatest(coalesce(p_days, 21), 1), 90)
     and (a.status = 'cancelled' or (a.is_extra and a.status <> 'cancelled'))
     and (a.instructor_id = auth.uid() or c.instructor_id = auth.uid()
          or exists (select 1 from public.class_students cs
                      where cs.class_id = a.class_id and cs.student_id = auth.uid() and cs.joined_at <= a.date
                        and (cs.leaves_after is null or cs.leaves_after >= a.date)))
   order by a.date, 6;
$$;

-- -----------------------------------------------------------------------------
-- Roll calls skip a weekly session that was called off (same function, one condition more)
-- -----------------------------------------------------------------------------
create or replace function public.generate_student_attendance(p_date date default null)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_date  date;
  v_count int;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: staff only';
  end if;

  v_date := coalesce(p_date, public.studio_today());

  insert into public.student_attendance (class_id, student_id, date, status)
  select cs.class_id, cs.student_id, v_date, 'pending'
  from public.class_students cs
  join public.classes c on c.id = cs.class_id
  where cs.joined_at <= v_date
    and c.starts_on <= v_date
    and (c.ended_on is null or c.ended_on >= v_date)
    and ((exists (
           select 1 from public.class_schedules s
           where s.class_id = cs.class_id
             and s.day_of_week = extract(isodow from v_date))
          and not exists (
           select 1 from public.instructor_attendance a
           where a.class_id = cs.class_id and a.date = v_date and a.status = 'cancelled' and not a.is_extra))
         or exists (
           select 1 from public.instructor_attendance a
           where a.class_id = cs.class_id and a.date = v_date and a.is_extra and a.status <> 'cancelled'))
  on conflict (class_id, student_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.class_meets_on(bigint, date), private.session_reopened() from public, anon, authenticated;
revoke execute on function public.session_cancel(bigint, date, text), public.session_move(bigint, date, date, time, time, text),
  public.studio_close_day(date, text, boolean), public.my_session_changes(integer) from public, anon;
grant execute on function public.session_cancel(bigint, date, text), public.session_move(bigint, date, date, time, time, text),
  public.studio_close_day(date, text, boolean), public.my_session_changes(integer) to authenticated;
