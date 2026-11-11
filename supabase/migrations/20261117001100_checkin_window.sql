-- =============================================================================
-- Check-in window and late check-out — api-contract §3 instructor_attendance.checkout_late, §5 Instructor
-- attendance, session_edit_check
--
--   * Check-in opens 15 minutes before the session starts (its own times for a make-up or a moved session,
--     else the class's weekly slot that day) and closes when it ends — after that the studio records it.
--   * Check-out: any time after check-in (early is fine); later than 10 minutes after the end it still works
--     but the session is marked `checkout_late` (a badge for staff).
--   * Staff can correct the check-in / check-out times and the late mark, with a reason; every correction is
--     in the activity log (sessions · check_edited, with before and after).
-- =============================================================================

alter table public.instructor_attendance add column checkout_late boolean not null default false;

-- When a session starts and ends, as moments in time (studio time): its own times, else the weekly slot.
create function private.session_window(a public.instructor_attendance)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select (a.date + coalesce(a.start_time, s.start_time)) at time zone 'Asia/Ho_Chi_Minh',
         (a.date + coalesce(a.end_time, s.end_time)) at time zone 'Asia/Ho_Chi_Minh'
    from (select min(cs.start_time) as start_time, max(cs.end_time) as end_time
            from public.class_schedules cs
           where cs.class_id = a.class_id and cs.day_of_week = extract(isodow from a.date)) s;
$$;

create or replace function public.instructor_check_in(p_attendance_id bigint, p_proof_path text)
returns public.instructor_attendance
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.instructor_attendance;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN: sign in to check in';
  end if;

  select * into v_row from public.instructor_attendance a where a.id = p_attendance_id for update;
  if not found then
    raise exception 'NOT_FOUND: attendance % not found', p_attendance_id;
  end if;
  if v_row.instructor_id <> v_uid then
    raise exception 'FORBIDDEN: this session belongs to another instructor';
  end if;
  if v_row.date <> public.studio_today() then
    raise exception 'INVALID_STATE: check-in is only allowed on the session date (%)', v_row.date;
  end if;
  if v_row.status not in ('pending', 'waiting') then
    raise exception 'INVALID_STATE: cannot check in a session that is %', v_row.status;
  end if;
  perform private.assert_attendance_proof(v_uid, p_attendance_id, 'checkin', p_proof_path);
  select w.starts_at, w.ends_at into v_starts, v_ends from private.session_window(v_row) w;
  if v_starts is not null and now() < v_starts - interval '15 minutes' then
    raise exception 'INVALID_STATE: check-in opens at % (15 minutes before the session)',
      to_char((v_starts - interval '15 minutes') at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI');
  end if;
  if v_ends is not null and now() > v_ends then
    raise exception 'INVALID_STATE: the session is over; ask the studio to record it';
  end if;

  update public.instructor_attendance a
     set status = 'in_progress',
         checkin_at = now(),
         checkin_proof_path = p_proof_path
   where a.id = p_attendance_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.instructor_check_out(p_attendance_id bigint, p_proof_path text)
returns public.instructor_attendance
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.instructor_attendance;
  v_ends timestamptz;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN: sign in to check out';
  end if;

  select * into v_row from public.instructor_attendance a where a.id = p_attendance_id for update;
  if not found then
    raise exception 'NOT_FOUND: attendance % not found', p_attendance_id;
  end if;
  if v_row.instructor_id <> v_uid then
    raise exception 'FORBIDDEN: this session belongs to another instructor';
  end if;
  if v_row.status <> 'in_progress' then
    raise exception 'INVALID_STATE: cannot check out a session that is %', v_row.status;
  end if;

  perform private.assert_attendance_proof(v_uid, p_attendance_id, 'checkout', p_proof_path);
  select w.ends_at into v_ends from private.session_window(v_row) w;

  update public.instructor_attendance a
     set status = 'completed',
         checkout_at = now(),
         checkout_proof_path = p_proof_path,
         -- Early is fine; up to 10 minutes after the end is on time.
         checkout_late = v_ends is not null and now() > v_ends + interval '10 minutes'
   where a.id = p_attendance_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Staff correct a session's check-in / check-out (a forgotten check-out, a wrong time) with a reason.
-- p_checkout_at null leaves it unchecked-out; p_checkout_late null = worked out from the times (more than
-- 10 minutes after the end), true / false = staff decide (e.g. excused). A session with a check-out becomes
-- completed. Logged as sessions · check_edited with the times before and after.
create function public.session_edit_check(p_attendance bigint, p_checkin_at timestamptz, p_checkout_at timestamptz,
                                          p_checkout_late boolean default null, p_reason text default null)
returns public.instructor_attendance
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.instructor_attendance;
  v_before jsonb;
  v_reason text := left(nullif(btrim(p_reason), ''), 300);
  v_ends timestamptz;
  v_late boolean;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can correct a check-in';
  end if;
  if v_reason is null then
    raise exception 'INVALID_INPUT: say why the times change';
  end if;
  select * into v from public.instructor_attendance a where a.id = p_attendance for update;
  if not found then
    raise exception 'NOT_FOUND: session % not found', p_attendance;
  end if;
  if v.status = 'cancelled' then
    raise exception 'INVALID_STATE: the session was called off';
  end if;
  if p_checkin_at is null then
    raise exception 'INVALID_INPUT: a check-in time is needed';
  end if;
  if p_checkout_at is not null and p_checkout_at <= p_checkin_at then
    raise exception 'INVALID_INPUT: check-out comes after check-in';
  end if;

  select w.ends_at into v_ends from private.session_window(v) w;
  v_late := case
    when p_checkout_at is null then false
    when p_checkout_late is not null then p_checkout_late
    else v_ends is not null and p_checkout_at > v_ends + interval '10 minutes' end;
  v_before := jsonb_build_object('checkin_at', v.checkin_at, 'checkout_at', v.checkout_at, 'checkout_late', v.checkout_late,
                                 'status', v.status);

  perform set_config('oops.activity', 'off', true);
  update public.instructor_attendance a
     set checkin_at = p_checkin_at,
         checkout_at = p_checkout_at,
         checkout_late = v_late,
         status = case when p_checkout_at is not null then 'completed'::public.instructor_attendance_status
                       when a.status in ('pending', 'waiting', 'completed') then 'in_progress'::public.instructor_attendance_status
                       else a.status end
   where a.id = v.id
  returning * into v;
  perform set_config('oops.activity', '', true);

  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, class_id, subject_id, label, changes, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'sessions', 'check_edited', 'instructor_attendance', v.id::text, v.class_id, v.instructor_id,
         coalesce(private.class_name(v.class_id), ''),
         (select coalesce(jsonb_object_agg(k, jsonb_build_object('from', v_before -> k, 'to', after -> k)), '{}'::jsonb)
            from (select jsonb_build_object('checkin_at', v.checkin_at, 'checkout_at', v.checkout_at,
                                            'checkout_late', v.checkout_late, 'status', v.status) as after) x,
                 jsonb_object_keys(x.after) k
           where (v_before -> k) is distinct from (x.after -> k)),
         jsonb_strip_nulls(jsonb_build_object('date', v.date, 'instructor', private.person_name(v.instructor_id), 'reason', v_reason,
                                              'start', private.session_start(v.class_id, v.date, v.start_time)));
  return v;
end;
$$;

revoke execute on function private.session_window(public.instructor_attendance) from public, anon, authenticated;
revoke execute on function public.session_edit_check(bigint, timestamptz, timestamptz, boolean, text) from public, anon;
grant execute on function public.session_edit_check(bigint, timestamptz, timestamptz, boolean, text) to authenticated;
