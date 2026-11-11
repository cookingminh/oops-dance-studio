-- =============================================================================
-- Booking cancellations and refunds — api-contract §3 bookings (cancel / refund columns), booking_settings,
-- §5 Booking refunds
--
--   The studio's cancellation policy (booking_settings, admin): cancelling at least `refund_full_hours`
--   before the booking starts gets everything back (off when null), at least `refund_partial_hours`
--   before gets `refund_partial_percent` % back, later gets nothing. A booking the studio hasn't
--   approved yet gets everything back, and so does one the studio cancels or rejects itself.
--   * Guests can now cancel their approved bookings too (before they start): cancel_booking() works out
--     the refund from the policy; booking_cancel_quote() shows it before they confirm.
--   * The refund is a debt (`refund_due`) until staff pay it back (booking_refund: it moves to `refund_paid`)
--     or change it with a reason (booking_set_refund). real_income becomes what the studio keeps, so the money kept from a
--     cancelled booking counts as income (the revenue reports now include cancelled bookings).
--   * Staff changing a status by hand: rejecting or cancelling a booking that has money on it makes all of
--     it due back; reopening it clears the cancellation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The policy
-- -----------------------------------------------------------------------------
create table public.booking_settings (
  id                     smallint primary key default 1 check (id = 1),
  refund_full_hours      smallint check (refund_full_hours between 1 and 720),
  refund_partial_hours   smallint not null default 24 check (refund_partial_hours between 1 and 720),
  refund_partial_percent smallint not null default 50 check (refund_partial_percent between 0 and 100),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.profiles (id) on delete set null,
  constraint booking_settings_full_after_partial check (refund_full_hours is null or refund_full_hours > refund_partial_hours)
);
insert into public.booking_settings (id) values (1);

alter table public.booking_settings enable row level security;
-- Everyone sees the policy (it is shown before booking); admins change it through booking_set_refund_policy.
create policy booking_settings_select on public.booking_settings for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.booking_settings from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Cancellation and refund on the booking
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles (id) on delete set null,
  add column cancel_kind  text check (cancel_kind in ('guest', 'studio')),
  add column refund_due   numeric(12, 0) not null default 0 check (refund_due >= 0),
  add column refund_paid  numeric(12, 0) not null default 0 check (refund_paid >= 0),
  add column refund_to    text check (char_length(refund_to) <= 200),
  add column refund_note  text check (char_length(refund_note) <= 300),
  add column refunded_at  timestamptz;

create index bookings_refund_due_idx on public.bookings (cancelled_at) where refund_due > 0;

-- When the booking starts, as a moment in time (studio time).
create function private.booking_starts_at(b public.bookings)
returns timestamptz
language sql
stable
set search_path = ''
as $$ select (b.date + b.start_time) at time zone 'Asia/Ho_Chi_Minh'; $$;

