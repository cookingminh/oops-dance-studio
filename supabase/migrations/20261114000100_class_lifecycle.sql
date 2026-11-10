-- =============================================================================
-- Class lifecycle — api-contract §3 "classes", §5 class_end / class_reopen / classes_run_endings
--
--   A class runs from `starts_on` to `ended_on` (null = still running). Upcoming classes
--   (starts_on in the future) can take students: they're billed from the first month.
--   * class_end(class, last_day): the class runs until last_day. Right away, months after it are
--     cancelled (unpaid invoices void 'class_ended'; paid ones are returned so staff can switch or
--     refund those students) and pending sessions / roll calls after it are dropped.
--   * The day after the last day (daily job classes_run_endings): its weekly schedule is kept in
--     `final_schedule` and removed — so it no longer blocks rooms, appears in the timetable or
--     generates sessions — and its students leave the class. History stays: sessions,
--     attendance, lessons, invoices.
--   * class_reopen(): undo, restoring the schedule where the room is still free.
--   * A class with history (completed sessions, marked roll calls, money paid) can't be
--     deleted: end it instead. Deleting stays possible for a class created by mistake.
-- =============================================================================

alter table public.classes
  add column starts_on      date not null default public.studio_today(),
  add column ended_on       date,
  add column end_reason     text check (char_length(end_reason) <= 200),
  add column final_schedule jsonb;
alter table public.classes
  add constraint classes_run_dates check (ended_on is null or ended_on >= starts_on);

