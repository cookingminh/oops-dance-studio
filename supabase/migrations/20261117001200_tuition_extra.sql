-- Extra tuition money: an invoice paid more than it costs (a transfer bigger than the course, a transfer
-- put on the wrong course, a class switch). Until now the extra just sat in paid_amount, invisible, and the
-- finance report counted it as income. Staff can now:
--   * move it onto another unpaid invoice (the same student's next course, a sibling's…), or
--   * record that it went back to the student (cash or transfer).
-- Each move / refund is a row in tuition_extra_moves; the invoice's paid_amount drops by it, so the report
-- counts only what the studio keeps. The activity log gets one entry per move / refund ('extra_moved',
-- 'extra_refunded'); the invoice updates behind them are not logged on their own.
-- Undoing a payment (tuition_undo_payment) also takes back what was moved on from it, returns what was
-- moved in to where it came from, and is refused once part of the money was given back.

create table public.tuition_extra_moves (
  id          bigint generated always as identity primary key,
  invoice_id  bigint not null references public.tuition_invoices (id) on delete cascade,
  kind        text not null check (kind in ('moved', 'refunded')),
  to_invoice  bigint references public.tuition_invoices (id) on delete set null,
  amount      numeric(12,0) not null check (amount > 0),
  method      public.payment_method,
  note        text check (char_length(note) <= 300),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint tuition_extra_moves_refund_shape check (kind = 'moved' or (to_invoice is null and method is not null))
);

create index tuition_extra_moves_invoice_idx on public.tuition_extra_moves (invoice_id);
create index tuition_extra_moves_to_idx on public.tuition_extra_moves (to_invoice) where to_invoice is not null;

alter table public.tuition_extra_moves enable row level security;
create policy tuition_extra_moves_select on public.tuition_extra_moves
  for select to authenticated using ((select public.is_staff()));
grant select on public.tuition_extra_moves to authenticated;

-- What a paid invoice holds beyond its price.
create function private.invoice_extra(v public.tuition_invoices)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when v.status = 'paid' then greatest(v.paid_amount - v.amount, 0) else 0 end;
$$;

