-- =============================================================================
-- Paid in full = completed — api-contract §3 bookings (status)
--
--   An approved booking becomes `completed` by itself once everything is paid (bank transfer, cash, a
--   staff-created booking paid on the spot); before it starts, a completed booking that isn't paid in full
--   (money taken back, or the status picked by hand) is `approved`. Once it has started staff can still mark
--   it completed by hand, paid or not.
--   A completed booking ahead still holds its room: the room checks (free slots, booking rules, make-up and
--   timetable clashes, reopening a cancelled session) count it like an approved one. The overlap
--   constraint keeps covering pending / approved (older completed bookings overlap); the booking rules
--   check completed ones ahead under the same room lock.
-- =============================================================================

create function private.booking_auto_complete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_paid boolean := coalesce(new.full_payment, 0) > 0
                    and coalesce(new.bank_transfer, 0) + coalesce(new.cash, 0) >= new.full_payment;
begin
  if new.status = 'approved' and v_paid then
    new.status := 'completed';
  elsif new.status = 'completed' and not v_paid and private.booking_starts_at(new) > now() then
    -- Ahead of its time, completed means paid in full: anything less is approved (money taken back, or the
    -- status picked by hand in the booking form). Once it has started staff may complete it as they like.
    new.status := 'approved';
  end if;
  return new;
end;
$$;

-- Named to run before the other before-triggers (booking_price, booking_status_money, check_booking_rules).
create trigger booking_auto_complete before insert or update on public.bookings
  for each row execute function private.booking_auto_complete();

revoke execute on function private.booking_auto_complete() from public, anon, authenticated;

-- Approved bookings already paid in full.
update public.bookings b
   set status = 'completed'
 where b.status = 'approved' and coalesce(b.full_payment, 0) > 0
   and coalesce(b.bank_transfer, 0) + coalesce(b.cash, 0) >= b.full_payment;