-- Existing classes started with their earliest record.
update public.classes c
   set starts_on = least(
         (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
         coalesce((select min(cs.joined_at) from public.class_students cs where cs.class_id = c.id), 'infinity'::date),
         coalesce((select min(a.date) from public.instructor_attendance a where a.class_id = c.id), 'infinity'::date),
         coalesce((select min(l.month) from public.class_lessons l where l.class_id = c.id), 'infinity'::date));

alter table public.tuition_invoices drop constraint tuition_invoices_void_reason_check;
alter table public.tuition_invoices add constraint tuition_invoices_void_reason_check
  check (void_reason in ('stopped', 'not_renewed', 'removed', 'switched', 'class_ended'));

-- Is the class running on p_day?
create function private.class_runs_on(p_class bigint, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes c
                  where c.id = p_class and c.starts_on <= p_day and (c.ended_on is null or c.ended_on >= p_day));
$$;

-- Does the class run at some point in the month starting p_month?
create function private.class_runs_in_month(p_class bigint, p_month date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes c
                  where c.id = p_class
                    and c.starts_on < (p_month + interval '1 month')::date
                    and (c.ended_on is null or c.ended_on >= p_month));
$$;

-- -----------------------------------------------------------------------------
-- Sessions and roll calls only inside the class's run
-- -----------------------------------------------------------------------------
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
  where v_monday + (s.day_of_week - 1) >= c.starts_on
    and (c.ended_on is null or v_monday + (s.day_of_week - 1) <= c.ended_on)
  order by c.id, v_monday + (s.day_of_week - 1)
  on conflict (class_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

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

-- The public catalogue leaves out classes that have ended.
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
  where c.ended_on is null or c.ended_on >= public.studio_today()
  order by c.name;
$$;

-- -----------------------------------------------------------------------------
-- Tuition only for months the class runs in
-- -----------------------------------------------------------------------------
create or replace function private.bill_enrolment(p_student uuid, p_class bigint, p_month date, p_renewal public.tuition_renewal, p_today date)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not private.class_runs_in_month(p_class, p_month) then
    return null;
  end if;
  insert into public.tuition_invoices (student_id, class_id, student_name, class_name, month, amount, renewal, due_date)
  select p_student, c.id, coalesce(private.person_name(p_student), ''), c.name, p_month, c.price, p_renewal,
         private.tuition_due_date(p_month, p_today)
    from public.classes c
   where c.id = p_class
  on conflict on constraint tuition_invoices_one_per_month do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.open_month(p_month date, p_today date)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.tuition_invoices (student_id, class_id, student_name, class_name, month, amount, renewal, due_date)
  select cs.student_id, c.id, coalesce(private.person_name(cs.student_id), ''), c.name, p_month, c.price,
         case when cs.joined_at >= p_month or c.starts_on >= p_month then 'continue'::public.tuition_renewal end,
         private.tuition_due_date(p_month, p_today)
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
   where c.starts_on < (p_month + interval '1 month')::date
     and (c.ended_on is null or c.ended_on >= p_month)
  on conflict on constraint tuition_invoices_one_per_month do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Joining an upcoming class bills its first month (they've said yes).
create or replace function private.on_enrolment_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_month date := private.tuition_month(v_today);
  v_first date;
begin
  select greatest(v_month, private.tuition_month(c.starts_on)) into v_first
    from public.classes c where c.id = new.class_id;

  update public.tuition_invoices
     set status = 'unpaid', void_reason = null,
         renewal = case when month = v_first then 'continue'::public.tuition_renewal end
   where student_id = new.student_id and class_id = new.class_id
     and month >= v_month and status = 'void' and void_reason <> 'class_ended';
  perform private.bill_enrolment(new.student_id, new.class_id, v_first, 'continue', v_today);
  if v_first = v_month
     and extract(day from v_today) >= (select s.invoice_day from public.tuition_settings s where s.id = 1) then
    perform private.bill_enrolment(new.student_id, new.class_id, (v_month + interval '1 month')::date, null, v_today);
  end if;
  return null;
end;
$$;

-- Leaving a class voids unpaid months from now on — but not the months an ended class ran:
-- students still owe what they danced.
create or replace function private.on_enrolment_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tuition_invoices i
     set status = 'void', void_reason = 'removed'
   where i.student_id = old.student_id and i.class_id = old.class_id
     and i.month >= private.tuition_month(public.studio_today())
     and i.status = 'unpaid' and i.paid_amount = 0
     and not exists (select 1 from public.classes c
                      where c.id = old.class_id and c.ended_on is not null
                        and i.month <= private.tuition_month(c.ended_on));
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ending a class
-- -----------------------------------------------------------------------------
-- Setting ended_on (by class_end or any update) cancels what lies after the last day;
-- clearing it brings back what was cancelled for still-enrolled students.
create function private.on_class_dates_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ended_on is not null then
    update public.tuition_invoices
       set status = 'void', void_reason = 'class_ended'
     where class_id = new.id and status = 'unpaid' and paid_amount = 0
       and month > private.tuition_month(new.ended_on);
    delete from public.instructor_attendance where class_id = new.id and status = 'pending' and date > new.ended_on;
    delete from public.student_attendance where class_id = new.id and status = 'pending' and date > new.ended_on;
  end if;
  if old.ended_on is not null and (new.ended_on is null or new.ended_on > old.ended_on) then
    update public.tuition_invoices i
       set status = 'unpaid', void_reason = null
     where i.class_id = new.id and i.status = 'void' and i.void_reason = 'class_ended'
       and (new.ended_on is null or i.month <= private.tuition_month(new.ended_on))
       and exists (select 1 from public.class_students cs where cs.class_id = new.id and cs.student_id = i.student_id);
  end if;
  return null;
end;
$$;

create trigger class_dates_changed
  after update of ended_on on public.classes
  for each row when (old.ended_on is distinct from new.ended_on)
  execute function private.on_class_dates_changed();

-- Staff end a class after p_last_day (today or later). Returns { class_id, ended_on,
-- paid_after: [{ invoice_id, student_id, student_name, month, paid_amount }] } — students who
-- already paid for a month the class won't run (switch them or refund them).
create function public.class_end(p_class bigint, p_last_day date, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.classes;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can end a class';
  end if;
  select * into v from public.classes where id = p_class for update;
  if not found then
    raise exception 'NOT_FOUND: no such class';
  end if;
  if p_last_day is null or (p_last_day < public.studio_today() and not private.is_service_context()) then
    raise exception 'INVALID_INPUT: the last day must be today or later';
  end if;
  if p_last_day < v.starts_on then
    raise exception 'INVALID_INPUT: the last day is before the class starts';
  end if;

  update public.classes
     set ended_on = p_last_day, end_reason = left(nullif(btrim(p_reason), ''), 200)
   where id = p_class;

  return jsonb_build_object(
    'class_id', p_class,
    'ended_on', p_last_day,
    'paid_after', coalesce((
      select jsonb_agg(jsonb_build_object('invoice_id', i.id, 'student_id', i.student_id, 'student_name', i.student_name,
                                          'month', i.month, 'paid_amount', i.paid_amount) order by i.month, i.student_name)
        from public.tuition_invoices i
       where i.class_id = p_class and i.month > private.tuition_month(p_last_day)
         and i.status <> 'void' and i.paid_amount > 0), '[]'::jsonb));
end;
$$;

-- Undo: the class runs again; its weekly sessions come back where the room is still free.
-- Returns { restored, skipped } schedule counts.
create function public.class_reopen(p_class bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.classes;
  s jsonb;
  v_restored integer := 0;
  v_skipped integer := 0;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can reopen a class';
  end if;
  select * into v from public.classes where id = p_class for update;
  if not found then
    raise exception 'NOT_FOUND: no such class';
  end if;
  if v.ended_on is null then
    raise exception 'INVALID_STATE: this class is still running';
  end if;

  update public.classes set ended_on = null, end_reason = null where id = p_class;
  if v.final_schedule is not null and not exists (select 1 from public.class_schedules where class_id = p_class) then
    for s in select * from jsonb_array_elements(v.final_schedule) loop
      begin
        insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
        values (p_class, (s ->> 'day_of_week')::smallint, (s ->> 'start_time')::time, (s ->> 'end_time')::time);
        v_restored := v_restored + 1;
      exception when others then
        v_skipped := v_skipped + 1;  -- the slot is taken now
      end;
    end loop;
    update public.classes set final_schedule = null where id = p_class;
  end if;
  return jsonb_build_object('restored', v_restored, 'skipped', v_skipped);
end;
$$;

-- Daily (00:02 ICT): classes past their last day keep their schedule in final_schedule, stop
-- holding the room and lose their students. Returns how many classes were wrapped up.
create function public.classes_run_endings(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date;
  c public.classes;
  v_count integer := 0;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: staff only';
  end if;
  v_today := case when private.is_service_context() then coalesce(p_today, public.studio_today()) else public.studio_today() end;

  for c in
    select * from public.classes x
     where x.ended_on is not null and x.ended_on < v_today
       and (exists (select 1 from public.class_schedules s where s.class_id = x.id)
            or exists (select 1 from public.class_students cs where cs.class_id = x.id))
     for update
  loop
    update public.classes
       set final_schedule = coalesce(final_schedule, (
             select jsonb_agg(jsonb_build_object('day_of_week', s.day_of_week,
                                                 'start_time', to_char(s.start_time, 'HH24:MI'),
                                                 'end_time', to_char(s.end_time, 'HH24:MI'))
                              order by s.day_of_week, s.start_time)
               from public.class_schedules s where s.class_id = c.id))
     where id = c.id;
    delete from public.class_schedules where class_id = c.id;
    delete from public.class_students where class_id = c.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- A class with history can only be ended, not deleted.
create function private.guard_class_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.instructor_attendance a where a.class_id = old.id and a.status = 'completed')
     or exists (select 1 from public.student_attendance a where a.class_id = old.id and a.status <> 'pending')
     or exists (select 1 from public.tuition_invoices i where i.class_id = old.id and i.paid_amount > 0) then
    raise exception 'IN_USE: this class has history (sessions, attendance or payments); end it instead of deleting it';
  end if;
  return old;
end;
$$;

-- Runs before drop_unpaid_invoices (triggers fire in name order).
create trigger block_delete_with_history before delete on public.classes
  for each row execute function private.guard_class_delete();

-- -----------------------------------------------------------------------------
-- Demo data (seed.sql / seed-demo.mjs; service role on a sandbox only): a summer class that ran
-- three months and ended, and a class opening next month with two students signed up.
-- -----------------------------------------------------------------------------
create function public.seed_demo_classes()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today  date := public.studio_today();
  v_month  date := private.tuition_month(v_today);
  v_start  date := (private.tuition_month(v_today) - interval '4 months')::date;
  v_end    date := (private.tuition_month(v_today) - interval '1 month')::date - 1;
  v_bin    uuid := (select id from public.profiles where email = 'instructor2@demo.oopsdance.test');
  v_chaeng uuid := (select id from public.profiles where email = 'instructor4@demo.oopsdance.test');
  v_room_a bigint := (select min(id) from public.rooms);
  v_room_b bigint := (select max(id) from public.rooms);
  v_past   bigint;
  v_next   bigint;
  v_day    date;
  r record;
  m date;
  h integer;
  v_slot   record;
  v_ok     boolean := false;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo classes are only seeded on a sandbox';
  end if;

  -- Hip-hop Summer Camp: Saturdays 10:30–12:00, four students, ended last-but-one month.
  insert into public.classes (name, instructor_id, room_id, price, starts_on, ended_on, end_reason, lesson, final_schedule)
  values ('Hip-hop Summer Camp', v_bin, v_room_a, 1000000, v_start, v_end, 'Khoá hè 3 tháng đã kết thúc.',
          'Summer Breeze — Oops! Crew remix',
          '[{"day_of_week": 6, "start_time": "10:30", "end_time": "12:00"}]'::jsonb)
  returning id into v_past;

  insert into public.class_lessons (class_id, month, title, video_url)
  select v_past, (v_start + make_interval(months => k))::date, t.title, t.video
    from (values (0, 'Summer Breeze — Oops! Crew remix', null::text),
                 (1, 'Hot Stuff — Donna Summer', null),
                 (2, 'Dynamite — BTS', null)) as t(k, title, video);

  for r in
    select p.id, private.person_name(p.id) as sname
      from public.profiles p
     where p.role = 'guest' and p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
     order by p.email
     limit 4
  loop
    m := v_start;
    while m <= private.tuition_month(v_end) loop
      h := abs(hashtext(r.id::text || m::text));
      insert into public.tuition_invoices (student_id, class_id, student_name, class_name, month, amount, paid_amount,
                                           status, renewal, method, due_date, paid_at)
      values (r.id, v_past, coalesce(r.sname, ''), 'Hip-hop Summer Camp', m, 1000000, 1000000, 'paid', 'continue',
              case when h % 3 = 0 then 'cash' else 'transfer' end::public.payment_method, m + 9,
              ((m + (h % 7)) + time '19:00') at time zone 'Asia/Ho_Chi_Minh')
      on conflict on constraint tuition_invoices_one_per_month do nothing;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  -- Its Saturday sessions: taught (completed), with roll calls.
  v_day := v_start + ((6 - extract(isodow from v_start)::int + 7) % 7);
  while v_day <= v_end loop
    insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status, checkin_at, checkout_at)
    values (v_past, v_bin, v_room_a, v_day, 'completed',
            (v_day + time '10:25') at time zone 'Asia/Ho_Chi_Minh', (v_day + time '12:05') at time zone 'Asia/Ho_Chi_Minh')
    on conflict (class_id, date) do nothing;
    insert into public.student_attendance (class_id, student_id, date, status)
    select v_past, i.student_id, v_day,
           case when abs(hashtext(i.student_id::text || v_day::text)) % 7 = 0 then 'absent' else 'attend' end::public.student_attendance_status
      from (select distinct student_id from public.tuition_invoices where class_id = v_past) i
    on conflict (class_id, student_id, date) do nothing;
    v_day := v_day + 7;
  end loop;

  -- Waacking Basics opens next month (Chaeng). The first free Sunday-afternoon slot in room B.
  insert into public.classes (name, instructor_id, room_id, price, starts_on, lesson)
  values ('Waacking Basics', v_chaeng, v_room_b, 950000, (v_month + interval '1 month')::date, 'Vogue — Madonna')
  returning id into v_next;
  for v_slot in
    select * from (values (7, '14:00'::time, '15:30'::time), (7, '13:00', '14:30'), (3, '20:30', '22:00'), (5, '20:00', '21:30')) as t(dow, s, e)
  loop
    begin
      insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (v_next, v_slot.dow, v_slot.s, v_slot.e);
      v_ok := true;
      exit;
    exception when others then
      null;  -- taken by a booking or a class; try the next slot
    end;
  end loop;
  insert into public.class_lessons (class_id, month, title) values (v_next, (v_month + interval '1 month')::date, 'Vogue — Madonna');
  insert into public.class_students (class_id, student_id)
  select v_next, p.id from public.profiles p
   where p.role = 'guest' and p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
   order by p.email desc
   limit 2;

  return jsonb_build_object('past_class', v_past, 'upcoming_class', v_next, 'upcoming_scheduled', v_ok);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants and the daily job
-- -----------------------------------------------------------------------------
revoke execute on function
  private.class_runs_on(bigint, date), private.class_runs_in_month(bigint, date),
  private.on_class_dates_changed(), private.guard_class_delete()
from public, anon, authenticated;

revoke execute on function
  public.class_end(bigint, date, text), public.class_reopen(bigint), public.classes_run_endings(date),
  public.seed_demo_classes()
from public, anon;
grant execute on function public.class_end(bigint, date, text), public.class_reopen(bigint), public.classes_run_endings(date)
to authenticated, service_role;
revoke execute on function public.seed_demo_classes() from authenticated;
grant execute on function public.seed_demo_classes() to service_role;

-- 00:02 Asia/Ho_Chi_Minh daily (= 17:02 UTC), before the roll calls and the tuition cycle.
select cron.schedule(
  'class-endings',
  '2 17 * * *',
  $$select public.classes_run_endings()$$
);
