-- =============================================================================
-- Class switches, expenses and a fuller profit — api-contract §3 "Tuition" / "Expenses", §5
--
--   * tuition_switch_class(): a student moves from one class to another. What they already
--     paid for the running month (and next month, if billed) moves with them: the old invoice
--     becomes void ('switched'), the new class's invoice records `switched_from` and carries the
--     money (a dearer class leaves the difference to pay, a cheaper one notes the surplus).
--     Reports count it as a switch, not as someone leaving plus someone new.
--   * expenses: every cost that isn't payroll (rent, utilities, the monthly video shoot,
--     costumes, a shoot location, equipment, marketing, …), optionally tied to one class, with
--     an optional receipt (private bucket `receipts`). recurring_expenses add the same cost every
--     month (rent, internet) through a daily job.
--   * finance_monthly / finance_by_class now subtract expenses: studio profit = revenue −
--     payroll − expenses; a class's margin = its tuition − its instructor's pay − costs tied to
--     it. Shared costs (rent, utilities…) stay at studio level. Student movement is also counted
--     per person (new / continuing / returning / left), so a class switch isn't churn.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Class switches
-- -----------------------------------------------------------------------------
alter table public.tuition_invoices drop constraint tuition_invoices_void_reason_check;
alter table public.tuition_invoices add constraint tuition_invoices_void_reason_check
  check (void_reason in ('stopped', 'not_renewed', 'removed', 'switched'));
alter table public.tuition_invoices
  add column switched_from bigint references public.tuition_invoices (id) on delete set null;
create index tuition_invoices_switched_from_idx on public.tuition_invoices (switched_from);

-- Staff move a student from p_from to p_to. Returns the new class's invoice for this month.
create function public.tuition_switch_class(p_student uuid, p_from bigint, p_to bigint, p_note text default null)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_month date := private.tuition_month(v_today);
  v_from_name text;
  v_to_name text;
  v_old public.tuition_invoices;
  v_new public.tuition_invoices;
  v_paid numeric;
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

  -- Into the new class: bills its running month (and next month from invoice_day).
  insert into public.class_students (class_id, student_id) values (p_to, p_student);

  -- Each open month of the old class moves across with whatever was paid on it.
  for v_old in
    select * from public.tuition_invoices
     where student_id = p_student and class_id = p_from and month >= v_month and status <> 'void'
     order by month
     for update
  loop
    perform private.bill_enrolment(p_student, p_to, v_old.month, v_old.renewal, v_today);
    select * into v_new from public.tuition_invoices
     where student_id = p_student and class_id = p_to and month = v_old.month
     for update;
    v_paid := v_old.paid_amount;

    update public.tuition_invoices n
       set paid_amount   = n.paid_amount + v_paid,
           status        = case
                             when v_old.status = 'waived' then 'waived'::public.tuition_status
                             when v_paid > 0 and n.paid_amount + v_paid >= n.amount then 'paid'::public.tuition_status
                             else n.status
                           end,
           paid_at       = case
                             when v_old.status <> 'waived' and v_paid > 0 and n.paid_amount + v_paid >= n.amount
                               then coalesce(v_old.paid_at, now())
                             else n.paid_at
                           end,
           method        = coalesce(v_old.method, n.method),
           renewal       = coalesce(v_old.renewal, n.renewal),
           switched_from = v_old.id,
           note          = left(concat_ws(' ',
                             format('Switched from %s.', v_from_name),
                             case when v_paid > n.amount then format('Paid %s more than this class costs.', v_paid - n.amount) end,
                             nullif(btrim(p_note), '')), 300),
           updated_by    = auth.uid()
     where n.id = v_new.id;

    update public.bank_transfers set invoice_id = v_new.id where invoice_id = v_old.id;
    update public.tuition_invoices
       set status = 'void', void_reason = 'switched', paid_amount = 0, paid_at = null, method = null,
           note = left(format('Moved to %s.', v_to_name), 300), updated_by = auth.uid()
     where id = v_old.id;
  end loop;

  -- Out of the old class (nothing unpaid is left on it to void).
  delete from public.class_students where class_id = p_from and student_id = p_student;

  select * into v_new from public.tuition_invoices
   where student_id = p_student and class_id = p_to and month = v_month;
  return v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------
