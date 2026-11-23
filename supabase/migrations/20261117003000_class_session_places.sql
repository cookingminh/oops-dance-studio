-- A class session's own place — api-contract §3 instructor_attendance (own_place, needs_place), §5 class_move_room,
-- class_place_sessions, class_booking_clashes, class_free_rooms
--
-- Moving a class into a room (or adding a weekly session there) was refused outright when one booking somewhere
-- ahead used that room at the class's time: the whole class couldn't move because of one evening. Now the sessions
-- that clash can be dealt with one by one, then the class moves:
--   * a session can have a place of its own for that day: another of the studio's rooms (own_place), or none yet
--     (needs_place: staff must place it; it is on their to-do list until they do);
--   * the class's place changing doesn't move those sessions (class_place_changed), a new session row doesn't take
--     the class's studio when it has a place of its own (session_place);
--   * the room checks follow: a class holds its weekly room except on a day its session is elsewhere or unplaced
--     (class_holds_room, room_clash_on, assert_schedule_slot_free), and holds the room a session was placed in
--     that day;
--   * class_booking_clashes(class, room): the bookings ahead in that room at the class's times, by day, with the
--     rooms still free for the session that day; class_move_room(class, room, places) places those sessions and
--     moves the class in one go; class_place_sessions(class, places) places sessions later (class_free_rooms for one
--     day's choices).
-- A clash with a booking now names it ("… [booking 123]") so the page can open it.

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.instructor_attendance
  add column own_place   boolean not null default false,
  add column needs_place boolean not null default false,
  add constraint instructor_attendance_needs_place check (not needs_place or (own_place and room_id is null and venue_id is null));
comment on column public.instructor_attendance.own_place is
  'The session''s place was set for that day alone (class_place_sessions): it stays when the class moves.';
comment on column public.instructor_attendance.needs_place is
  'The session has no place yet: staff must place it (a to-do until they do). Implies own_place.';
create index instructor_attendance_needs_place_idx on public.instructor_attendance (date) where needs_place;

-- -----------------------------------------------------------------------------
-- Sessions with a place of their own don't follow the class
-- -----------------------------------------------------------------------------
-- A new session without a place takes its class's studio and room (the studio's own room is copied by whoever
-- inserts it) — unless it was given a place of its own (or none yet).
create or replace function private.session_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.room_id is null and new.venue_id is null and not new.own_place then
    select c.venue_id, c.venue_room_id into new.venue_id, new.venue_room_id from public.classes c where c.id = new.class_id;
  end if;
  return new;
end;
$$;

-- The class moved (to a room, to a studio or one of its rooms, or to no place): its sessions not started yet follow,
-- except those with a place of their own.
create or replace function private.class_place_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_logging text := coalesce(current_setting('oops.activity', true), '');
begin
  perform set_config('oops.activity', 'off', true);
  update public.instructor_attendance a
     set room_id = new.room_id, venue_id = new.venue_id, venue_room_id = new.venue_room_id
   where a.class_id = new.id
     and a.status = 'pending'
     and a.checkin_at is null
     and a.date >= public.studio_today()
     and not a.own_place;
  perform set_config('oops.activity', v_logging, true);
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Room checks
-- -----------------------------------------------------------------------------
-- Does a class hold the room on p_date between p_start and p_end? → the class name, or null. Its weekly room,
-- unless that day's session was cancelled or is elsewhere (own_place); a make-up's room; a session placed there
-- that day.
create or replace function private.class_holds_room(p_room bigint, p_date date, p_start time, p_end time)
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
                      where a.class_id = c.id and a.date = p_date and not a.is_extra
                        and (a.status = 'cancelled' or a.own_place))
  union all
  select c.name
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
   where a.room_id = p_room and a.date = p_date and a.is_extra and a.status <> 'cancelled'
     and a.start_time < p_end and a.end_time > p_start
  union all
  select c.name
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
    join public.class_schedules s on s.class_id = c.id and s.day_of_week = extract(isodow from a.date)
   where a.room_id = p_room and a.date = p_date and a.own_place and not a.is_extra and a.status <> 'cancelled'
     and coalesce(a.start_time, s.start_time) < p_end and coalesce(a.end_time, s.end_time) > p_start
  limit 1;
$$;

