-- =============================================================================
-- Routines by sessions, and make-up sessions — api-contract §3 "class_lessons", §5 lesson_progress /
-- class_add_session / lessons_refresh
--
--   A class's lesson (class_lessons) is now a *routine*: a piece learned over `session_count`
--   sessions from `starts_on` (e.g. 8 sessions), not a calendar month. `month` stays, always the
--   first day of starts_on's month (monthly views: history, the class-video showcase).
--   lesson_progress() counts the sessions held since the routine started — the class's weekly
--   sessions plus extra (make-up) sessions, minus cancelled ones — and projects the date of the
--   last one: a cancelled session pushes the end back, a make-up session pulls it in.
--   class_add_session() adds a one-off (make-up) session on a date with its own times, checked
--   against bookings and other classes in the room; it gets a roll call like any session and
--   counts for payroll when completed.
--   classes.lesson now mirrors the *current* routine (latest started, else the next one), and a
--   daily job keeps it current as planned routines start.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Routines
-- -----------------------------------------------------------------------------
alter table public.class_lessons
  add column starts_on     date,
  add column session_count smallint not null default 8 check (session_count between 1 and 60);

-- Existing monthly lessons start on the 1st and last as many sessions as the class had that month.
update public.class_lessons l
   set starts_on = l.month,
       session_count = greatest(1, least(60, coalesce(nullif((
         select count(*)::int
           from generate_series(l.month, (l.month + interval '1 month' - interval '1 day')::date, interval '1 day') d
           join public.class_schedules s on s.class_id = l.class_id and s.day_of_week = extract(isodow from d)
       ), 0), 8)));
alter table public.class_lessons alter column starts_on set not null;

alter table public.class_lessons drop constraint class_lessons_class_id_month_key;
alter table public.class_lessons add constraint class_lessons_one_start unique (class_id, starts_on);
create index class_lessons_class_start_idx on public.class_lessons (class_id, starts_on desc);

-- month follows starts_on (a write that only gives `month` starts the routine on that day).
create function private.lesson_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.starts_on := coalesce(new.starts_on, new.month);
  elsif new.starts_on is not distinct from old.starts_on and new.month is distinct from old.month then
    new.starts_on := new.month;
  end if;
  new.month := date_trunc('month', new.starts_on)::date;
  return new;
end;
$$;

create trigger lesson_dates before insert or update on public.class_lessons
  for each row execute function private.lesson_dates();

