-- =============================================================================
-- Tuition per course — api-contract §3 "Tuition", §5 tuition_*
--
--   The owner charges per *course* (khoá): one routine (class_lessons row) of N sessions, not per
--   calendar month. Invoices now belong to a course (`lesson_id`).
--   * Course fee: class_lessons.price (null = the class price). Joining after a course started pays
--     for the sessions left (tuition_settings.prorate_late_join), rounded to 1,000 ₫.
--   * Renewal: when the current course has `renewal_open_sessions` (2) or fewer sessions left and
--     the next course is planned, every member is billed for it (or right away when there is no
--     current course). Pay or answer by the course's `due_session`-th session (2nd; at least 3 days).
--   * Daily cycle: bill members missing an invoice for the running course, open renewals, cancel
--     unpaid + unanswered + overdue invoices (not_renewed), and take out of the class whoever has a
--     cancelled invoice for the running course (stopped / not renewed).
--   * Someone joining the class is a "yes" for the course they join; a member of the previous course
--     must answer for the next one.
--   * Leaving or switching a class also clears that student's unmarked roll calls from today on.
--   `month` stays on invoices: the month the course starts (reports count tuition there).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema
-- -----------------------------------------------------------------------------
alter table public.class_lessons
  add column price numeric(12, 0) check (price >= 0);

alter table public.tuition_settings
  add column renewal_open_sessions smallint not null default 2 check (renewal_open_sessions between 0 and 10),
  add column due_session smallint not null default 2 check (due_session between 1 and 10),
  add column prorate_late_join boolean not null default true;

alter table public.tuition_invoices
  add column lesson_id bigint references public.class_lessons (id) on delete set null,
  add column lesson_title text not null default '',
  add column sessions smallint check (sessions between 0 and 60);
create index tuition_invoices_lesson_idx on public.tuition_invoices (lesson_id);

alter table public.tuition_invoices drop constraint tuition_invoices_one_per_month;

-- -----------------------------------------------------------------------------
-- Course dates
-- -----------------------------------------------------------------------------
-- The sessions of a course, numbered from its start: the class's weekly sessions and make-ups,
-- without cancelled ones, inside the class's run (looks ahead at most 400 days).
create function private.course_dates(p_lesson bigint)
returns table (n bigint, d date)
language sql
stable
security definer
set search_path = ''
as $$
  with l as (
    select l.starts_on, c.id as cid, c.starts_on as c_start, c.ended_on as c_end
      from public.class_lessons l join public.classes c on c.id = l.class_id
     where l.id = p_lesson
  ), days as (
    select g::date as d, l.cid
      from l, generate_series(greatest(l.starts_on, l.c_start),
                              least(greatest(l.starts_on, l.c_start) + 400, coalesce(l.c_end, greatest(l.starts_on, l.c_start) + 400)),
                              interval '1 day') g
  ), s as (
    select days.d from days
     where (exists (select 1 from public.class_schedules x where x.class_id = days.cid and x.day_of_week = extract(isodow from days.d))
            or exists (select 1 from public.instructor_attendance a where a.class_id = days.cid and a.date = days.d))
       and not exists (select 1 from public.instructor_attendance a
                        where a.class_id = days.cid and a.date = days.d and a.status = 'cancelled')
  )
  select row_number() over (order by s.d), s.d from s order by s.d;
$$;

create function private.course_nth(p_lesson bigint, p_n integer)
returns date
language sql
stable
security definer
set search_path = ''
as $$ select cd.d from private.course_dates(p_lesson) cd where cd.n = p_n; $$;

-- Projected last session (null when the class's schedule can't reach it).
create function private.course_end(p_lesson bigint)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select private.course_nth(p_lesson, (select l.session_count from public.class_lessons l where l.id = p_lesson));
$$;