-- What holds a room on p_date between p_start and p_end (other than class p_skip_class)? → words for the error,
-- or null. Bookings, then classes as class_holds_room counts them.
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
                      where a.class_id = c.id and a.date = p_date and not a.is_extra
                        and (a.status = 'cancelled' or a.own_place))
   limit 1;
  if v_what is not null then return v_what; end if;

  select format('a make-up session of "%s" %s–%s', c.name, to_char(a.start_time, 'HH24:MI'), to_char(a.end_time, 'HH24:MI')) into v_what
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
   where a.room_id = p_room and a.date = p_date and a.is_extra and a.status <> 'cancelled'
     and a.class_id is distinct from p_skip_class
     and a.start_time < p_end and a.end_time > p_start
   limit 1;
  if v_what is not null then return v_what; end if;

  select format('a session of "%s" %s–%s placed there that day', c.name, to_char(coalesce(a.start_time, s.start_time), 'HH24:MI'),
                to_char(coalesce(a.end_time, s.end_time), 'HH24:MI')) into v_what
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
    join public.class_schedules s on s.class_id = c.id and s.day_of_week = extract(isodow from a.date)
   where a.room_id = p_room and a.date = p_date and a.own_place and not a.is_extra and a.status <> 'cancelled'
     and a.class_id is distinct from p_skip_class
     and coalesce(a.start_time, s.start_time) < p_end and coalesce(a.end_time, s.end_time) > p_start
   limit 1;
  return v_what;
end;
$$;

-- A weekly session in a room: no other class there at that time, and no booking ahead on one of the class's days
-- (while it runs; not a day its session is called off or placed elsewhere). The booking is named: "[booking 123]".
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
  c public.classes;
begin
  if p_room_id is null then
    return;  -- a class without a room blocks nothing
  end if;
  perform private.lock_room(p_room_id);
  select * into c from public.classes where id = p_class_id;

  select x.name, s.start_time, s.end_time into v_other
  from public.class_schedules s
  join public.classes x on x.id = s.class_id
  where x.room_id = p_room_id
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

  select b.id, b.date, b.start_time, b.end_time into v_other
  from public.bookings b
  where b.room_id = p_room_id
    and b.status in ('pending', 'approved', 'completed')
    and b.date >= public.studio_today()
    and extract(isodow from b.date) = p_day_of_week
    and b.start_time < p_end
    and b.end_time > p_start
    and (c.starts_on is null or b.date >= c.starts_on)
    and (c.ended_on is null or b.date <= c.ended_on)
    and not exists (select 1 from public.instructor_attendance a
                     where a.class_id = p_class_id and a.date = b.date and not a.is_extra
                       and (a.status = 'cancelled' or a.own_place))
  order by b.date
  limit 1;
  if found then
    raise exception 'SLOT_TAKEN: overlaps a booking on % (%–%) [booking %]',
      v_other.date, to_char(v_other.start_time, 'HH24:MI'), to_char(v_other.end_time, 'HH24:MI'), v_other.id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Placing a session
-- -----------------------------------------------------------------------------
-- The studio rooms free for class p_class's session on p_date (its weekly times that day), other than p_except:
-- [{ id, name }] by room.
create function private.free_rooms_for(p_class bigint, p_date date, p_except bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name) order by r.id), '[]'::jsonb)
    from public.rooms r
    cross join (select min(s.start_time) as st, max(s.end_time) as en
                  from public.class_schedules s
                 where s.class_id = p_class and s.day_of_week = extract(isodow from p_date)) t
   where r.id is distinct from p_except and t.st is not null
     and private.room_clash_on(r.id, p_date, t.st, t.en, p_class) is null;
$$;

-- One session of p_class on p_date gets a place of its own: studio room p_room, or none yet (null → needs_place).
-- The day must be one the class meets, today or later, and its session not started or called off; the room free
-- then (SLOT_TAKEN otherwise). → the session.
create function private.place_session(p_class bigint, p_date date, p_room bigint)
returns public.instructor_attendance
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.classes;
  v public.instructor_attendance;
  v_start time;
  v_end time;
  v_clash text;
begin
  select * into c from public.classes where id = p_class;
  if not found then
    raise exception 'NOT_FOUND: no such class';
  end if;
  if p_date is null or p_date < public.studio_today() then
    raise exception 'INVALID_INPUT: pick today or a later day';
  end if;
  if not private.class_meets_on(p_class, p_date) then
    raise exception 'INVALID_INPUT: % has no session on %', c.name, p_date;
  end if;
  select min(s.start_time), max(s.end_time) into v_start, v_end
    from public.class_schedules s where s.class_id = p_class and s.day_of_week = extract(isodow from p_date);
  if p_room is not null then
    if not exists (select 1 from public.rooms r where r.id = p_room) then
      raise exception 'NOT_FOUND: room % does not exist', p_room;
    end if;
    perform private.lock_room(p_room);
    v_clash := private.room_clash_on(p_room, p_date, v_start, v_end, p_class);
    if v_clash is not null then
      raise exception 'SLOT_TAKEN: on % the room has %', p_date, v_clash;
    end if;
  end if;
  select * into v from public.instructor_attendance a where a.class_id = p_class and a.date = p_date for update;
  if found and (v.is_extra or v.status <> 'pending' or v.checkin_at is not null) then
    raise exception 'INVALID_STATE: the session on % has started, is a make-up or was called off', p_date;
  end if;
  insert into public.instructor_attendance (class_id, instructor_id, room_id, venue_id, venue_room_id, date, status,
                                            own_place, needs_place)
  values (p_class, c.instructor_id, p_room, null, null, p_date, 'pending', true, p_room is null)
  on conflict (class_id, date) do update
    set room_id = excluded.room_id, venue_id = null, venue_room_id = null, own_place = true,
        needs_place = excluded.needs_place
  returning * into v;
  return v;