-- rent · utilities (electricity, water, internet) · video (camera crew, editing) · costumes ·
-- shoot_location (studio / venue for a shoot) · equipment · marketing · events · maintenance ·
-- supplies (drinks, office) · other
create function private.is_expense_category(p_category text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_category in ('rent', 'utilities', 'video', 'costumes', 'shoot_location', 'equipment',
                        'marketing', 'events', 'maintenance', 'supplies', 'other');
$$;

create table public.recurring_expenses (
  id           bigint generated by default as identity primary key,
  category     text not null check (private.is_expense_category(category)),
  amount       numeric(12, 0) not null check (amount > 0),
  description  text not null check (char_length(btrim(description)) between 1 and 200),
  vendor       text check (char_length(vendor) <= 100),
  class_id     bigint references public.classes (id) on delete set null,
  method       public.payment_method,
  day_of_month smallint not null default 1 check (day_of_month between 1 and 28),
  starts_on    date not null default date_trunc('month', public.studio_today())::date
               check (starts_on = date_trunc('month', starts_on)::date),
  ends_on      date check (ends_on is null or (ends_on = date_trunc('month', ends_on)::date and ends_on >= starts_on)),
  active       boolean not null default true,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.expenses (
  id           bigint generated by default as identity primary key,
  spent_on     date not null,
  month        date generated always as (date_trunc('month', spent_on::timestamp)::date) stored,
  category     text not null check (private.is_expense_category(category)),
  amount       numeric(12, 0) not null check (amount > 0),
  description  text not null check (char_length(btrim(description)) between 1 and 200),
  vendor       text check (char_length(vendor) <= 100),
  class_id     bigint references public.classes (id) on delete set null,
  method       public.payment_method,
  receipt_path text check (char_length(receipt_path) <= 300),
  recurring_id bigint references public.recurring_expenses (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint expenses_recurring_once unique (recurring_id, month)
);
create index expenses_month_idx on public.expenses (month);
create index expenses_class_month_idx on public.expenses (class_id, month);
create index expenses_created_by_idx on public.expenses (created_by);

create trigger set_updated_at before update on public.recurring_expenses
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

-- RLS: admins see and change everything; staff record petty costs and see/change their own.
alter table public.expenses enable row level security;
alter table public.recurring_expenses enable row level security;

create policy expenses_select on public.expenses
  for select to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and created_by = (select auth.uid())));
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check ((select public.is_admin()) or ((select public.is_staff()) and created_by = (select auth.uid())));
create policy expenses_update on public.expenses
  for update to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and created_by = (select auth.uid())))
  with check ((select public.is_admin()) or ((select public.is_staff()) and created_by = (select auth.uid())));
create policy expenses_delete on public.expenses
  for delete to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and created_by = (select auth.uid())));

create policy recurring_expenses_admin on public.recurring_expenses
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.expenses, public.recurring_expenses from anon;
revoke truncate, references, trigger on public.expenses, public.recurring_expenses from authenticated;

-- Recurring costs land on their day each month (idempotent). Daily job; admins may run it.
create function public.expenses_run_recurring(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_month date;
  v_count integer;
begin
  if not (private.is_service_context() or public.is_admin()) then
    raise exception 'FORBIDDEN: only an admin can run recurring expenses';
  end if;
  v_today := case when private.is_service_context() then coalesce(p_today, public.studio_today()) else public.studio_today() end;
  v_month := private.tuition_month(v_today);
  insert into public.expenses (spent_on, category, amount, description, vendor, class_id, method, recurring_id, created_by)
  select v_month + (r.day_of_month - 1), r.category, r.amount, r.description, r.vendor, r.class_id, r.method, r.id, r.created_by
    from public.recurring_expenses r
   where r.active and r.starts_on <= v_month and (r.ends_on is null or r.ends_on >= v_month)
     and extract(day from v_today) >= r.day_of_month
  on conflict on constraint expenses_recurring_once do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Receipts: private bucket, {expense_id}/{file}. Whoever can see the expense can see its receipt.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function private.can_access_receipt(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := regexp_match(coalesce(p_name, ''), '^([0-9]{1,18})/[A-Za-z0-9._-]{1,120}$');
begin
  if v_parts is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1 from public.expenses e
     where e.id = v_parts[1]::bigint
       and (public.is_admin() or (public.is_staff() and e.created_by = auth.uid()))
  );
end;
$$;
revoke execute on function private.can_access_receipt(text) from public, anon;
grant execute on function private.can_access_receipt(text) to authenticated;

create policy oops_receipts_select on storage.objects
  for select to authenticated using (bucket_id = 'receipts' and private.can_access_receipt(name));
create policy oops_receipts_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts' and private.can_access_receipt(name));
create policy oops_receipts_update on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and private.can_access_receipt(name))
  with check (bucket_id = 'receipts' and private.can_access_receipt(name));