-- What cancelling `b` at p_at gives back: { received, percent, refund, keep, hours_before, tier }.
--   tier  'studio'  the studio cancels: everything back
--         'pending' not approved yet: everything back
--         'full' / 'partial' / 'none'  the policy, by hours before the start
create function private.booking_refund_quote(b public.bookings, p_by_studio boolean, p_at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.booking_settings;
  v_received numeric := coalesce(b.bank_transfer, 0) + coalesce(b.cash, 0);
  v_hours numeric := extract(epoch from private.booking_starts_at(b) - p_at) / 3600;
  v_tier text;
  v_percent int;
  v_refund numeric;
begin
  select * into s from public.booking_settings where id = 1;
  if p_by_studio then
    v_tier := 'studio'; v_percent := 100;
  elsif b.status = 'pending' then
    v_tier := 'pending'; v_percent := 100;
  elsif s.refund_full_hours is not null and v_hours >= s.refund_full_hours then
    v_tier := 'full'; v_percent := 100;
  elsif v_hours >= s.refund_partial_hours then
    v_tier := 'partial'; v_percent := s.refund_partial_percent;
  else
    v_tier := 'none'; v_percent := 0;
  end if;
  v_refund := least(v_received, round(v_received * v_percent / 100.0));
  return jsonb_build_object('received', v_received, 'percent', v_percent, 'refund', v_refund,
                            'keep', v_received - v_refund, 'hours_before', round(v_hours, 1), 'tier', v_tier,
                            'full_hours', s.refund_full_hours, 'partial_hours', s.refund_partial_hours,
                            'partial_percent', s.refund_partial_percent);
end;
$$;

-- Staff changing the status by hand (the booking form): rejecting or cancelling a booking with money on it
-- makes all of it due back; bringing it back clears the cancellation. cancel_booking() fills the columns
-- itself (cancelled_at set in the same update), so this leaves it alone.
create function private.booking_status_money()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_received numeric := coalesce(new.bank_transfer, 0) + coalesce(new.cash, 0);
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status in ('cancelled', 'rejected') and old.status not in ('cancelled', 'rejected') then
    if new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
      new.cancel_kind := 'studio';
      new.refund_due := v_received;
      new.real_income := 0;
    end if;
  elsif old.status in ('cancelled', 'rejected') and new.status not in ('cancelled', 'rejected') then
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.cancel_kind := null;
    new.refund_due := 0;
    new.refund_paid := 0;
    new.refund_to := null;
    new.refund_note := null;
    new.real_income := v_received;
  end if;
  return new;
end;
$$;

create trigger booking_status_money before update of status on public.bookings
  for each row execute function private.booking_status_money();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- What cancelling now would give back (the guest's own booking, or staff). p_by_studio: the studio cancels.
create function public.booking_cancel_quote(p_booking bigint, p_by_studio boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_staff boolean := public.is_staff() or private.is_service_context();
begin
  select * into b from public.bookings where id = p_booking;
  if not found or (b.guest_id is distinct from auth.uid() and not v_staff) then
    raise exception 'NOT_FOUND: booking % not found', p_booking;
  end if;
  return private.booking_refund_quote(b, p_by_studio and v_staff, now());
end;
$$;

-- Cancel a booking.
--   The guest (their own, pending or approved, before it starts): the refund follows the policy; p_refund_to
--   is where they want the money (bank account, ≤ 200 characters).
--   Staff (pending or approved): p_by_studio = the studio cancels (everything back), else the guest asked
--   (the policy). p_refund overrides the amount (0 … received) with a reason in p_note.
-- The money due back is kept in refund_due until staff pay it (booking_refund).
drop function public.cancel_booking(bigint);
create function public.cancel_booking(p_booking_id bigint, p_by_studio boolean default false, p_refund numeric default null,
                                      p_note text default null, p_refund_to text default null)
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
  v_quote jsonb;
  v_refund numeric;
  v_received numeric;
  v_note text := left(nullif(btrim(p_note), ''), 300);
begin
  if v_uid is null and not v_staff then
    raise exception 'FORBIDDEN: sign in to cancel a booking';
  end if;

  select * into v_row from public.bookings b where b.id = p_booking_id for update;
  -- Other users' bookings are reported as missing (do not leak existence).
  if not found or (v_row.guest_id is distinct from v_uid and not v_staff) then
    raise exception 'NOT_FOUND: booking % not found', p_booking_id;
  end if;
  -- A booking paid in full is `completed` (20261117001000) but can still be cancelled before it starts.
  if v_row.status not in ('pending', 'approved', 'completed')
     or (v_row.status = 'completed' and private.booking_starts_at(v_row) <= now()) then
    raise exception 'INVALID_STATE: booking is already %', v_row.status;
  end if;
  if not v_staff and private.booking_starts_at(v_row) <= now() then
    raise exception 'INVALID_STATE: the booking has already started';
  end if;

  v_received := coalesce(v_row.bank_transfer, 0) + coalesce(v_row.cash, 0);
  v_quote := private.booking_refund_quote(v_row, p_by_studio and v_staff, now());
  v_refund := (v_quote ->> 'refund')::numeric;
  if v_staff and p_refund is not null and round(p_refund) <> v_refund then
    if round(p_refund) < 0 or round(p_refund) > v_received then
      raise exception 'INVALID_INPUT: the refund is between 0 and what was paid (%)', v_received;
    end if;
    if v_note is null then
      raise exception 'INVALID_INPUT: say why the refund differs from the policy';
    end if;
    v_refund := round(p_refund);
  end if;

  perform set_config('oops.activity', 'off', true);
  update public.bookings b
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancel_kind = case when v_staff and p_by_studio then 'studio' else 'guest' end,
         refund_due = v_refund,
         refund_to = left(nullif(btrim(p_refund_to), ''), 200),
         refund_note = v_note,
         real_income = greatest(v_received - v_refund, 0)
   where b.id = p_booking_id
  returning * into v_row;
  perform set_config('oops.activity', '', true);
  perform private.log_booking_money(v_row, 'cancelled', jsonb_build_object(
    'refund', v_refund, 'percent', v_quote -> 'percent', 'tier', case when v_staff and p_by_studio then 'studio' else v_quote ->> 'tier' end,
    'by_studio', v_staff and p_by_studio, 'note', v_note));
  return v_row;
end;
$$;

-- Staff paid the refund back: by transfer (default) or cash. The money leaves the way it came in where it
-- can (the chosen way first, then the other); real_income already excludes it.
create function public.booking_refund(p_booking bigint, p_method public.payment_method default 'transfer', p_note text default null)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_amount numeric;
  v_from_chosen numeric;
  v_from_other numeric;
  v_method public.payment_method := coalesce(p_method, 'transfer');
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can record refunds';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'NOT_FOUND: booking % not found', p_booking;
  end if;
  if b.refund_due <= 0 then
    raise exception 'INVALID_STATE: nothing is due back on this booking';
  end if;
  v_amount := b.refund_due;
  v_from_chosen := least(v_amount, case when v_method = 'transfer' then coalesce(b.bank_transfer, 0) else coalesce(b.cash, 0) end);
  v_from_other := v_amount - v_from_chosen;

  insert into public.booking_payment_entries (booking_id, method, amount, note)
  values (b.id, v_method, -v_amount, coalesce(left(nullif(btrim(p_note), ''), 300), 'Refund after cancellation'));

  perform set_config('oops.activity', 'off', true);
  update public.bookings
     set bank_transfer = greatest(coalesce(bank_transfer, 0)
                           - case when v_method = 'transfer' then v_from_chosen else v_from_other end, 0),
         cash = greatest(coalesce(cash, 0) - case when v_method = 'cash' then v_from_chosen else v_from_other end, 0),
         refund_due = 0,
         refund_paid = refund_paid + v_amount,
         refunded_at = now()
   where id = b.id
  returning * into b;
  perform set_config('oops.activity', '', true);
  perform private.log_booking_money(b, 'refunded', jsonb_build_object('received', -v_amount, 'method', v_method, 'note', p_note));
  return b;
end;
$$;

-- Staff change what is due back on a cancelled or rejected booking (0 … what was paid), with a reason:
-- e.g. the guest agreed to move the money to another booking.
create function public.booking_set_refund(p_booking bigint, p_amount numeric, p_note text)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_received numeric;
  v_note text := left(nullif(btrim(p_note), ''), 300);
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can change a refund';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'NOT_FOUND: booking % not found', p_booking;
  end if;
  if b.status not in ('cancelled', 'rejected') then
    raise exception 'INVALID_STATE: only a cancelled or rejected booking has a refund';
  end if;
  v_received := coalesce(b.bank_transfer, 0) + coalesce(b.cash, 0);
  if p_amount is null or round(p_amount) < 0 or round(p_amount) > v_received then
    raise exception 'INVALID_INPUT: the refund is between 0 and what was paid (%)', v_received;
  end if;
  if v_note is null then
    raise exception 'INVALID_INPUT: say why the refund changes';
  end if;
  perform set_config('oops.activity', 'off', true);
  update public.bookings
     set refund_due = round(p_amount), refund_note = v_note, real_income = v_received - round(p_amount)
   where id = b.id
  returning * into b;
  perform set_config('oops.activity', '', true);
  perform private.log_booking_money(b, 'refund_changed', jsonb_build_object('refund', round(p_amount), 'note', v_note));
  return b;
end;
$$;

-- Admin: the cancellation policy. p_full_hours null = no full-refund step.
create function public.booking_set_refund_policy(p_full_hours integer, p_partial_hours integer, p_partial_percent integer)
returns public.booking_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.booking_settings;
begin
  if not (public.is_admin() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only admins can change the cancellation policy';
  end if;
  if p_partial_hours is null or p_partial_hours not between 1 and 720
     or p_partial_percent is null or p_partial_percent not between 0 and 100
     or (p_full_hours is not null and (p_full_hours not between 1 and 720 or p_full_hours <= p_partial_hours)) then
    raise exception 'INVALID_INPUT: hours are 1–720 (the full refund needs more hours than the partial one), the percent 0–100';
  end if;
  update public.booking_settings
     set refund_full_hours = p_full_hours, refund_partial_hours = p_partial_hours,
         refund_partial_percent = p_partial_percent, updated_at = now(), updated_by = auth.uid()
   where id = 1
  returning * into s;
  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'bookings', 'refund_policy', 'booking_settings', '1', '',
         jsonb_strip_nulls(jsonb_build_object('full_hours', p_full_hours, 'partial_hours', p_partial_hours, 'partial_percent', p_partial_percent));
  return s;
end;
$$;

revoke execute on function private.booking_starts_at(public.bookings), private.booking_refund_quote(public.bookings, boolean, timestamptz),
  private.booking_status_money() from public, anon, authenticated;
revoke execute on function public.booking_cancel_quote(bigint, boolean), public.cancel_booking(bigint, boolean, numeric, text, text),
  public.booking_refund(bigint, public.payment_method, text), public.booking_set_refund(bigint, numeric, text),
  public.booking_set_refund_policy(integer, integer, integer) from public, anon;
grant execute on function public.booking_cancel_quote(bigint, boolean), public.cancel_booking(bigint, boolean, numeric, text, text),
  public.booking_refund(bigint, public.payment_method, text), public.booking_set_refund(bigint, numeric, text),
  public.booking_set_refund_policy(integer, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Revenue: what the studio keeps from a cancelled booking is income (real_income = paid − refund), so the
-- reports count cancelled bookings too (a fully refunded one adds 0). Same definitions, one condition wider.
-- -----------------------------------------------------------------------------
create or replace view public.v_revenue_monthly
with (security_invoker = true)
as
select date_trunc('month', b.date)::date        as month,
       b.room_id,
       r.name                                    as room_name,
       count(*)::int                             as bookings_count,
       coalesce(sum(b.full_payment), 0)          as full_payment_sum,
       coalesce(sum(b.real_income), 0)           as real_income_sum,
       coalesce(sum(b.cash), 0)                  as cash_sum,
       coalesce(sum(b.bank_transfer), 0)         as bank_transfer_sum
from public.bookings b
join public.rooms r on r.id = b.room_id
where b.status in ('approved', 'completed', 'cancelled')
  and (select public.is_staff())
group by 1, b.room_id, r.name;

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
        and b.status in ('approved', 'completed', 'cancelled'))
  );
end;
$$;

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
       and bk.status in ('approved', 'completed', 'cancelled')
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