-- -----------------------------------------------------------------------------
-- Room checks: a completed booking ahead holds its room (same definitions, one condition wider)
-- -----------------------------------------------------------------------------
create or replace function private.assert_schedule_slot_free(
  p_room_id     bigint,
  p_schedule_id bigint,
  p_class_id    bigint,
  p_day_of_week smallint,
  p_start       time,
  p_end         time
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_other record;
begin
  if p_room_id is null then
    return;  -- a class without a room blocks nothing
  end if;
  perform private.lock_room(p_room_id);

  select c.name, s.start_time, s.end_time into v_other
  from public.class_schedules s
  join public.classes c on c.id = s.class_id
  where c.room_id = p_room_id
    and s.day_of_week = p_day_of_week
    and s.id is distinct from p_schedule_id
    and not (s.class_id = p_class_id and s.start_time = p_start)
    and s.start_time < p_end
    and s.end_time > p_start
  limit 1;
  if found then
    raise exception 'SLOT_TAKEN: overlaps class "%" (%–%) in the same room',
      v_other.name, to_char(v_other.start_time, 'HH24:MI'), to_char(v_other.end_time, 'HH24:MI');
  end if;

  select b.date, b.start_time, b.end_time into v_other
  from public.bookings b
  where b.room_id = p_room_id
    and b.status in ('pending', 'approved', 'completed')
    and b.date >= public.studio_today()
    and extract(isodow from b.date) = p_day_of_week
    and b.start_time < p_end
    and b.end_time > p_start
  order by b.date
  limit 1;
  if found then
    raise exception 'SLOT_TAKEN: overlaps a booking on % (%–%)',
      v_other.date, to_char(v_other.start_time, 'HH24:MI'), to_char(v_other.end_time, 'HH24:MI');
  end if;
end;
$$;

create or replace function private.room_clash_on(p_room bigint, p_date date, p_start time, p_end time, p_skip_class bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_what text;
begin
  if p_room is null then
    return null;
  end if;
  select format('a booking %s–%s', to_char(b.start_time, 'HH24:MI'), to_char(b.end_time, 'HH24:MI')) into v_what
    from public.bookings b
   where b.room_id = p_room and b.date = p_date and b.status in ('pending', 'approved', 'completed')
     and b.start_time < p_end and b.end_time > p_start
   limit 1;
  if v_what is not null then return v_what; end if;

  select format('class "%s" %s–%s', c.name, to_char(s.start_time, 'HH24:MI'), to_char(s.end_time, 'HH24:MI')) into v_what
    from public.class_schedules s
    join public.classes c on c.id = s.class_id
   where c.room_id = p_room and c.id is distinct from p_skip_class
     and s.day_of_week = extract(isodow from p_date)
     and c.starts_on <= p_date and (c.ended_on is null or c.ended_on >= p_date)
     and s.start_time < p_end and s.end_time > p_start
     and not exists (select 1 from public.instructor_attendance a
                      where a.class_id = c.id and a.date = p_date and a.status = 'cancelled')
   limit 1;
  if v_what is not null then return v_what; end if;

  select format('a make-up session of "%s" %s–%s', c.name, to_char(a.start_time, 'HH24:MI'), to_char(a.end_time, 'HH24:MI')) into v_what
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
   where a.room_id = p_room and a.date = p_date and a.is_extra and a.status <> 'cancelled'
     and a.class_id is distinct from p_skip_class
     and a.start_time < p_end and a.end_time > p_start
   limit 1;
  return v_what;
end;
$$;

create or replace function public.get_available_slots(p_date date)
returns table (room_id bigint, room_name text, start_time time, end_time time)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (
    select public.studio_today()                                as today,
           (now() at time zone 'Asia/Ho_Chi_Minh')::time        as now_local
  ),
  grid as (
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
          and b.status in ('pending', 'approved', 'completed')
          and b.start_time < grid.slot_end
          and b.end_time > grid.slot_start
      )
      and private.class_holds_room(r.id, p_date, grid.slot_start, grid.slot_end) is null
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

create or replace function private.guard_session_reopen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room bigint;
  v_start time;
  v_end time;
  v_booking text;
begin
  if old.status <> 'cancelled' or new.status = 'cancelled' then
    return new;
  end if;
  if new.is_extra then
    v_room := new.room_id;
    v_start := new.start_time;
    v_end := new.end_time;
  else
    select c.room_id, s.start_time, s.end_time into v_room, v_start, v_end
      from public.classes c
      join public.class_schedules s on s.class_id = c.id and s.day_of_week = extract(isodow from new.date)
     where c.id = new.class_id
     order by s.start_time
     limit 1;
  end if;
  if v_room is null or v_start is null then
    return new;
  end if;
  perform private.lock_room(v_room);
  select format('%s–%s', to_char(b.start_time, 'HH24:MI'), to_char(b.end_time, 'HH24:MI')) into v_booking
    from public.bookings b
   where b.room_id = v_room and b.date = new.date and b.status in ('pending', 'approved', 'completed')
     and b.start_time < v_end and b.end_time > v_start
   limit 1;
  if v_booking is not null then
    raise exception 'SLOT_TAKEN: the room was booked % that day after the session was cancelled', v_booking;
  end if;
  return new;
end;
$$;

create or replace function private.check_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class text;
begin
  if new.end_time <= new.start_time then
    raise exception 'INVALID_INPUT: end time must be after start time';
  end if;
  if new.start_time < time '08:00' or new.end_time > time '22:00' then
    raise exception 'INVALID_INPUT: bookings must be between 08:00 and 22:00';
  end if;
  if extract(minute from new.start_time) not in (0, 30) or extract(second from new.start_time) <> 0
     or extract(minute from new.end_time) not in (0, 30) or extract(second from new.end_time) <> 0
  then
    raise exception 'INVALID_INPUT: start and end must be on the half hour (HH:00 or HH:30)';
  end if;

  -- A booking paid in full ahead ('completed') holds its room like an approved one.
  if new.status in ('pending', 'approved') or (new.status = 'completed' and new.date >= public.studio_today()) then
    perform private.lock_room(new.room_id);
    v_class := private.class_holds_room(new.room_id, new.date, new.start_time, new.end_time);
    if v_class is not null then
      raise exception 'SLOT_TAKEN: the room is reserved for class "%" at that time', v_class;
    end if;
    -- The overlap constraint covers pending / approved; a completed one ahead is checked here.
    if exists (select 1 from public.bookings b
                where b.room_id = new.room_id and b.date = new.date and b.id <> new.id
                  and b.start_time < new.end_time and b.end_time > new.start_time
                  and (b.status = 'completed' or (new.status = 'completed' and b.status in ('pending', 'approved')))) then
      raise exception 'SLOT_TAKEN: the room is already booked at that time';
    end if;
  end if;
  return new;
end;
$$;