create policy oops_receipts_delete on storage.objects
  for delete to authenticated using (bucket_id = 'receipts' and private.can_access_receipt(name));

-- -----------------------------------------------------------------------------
-- Finance report, now with expenses and per-person movement
-- -----------------------------------------------------------------------------
drop function public.finance_monthly(date, date);
drop function public.finance_by_class(date);

-- One row per month from p_from to p_to (at most 36).
--   revenue  = tuition_collected + bookings_revenue
--   costs    = payroll_cost + expenses_total;  profit = revenue − costs
--   students_*: people, not class memberships — new (first month ever), continuing (also here
--   last month), returning (back after a break), left (here last month, not this month).
--   enrolments_* stay per class membership; switches are counted apart (class_switches).
create function public.finance_monthly(p_from date, p_to date)
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
    select i.*, (i.status <> 'void') as live,
           exists (select 1 from public.tuition_invoices p
                    where p.status <> 'void' and p.student_id = i.student_id and p.class_id = i.class_id
                      and p.month = (i.month - interval '1 month')::date) as had_prev
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
           count(*) filter (where i.void_reason = 'switched')::integer as switches,
           count(*) filter (where i.status = 'unpaid' and i.due_date < v_today)::integer as overdue
      from months m
      left join inv i on i.month = m.m
     group by m.m
  ), people as (
    -- one row per student and month they were active (any live invoice)
    select distinct i.month, i.student_id
      from public.tuition_invoices i
     where i.status <> 'void' and i.student_id is not null
       and i.month between (v_from - interval '1 month')::date and v_to
  ), firsts as (
    select i.student_id, min(i.month) as first_month
      from public.tuition_invoices i
     where i.status <> 'void' and i.student_id is not null
     group by i.student_id
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

-- Per class for one month. margin = collected − instructor_pay − direct_costs (expenses tied to
-- the class). Shared costs (rent, utilities, …) are not split across classes.
create function public.finance_by_class(p_month date)
returns table (
  class_id        bigint,
  class_name      text,
  instructor_name text,
  students        integer,
  billed          numeric,
  collected       numeric,
  outstanding     numeric,
  sessions        integer,
  instructor_pay  numeric,
  direct_costs    numeric,
  margin          numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_month date := private.tuition_month(p_month);
  v_next  date := (private.tuition_month(p_month) + interval '1 month')::date;
  v_rate  numeric := (select s.default_session_rate from public.payroll_settings s where s.id = 1);
begin
  if not (public.is_admin() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only an admin can see the finance report';
  end if;

  return query
  with inv as (
    select i.class_id as cid, max(i.class_name) as cname,
           count(*) filter (where i.status <> 'void')::integer as n,
           coalesce(sum(i.amount) filter (where i.status in ('unpaid', 'paid')), 0) as billed,
           coalesce(sum(i.paid_amount), 0) as collected,
           coalesce(sum(i.amount - i.paid_amount) filter (where i.status = 'unpaid'), 0) as outstanding
      from public.tuition_invoices i
     where i.month = v_month
     group by i.class_id
  ), sess as (
    select a.class_id as cid, count(*)::integer as n, sum(coalesce(r.session_rate, v_rate)) as pay
      from public.instructor_attendance a
      left join public.class_pay_rates r on r.class_id = a.class_id
     where a.status = 'completed' and a.date >= v_month and a.date < v_next
     group by a.class_id
  ), costs as (
    select x.class_id as cid, sum(x.amount) as spent
      from public.expenses x
     where x.month = v_month and x.class_id is not null
     group by x.class_id
  ), ids as (
    select cid from inv union select cid from sess union select cid from costs
  )
  select ids.cid,
         coalesce(c.name, inv.cname, ''),
         coalesce(nullif(btrim(p.full_name), ''), p.username, ''),
         coalesce(inv.n, 0),
         coalesce(inv.billed, 0),
         coalesce(inv.collected, 0),
         coalesce(inv.outstanding, 0),
         coalesce(sess.n, 0),
         coalesce(sess.pay, 0),
         coalesce(costs.spent, 0),
         coalesce(inv.collected, 0) - coalesce(sess.pay, 0) - coalesce(costs.spent, 0)
    from ids
    left join inv on inv.cid is not distinct from ids.cid
    left join sess on sess.cid = ids.cid
    left join costs on costs.cid = ids.cid
    left join public.classes c on c.id = ids.cid
    left join public.profiles p on p.id = c.instructor_id
   order by coalesce(inv.collected, 0) - coalesce(sess.pay, 0) - coalesce(costs.spent, 0) desc, 2;
end;
$$;

-- Expenses per month and category: { month, category, amount, items }.
create function public.finance_expenses(p_from date, p_to date)
returns table (month date, category text, amount numeric, items integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (public.is_admin() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only an admin can see the finance report';
  end if;
  return query
  select x.month, x.category, sum(x.amount), count(*)::integer
    from public.expenses x
   where x.month between private.tuition_month(p_from) and private.tuition_month(p_to)
   group by x.month, x.category
   order by x.month, sum(x.amount) desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Demo data (seed.sql / seed-demo.mjs; service role on a sandbox only): recurring rent,
-- internet and ads; monthly electricity, supplies and the end-of-month shoot; some one-offs
-- (a speaker, new mirrors, costumes and a shoot location tied to classes); one student who
-- switched class this month.
-- -----------------------------------------------------------------------------
create function public.seed_demo_finance()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_month date := private.tuition_month(v_today);
  v_admin uuid := (select id from public.profiles where email = 'admin@demo.oopsdance.test');
  v_staff uuid := (select id from public.profiles where email = 'staff@demo.oopsdance.test');
  v_adv   bigint := (select id from public.classes where name = 'K-pop Cover Nâng Cao');
  v_choreo bigint := (select id from public.classes where name = 'Choreography Sáng Tạo');
  m date;
  k integer;
  r record;
  v_target bigint;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo finance is only seeded on a sandbox';
  end if;

  insert into public.recurring_expenses (category, amount, description, vendor, day_of_month, starts_on, method, created_by) values
    ('rent', 12000000, 'Thuê mặt bằng tầng 7, 25 Trung Phụng', 'Chủ nhà', 1, (v_month - interval '3 months')::date, 'transfer', v_admin),
    ('utilities', 330000, 'Internet cáp quang', 'FPT Telecom', 5, (v_month - interval '3 months')::date, 'transfer', v_admin),
    ('marketing', 1500000, 'Quảng cáo Facebook & TikTok', 'Meta / TikTok', 3, (v_month - interval '3 months')::date, 'transfer', v_admin);

  for k in reverse 3..0 loop
    m := (v_month - make_interval(months => k))::date;
    -- the recurring ones, for past months and (when their day has come) this month
    insert into public.expenses (spent_on, category, amount, description, vendor, method, recurring_id, created_by)
    select m + (r2.day_of_month - 1), r2.category, r2.amount, r2.description, r2.vendor, r2.method, r2.id, r2.created_by
      from public.recurring_expenses r2
     where m < v_month or extract(day from v_today) >= r2.day_of_month
    on conflict on constraint expenses_recurring_once do nothing;

    if m < v_month then
      insert into public.expenses (spent_on, category, amount, description, vendor, method, created_by) values
        (m + 7,  'utilities', 1800000 + (k * 230000), format('Tiền điện tháng %s', to_char(m, 'MM')), 'EVN Hà Nội', 'transfer', v_admin),
        (m + 9,  'utilities', 380000, format('Nước & vệ sinh tháng %s', to_char(m, 'MM')), null, 'cash', v_staff),
        (m + 14, 'supplies', 320000 + (k * 40000), 'Nước uống, khăn giấy, băng dính', 'Siêu thị', 'cash', v_staff),
        (m + 26, 'video', 3000000, format('Camera man + dựng video buổi quay cuối tháng %s', to_char(m, 'MM')), 'Quang Media', 'transfer', v_admin);
    elsif extract(day from v_today) >= 8 then
      insert into public.expenses (spent_on, category, amount, description, vendor, method, created_by) values
        (m + 7, 'utilities', 2050000, format('Tiền điện tháng %s', to_char(m, 'MM')), 'EVN Hà Nội', 'transfer', v_admin);
    end if;
  end loop;

  -- one-offs
  insert into public.expenses (spent_on, category, amount, description, vendor, class_id, method, created_by) values
    ((v_month - interval '3 months')::date + 11, 'equipment', 7990000, 'Loa JBL PartyBox cho phòng A', 'Điện máy Xanh', null, 'transfer', v_admin),
    ((v_month - interval '2 months')::date + 16, 'maintenance', 2200000, 'Thay tấm gương vỡ phòng B', 'Kính Hoà Phát', null, 'cash', v_admin),
    ((v_month - interval '1 month')::date + 22, 'costumes', 1200000, 'Thuê trang phục quay bài cuối tháng', 'Tiệm đồ diễn Hàng Bạc', v_adv, 'cash', v_staff),
    ((v_month - interval '1 month')::date + 25, 'shoot_location', 2500000, 'Thuê studio quay MV cuối tháng', 'Kho Studio', v_choreo, 'transfer', v_admin),
    ((v_month - interval '2 months')::date + 24, 'costumes', 900000, 'Thuê áo đồng phục lớp quay video', 'Tiệm đồ diễn Hàng Bạc', v_choreo, 'cash', v_staff);

  -- One student switched class this month: their paid month moved to a dearer class.
  select cs.student_id, cs.class_id into r
    from public.class_students cs
    join public.profiles p on p.id = cs.student_id
    join public.tuition_invoices i on i.student_id = cs.student_id and i.class_id = cs.class_id
                                  and i.month = v_month and i.status = 'paid'
   where p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
     and (select count(*) from public.class_students x where x.student_id = cs.student_id) = 1
   order by p.email
   limit 1;
  if found then
    select c.id into v_target from public.classes c
     where c.id <> r.class_id
       and not exists (select 1 from public.class_students x where x.student_id = r.student_id and x.class_id = c.id)
     order by c.price desc, c.id
     limit 1;
    if v_target is not null then
      perform public.tuition_switch_class(r.student_id, r.class_id, v_target, 'Muốn học lớp nâng cao hơn.');
    end if;
  end if;

  return jsonb_build_object(
    'expenses', (select count(*) from public.expenses),
    'recurring', (select count(*) from public.recurring_expenses),
    'switched', (select count(*) from public.tuition_invoices where void_reason = 'switched'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants and the daily job
-- -----------------------------------------------------------------------------
revoke execute on function private.is_expense_category(text) from public, anon;
grant execute on function private.is_expense_category(text) to authenticated, service_role;

revoke execute on function
  public.tuition_switch_class(uuid, bigint, bigint, text),
  public.expenses_run_recurring(date),
  public.finance_monthly(date, date),
  public.finance_by_class(date),
  public.finance_expenses(date, date),
  public.seed_demo_finance()
from public, anon;
grant execute on function
  public.tuition_switch_class(uuid, bigint, bigint, text),
  public.expenses_run_recurring(date),
  public.finance_monthly(date, date),
  public.finance_by_class(date),
  public.finance_expenses(date, date)
to authenticated, service_role;
revoke execute on function public.seed_demo_finance() from authenticated;
grant execute on function public.seed_demo_finance() to service_role;

-- 00:15 Asia/Ho_Chi_Minh daily (= 17:15 UTC).
select cron.schedule(
  'expenses-recurring',
  '15 17 * * *',
  $$select public.expenses_run_recurring()$$
);
