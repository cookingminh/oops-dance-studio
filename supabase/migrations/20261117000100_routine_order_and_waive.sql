-- Routines follow each other, and a waive comes off cleanly (api-contract §3 Routines, §5 tuition_waive).
--
--   * A class learns one routine at a time: the next one starts after the last session (the shoot day)
--     of the one before, and a routine ends before the next one starts. Checked when staff plan or
--     change a routine (start day or number of sessions). Seeds and jobs (service context) aren't
--     checked: a session cancelled later can still push a routine's end past the next start — the
--     Routines tab shows that overlap so staff move the next one.
--   * Waiving an invoice with a reason ("Free trial course") replaced its note; reopening it kept the
--     reason. The note from before the waive is kept aside and comes back on reopen.
--   * seed_demo_fit_routines(): past demo routines last as many sessions as their month really held
--     (cancelled sessions don't count), so they end inside their month and don't overlap. Runs after the
--     demo tuition (which adds older courses) and trims their invoices' session counts to match.

-- -----------------------------------------------------------------------------
-- One routine at a time
-- -----------------------------------------------------------------------------
create function private.check_routine_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev record;
  v_next record;
  v_end date;
begin
  if private.is_service_context() then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.starts_on is not distinct from old.starts_on
     and new.session_count is not distinct from old.session_count then
    return null;
  end if;

  -- The routine before it must be over (its projected last session) before this one starts.
  select l.id, l.title into v_prev
    from public.class_lessons l
   where l.class_id = new.class_id and l.id <> new.id and l.starts_on < new.starts_on
   order by l.starts_on desc
   limit 1;
  if found then
    v_end := private.course_end(v_prev.id);
    if v_end is not null and v_end >= new.starts_on then
      raise exception 'INVALID_STATE: routine order: "%" runs until %; start the next routine after it', v_prev.title, v_end;
    end if;
  end if;

  -- And this one must be over before the next one starts.
  select l.id, l.title, l.starts_on into v_next
    from public.class_lessons l
   where l.class_id = new.class_id and l.id <> new.id and l.starts_on > new.starts_on
   order by l.starts_on
   limit 1;
  if found then
    v_end := private.course_end(new.id);
    if v_end is not null and v_end >= v_next.starts_on then
      raise exception 'INVALID_STATE: routine order: this routine runs until %, after "%" starts on %', v_end, v_next.title, v_next.starts_on;
    end if;
  end if;
  return null;
end;
$$;

create trigger routine_order
  after insert or update of starts_on, session_count on public.class_lessons
  for each row execute function private.check_routine_order();

-- -----------------------------------------------------------------------------
-- Waive / reopen keep the note straight
-- -----------------------------------------------------------------------------
alter table public.tuition_invoices add column note_before_waive text;
comment on column public.tuition_invoices.note_before_waive is
  'The note an invoice had before it was waived (the waive reason replaces it); restored by tuition_reopen.';

create or replace function public.tuition_waive(p_invoice bigint, p_note text default null)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can waive tuition';
  end if;
  v := private.invoice_for_caller(p_invoice, false);
  if v.status <> 'unpaid' or v.paid_amount > 0 then
    raise exception 'INVALID_STATE: only an unpaid invoice can be waived';
  end if;
  update public.tuition_invoices
     set status = 'waived', renewal = coalesce(renewal, 'continue'),
         note_before_waive = note,
         note = coalesce(left(nullif(btrim(p_note), ''), 300), note), updated_by = auth.uid()
   where id = v.id;
  select * into v from public.tuition_invoices where id = p_invoice;
  return v;
end;
$$;

create or replace function public.tuition_reopen(p_invoice bigint)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can reopen invoices';
  end if;
  v := private.invoice_for_caller(p_invoice, false);
  if v.status = 'waived' then
    -- The waive reason goes; the note from before comes back (none for invoices waived before this).
    update public.tuition_invoices
       set status = 'unpaid', note = note_before_waive, note_before_waive = null, updated_by = auth.uid()
     where id = v.id;
  elsif v.status <> 'void' or not private.reinstate(v.id) then
    raise exception 'INVALID_STATE: this invoice can''t be reopened';
  end if;
  select * into v from public.tuition_invoices where id = p_invoice;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Demo data: past routines end inside their month
-- -----------------------------------------------------------------------------
create function public.seed_demo_fit_routines()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo routines are only fitted on a sandbox';
  end if;
  with fit as (
    select l.id, greatest(1, (select count(*)::int from private.course_dates(l.id) cd
                               where cd.d < (l.month + interval '1 month')::date)) as sessions
      from public.class_lessons l
     where l.month < date_trunc('month', public.studio_today())::date
  )
  update public.class_lessons l
     set session_count = fit.sessions
    from fit
   where fit.id = l.id and l.session_count <> fit.sessions;
  get diagnostics v_n = row_count;
  -- Their invoices said how many sessions they covered.
  update public.tuition_invoices i
     set sessions = l.session_count
    from public.class_lessons l
   where l.id = i.lesson_id and i.sessions > l.session_count;
  return v_n;
end;
$$;

revoke all on function public.seed_demo_fit_routines() from public, anon, authenticated;
grant execute on function public.seed_demo_fit_routines() to service_role;
revoke all on function private.check_routine_order() from public, anon, authenticated;
