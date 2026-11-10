-- A cancelled class session frees its room (api-contract §5 Bookings).
--
-- Bookings, free slots and the bookings calendar now agree with make-up sessions (room_clash_on): a class
-- holds its room on its weekly slot only while it runs (starts_on … ended_on) and not on a day its session
-- was cancelled. Reopening a cancelled session whose slot has been booked meanwhile is refused (SLOT_TAKEN)
-- so a room is never double-booked.

-- Does a class hold the room on p_date between p_start and p_end? → the class name, or null.
create function private.class_holds_room(p_room bigint, p_date date, p_start time, p_end time)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.name
    from public.class_schedules s
    join public.classes c on c.id = s.class_id
   where c.room_id = p_room
     and s.day_of_week = extract(isodow from p_date)
     and s.start_time < p_end and s.end_time > p_start
     and (c.starts_on is null or c.starts_on <= p_date) and (c.ended_on is null or c.ended_on >= p_date)
     and not exists (select 1 from public.instructor_attendance a
                      where a.class_id = c.id and a.date = p_date and a.status = 'cancelled' and not a.is_extra)
  union all
  select c.name
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
   where a.room_id = p_room and a.date = p_date and a.is_extra and a.status <> 'cancelled'
     and a.start_time < p_end and a.end_time > p_start
  limit 1;
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

  if new.status in ('pending', 'approved') then
    perform private.lock_room(new.room_id);
    v_class := private.class_holds_room(new.room_id, new.date, new.start_time, new.end_time);
    if v_class is not null then
      raise exception 'SLOT_TAKEN: the room is reserved for class "%" at that time', v_class;
    end if;
  end if;
  return new;
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
          and b.status in ('pending', 'approved')
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

-- Bringing a cancelled session back: its slot may have been booked in the meantime.
create function private.guard_session_reopen()
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
   where b.room_id = v_room and b.date = new.date and b.status in ('pending', 'approved')
     and b.start_time < v_end and b.end_time > v_start
   limit 1;
  if v_booking is not null then
    raise exception 'SLOT_TAKEN: the room was booked % that day after the session was cancelled', v_booking;
  end if;
  return new;
end;
$$;

create trigger guard_session_reopen
  before update of status on public.instructor_attendance
  for each row execute function private.guard_session_reopen();

revoke execute on function private.class_holds_room(bigint, date, time, time), private.guard_session_reopen()
  from public, anon, authenticated;