end;
$$;

-- Staff: places sessions of a class, each day on its own: p_places = [{ "date": "yyyy-mm-dd", "room_id": 2 | null }]
-- (null: no place yet — a to-do for staff). All or nothing. → how many were placed.
create function public.class_place_sessions(p_class bigint, p_places jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  x record;
  v_n integer := 0;
  v_logging text := coalesce(current_setting('oops.activity', true), '');
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can place a session';
  end if;
  if p_places is null or jsonb_typeof(p_places) <> 'array' then
    raise exception 'INVALID_INPUT: pass the days to place as a list';
  end if;
  perform set_config('oops.activity', 'off', true);
  for x in select * from jsonb_to_recordset(p_places) as t(date date, room_id bigint) loop
    perform private.place_session(p_class, x.date, x.room_id);
    v_n := v_n + 1;
  end loop;
  perform set_config('oops.activity', v_logging, true);
  return v_n;
end;
$$;

-- Staff: the class moves into studio room p_room, with the sessions that clash there placed first (p_places as
-- class_place_sessions). A clash left over (another class there, a booking on a day not placed) refuses the move
-- (SLOT_TAKEN) and nothing changes. → the class.
create function public.class_move_room(p_class bigint, p_room bigint, p_places jsonb default '[]'::jsonb)
returns public.classes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.classes;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can move a class';
  end if;
  if p_room is null or not exists (select 1 from public.rooms r where r.id = p_room) then
    raise exception 'NOT_FOUND: room % does not exist', p_room;
  end if;
  perform public.class_place_sessions(p_class, coalesce(p_places, '[]'::jsonb));
  update public.classes set room_id = p_room, venue_id = null, venue_room_id = null where id = p_class returning * into c;
  if not found then
    raise exception 'NOT_FOUND: no such class';
  end if;
  return c;
end;
$$;

-- Staff: the bookings ahead in room p_room at class p_class's weekly times (while it runs; not a day its session is
-- called off or already elsewhere), one entry per day: [{ date, bookings: [{ id, start, end, who, status }],
-- free_rooms: [{ id, name }] }] — what moving the class there would clash with, and where that day's session could go.
create function public.class_booking_clashes(p_class bigint, p_room bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only staff can see this';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('date', d.date, 'bookings', d.bookings,
                                               'free_rooms', private.free_rooms_for(p_class, d.date, p_room))
                            order by d.date), '[]'::jsonb) into v
    from (
      select b.date,
             jsonb_agg(jsonb_build_object('id', b.id, 'start', to_char(b.start_time, 'HH24:MI'),
                                          'end', to_char(b.end_time, 'HH24:MI'), 'who', private.booking_who(b),
                                          'status', b.status) order by b.start_time) as bookings
        from public.bookings b
        join public.classes c on c.id = p_class
       where b.room_id = p_room
         and b.status in ('pending', 'approved', 'completed')
         and b.date >= public.studio_today()
         and (c.starts_on is null or b.date >= c.starts_on)
         and (c.ended_on is null or b.date <= c.ended_on)
         and exists (select 1 from public.class_schedules s
                      where s.class_id = p_class and s.day_of_week = extract(isodow from b.date)
                        and b.start_time < s.end_time and b.end_time > s.start_time)
         and not exists (select 1 from public.instructor_attendance a
                          where a.class_id = p_class and a.date = b.date and not a.is_extra
                            and (a.status = 'cancelled' or a.own_place))
       group by b.date
    ) d;
  return v;
end;
$$;

-- Staff: the studio rooms free for class p_class's session on p_date → [{ id, name }].
create function public.class_free_rooms(p_class bigint, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only staff can see this';
  end if;
  return private.free_rooms_for(p_class, p_date, null);
end;
$$;

revoke execute on function private.free_rooms_for(bigint, date, bigint), private.place_session(bigint, date, bigint)
  from public, anon, authenticated;
revoke execute on function public.class_place_sessions(bigint, jsonb), public.class_move_room(bigint, bigint, jsonb),
  public.class_booking_clashes(bigint, bigint), public.class_free_rooms(bigint, date) from public, anon;
grant execute on function public.class_place_sessions(bigint, jsonb), public.class_move_room(bigint, bigint, jsonb),
  public.class_booking_clashes(bigint, bigint), public.class_free_rooms(bigint, date) to authenticated;
