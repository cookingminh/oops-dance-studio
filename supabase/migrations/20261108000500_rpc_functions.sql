-- =============================================================================
-- 05 · RPC functions  (supabase.rpc(name, args))
-- Contract: docs/architecture/api-contract.md §5
--
-- Every function: security definer, set search_path = '', own role check.
-- Errors: `raise exception '<CODE>: message'` with CODE in
--   FORBIDDEN | NOT_FOUND | INVALID_STATE | INVALID_INPUT | SLOT_TAKEN | PAST_DATE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Public lookups
-- -----------------------------------------------------------------------------

-- Merged free windows per room between 08:00 and 22:00 on a 30-minute grid.
-- Blocked by: pending/approved bookings on p_date, and class schedules of
-- classes in that room on isodow(p_date) (ISO: 1 = Mon … 7 = Sun).
-- Past dates return nothing; for today, slots that already started are dropped.
-- Rooms with no free slot return no row.
create or replace function public.get_available_slots(p_date date)
returns table (room_id bigint, room_name text, start_time time, end_time time)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (
    select extract(isodow from p_date)::int                    as dow,
           public.studio_today()                                as today,
           (now() at time zone 'Asia/Ho_Chi_Minh')::time        as now_local
  ),
  grid as (
    -- 28 half-hour slots: 08:00–08:30 … 21:30–22:00
    select g.i,
           time '08:00' + g.i * interval '30 minutes'       as slot_start,
           time '08:00' + (g.i + 1) * interval '30 minutes' as slot_end
    from generate_series(0, 27) as g(i)
  ),
  free as (
    select r.id as rid, r.name as rname, grid.i, grid.slot_start, grid.slot_end
    from public.rooms r
    cross join grid
    cross join ctx
    where (p_date > ctx.today or (p_date = ctx.today and grid.slot_start >= ctx.now_local))
      and not exists (
        select 1 from public.bookings b
        where b.room_id = r.id
          and b.date = p_date
          and b.status in ('pending', 'approved')
          and b.start_time < grid.slot_end
          and b.end_time > grid.slot_start
      )
      and not exists (
        select 1
        from public.class_schedules s
        join public.classes c on c.id = s.class_id
        where c.room_id = r.id
          and s.day_of_week = ctx.dow
          and s.start_time < grid.slot_end
          and s.end_time > grid.slot_start
      )
  ),
  islands as (
    select free.*, free.i - row_number() over (partition by free.rid order by free.i) as grp
    from free
  )
  select islands.rid, islands.rname, min(islands.slot_start), max(islands.slot_end)
  from islands
  group by islands.rid, islands.rname, islands.grp
  order by islands.rid, min(islands.slot_start);
$$;

-- Homepage catalogue: exposes instructor name/avatar without opening profiles.
create or replace function public.list_public_classes()
returns table (
  id                     bigint,
  name                   text,
  price                  numeric,
  lesson                 text,
  image_path             text,
  room_name              text,
  instructor_name        text,
  instructor_avatar_path text,
  schedules              jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         c.name,
         c.price,
         c.lesson,
         c.image_path,
         r.name,
         p.full_name,
         p.avatar_path,
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'day_of_week', s.day_of_week,
                       'start_time',  s.start_time,
                       'end_time',    s.end_time)
                     order by s.day_of_week, s.start_time)
            from public.class_schedules s
            where s.class_id = c.id),
           '[]'::jsonb)
  from public.classes c
  join public.profiles p on p.id = c.instructor_id
  left join public.rooms r on r.id = c.room_id
  order by c.name;
$$;

-- Sign-up form helper: usernames are unique, and a clash would otherwise
-- surface only as GoTrue's generic "Database error saving new user".
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p_username), '') is not null
     and not exists (
       select 1 from public.profiles p where p.username = btrim(p_username)
     );
$$;

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------