-- One activity entry about an invoice's extra money (the invoice as it was before).
create function private.log_extra(v public.tuition_invoices, p_action text, p_meta jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'tuition', p_action, 'tuition_invoices', v.id::text, v.class_id, v.student_id, v.student_name,
         jsonb_build_object('class', v.class_name, 'course', v.lesson_title) || p_meta;
$$;

-- Invoices holding extra money, newest payment first (staff see all; RLS applies).
create function public.tuition_extra_list()
returns setof public.tuition_invoices
language sql
stable
set search_path = ''
as $$
  select i.*
    from public.tuition_invoices i
   where i.status = 'paid' and i.paid_amount > i.amount
   order by i.paid_at desc nulls last, i.id;
$$;

-- Move (part of) an invoice's extra onto another unpaid invoice. p_amount defaults to as much as fits:
-- the extra, or what the other invoice still needs if that is less. Returns the invoice paid.
create function public.tuition_move_extra(p_invoice bigint, p_to_invoice bigint, p_amount numeric default null)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices;
  w public.tuition_invoices;
  v_extra numeric;
  v_due numeric;
  v_amount numeric;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can move tuition money';
  end if;
  if p_invoice = p_to_invoice then
    raise exception 'INVALID_INPUT: pick another invoice to move the money to';
  end if;
  -- Both rows locked, lower id first.
  if p_invoice < p_to_invoice then
    v := private.invoice_for_caller(p_invoice, false);
    w := private.invoice_for_caller(p_to_invoice, false);
  else
    w := private.invoice_for_caller(p_to_invoice, false);
    v := private.invoice_for_caller(p_invoice, false);
  end if;
  v_extra := private.invoice_extra(v);
  if v_extra <= 0 then
    raise exception 'INVALID_STATE: this invoice has no extra money';
  end if;
  if w.status <> 'unpaid' then
    raise exception 'INVALID_STATE: that invoice is %', w.status;
  end if;
  v_due := w.amount - w.paid_amount;
  v_amount := coalesce(p_amount, least(v_extra, v_due));
  if v_amount <= 0 then
    raise exception 'INVALID_INPUT: the amount must be more than 0';
  end if;
  if v_amount > v_extra then
    raise exception 'INVALID_INPUT: only % is extra on this invoice', v_extra;
  end if;
  if v_amount > v_due then
    raise exception 'INVALID_INPUT: that invoice only needs %', v_due;
  end if;

  perform set_config('oops.activity', 'off', true);
  update public.tuition_invoices set paid_amount = paid_amount - v_amount, updated_by = auth.uid() where id = v.id;
  perform private.apply_payment(w.id, v_amount, coalesce(v.method, 'transfer'), now());
  perform set_config('oops.activity', '', true);

  insert into public.tuition_extra_moves (invoice_id, kind, to_invoice, amount)
  values (v.id, 'moved', w.id, v_amount);
  perform private.log_extra(v, 'extra_moved', jsonb_build_object(
    'amount', v_amount, 'to_invoice', w.id, 'to_student', w.student_name, 'to_class', w.class_name, 'to_course', w.lesson_title));

  select * into w from public.tuition_invoices where id = p_to_invoice;
  return w;
end;
$$;

-- Record that (part of) an invoice's extra went back to the student. p_amount defaults to all of it.
create function public.tuition_refund_extra(
  p_invoice bigint,
  p_amount  numeric default null,
  p_method  public.payment_method default 'cash',
  p_note    text default null
)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices;
  v_extra numeric;
  v_amount numeric;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can record refunds';
  end if;
  v := private.invoice_for_caller(p_invoice, false);
  v_extra := private.invoice_extra(v);
  if v_extra <= 0 then
    raise exception 'INVALID_STATE: this invoice has no extra money';
  end if;
  v_amount := coalesce(p_amount, v_extra);
  if v_amount <= 0 then
    raise exception 'INVALID_INPUT: the amount must be more than 0';
  end if;
  if v_amount > v_extra then
    raise exception 'INVALID_INPUT: only % is extra on this invoice', v_extra;
  end if;

  perform set_config('oops.activity', 'off', true);
  update public.tuition_invoices set paid_amount = paid_amount - v_amount, updated_by = auth.uid() where id = v.id;
  perform set_config('oops.activity', '', true);

  insert into public.tuition_extra_moves (invoice_id, kind, amount, method, note)
  values (v.id, 'refunded', v_amount, coalesce(p_method, 'cash'), v_note);
  perform private.log_extra(v, 'extra_refunded', jsonb_build_object('amount', v_amount, 'method', coalesce(p_method, 'cash'), 'note', v_note));

  select * into v from public.tuition_invoices where id = p_invoice;
  return v;
end;
$$;

-- Undo a payment recorded by mistake; transfers that paid it go back to the inbox. Extra moved on from
-- this invoice comes back off the invoices it paid; extra moved in returns to where it came from.
create or replace function public.tuition_undo_payment(p_invoice bigint)
returns public.tuition_invoices
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.tuition_invoices;
  w public.tuition_invoices;
  r record;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can undo payments';
  end if;
  v := private.invoice_for_caller(p_invoice, false);
  if v.paid_amount = 0 or v.status not in ('paid', 'unpaid') then
    raise exception 'INVALID_STATE: nothing has been paid on this invoice';
  end if;
  if exists (select 1 from public.tuition_extra_moves m where m.invoice_id = v.id and m.kind = 'refunded') then
    raise exception 'INVALID_STATE: part of this payment was given back to the student';
  end if;

  perform set_config('oops.activity', 'off', true);
  for r in select m.id, m.to_invoice, m.amount from public.tuition_extra_moves m where m.invoice_id = v.id and m.kind = 'moved' loop
    if r.to_invoice is not null then
      update public.tuition_invoices i
         set status     = case when i.status = 'paid' and i.paid_amount - r.amount < i.amount then 'unpaid'::public.tuition_status else i.status end,
             paid_at    = case when i.status = 'paid' and i.paid_amount - r.amount < i.amount then null else i.paid_at end,
             paid_amount = greatest(i.paid_amount - r.amount, 0),
             updated_by = auth.uid()
       where i.id = r.to_invoice
      returning * into w;
      perform private.log_extra(v, 'extra_move_undone', jsonb_build_object(
        'amount', r.amount, 'to_invoice', w.id, 'to_student', w.student_name, 'to_class', w.class_name, 'to_course', w.lesson_title));
    end if;
    delete from public.tuition_extra_moves where id = r.id;
  end loop;
  for r in select m.id, m.invoice_id, m.amount from public.tuition_extra_moves m where m.to_invoice = v.id loop
    update public.tuition_invoices set paid_amount = paid_amount + r.amount, updated_by = auth.uid() where id = r.invoice_id;
    delete from public.tuition_extra_moves where id = r.id;
  end loop;
  perform set_config('oops.activity', '', true);

  update public.tuition_invoices
     set status = 'unpaid', paid_amount = 0, method = null, paid_at = null, updated_by = auth.uid()
   where id = v.id;
  update public.bank_transfers
     set status = 'unmatched', invoice_id = null, note = 'Payment undone by staff.'
   where invoice_id = v.id;
  select * into v from public.tuition_invoices where id = p_invoice;
  return v;
end;
$$;

revoke execute on function private.invoice_extra(public.tuition_invoices), private.log_extra(public.tuition_invoices, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.tuition_extra_list(), public.tuition_move_extra(bigint, bigint, numeric),
  public.tuition_refund_extra(bigint, numeric, public.payment_method, text) from public, anon;
grant execute on function public.tuition_extra_list(), public.tuition_move_extra(bigint, bigint, numeric),
  public.tuition_refund_extra(bigint, numeric, public.payment_method, text) to authenticated;