-- classes.lesson = the current routine: the latest one that has started, else the next one.
create function private.current_lesson_title(p_class bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.title from public.class_lessons l
   where l.class_id = p_class
   order by (l.starts_on <= public.studio_today()) desc,
            case when l.starts_on <= public.studio_today() then l.starts_on end desc nulls last,
            l.starts_on asc
   limit 1;
$$;

create or replace function private.sync_class_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    update public.classes c set lesson = private.current_lesson_title(old.class_id) where c.id = old.class_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.classes c set lesson = private.current_lesson_title(new.class_id) where c.id = new.class_id;
  end if;
  return null;
end;
$$;

update public.classes c set lesson = private.current_lesson_title(c.id);

-- Daily (00:03 ICT): planned routines that start today become the class's lesson.
create function public.lessons_refresh()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: staff only';
  end if;
  update public.classes c
     set lesson = private.current_lesson_title(c.id)
   where c.lesson is distinct from private.current_lesson_title(c.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Make-up (extra) sessions
-- -----------------------------------------------------------------------------
alter table public.instructor_attendance
  add column start_time time,
  add column end_time   time,
  add column is_extra   boolean not null default false,
  add constraint instructor_attendance_own_times
    check ((start_time is null) = (end_time is null) and (end_time is null or end_time > start_time)),
  add constraint instructor_attendance_extra_has_times check (not is_extra or start_time is not null);

-- Is the room busy on p_date between p_start and p_end (bookings, classes, other extra sessions)?
-- Returns what it clashes with, or null.
create function private.room_clash_on(p_room bigint, p_date date, p_start time, p_end time, p_skip_class bigint)
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
   where b.room_id = p_room and b.date = p_date and b.status in ('pending', 'approved')
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

-- Staff add a one-off session (make-up) for a class on p_date (today or later). It gets a roll call
-- (now if it's today, otherwise by the daily job) and counts towards routines and payroll.
create function public.class_add_session(p_class bigint, p_date date, p_start time, p_end time, p_note text default null)
returns public.instructor_attendance
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.classes;
  v_clash text;
  v_row public.instructor_attendance;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can add a session';
  end if;
  select * into c from public.classes where id = p_class;
  if not found then
    raise exception 'NOT_FOUND: no such class';
  end if;
  if p_date is null or (p_date < public.studio_today() and not private.is_service_context()) then
    raise exception 'INVALID_INPUT: pick today or a later day';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'INVALID_INPUT: end time must be after start time';
  end if;
  if p_start < time '08:00' or p_end > time '22:00' then
    raise exception 'INVALID_INPUT: sessions must be between 08:00 and 22:00';
  end if;
  if c.starts_on > p_date or (c.ended_on is not null and c.ended_on < p_date) then
    raise exception 'INVALID_STATE: the class doesn''t run on that day';
  end if;
  if exists (select 1 from public.instructor_attendance a where a.class_id = p_class and a.date = p_date and a.status <> 'cancelled')
     or exists (select 1 from public.class_schedules s where s.class_id = p_class and s.day_of_week = extract(isodow from p_date)) then
    raise exception 'INVALID_STATE: the class already meets that day';
  end if;

  perform private.lock_room(c.room_id);
  v_clash := private.room_clash_on(c.room_id, p_date, p_start, p_end, p_class);
  if v_clash is not null then
    raise exception 'SLOT_TAKEN: the room is taken by %', v_clash;
  end if;

  -- A cancelled session on that day is turned into the make-up.
  delete from public.instructor_attendance where class_id = p_class and date = p_date and status = 'cancelled';
  insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status, start_time, end_time, is_extra, details)
  values (p_class, c.instructor_id, c.room_id, p_date, 'pending', p_start, p_end, true, left(nullif(btrim(p_note), ''), 300))
  returning * into v_row;

  if p_date = public.studio_today() then
    insert into public.student_attendance (class_id, student_id, date, status)
    select cs.class_id, cs.student_id, p_date, 'pending'
      from public.class_students cs
     where cs.class_id = p_class and cs.joined_at <= p_date
    on conflict (class_id, student_id, date) do nothing;
  end if;
  return v_row;
end;
$$;

-- Roll calls also for make-up sessions.
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
    and (exists (
           select 1 from public.class_schedules s
           where s.class_id = cs.class_id
             and s.day_of_week = extract(isodow from v_date))
         or exists (
           select 1 from public.instructor_attendance a
           where a.class_id = cs.class_id and a.date = v_date and a.is_extra and a.status <> 'cancelled'))
  on conflict (class_id, student_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Bookings may not overlap a make-up session either.
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
    select c.name into v_class
    from public.class_schedules s
    join public.classes c on c.id = s.class_id
    where c.room_id = new.room_id
      and s.day_of_week = extract(isodow from new.date)
      and s.start_time < new.end_time
      and s.end_time > new.start_time
    limit 1;
    if not found then
      select c.name into v_class
      from public.instructor_attendance a
      join public.classes c on c.id = a.class_id
      where a.room_id = new.room_id and a.date = new.date and a.is_extra and a.status <> 'cancelled'
        and a.start_time < new.end_time and a.end_time > new.start_time
      limit 1;
    end if;
    if v_class is not null then
      raise exception 'SLOT_TAKEN: the room is reserved for class "%" at that time', v_class;
    end if;
  end if;
  return new;
end;
$$;

-- Free slots leave out make-up sessions too.
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
      and not exists (
        select 1
        from public.instructor_attendance a
        where a.room_id = r.id and a.date = p_date and a.is_extra and a.status <> 'cancelled'
          and a.start_time < grid.slot_end
          and a.end_time > grid.slot_start
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

-- -----------------------------------------------------------------------------
-- Progress of routines
-- -----------------------------------------------------------------------------
-- One row per routine of the given classes:
--   sessions_held  sessions that took place since starts_on (weekly + make-up, not cancelled;
--                  today counts once its session is completed), capped at session_count
--   sessions_cancelled  cancelled sessions between the start and the projected end
--   next_session   the next session date counting for it (null when done)
--   ends_on        projected date of its last session (the shoot day); later when sessions are
--                  cancelled, earlier with a make-up; null if the class's schedule can't reach it
--   status         'planned' (not started) | 'current' | 'done' | 'stopped' (the class ended first)
create function public.lesson_progress(p_class_ids bigint[])
returns table (
  lesson_id          bigint,
  class_id           bigint,
  title              text,
  starts_on          date,
  session_count      integer,
  sessions_held      integer,
  sessions_cancelled integer,
  next_session       date,
  ends_on            date,
  status             text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := public.studio_today();
begin
  return query
  select l.id, l.class_id, l.title, l.starts_on, l.session_count::integer,
         least(x.held, l.session_count)::integer,
         x.cancelled::integer,
         case when x.held >= l.session_count then null else x.next_day end,
         x.last_day,
         case when x.held >= l.session_count then 'done'
              when c.ended_on is not null and c.ended_on < v_today then 'stopped'
              when coalesce(x.first_day, l.starts_on) > v_today and x.held = 0 then 'planned'
              else 'current' end
    from public.class_lessons l
    join public.classes c on c.id = l.class_id
    cross join lateral (
      with days as (
        select d::date as d
          from generate_series(greatest(l.starts_on, c.starts_on),
                               least(greatest(l.starts_on, c.starts_on) + 400, coalesce(c.ended_on, greatest(l.starts_on, c.starts_on) + 400)),
                               interval '1 day') d
      ), sessions as (
        select days.d,
               exists (select 1 from public.instructor_attendance a
                        where a.class_id = c.id and a.date = days.d and a.status = 'completed') as completed
          from days
         where (exists (select 1 from public.class_schedules s
                         where s.class_id = c.id and s.day_of_week = extract(isodow from days.d))
                or exists (select 1 from public.instructor_attendance a
                            where a.class_id = c.id and a.date = days.d))
           and not exists (select 1 from public.instructor_attendance a
                            where a.class_id = c.id and a.date = days.d and a.status = 'cancelled')
      ), numbered as (
        select s.d, s.completed, row_number() over (order by s.d) as n from sessions s
      )
      select
        (select count(*) from numbered where numbered.d < v_today or (numbered.d = v_today and numbered.completed)) as held,
        (select min(numbered.d) from numbered where numbered.d > v_today or (numbered.d = v_today and not numbered.completed)) as next_day,
        (select numbered.d from numbered where numbered.n = l.session_count) as last_day,
        (select min(numbered.d) from numbered) as first_day,
        (select count(*) from public.instructor_attendance a
          where a.class_id = c.id and a.status = 'cancelled' and a.date >= l.starts_on
            and a.date <= coalesce((select numbered.d from numbered where numbered.n = l.session_count), v_today)) as cancelled
    ) x
   where l.class_id = any(p_class_ids)
   order by l.class_id, l.starts_on;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants and the daily job
-- -----------------------------------------------------------------------------
revoke execute on function
  private.lesson_dates(), private.current_lesson_title(bigint),
  private.room_clash_on(bigint, date, time, time, bigint)
from public, anon, authenticated;

revoke execute on function public.lessons_refresh(), public.class_add_session(bigint, date, time, time, text),
  public.lesson_progress(bigint[]) from public, anon;
grant execute on function public.lessons_refresh(), public.class_add_session(bigint, date, time, time, text),
  public.lesson_progress(bigint[]) to authenticated, service_role;

-- 00:03 Asia/Ho_Chi_Minh daily (= 17:03 UTC).
select cron.schedule(
  'lessons-refresh',
  '3 17 * * *',
  $$select public.lessons_refresh()$$
);