-- Books for the caller (status pending), or — staff only — for p_guest_id
-- (status approved: staff took the booking themselves).
-- Start and end must be on the half hour.
-- Amounts are computed here, never taken from the client:
--   full_payment = rooms.price (VND/hour) × duration in hours
--   deposit      = 50 % of full_payment
create or replace function public.create_booking(
  p_room_id  bigint,
  p_date     date,
  p_start    time,
  p_end      time,
  p_details  text default null,
  p_guest_id uuid default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_guest  uuid;
  v_status public.booking_status := 'pending'::public.booking_status;
  v_price  numeric;
  v_total  numeric;
  v_row    public.bookings;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN: sign in to book a room';
  end if;

  v_guest := coalesce(p_guest_id, v_uid);
  if v_guest <> v_uid then
    if not public.is_staff() then
      raise exception 'FORBIDDEN: only staff can book for another user';
    end if;
    if not exists (select 1 from public.profiles p where p.id = v_guest) then
      raise exception 'NOT_FOUND: user % not found', v_guest;
    end if;
  end if;
  if p_guest_id is not null and public.is_staff() then
    v_status := 'approved'::public.booking_status;
  end if;

  if p_room_id is null or p_date is null or p_start is null or p_end is null then
    raise exception 'INVALID_INPUT: room, date, start and end are required';
  end if;
  if p_end <= p_start then
    raise exception 'INVALID_INPUT: end time must be after start time';
  end if;
  if p_start < time '08:00' or p_end > time '22:00' then
    raise exception 'INVALID_INPUT: bookings must be between 08:00 and 22:00';
  end if;
  if extract(minute from p_start) not in (0, 30) or extract(second from p_start) <> 0
     or extract(minute from p_end) not in (0, 30) or extract(second from p_end) <> 0
  then
    raise exception 'INVALID_INPUT: start and end must be on the half hour (HH:00 or HH:30)';
  end if;

  if p_date < public.studio_today()
     or (p_date = public.studio_today() and p_start < (now() at time zone 'Asia/Ho_Chi_Minh')::time)
  then
    raise exception 'PAST_DATE: cannot book a time in the past';
  end if;

  select r.price into v_price from public.rooms r where r.id = p_room_id;
  if not found then
    raise exception 'NOT_FOUND: room % does not exist', p_room_id;
  end if;
  v_total := round(v_price * extract(epoch from (p_end - p_start)) / 3600);

  -- Class overlap → SLOT_TAKEN from trigger private.check_booking_rules.
  -- Booking overlap → exclusion constraint bookings_no_overlap.
  begin
    insert into public.bookings (room_id, guest_id, date, start_time, end_time, status,
                                 full_payment, deposit, details)
    values (p_room_id, v_guest, p_date, p_start, p_end, v_status,
            v_total, round(v_total * 0.5), nullif(btrim(p_details), ''))
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN: the room is already booked at that time';
  end;

  return v_row;
end;
$$;

-- Owner may cancel while pending; staff may cancel pending/approved.
create or replace function public.cancel_booking(p_booking_id bigint)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_staff boolean := public.is_staff() or private.is_service_context();
  v_row   public.bookings;
begin
  if v_uid is null and not v_staff then
    raise exception 'FORBIDDEN: sign in to cancel a booking';
  end if;

  select * into v_row from public.bookings b where b.id = p_booking_id for update;
  -- Other users' bookings are reported as missing (do not leak existence).
  if not found or (v_row.guest_id is distinct from v_uid and not v_staff) then
    raise exception 'NOT_FOUND: booking % not found', p_booking_id;
  end if;

  if v_staff then
    if v_row.status not in ('pending', 'approved') then
      raise exception 'INVALID_STATE: booking is already %', v_row.status;
    end if;
  elsif v_row.status <> 'pending' then
    raise exception 'INVALID_STATE: only pending bookings can be cancelled (status: %)', v_row.status;
  end if;

  update public.bookings b
     set status = 'cancelled'
   where b.id = p_booking_id
  returning * into v_row;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Instructor attendance
-- Proof photo must already be uploaded to bucket attendance-proofs at
--   {instructor_id}/{attendance_id}/{checkin|checkout}.{jpg|jpeg|png|webp}
-- checkin_at / checkout_at are always set server-side.
-- -----------------------------------------------------------------------------
create or replace function private.assert_attendance_proof(
  p_instructor_id uuid,
  p_attendance_id bigint,
  p_phase         text,
  p_proof_path    text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_proof_path is null
     or p_proof_path !~ ('^' || p_instructor_id::text || '/' || p_attendance_id::text || '/' || p_phase || '\.(jpg|jpeg|png|webp)$')
  then
    raise exception 'INVALID_INPUT: proof path must be %/%/%.{jpg|jpeg|png|webp}',
      p_instructor_id, p_attendance_id, p_phase;
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'attendance-proofs' and o.name = p_proof_path
  ) then
    raise exception 'INVALID_INPUT: proof photo % has not been uploaded', p_proof_path;
  end if;
end;
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

  update public.instructor_attendance a
     set status = 'completed',
         checkout_at = now(),
         checkout_proof_path = p_proof_path
   where a.id = p_attendance_id
  returning * into v_row;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Attendance generation (idempotent; return = rows created)
-- Callers: staff, pg_cron / service role.
-- -----------------------------------------------------------------------------

-- One instructor_attendance row per (class, scheduled date) in the ISO week
-- containing p_week_start (normalised to its Monday). Null → this week.
create or replace function public.generate_instructor_attendance(p_week_start date default null)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_monday date;
  v_count  int;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: staff only';
  end if;

  v_monday := date_trunc('week', coalesce(p_week_start, public.studio_today()))::date;

  insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status)
  select distinct on (c.id, v_monday + (s.day_of_week - 1))
         c.id, c.instructor_id, c.room_id, v_monday + (s.day_of_week - 1), 'pending'
  from public.classes c
  join public.class_schedules s on s.class_id = c.id
  order by c.id, v_monday + (s.day_of_week - 1)
  on conflict (class_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- One student_attendance row per enrolled student for every class scheduled
-- on p_date's weekday. Null → today. Students who joined after p_date are skipped.
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
  where cs.joined_at <= v_date
    and exists (
      select 1 from public.class_schedules s
      where s.class_id = cs.class_id
        and s.day_of_week = extract(isodow from v_date)
    )
  on conflict (class_id, student_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: admin only';
  end if;
  if p_user is null or p_role is null then
    raise exception 'INVALID_INPUT: user and role are required';
  end if;

  -- Invariants (last admin, instructor with classes) live in the
  -- private.guard_profile_changes trigger so they hold for every write path.
  update public.profiles p
     set role = p_role
   where p.id = p_user
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND: user % not found', p_user;
  end if;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Stats
-- -----------------------------------------------------------------------------

-- Staff dashboard. Month = current calendar month in studio time.
--   monthly_booking_count  bookings dated this month, excluding cancelled/rejected
--   total_students         distinct enrolled students
--   classes_today          distinct classes scheduled on today's weekday
--   revenue_this_month     sum(real_income) of approved/completed bookings this month
create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today       date := public.studio_today();
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end   date := (date_trunc('month', v_today) + interval '1 month')::date;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: staff only';
  end if;

  return jsonb_build_object(
    'monthly_booking_count', (
      select count(*) from public.bookings b
      where b.date >= v_month_start and b.date < v_month_end
        and b.status not in ('cancelled', 'rejected')),
    'total_students', (
      select count(distinct cs.student_id) from public.class_students cs),
    'classes_today', (
      select count(distinct s.class_id) from public.class_schedules s
      where s.day_of_week = extract(isodow from v_today)),
    'revenue_this_month', (
      select coalesce(sum(b.real_income), 0) from public.bookings b
      where b.date >= v_month_start and b.date < v_month_end
        and b.status in ('approved', 'completed'))
  );
end;
$$;

-- Personal stats for the caller.
--   instructor        {class_count, completed_sessions}
--   everyone else     {class_count, attended_count, absent_count}
create or replace function public.my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'FORBIDDEN: sign in required';
  end if;

  if public.current_app_role() = 'instructor' then
    return jsonb_build_object(
      'class_count', (select count(*) from public.classes c where c.instructor_id = v_uid),
      'completed_sessions', (
        select count(*) from public.instructor_attendance a
        where a.instructor_id = v_uid and a.status = 'completed')
    );
  end if;

  return jsonb_build_object(
    'class_count', (select count(*) from public.class_students cs where cs.student_id = v_uid),
    'attended_count', (
      select count(*) from public.student_attendance sa
      where sa.student_id = v_uid and sa.status = 'attend'),
    'absent_count', (
      select count(*) from public.student_attendance sa
      where sa.student_id = v_uid and sa.status = 'absent')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges: nothing is executable unless granted here.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.get_available_slots(date),
  public.list_public_classes(),
  public.is_username_available(text),
  public.create_booking(bigint, date, time, time, text, uuid),
  public.cancel_booking(bigint),
  public.instructor_check_in(bigint, text),
  public.instructor_check_out(bigint, text),
  public.generate_instructor_attendance(date),
  public.generate_student_attendance(date),
  public.admin_set_role(uuid, public.app_role),
  public.dashboard_stats(),
  public.my_stats()
from public, anon, authenticated;

grant execute on function
  public.get_available_slots(date),
  public.list_public_classes(),
  public.is_username_available(text)
to anon, authenticated, service_role;

grant execute on function
  public.create_booking(bigint, date, time, time, text, uuid),
  public.cancel_booking(bigint),
  public.instructor_check_in(bigint, text),
  public.instructor_check_out(bigint, text),
  public.generate_instructor_attendance(date),
  public.generate_student_attendance(date),
  public.admin_set_role(uuid, public.app_role),
  public.dashboard_stats(),
  public.my_stats()
to authenticated, service_role;

revoke execute on all functions in schema private from public, anon, authenticated;
