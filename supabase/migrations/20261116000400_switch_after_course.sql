-- =============================================================================
-- Class switches happen between courses — api-contract §3 class_students, §5 tuition_switch_class
--
--   The studio doesn't switch classes in the middle of a course and doesn't refund a course that
--   was started. A switch is: the student joins the new class's upcoming course (starting today or
--   later, paid in full), and finishes the course they paid for in the old class, leaving after its
--   last session (class_students.leaves_after). Their invoice for the old class's next course, if
--   it was already opened, is cancelled ('switched'); money paid on it moves to the new course.
--   If the old class has no running course, they leave it now; if the new class has no upcoming
--   course they join its running one (a normal late join, pro-rated).
--   Members join a class from joined_at: courses that end before it aren't billed to them.
-- =============================================================================

alter table public.class_students add column leaves_after date;

-- Bills a class (or one member): the running course for whoever lacks an invoice and is in the class
-- for it, and the next course once its renewal is open — not for someone leaving before it starts.
create or replace function private.bill_class(p_class bigint, p_today date, p_student uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cur bigint := private.current_course(p_class, p_today);
  v_next bigint := private.next_course(p_class, p_today);
  v_cur_end date := case when v_cur is not null then private.course_end(v_cur) end;
  v_next_start date := (select l.starts_on from public.class_lessons l where l.id = v_next);
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
    select cs.student_id, cs.joined_at, cs.leaves_after from public.class_students cs
     where cs.class_id = p_class and (p_student is null or cs.student_id = p_student)
  loop
    -- the running course, for members already in the class (someone joining later is billed for the
    -- course they join from, when they enrol)
    if v_cur is not null and r.joined_at <= p_today and coalesce(v_cur_end, p_today) >= r.joined_at
       and not exists (select 1 from public.tuition_invoices i where i.student_id = r.student_id and i.lesson_id = v_cur) then
      if private.bill_course(r.student_id, v_cur, p_today) is not null then v_count := v_count + 1; end if;
    end if;
    -- the next one, once its renewal is open, unless they leave before it starts
    if v_open and (r.leaves_after is null or r.leaves_after >= v_next_start)
       and not exists (select 1 from public.tuition_invoices i where i.student_id = r.student_id and i.lesson_id = v_next) then
      if private.bill_course(r.student_id, v_next, p_today) is not null then v_count := v_count + 1; end if;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Staff switch a student to another class from its upcoming course. Returns the new course's invoice.
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
  v_cur_from bigint;
  v_leave date;
  v_target bigint;
  v_target_start date;
  v_new public.tuition_invoices;
  v_move numeric := 0;
  v_first bigint;
  v_method public.payment_method;
  v_paid_at timestamptz;
  v_old record;
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

  -- They finish the course they're in (paid, no refund) and leave after its last session.
  v_cur_from := private.current_course(p_from, v_today);
  v_leave := case when v_cur_from is not null then coalesce(private.course_end(v_cur_from), v_today) else v_today end;

  -- The new class's upcoming course (starting today or later); its running one only when the old
  -- class has nothing running (then it's a normal late join).
  select l.id, l.starts_on into v_target, v_target_start
    from public.class_lessons l
   where l.class_id = p_to and l.starts_on >= v_today
     and not exists (select 1 from public.classes c where c.id = p_to and c.ended_on is not null and l.starts_on > c.ended_on)
   order by l.starts_on limit 1;
  if v_target is null and v_cur_from is null then
    v_target := private.current_course(p_to, v_today);
    v_target_start := v_today;
  end if;
  if v_target is null then
    raise exception 'INVALID_STATE: % has no upcoming course; plan its next course first', v_to_name;
  end if;

  -- Old class: the invoices of courses after the one they finish are cancelled; their money moves.
  for v_old in
    select i.* from public.tuition_invoices i
      join public.class_lessons l on l.id = i.lesson_id
     where i.student_id = p_student and i.class_id = p_from and i.status <> 'void'
       and l.starts_on > v_leave
     order by l.starts_on
     for update of i
  loop
    v_first := coalesce(v_first, v_old.id);
    v_move := v_move + v_old.paid_amount;
    if v_old.paid_amount > 0 then
      v_method := coalesce(v_old.method, v_method);
      v_paid_at := coalesce(v_old.paid_at, v_paid_at);
    end if;
    update public.tuition_invoices
       set status = 'void', void_reason = 'switched', paid_amount = 0, paid_at = null, method = null,
           note = left(format('Moved to %s.', v_to_name), 300), updated_by = auth.uid()
     where id = v_old.id;
  end loop;

  update public.class_students set leaves_after = v_leave where class_id = p_from and student_id = p_student;
  if v_leave <= v_today and v_cur_from is null then
    delete from public.class_students where class_id = p_from and student_id = p_student;
  end if;

  -- New class: a member from the target course's start, billed for it.
  insert into public.class_students (class_id, student_id, joined_at) values (p_to, p_student, greatest(v_target_start, v_today));
  perform private.bill_course(p_student, v_target, v_today);
  select * into v_new from public.tuition_invoices where student_id = p_student and lesson_id = v_target for update;

  update public.tuition_invoices n
     set paid_amount   = n.paid_amount + v_move,
         status        = case when v_move > 0 and n.paid_amount + v_move >= n.amount then 'paid'::public.tuition_status else n.status end,
         paid_at       = case when v_move > 0 and n.paid_amount + v_move >= n.amount then coalesce(v_paid_at, now()) else n.paid_at end,
         method        = case when v_move > 0 then coalesce(v_method, n.method) else n.method end,
         renewal       = 'continue',
         switched_from = coalesce(v_first, (select i.id from public.tuition_invoices i
                                             where i.student_id = p_student and i.lesson_id = v_cur_from)),
         note          = left(concat_ws(' ',
                           format('Switched from %s.', v_from_name),
                           case when v_move > n.amount then format('Paid %s more than this course costs.', v_move - n.amount) end,
                           nullif(btrim(p_note), '')), 300),
         updated_by    = auth.uid()
   where n.id = v_new.id;
  if v_first is not null then
    update public.bank_transfers t set invoice_id = v_new.id
      from public.tuition_invoices i
     where t.invoice_id = i.id and i.student_id = p_student and i.class_id = p_from and i.void_reason = 'switched';
  end if;

  select * into v_new from public.tuition_invoices where id = v_new.id;
  return v_new;
end;
$$;

-- The daily cycle also takes out students whose leave date has passed.
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

  -- 1. Students past their leave date (switched class, finished their course) leave.
  delete from public.class_students where leaves_after is not null and leaves_after < v_today;
  get diagnostics v_n = row_count;
  v_ended := v_ended + v_n;

  -- 2. Running courses are billed and renewals open when it's time.
  for c in select x.id from public.classes x where x.ended_on is null or x.ended_on >= v_today loop
    v_billed := v_billed + private.bill_class(c.id, v_today);
  end loop;

  -- 3. Unpaid, unanswered and past due: not renewed.
  update public.tuition_invoices
     set status = 'void', void_reason = 'not_renewed'
   where status = 'unpaid' and renewal is null and paid_amount = 0 and due_date < v_today;
  get diagnostics v_voided = row_count;

  -- 4. Whoever has a cancelled invoice for the course their class is running leaves the class.
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

-- Enrolling from an upcoming course (joined_at in the future) bills that course right away, in full.
create or replace function private.on_enrolment_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_course bigint;
begin
  -- Back in the class: cancelled invoices of courses that aren't over come back.
  update public.tuition_invoices i
     set status = 'unpaid', void_reason = null, renewal = 'continue'
   where i.student_id = new.student_id and i.class_id = new.class_id and i.status = 'void'
     and i.void_reason in ('stopped', 'not_renewed', 'removed')
     and i.lesson_id is not null and not private.course_finished(i.lesson_id, v_today);
  if new.joined_at > v_today then
    select l.id into v_course from public.class_lessons l
     where l.class_id = new.class_id and l.starts_on >= new.joined_at order by l.starts_on limit 1;
    if v_course is not null then
      perform private.bill_course(new.student_id, v_course, v_today);
    end if;
  end if;
  perform private.bill_class(new.class_id, v_today, new.student_id);
  return null;
end;
$$;