-- Sessions held before p_day (capped at the course length).
create function private.course_held(p_lesson bigint, p_day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(count(*), (select l.session_count from public.class_lessons l where l.id = p_lesson))::integer
    from private.course_dates(p_lesson) cd where cd.d < p_day;
$$;

-- Is the course over before p_day?
create function private.course_finished(p_lesson bigint, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(private.course_end(p_lesson) < p_day, false); $$;

-- The course a class is in on p_day (started, not finished), and the next planned one.
create function private.current_course(p_class bigint, p_day date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select l.id from public.class_lessons l
   where l.class_id = p_class and l.starts_on <= p_day and not private.course_finished(l.id, p_day)
   order by l.starts_on desc
   limit 1;
$$;

create function private.next_course(p_class bigint, p_day date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select l.id from public.class_lessons l
   where l.class_id = p_class and l.starts_on > p_day
     and not exists (select 1 from public.classes c where c.id = p_class and c.ended_on is not null and l.starts_on > c.ended_on)
   order by l.starts_on
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Billing
-- -----------------------------------------------------------------------------
-- One invoice per student and course. Returns its id (existing or new), or null when there is
-- nothing to bill (course over, or after the class's last day).
create function private.bill_course(p_student uuid, p_lesson bigint, p_today date)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l record;
  s public.tuition_settings;
  v_id bigint;
  v_held integer;
  v_left integer;
  v_price numeric;
  v_amount numeric;
  v_prev bigint;
  v_renewal public.tuition_renewal;
begin
  select id into v_id from public.tuition_invoices where student_id = p_student and lesson_id = p_lesson;
  if v_id is not null then
    return v_id;
  end if;
  select le.*, c.price as class_price, c.name as class_name, c.ended_on as class_end into l
    from public.class_lessons le join public.classes c on c.id = le.class_id
   where le.id = p_lesson;
  if not found or (l.class_end is not null and l.starts_on > l.class_end) then
    return null;
  end if;
  select * into s from public.tuition_settings where id = 1;

  v_held := private.course_held(p_lesson, p_today);
  if v_held >= l.session_count then
    return null;
  end if;

  -- A member of the class's previous course has to answer; someone new said yes by joining.
  select p.id into v_prev from public.class_lessons p
   where p.class_id = l.class_id and p.starts_on < l.starts_on order by p.starts_on desc limit 1;
  v_renewal := case
    when v_prev is not null and exists (select 1 from public.tuition_invoices i
                                         where i.student_id = p_student and i.lesson_id = v_prev and i.status <> 'void')
      then null
    else 'continue'::public.tuition_renewal end;

  -- Only someone new who joins after the course started pays for the sessions left; a member
  -- carrying on pays the whole course even if it is billed late.
  v_price := coalesce(l.price, l.class_price);
  v_left := case when v_renewal = 'continue' and s.prorate_late_join and v_held > 0
                 then l.session_count - v_held else l.session_count end;
  v_amount := case when v_left < l.session_count then round(v_price * v_left / l.session_count, -3) else v_price end;

  insert into public.tuition_invoices (student_id, class_id, lesson_id, student_name, class_name, lesson_title, month,
                                       amount, sessions, renewal, due_date, note)
  values (p_student, l.class_id, p_lesson, coalesce(private.person_name(p_student), ''), l.class_name, l.title, l.month,
          v_amount, v_left, v_renewal,
          greatest(coalesce(private.course_nth(p_lesson, least(s.due_session, l.session_count)), p_today + 7), p_today + 3),
          case when v_left < l.session_count then format('Joined after %s of %s sessions.', v_held, l.session_count) end)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create unique index tuition_invoices_one_per_course on public.tuition_invoices (student_id, lesson_id) where lesson_id is not null;

-- -----------------------------------------------------------------------------
-- Existing invoices: tie them to the course of their month; older months get a course of the
-- sessions the class had that month (so history stays complete).
-- -----------------------------------------------------------------------------
insert into public.class_lessons (class_id, starts_on, title, session_count)
select g.class_id, g.month, format('Khoá tháng %s', to_char(g.month, 'MM/YYYY')),
       greatest(1, least(60, coalesce(nullif((
         select count(*)::int
           from generate_series(g.month, (g.month + interval '1 month' - interval '1 day')::date, interval '1 day') d
           join public.class_schedules s on s.class_id = g.class_id and s.day_of_week = extract(isodow from d)), 0), 8)))
  from (select distinct i.class_id, i.month from public.tuition_invoices i
         where i.class_id is not null and i.month < date_trunc('month', public.studio_today())::date
           and not exists (select 1 from public.class_lessons l where l.class_id = i.class_id and l.month = i.month)) g
on conflict do nothing;

update public.tuition_invoices i
   set lesson_id = l.id, lesson_title = l.title
  from public.class_lessons l
 where i.lesson_id is null and l.class_id = i.class_id and l.month = i.month
   and l.starts_on = (select min(x.starts_on) from public.class_lessons x where x.class_id = i.class_id and x.month = i.month);

-- Monthly renewals of months that have no course yet are dropped when nothing was paid on them.
delete from public.tuition_invoices i
 where i.lesson_id is null and i.paid_amount = 0
   and i.month >= date_trunc('month', public.studio_today())::date;

update public.tuition_invoices i
   set sessions = l.session_count
  from public.class_lessons l
 where l.id = i.lesson_id and i.sessions is null;


-- Bills a class (or one of its members): the running course for whoever lacks an invoice, and the
-- next course once its renewal is open. Returns how many invoices were created.
create function private.bill_class(p_class bigint, p_today date, p_student uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cur bigint := private.current_course(p_class, p_today);
  v_next bigint := private.next_course(p_class, p_today);
  v_open boolean;
  v_count integer := 0;
  r record;
begin
  if exists (select 1 from public.classes c where c.id = p_class and c.ended_on is not null and c.ended_on < p_today) then
    return 0;
  end if;
  v_open := v_next is not null and (
    v_cur is null
    or (select l.session_count from public.class_lessons l where l.id = v_cur) - private.course_held(v_cur, p_today)
       <= (select s.renewal_open_sessions from public.tuition_settings s where s.id = 1));

  for r in
    select cs.student_id from public.class_students cs
     where cs.class_id = p_class and (p_student is null or cs.student_id = p_student)
  loop
    if v_cur is not null and not exists (select 1 from public.tuition_invoices i where i.student_id = r.student_id and i.lesson_id = v_cur) then
      if private.bill_course(r.student_id, v_cur, p_today) is not null then v_count := v_count + 1; end if;
    end if;
    if v_open and not exists (select 1 from public.tuition_invoices i where i.student_id = r.student_id and i.lesson_id = v_next) then
      if private.bill_course(r.student_id, v_next, p_today) is not null then v_count := v_count + 1; end if;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Older (monthly) inserts that only give class + month are tied to the course starting that month.
create function private.link_invoice_course()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lesson_id is null and new.class_id is not null then
    select l.id, l.title into new.lesson_id, new.lesson_title
      from public.class_lessons l
     where l.class_id = new.class_id and l.month = new.month
     order by l.starts_on
     limit 1;
  end if;
  if new.lesson_id is not null and new.lesson_title = '' then
    new.lesson_title := coalesce((select l.title from public.class_lessons l where l.id = new.lesson_id), '');
  end if;
  return new;
end;
$$;
create trigger link_invoice_course before insert on public.tuition_invoices
  for each row execute function private.link_invoice_course();

-- A new or moved course bills the class right away when it should.
create function private.on_course_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.bill_class(new.class_id, public.studio_today());
  return null;
end;
$$;
create trigger bill_on_course_change
  after insert or update of starts_on, session_count on public.class_lessons
  for each row execute function private.on_course_changed();

-- -----------------------------------------------------------------------------
-- Enrolment triggers, reinstating, renewal answers
-- -----------------------------------------------------------------------------
create or replace function private.on_enrolment_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
begin
  -- Back in the class: cancelled invoices of courses that aren't over come back.
  update public.tuition_invoices i
     set status = 'unpaid', void_reason = null, renewal = 'continue'
   where i.student_id = new.student_id and i.class_id = new.class_id and i.status = 'void'
     and i.void_reason in ('stopped', 'not_renewed', 'removed')
     and i.lesson_id is not null and not private.course_finished(i.lesson_id, v_today);
  perform private.bill_class(new.class_id, v_today, new.student_id);
  return null;
end;
$$;

-- Leaving: unpaid invoices of courses that aren't over are cancelled — except courses an ended class
-- ran (students owe what they danced) — and unmarked roll calls from today on are cleared.
create or replace function private.on_enrolment_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
begin
  update public.tuition_invoices i
     set status = 'void', void_reason = 'removed'
   where i.student_id = old.student_id and i.class_id = old.class_id
     and i.status = 'unpaid' and i.paid_amount = 0
     and (i.lesson_id is null or not private.course_finished(i.lesson_id, v_today))
     and not exists (select 1 from public.classes c
                      join public.class_lessons l on l.id = i.lesson_id
                     where c.id = old.class_id and c.ended_on is not null
                       and l.starts_on <= c.ended_on);
  delete from public.student_attendance
   where class_id = old.class_id and student_id = old.student_id and status = 'pending' and date >= v_today;
  return null;
end;
$$;

create or replace function private.reinstate(p_invoice bigint)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices;
  v_today date := public.studio_today();
begin
  select * into v from public.tuition_invoices where id = p_invoice for update;
  if v.status <> 'void' or v.void_reason not in ('stopped', 'not_renewed')
     or v.student_id is null or v.class_id is null or v.lesson_id is null
     or private.course_finished(v.lesson_id, v_today) then
    return false;
  end if;
  update public.tuition_invoices
     set status = 'unpaid', void_reason = null, renewal = 'continue', updated_by = auth.uid()
   where id = p_invoice;
  -- Back in the class if that course is running.
  if (select l.starts_on from public.class_lessons l where l.id = v.lesson_id) <= v_today then
    insert into public.class_students (class_id, student_id) values (v.class_id, v.student_id) on conflict do nothing;
  end if;
  return true;
end;
$$;

create or replace function public.tuition_set_renewal(p_invoice bigint, p_decision public.tuition_renewal)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices := private.invoice_for_caller(p_invoice, true);
  v_today date := public.studio_today();
  v_started boolean;
begin
  if v.lesson_id is null or private.course_finished(v.lesson_id, v_today) then
    raise exception 'INVALID_STATE: that course is over';
  end if;
  v_started := (select l.starts_on from public.class_lessons l where l.id = v.lesson_id) <= v_today;

  if p_decision = 'stop' then
    if v.status not in ('unpaid', 'void') or v.paid_amount > 0 then
      raise exception 'INVALID_STATE: this course is already paid; ask the studio to stop it';
    end if;
    update public.tuition_invoices
       set status = 'void', void_reason = 'stopped', renewal = 'stop', updated_by = auth.uid()
     where id = v.id;
    -- Stopping the running course leaves now; a later one when it starts.
    if v_started then
      delete from public.class_students where class_id = v.class_id and student_id = v.student_id;
    end if;
  else
    if v.status = 'void' then
      if not private.reinstate(v.id) then
        raise exception 'INVALID_STATE: this invoice can''t be reopened; ask the studio';
      end if;
    else
      update public.tuition_invoices set renewal = 'continue', updated_by = auth.uid() where id = v.id;
    end if;
  end if;

  select * into v from public.tuition_invoices where id = p_invoice;
  return v;
end;
$$;

-- Staff open a course's renewal now (every member is billed for it), whatever the timing.
create function public.tuition_open_course(p_lesson bigint)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_class bigint;
  v_count integer := 0;
  r record;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can open a course';
  end if;
  select class_id into v_class from public.class_lessons where id = p_lesson;
  if v_class is null then
    raise exception 'NOT_FOUND: no such course';
  end if;
  if private.course_finished(p_lesson, public.studio_today()) then
    raise exception 'INVALID_STATE: that course is over';
  end if;
  for r in select cs.student_id from public.class_students cs where cs.class_id = v_class loop
    if not exists (select 1 from public.tuition_invoices i where i.student_id = r.student_id and i.lesson_id = p_lesson)
       and private.bill_course(r.student_id, p_lesson, public.studio_today()) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Kept for older screens: opens every course starting in p_month (current or next month).
create or replace function public.tuition_open_month(p_month date)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_month date := private.tuition_month(p_month);
  v_count integer := 0;
  r record;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can open a month';
  end if;
  for r in select l.id from public.class_lessons l where l.month = v_month and not private.course_finished(l.id, public.studio_today()) loop
    v_count := v_count + public.tuition_open_course(r.id);
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- The daily cycle, per course
-- -----------------------------------------------------------------------------
create or replace function public.tuition_run_cycle(p_today date default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today  date;
  v_billed integer := 0;
  v_voided integer;
  v_ended  integer := 0;
  v_n      integer;
  c record;
  v_cur bigint;
begin
  if not (private.is_service_context() or public.is_staff()) then
    raise exception 'FORBIDDEN: only staff can run the tuition cycle';
  end if;
  v_today := case when private.is_service_context() then coalesce(p_today, public.studio_today()) else public.studio_today() end;

  -- 1. Running courses are billed and renewals open when it's time.
  for c in select x.id from public.classes x where x.ended_on is null or x.ended_on >= v_today loop
    v_billed := v_billed + private.bill_class(c.id, v_today);
  end loop;

  -- 2. Unpaid, unanswered and past due: not renewed.
  update public.tuition_invoices
     set status = 'void', void_reason = 'not_renewed'
   where status = 'unpaid' and renewal is null and paid_amount = 0 and due_date < v_today;
  get diagnostics v_voided = row_count;

  -- 3. Whoever has a cancelled invoice for the course their class is running leaves the class.
  for c in select x.id from public.classes x where x.ended_on is null or x.ended_on >= v_today loop
    v_cur := private.current_course(c.id, v_today);
    continue when v_cur is null;
    delete from public.class_students cs
     using public.tuition_invoices i
     where cs.class_id = c.id and i.student_id = cs.student_id and i.lesson_id = v_cur
       and i.status = 'void' and i.void_reason in ('stopped', 'not_renewed');
    get diagnostics v_n = row_count;
    v_ended := v_ended + v_n;
  end loop;

  return jsonb_build_object('today', v_today, 'billed', v_billed, 'not_renewed', v_voided, 'enrolments_ended', v_ended);
end;
$$;

-- -----------------------------------------------------------------------------
-- Class end: courses after the last day are cancelled
-- -----------------------------------------------------------------------------
create or replace function private.on_class_dates_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ended_on is not null then
    update public.tuition_invoices i
       set status = 'void', void_reason = 'class_ended'
      from public.class_lessons l
     where l.id = i.lesson_id and i.class_id = new.id and i.status = 'unpaid' and i.paid_amount = 0
       and l.starts_on > new.ended_on;
    delete from public.instructor_attendance where class_id = new.id and status = 'pending' and date > new.ended_on;
    delete from public.student_attendance where class_id = new.id and status = 'pending' and date > new.ended_on;
  end if;
  if old.ended_on is not null and (new.ended_on is null or new.ended_on > old.ended_on) then
    update public.tuition_invoices i
       set status = 'unpaid', void_reason = null
      from public.class_lessons l
     where l.id = i.lesson_id and i.class_id = new.id and i.status = 'void' and i.void_reason = 'class_ended'
       and (new.ended_on is null or l.starts_on <= new.ended_on)
       and exists (select 1 from public.class_students cs where cs.class_id = new.id and cs.student_id = i.student_id);
  end if;
  return null;
end;
$$;

create or replace function public.class_end(p_class bigint, p_last_day date, p_reason text default null)
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
                                          'month', i.month, 'lesson_title', i.lesson_title, 'paid_amount', i.paid_amount)
                       order by l.starts_on, i.student_name)
        from public.tuition_invoices i
        join public.class_lessons l on l.id = i.lesson_id
       where i.class_id = p_class and l.starts_on > p_last_day and i.status <> 'void' and i.paid_amount > 0), '[]'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Class switch, per course
-- -----------------------------------------------------------------------------
-- What the student paid on the old class's open courses moves to the new class's running course
-- (or its next one when nothing is running there), billed for the sessions left. Only the unused part
-- moves: for a course they're in the middle of, the sessions already danced stay paid in the old
-- class (kept on its switched invoice), so each class keeps what it earned.
create or replace function public.tuition_switch_class(p_student uuid, p_from bigint, p_to bigint, p_note text default null)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_from_name text;
  v_to_name text;
  v_target bigint;
  v_new public.tuition_invoices;
  v_old record;
  v_move numeric := 0;
  v_part numeric;
  v_keep numeric;
  v_held integer;
  v_waived boolean := false;
  v_first bigint;
  v_method public.payment_method;
  v_paid_at timestamptz;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can switch a student''s class';
  end if;
  if p_from = p_to then
    raise exception 'INVALID_INPUT: pick a different class';
  end if;
  select c.name into v_from_name from public.classes c where c.id = p_from;
  select c.name into v_to_name from public.classes c where c.id = p_to;
  if v_from_name is null or v_to_name is null then
    raise exception 'NOT_FOUND: no such class';
  end if;
  if not exists (select 1 from public.class_students where student_id = p_student and class_id = p_from) then
    raise exception 'INVALID_STATE: the student isn''t in %', v_from_name;
  end if;
  if exists (select 1 from public.class_students where student_id = p_student and class_id = p_to) then
    raise exception 'INVALID_STATE: the student is already in %', v_to_name;
  end if;

  v_target := coalesce(private.current_course(p_to, v_today), private.next_course(p_to, v_today));
  if v_target is null and exists (
       select 1 from public.tuition_invoices i
        where i.student_id = p_student and i.class_id = p_from and i.status <> 'void'
          and (i.paid_amount > 0 or i.status = 'waived')
          and (i.lesson_id is null or not private.course_finished(i.lesson_id, v_today))) then
    raise exception 'INVALID_STATE: % has no course to move the payment to; plan one first', v_to_name;
  end if;

  -- Into the new class (bills its running course, as a new member).
  insert into public.class_students (class_id, student_id) values (p_to, p_student);
  if v_target is not null then
    perform private.bill_course(p_student, v_target, v_today);
  end if;

  -- Each open course of the old class: the unused part of what was paid moves, the rest stays.
  for v_old in
    select i.*, l.starts_on as course_start, l.session_count
      from public.tuition_invoices i
      left join public.class_lessons l on l.id = i.lesson_id
     where i.student_id = p_student and i.class_id = p_from and i.status <> 'void'
       and (i.lesson_id is null or not private.course_finished(i.lesson_id, v_today))
     order by i.id
     for update of i
  loop
    v_first := coalesce(v_first, v_old.id);
    v_waived := v_waived or v_old.status = 'waived';
    v_held := case when v_old.lesson_id is not null and v_old.course_start <= v_today
                   then private.course_held(v_old.lesson_id, v_today) else 0 end;
    v_part := case when v_held = 0 then v_old.paid_amount
                   else round(v_old.paid_amount * greatest(v_old.session_count - v_held, 0)
                              / greatest(coalesce(v_old.sessions, v_old.session_count), 1), -3) end;
    v_part := least(v_part, v_old.paid_amount);
    v_keep := v_old.paid_amount - v_part;
    v_move := v_move + v_part;
    if v_old.paid_amount > 0 then
      v_method := coalesce(v_old.method, v_method);
      v_paid_at := coalesce(v_old.paid_at, v_paid_at);
    end if;

    update public.tuition_invoices
       set status = 'void', void_reason = 'switched', paid_amount = v_keep,
           paid_at = case when v_keep > 0 then paid_at end, method = case when v_keep > 0 then method end,
           note = left(case when v_keep > 0
                            then format('Moved to %s after %s sessions; %s kept for them.', v_to_name, v_held, v_keep)
                            else format('Moved to %s.', v_to_name) end, 300),
           updated_by = auth.uid()
     where id = v_old.id;
    -- The bank transfer follows the money when all of it moved.
    if v_keep = 0 and v_target is not null then
      update public.bank_transfers t set invoice_id = (select n.id from public.tuition_invoices n
                                                         where n.student_id = p_student and n.lesson_id = v_target)
       where t.invoice_id = v_old.id;
    end if;
  end loop;

  if v_target is not null then
    select * into v_new from public.tuition_invoices where student_id = p_student and lesson_id = v_target for update;
    update public.tuition_invoices n
       set paid_amount   = n.paid_amount + v_move,
           status        = case
                             when v_waived and v_move = 0 then 'waived'::public.tuition_status
                             when v_move > 0 and n.paid_amount + v_move >= n.amount then 'paid'::public.tuition_status
                             else n.status
                           end,
           paid_at       = case when v_move > 0 and n.paid_amount + v_move >= n.amount then coalesce(v_paid_at, now()) else n.paid_at end,
           method        = case when v_move > 0 then coalesce(v_method, n.method) else n.method end,
           renewal       = 'continue',
           switched_from = v_first,
           note          = left(concat_ws(' ',
                             format('Switched from %s.', v_from_name),
                             case when v_move > n.amount then format('Paid %s more than this course costs.', v_move - n.amount) end,
                             nullif(btrim(p_note), '')), 300),
           updated_by    = auth.uid()
     where n.id = v_new.id;
  end if;

  -- Out of the old class (its unmarked roll calls from today on go with it).
  delete from public.class_students where class_id = p_from and student_id = p_student;

  if v_target is null then
    return null;
  end if;
  select * into v_new from public.tuition_invoices where student_id = p_student and lesson_id = v_target;
  return v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finance: a student is active in every month their course runs through
-- -----------------------------------------------------------------------------
create or replace function public.finance_monthly(p_from date, p_to date)
returns table (
  month               date,
  tuition_billed      numeric,
  tuition_collected   numeric,
  tuition_outstanding numeric,
  tuition_waived      numeric,
  transfer_amount     numeric,
  cash_amount         numeric,
  bookings_revenue    numeric,
  payroll_cost        numeric,
  expenses_total      numeric,
  costs_total         numeric,
  revenue             numeric,
  profit              numeric,
  students_active     integer,
  students_new        integer,
  students_continuing integer,
  students_returning  integer,
  students_left       integer,
  enrolments_active   integer,
  enrolments_new      integer,
  enrolments_renewed  integer,
  enrolments_ended    integer,
  class_switches      integer,
  invoices_overdue    integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_from  date := private.tuition_month(p_from);
  v_to    date := private.tuition_month(p_to);
  v_today date := public.studio_today();
begin
  if not (public.is_admin() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only an admin can see the finance report';
  end if;
  if v_from is null or v_to is null or v_from > v_to or v_to > v_from + interval '35 months' then
    raise exception 'INVALID_INPUT: pick up to 36 months, oldest first';
  end if;

  return query
  with months as (
    select g::date as m from generate_series(v_from, v_to, interval '1 month') g
  ), inv as (
    -- had_prev: the student had a live invoice for the class's previous course (or previous month)
    select i.*, (i.status <> 'void') as live,
           exists (select 1 from public.tuition_invoices p
                    where p.status <> 'void' and p.student_id = i.student_id and p.class_id = i.class_id
                      and (case when i.lesson_id is not null
                                then p.lesson_id = (select pl.id from public.class_lessons pl, public.class_lessons cl
                                                     where cl.id = i.lesson_id and pl.class_id = cl.class_id
                                                       and pl.starts_on < cl.starts_on order by pl.starts_on desc limit 1)
                                else p.month = (i.month - interval '1 month')::date end)) as had_prev
      from public.tuition_invoices i
     where i.month between v_from and v_to
  ), t as (
    select m.m,
           coalesce(sum(i.amount) filter (where i.status in ('unpaid', 'paid')), 0) as billed,
           coalesce(sum(i.paid_amount), 0) as collected,
           coalesce(sum(i.amount - i.paid_amount) filter (where i.status = 'unpaid'), 0) as outstanding,
           coalesce(sum(i.amount) filter (where i.status = 'waived'), 0) as waived,
           coalesce(sum(i.paid_amount) filter (where i.method = 'transfer'), 0) as by_transfer,
           coalesce(sum(i.paid_amount) filter (where i.method = 'cash'), 0) as by_cash,
           count(*) filter (where i.live)::integer as active,
           count(*) filter (where i.live and not i.had_prev and i.switched_from is null)::integer as fresh,
           count(*) filter (where i.live and i.had_prev)::integer as renewed,
           count(*) filter (where not i.live and i.void_reason <> 'switched')::integer as ended,
           -- a switch is the new class's invoice that came from another class
           count(*) filter (where i.switched_from is not null)::integer as switches,
           count(*) filter (where i.status = 'unpaid' and i.due_date < v_today)::integer as overdue
      from months m
      left join inv i on i.month = m.m
     group by m.m
  ), spans as (
    -- each live invoice covers its course, from its start to its (projected) last session
    select i.student_id,
           coalesce(l.starts_on, i.month) as from_day,
           coalesce(private.course_end(i.lesson_id), (coalesce(l.starts_on, i.month) + interval '1 month' - interval '1 day')::date) as to_day
      from public.tuition_invoices i
      left join public.class_lessons l on l.id = i.lesson_id
     where i.status <> 'void' and i.student_id is not null
  ), people as (
    select distinct g::date as month, sp.student_id
      from spans sp
      cross join lateral generate_series(date_trunc('month', sp.from_day)::date, date_trunc('month', sp.to_day)::date, interval '1 month') g
     where g::date between (v_from - interval '1 month')::date and v_to
  ), firsts as (
    select sp.student_id, min(date_trunc('month', sp.from_day))::date as first_month from spans sp group by sp.student_id
  ), flags as (
    select p.month, p.student_id,
           exists (select 1 from people q where q.student_id = p.student_id
                                            and q.month = (p.month - interval '1 month')::date) as continuing,
           f.first_month = p.month as fresh
      from people p
      join firsts f on f.student_id = p.student_id
     where p.month >= v_from
  ), s as (
    select m.m,
           count(fl.student_id)::integer as active,
           count(fl.student_id) filter (where fl.fresh)::integer as fresh,
           count(fl.student_id) filter (where fl.continuing)::integer as continuing,
           count(fl.student_id) filter (where not fl.fresh and not fl.continuing)::integer as returning
      from months m
      left join flags fl on fl.month = m.m
     group by m.m
  ), gone as (
    select m.m, count(p.student_id)::integer as n
      from months m
      left join people p on p.month = (m.m - interval '1 month')::date
       and not exists (select 1 from people q where q.student_id = p.student_id and q.month = m.m)
     group by m.m
  ), b as (
    select m.m, coalesce(sum(bk.real_income), 0) as income
      from months m
      left join public.bookings bk
        on bk.date >= m.m and bk.date < (m.m + interval '1 month')::date
       and bk.status in ('approved', 'completed')
     group by m.m
  ), e as (
    select m.m, coalesce(sum(x.amount), 0) as spent
      from months m
      left join public.expenses x on x.month = m.m
     group by m.m
  )
  select t.m, t.billed, t.collected, t.outstanding, t.waived, t.by_transfer, t.by_cash,
         b.income, pc.cost, e.spent, pc.cost + e.spent,
         t.collected + b.income,
         t.collected + b.income - pc.cost - e.spent,
         s.active, s.fresh, s.continuing, s.returning, gone.n,
         t.active, t.fresh, t.renewed, t.ended, t.switches, t.overdue
    from t
    join b on b.m = t.m
    join e on e.m = t.m
    join s on s.m = t.m
    join gone on gone.m = t.m
    cross join lateral (select coalesce(sum(p.total), 0) as cost from public.payroll_month(t.m) p) pc
   order by t.m;
end;
$$;

-- -----------------------------------------------------------------------------
-- Old monthly helpers are gone (every caller above is per course now).
-- -----------------------------------------------------------------------------
drop function private.bill_enrolment(uuid, bigint, date, public.tuition_renewal, date);
drop function private.open_month(date, date);

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function
  private.course_dates(bigint), private.course_nth(bigint, integer), private.course_end(bigint),
  private.course_held(bigint, date), private.course_finished(bigint, date),
  private.current_course(bigint, date), private.next_course(bigint, date),
  private.bill_course(uuid, bigint, date), private.bill_class(bigint, date, uuid),
  private.link_invoice_course(), private.on_course_changed()
from public, anon, authenticated;

revoke execute on function public.tuition_open_course(bigint) from public, anon;
grant execute on function public.tuition_open_course(bigint) to authenticated, service_role;
