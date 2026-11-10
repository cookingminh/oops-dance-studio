-- Room bookings paid by bank transfer, like tuition (api-contract §3 bookings, §5 Booking payments).
--
--   * Every booking has a payment code: 'OOPS' + 6 characters, in one namespace with the tuition invoices,
--     used in its VietQR code and transfer content ("OOPS7K3M9Q dat phong 12/11").
--   * The bank webhook matches it like an invoice code: the money is added to bookings.bank_transfer,
--     real_income follows while it equals what was received, and the deposit counts as paid once covered.
--     The transfer keeps its booking (bank_transfers.booking_id): that is the booking's payment history.
--   * Staff assign an inbox transfer to a booking or take it back; the sandbox simulates a transfer.
--   * Money staff take by hand — cash, a transfer the webhook didn't see, a refund (negative) — is recorded
--     as a payment entry (booking_payment_entries), so every amount on a booking has a line with who and when.
--   * The price: list_price is the room's price × hours, kept up to date when the room or the times change;
--     full_payment is the agreed price. Staff change it with a reason (price_note); while it is unchanged it
--     follows list_price, and an open deposit stays half of it.
--   * booking_payments(): a booking's payments — transfers and entries — for its guest and staff.

-- One code space for invoices and bookings.
create or replace function private.new_payment_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_chars constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
begin
  loop
    v_code := 'OOPS' || (select string_agg(substr(v_chars, 1 + floor(random() * 32)::int, 1), '')
                           from generate_series(1, 6));
    exit when not exists (select 1 from public.tuition_invoices i where i.payment_code = v_code)
          and not exists (select 1 from public.bookings b where b.payment_code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table public.bookings add column payment_code text;
update public.bookings set payment_code = private.new_payment_code() where payment_code is null;
alter table public.bookings
  alter column payment_code set not null,
  add constraint bookings_payment_code_key unique (payment_code),
  add constraint bookings_payment_code_format check (payment_code ~ '^OOPS[2-9A-HJ-NP-Z]{6}$');

-- The server owns the code: set on insert, never changed.
create function private.booking_payment_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.payment_code := private.new_payment_code();
  else
    new.payment_code := old.payment_code;
  end if;
  return new;
end;
$$;

create trigger booking_payment_code
  before insert or update of payment_code on public.bookings
  for each row execute function private.booking_payment_code();

alter table public.bank_transfers add column booking_id bigint references public.bookings (id) on delete set null;
create index bank_transfers_booking_idx on public.bank_transfers (booking_id) where booking_id is not null;

-- -----------------------------------------------------------------------------
-- The price
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column list_price numeric(12, 0) check (list_price >= 0),
  add column price_note text check (char_length(price_note) <= 300);
comment on column public.bookings.list_price is 'The room''s price × hours (kept up to date when the room or the times change).';
comment on column public.bookings.price_note is 'Why the agreed price (full_payment) differs from list_price.';

-- round(price × hours) for a room and times.
create function private.room_price_for(p_room bigint, p_start time, p_end time)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(r.price * extract(epoch from (p_end - p_start)) / 3600) from public.rooms r where r.id = p_room;
$$;

update public.bookings b
   set list_price = coalesce(private.room_price_for(b.room_id, b.start_time, b.end_time), b.full_payment);

-- New booking: the list price, and the agreed price / deposit when not given. A move (room or times): the
-- list price follows; so does the agreed price unless staff changed it, and an open half deposit with it.
create function private.booking_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list numeric := private.room_price_for(new.room_id, new.start_time, new.end_time);
begin
  if tg_op = 'INSERT' then
    new.list_price := v_list;
    new.full_payment := coalesce(new.full_payment, v_list);
    new.deposit := coalesce(new.deposit, round(new.full_payment * 0.5));
    return new;
  end if;
  if (new.room_id, new.start_time, new.end_time) is not distinct from (old.room_id, old.start_time, old.end_time) then
    return new;
  end if;
  new.list_price := v_list;
  if new.full_payment is not distinct from old.full_payment and old.full_payment is not distinct from old.list_price then
    new.full_payment := v_list;
    if new.deposit_status = 'waiting' and new.deposit is not distinct from old.deposit
       and old.deposit is not distinct from round(old.full_payment * 0.5) then
      new.deposit := round(v_list * 0.5);
    end if;
  end if;
  return new;
end;
$$;

create trigger booking_price
  before insert or update of room_id, start_time, end_time on public.bookings
  for each row execute function private.booking_price();

-- -----------------------------------------------------------------------------
-- Payments taken by hand
-- -----------------------------------------------------------------------------
create table public.booking_payment_entries (
  id          bigint generated always as identity primary key,
  booking_id  bigint not null references public.bookings (id) on delete cascade,
  method      public.payment_method not null default 'cash',
  amount      numeric(12, 0) not null check (amount <> 0),   -- negative: refunded to the guest
  note        text check (char_length(note) <= 300),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index booking_payment_entries_booking_idx on public.booking_payment_entries (booking_id, created_at);

alter table public.booking_payment_entries enable row level security;
create policy booking_payment_entries_staff_read on public.booking_payment_entries
  for select to authenticated using (public.is_staff());
revoke all on public.booking_payment_entries from anon;
revoke insert, update, delete, truncate, references, trigger on public.booking_payment_entries from authenticated;
grant select on public.booking_payment_entries to authenticated;

-- Amounts entered before there was a payment history get one line each (cash; a transfer no bank
-- transfer row explains).
insert into public.booking_payment_entries (booking_id, method, amount, note, created_by, created_at)
select b.id, 'cash', b.cash, 'Recorded before payment history', null, b.updated_at
  from public.bookings b where coalesce(b.cash, 0) > 0;
insert into public.booking_payment_entries (booking_id, method, amount, note, created_by, created_at)
select b.id, 'transfer', b.bank_transfer, 'Recorded before payment history', null, b.updated_at
  from public.bookings b where coalesce(b.bank_transfer, 0) > 0;

-- -----------------------------------------------------------------------------
-- Money on a booking
-- -----------------------------------------------------------------------------
-- What a booking still asks for: the rest of its deposit while the deposit is open, then the rest of
-- the full price. 0 when nothing is due.
create function private.booking_due(b public.bookings)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(case
    when b.deposit_status = 'waiting' and coalesce(b.deposit, 0) > 0
      then b.deposit - coalesce(b.bank_transfer, 0) - coalesce(b.cash, 0)
    else coalesce(b.full_payment, 0) - coalesce(b.bank_transfer, 0) - coalesce(b.cash, 0)
  end, 0);
$$;

-- Adds (or with a negative amount, takes back) money received by transfer or in cash. real_income follows
-- while it was the sum of what had been received (staff may have set it to something else on purpose); the
-- deposit becomes paid once covered, and open again when taking money back uncovers it.
create function private.apply_booking_payment(p_booking bigint, p_amount numeric, p_method public.payment_method default 'transfer')
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_before numeric;
  v_after numeric;
begin
  select * into b from public.bookings where id = p_booking for update;
  v_before := coalesce(b.bank_transfer, 0) + coalesce(b.cash, 0);
  v_after := case when p_method = 'transfer'
                  then greatest(coalesce(b.bank_transfer, 0) + p_amount, 0) + coalesce(b.cash, 0)
                  else coalesce(b.bank_transfer, 0) + greatest(coalesce(b.cash, 0) + p_amount, 0) end;
  update public.bookings
     set bank_transfer = case when p_method = 'transfer' then greatest(coalesce(bank_transfer, 0) + p_amount, 0) else bank_transfer end,
         cash = case when p_method = 'cash' then greatest(coalesce(cash, 0) + p_amount, 0) else cash end,
         real_income = case when coalesce(real_income, 0) = v_before then v_after else real_income end,
         deposit_status = case
           when deposit_status = 'cancelled' then deposit_status
           when p_amount > 0 and deposit_status = 'waiting' and v_after >= coalesce(deposit, 0) then 'completed'
           when p_amount < 0 and deposit_status = 'completed' and v_after < coalesce(deposit, 0) then 'waiting'
           else deposit_status end::public.deposit_status
   where id = b.id
  returning * into b;
  return b;
end;
$$;

-- The bank paid a booking: apply it and log it as the bank (not as whoever triggered the match, e.g. a
-- guest simulating a transfer in the demo).
create function private.bank_pays_booking(p_booking bigint, p_amount numeric, p_code text)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  perform set_config('oops.activity', 'off', true);
  b := private.apply_booking_payment(p_booking, p_amount);
  perform set_config('oops.activity', '', true);
  insert into public.activity_log (area, action, entity, entity_id, subject_id, label, meta)
  values ('bookings', 'paid', 'bookings', b.id::text, b.guest_id, coalesce(private.person_name(b.guest_id), ''),
          jsonb_strip_nulls(jsonb_build_object(
            'received', p_amount, 'method', 'transfer', 'code', p_code, 'bank', true, 'date', b.date, 'start', b.start_time,
            'end', b.end_time, 'status', b.status,
            'room', (select r.name from public.rooms r where r.id = b.room_id))));
  return b;
end;
$$;

-- Matches a stored transfer by the OOPS code in its content: a tuition invoice, else a booking.
create or replace function private.match_transfer(p_transfer bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.bank_transfers;
  v public.tuition_invoices;
  b public.bookings;
  v_code text;
  v_due numeric;
begin
  select * into t from public.bank_transfers where id = p_transfer for update;
  v_code := substring(upper(regexp_replace(t.content, '[^A-Za-z0-9]', '', 'g')) from 'OOPS[2-9A-HJ-NP-Z]{6}');
  if v_code is null then
    update public.bank_transfers set status = 'unmatched', note = 'No invoice code in the transfer content.' where id = t.id;
    return;
  end if;

  select * into v from public.tuition_invoices where payment_code = v_code for update;
  if not found then
    select * into b from public.bookings where payment_code = v_code for update;
    if not found then
      update public.bank_transfers set status = 'unmatched', note = format('Unknown invoice code %s.', v_code) where id = t.id;
      return;
    end if;
    if b.status in ('rejected', 'cancelled') then
      update public.bank_transfers
         set status = 'unmatched', note = format('Booking #%s is %s.', b.id, b.status)
       where id = t.id;
      return;
    end if;
    v_due := greatest(coalesce(b.full_payment, 0) - coalesce(b.bank_transfer, 0) - coalesce(b.cash, 0), 0);
    perform private.bank_pays_booking(b.id, t.amount, v_code);
    update public.bank_transfers
       set status = 'matched', booking_id = b.id,
           note = case when t.amount > v_due then format('Paid %s more than was due.', t.amount - v_due) end
     where id = t.id;
    return;
  end if;

  if v.status = 'void' then
    perform private.reinstate(v.id);
    select * into v from public.tuition_invoices where id = v.id;
  end if;
  if v.status <> 'unpaid' then
    update public.bank_transfers
       set status = 'unmatched', note = format('Invoice %s is already %s.', v_code, v.status)
     where id = t.id;
    return;
  end if;

  v_due := v.amount - v.paid_amount;
  perform private.apply_payment(v.id, t.amount, 'transfer', t.received_at);
  update public.bank_transfers
     set status = 'matched', invoice_id = v.id,
         note = case when t.amount < v_due then format('Partial payment: %s still due.', v_due - t.amount)
                     when t.amount > v_due then format('Paid %s more than was due.', t.amount - v_due) end
   where id = t.id;
end;
$$;

-- The webhook's answer also names the booking.
create or replace function public.tuition_record_transfer(
  p_provider    text,
  p_ref         text,
  p_amount      numeric,
  p_content     text,
  p_received_at timestamptz default now(),
  p_raw         jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  t public.bank_transfers;
  v_duplicate boolean := false;
begin
  if not private.is_service_context() then
    raise exception 'FORBIDDEN: only the bank webhook can record transfers';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_INPUT: the amount must be positive';
  end if;
  insert into public.bank_transfers (provider, provider_ref, amount, content, received_at, raw)
  values (lower(p_provider), left(p_ref, 100), round(p_amount), left(coalesce(p_content, ''), 500),
          coalesce(p_received_at, now()), p_raw)
  on conflict on constraint bank_transfers_once do nothing
  returning id into v_id;

  if v_id is null then
    v_duplicate := true;
    select id into v_id from public.bank_transfers where provider = lower(p_provider) and provider_ref = left(p_ref, 100);
  else
    perform private.match_transfer(v_id);
  end if;

  select * into t from public.bank_transfers where id = v_id;
  return jsonb_build_object('transfer_id', t.id, 'status', t.status, 'invoice_id', t.invoice_id,
                            'booking_id', t.booking_id, 'note', t.note, 'duplicate', v_duplicate);
end;
$$;

-- The activity log line for money on a booking, by whoever is signed in (null = the bank).
create function private.log_booking_money(b public.bookings, p_action text, p_meta jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, subject_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'bookings', p_action, 'bookings', b.id::text, b.guest_id, coalesce(private.person_name(b.guest_id), ''),
         jsonb_strip_nulls(p_meta || jsonb_build_object(
           'date', b.date, 'start', b.start_time, 'end', b.end_time, 'status', b.status,
           'room', (select r.name from public.rooms r where r.id = b.room_id)));
$$;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
-- The booking for its guest or staff; NOT_FOUND otherwise (existence isn't revealed).
create function private.booking_for_caller(p_booking bigint)
returns public.bookings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking;
  if not found or not (public.is_staff() or private.is_service_context() or b.guest_id = auth.uid()) then
    raise exception 'NOT_FOUND: no such booking';
  end if;
  return b;
end;
$$;

-- A booking's payments, oldest first (its guest and staff): bank transfers matched to it (kind 'bank',
-- content = the transfer content) and amounts staff recorded by hand (kind 'entry', method cash | transfer,
-- negative = refunded), with who recorded them.
create function public.booking_payments(p_booking bigint)
returns table (kind text, id bigint, method public.payment_method, received_at timestamptz, amount numeric,
               content text, note text, recorded_by uuid, recorded_by_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.booking_for_caller(p_booking);
  return query
    select x.kind, x.id, x.method, x.received_at, x.amount, x.content, x.note, x.recorded_by, x.recorded_by_name
      from (
        select 'bank'::text as kind, t.id, 'transfer'::public.payment_method as method, t.received_at, t.amount,
               t.content, t.note, null::uuid as recorded_by, null::text as recorded_by_name
          from public.bank_transfers t
         where t.booking_id = p_booking and t.status = 'matched'
        union all
        select 'entry', e.id, e.method, e.created_at, e.amount, null::text, e.note, e.created_by, private.person_name(e.created_by)
          from public.booking_payment_entries e
         where e.booking_id = p_booking
      ) x
     order by x.received_at, x.id;
end;
$$;

-- Staff record money taken by hand: cash (default) or a transfer the webhook didn't see; a negative amount
-- is a refund (a note is then required). → the booking.
create function public.booking_record_payment(p_booking bigint, p_amount numeric, p_method public.payment_method default 'cash',
                                              p_note text default null)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_note text := left(nullif(btrim(p_note), ''), 300);
  v_have numeric;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can record payments';
  end if;
  b := private.booking_for_caller(p_booking);
  if p_amount is null or round(p_amount) = 0 then
    raise exception 'INVALID_INPUT: the amount can''t be zero';
  end if;
  if p_amount < 0 and v_note is null then
    raise exception 'INVALID_INPUT: say why the money goes back';
  end if;
  v_have := case when coalesce(p_method, 'cash') = 'cash' then coalesce(b.cash, 0) else coalesce(b.bank_transfer, 0) end;
  if p_amount < 0 and -p_amount > v_have then
    raise exception 'INVALID_INPUT: more than was received that way';
  end if;
  insert into public.booking_payment_entries (booking_id, method, amount, note)
  values (b.id, coalesce(p_method, 'cash'), round(p_amount), v_note);
  perform set_config('oops.activity', 'off', true);
  b := private.apply_booking_payment(b.id, round(p_amount), coalesce(p_method, 'cash'));
  perform set_config('oops.activity', '', true);
  perform private.log_booking_money(b, case when p_amount < 0 then 'refunded' else 'paid' end,
                                    jsonb_build_object('received', round(p_amount), 'method', coalesce(p_method, 'cash'), 'note', v_note));
  return b;
end;
$$;

-- Staff remove an entry recorded by mistake: its money comes off the booking. → the booking.
create function public.booking_delete_payment(p_entry bigint)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.booking_payment_entries;
  b public.bookings;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can remove payments';
  end if;
  delete from public.booking_payment_entries where id = p_entry returning * into e;
  if not found then
    raise exception 'NOT_FOUND: no such payment';
  end if;
  perform set_config('oops.activity', 'off', true);
  b := private.apply_booking_payment(e.booking_id, -e.amount, e.method);
  perform set_config('oops.activity', '', true);
  perform private.log_booking_money(b, 'payment_removed',
                                    jsonb_build_object('received', e.amount, 'method', e.method, 'note', e.note));
  return b;
end;
$$;

-- Staff agree another price (a discount, extra time, a surcharge…): `p_amount` is the new total; a reason
-- is required unless it is the list price again. An open deposit becomes half of it, or `p_deposit`; a
-- deposit already paid stays (capped at the total). → the booking.
create function public.booking_set_price(p_booking bigint, p_amount numeric, p_note text default null,
                                         p_deposit numeric default null)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_from numeric;
  v_note text := left(nullif(btrim(p_note), ''), 300);
  v_total numeric := round(p_amount);
  v_deposit numeric;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can change prices';
  end if;
  b := private.booking_for_caller(p_booking);
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_INPUT: the price can''t be negative';
  end if;
  if v_total is distinct from b.list_price and v_note is null then
    raise exception 'INVALID_INPUT: say why the price changes';
  end if;
  v_from := b.full_payment;
  v_deposit := case
    when p_deposit is not null then least(round(p_deposit), v_total)
    when b.deposit_status = 'waiting' then round(v_total * 0.5)
    else least(coalesce(b.deposit, 0), v_total) end;
  perform set_config('oops.activity', 'off', true);
  update public.bookings
     set full_payment = v_total,
         price_note = case when v_total = list_price then null else v_note end,
         deposit = v_deposit,
         deposit_status = case
           when deposit_status = 'waiting' and coalesce(bank_transfer, 0) + coalesce(cash, 0) >= v_deposit
                and coalesce(bank_transfer, 0) + coalesce(cash, 0) > 0 then 'completed'
           else deposit_status end::public.deposit_status
   where id = b.id
  returning * into b;
  perform set_config('oops.activity', '', true);
  perform private.log_booking_money(b, 'price_changed',
                                    jsonb_build_object('from', v_from, 'to', v_total, 'list_price', b.list_price, 'note', v_note));
  return b;
end;
$$;

-- Staff link an unmatched transfer to a booking (no code, or a wrong one).
create function public.booking_assign_transfer(p_transfer bigint, p_booking bigint)
returns public.bank_transfers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.bank_transfers;
  b public.bookings;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can assign transfers';
  end if;
  select * into t from public.bank_transfers where id = p_transfer for update;
  if not found then
    raise exception 'NOT_FOUND: no such transfer';
  end if;
  if t.status = 'matched' then
    raise exception 'INVALID_STATE: this transfer is already matched';
  end if;
  b := private.booking_for_caller(p_booking);
  if b.status in ('rejected', 'cancelled') then
    raise exception 'INVALID_STATE: this booking is %', b.status;
  end if;
  perform private.apply_booking_payment(b.id, t.amount);
  update public.bank_transfers
     set status = 'matched', booking_id = b.id, note = 'Assigned by staff.'
   where id = t.id
  returning * into t;
  return t;
end;
$$;

-- Staff take a transfer back off its booking (wrong booking, refunded…): it returns to the inbox.
create function public.booking_unassign_transfer(p_transfer bigint)
returns public.bank_transfers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.bank_transfers;
begin
  if not (public.is_staff() or private.is_service_context()) then
    raise exception 'FORBIDDEN: only staff can sort transfers';
  end if;
  select * into t from public.bank_transfers where id = p_transfer for update;
  if not found or t.status <> 'matched' or t.booking_id is null then
    raise exception 'INVALID_STATE: this transfer isn''t on a booking';
  end if;
  perform private.apply_booking_payment(t.booking_id, -t.amount);
  update public.bank_transfers
     set status = 'unmatched', booking_id = null, note = 'Taken back by staff.'
   where id = t.id
  returning * into t;
  return t;
end;
$$;

-- Sandbox only (demo, local stack): pretend the guest's bank sent what is due now (or p_amount).
create function public.booking_simulate_transfer(p_booking bigint, p_amount numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_amount numeric;
  v_id bigint;
begin
  if not public.tuition_sandbox() then
    raise exception 'FORBIDDEN: simulated transfers only work in the demo';
  end if;
  b := private.booking_for_caller(p_booking);
  if b.status in ('rejected', 'cancelled') then
    raise exception 'INVALID_STATE: this booking is %', b.status;
  end if;
  v_amount := coalesce(p_amount, private.booking_due(b));
  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_STATE: nothing is due on this booking';
  end if;
  insert into public.bank_transfers (provider, provider_ref, amount, content)
  values ('demo', gen_random_uuid()::text, round(v_amount),
          b.payment_code || ' dat phong ' || to_char(b.date, 'DD/MM'))
  returning id into v_id;
  perform private.match_transfer(v_id);
  return (select jsonb_build_object('transfer_id', t.id, 'status', t.status, 'booking_id', t.booking_id, 'note', t.note)
            from public.bank_transfers t where t.id = v_id);
end;
$$;

-- Staff book for a guest at the counter or on the phone, in one go: the booking (approved unless
-- p_status = 'pending'), another agreed price with its reason if given, and money taken now (the deposit,
-- the full price or any amount; cash or a transfer seen by hand). Its payment code is set like any booking's;
-- with nothing taken, the guest pays later by QR. → the booking.
create function public.booking_staff_create(
  p_guest        uuid,
  p_room         bigint,
  p_date         date,
  p_start        time,
  p_end          time,
  p_details      text default null,
  p_status       public.booking_status default 'approved',
  p_price        numeric default null,
  p_price_note   text default null,
  p_paid         numeric default 0,
  p_method       public.payment_method default 'cash',
  p_payment_note text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only staff can book for a guest';
  end if;
  if p_guest is null then
    raise exception 'INVALID_INPUT: pick the guest';
  end if;
  if p_status not in ('approved', 'pending') then
    raise exception 'INVALID_INPUT: a new booking is approved or pending';
  end if;
  if coalesce(p_paid, 0) < 0 then
    raise exception 'INVALID_INPUT: the amount taken can''t be negative';
  end if;
  b := public.create_booking(p_room, p_date, p_start, p_end, p_details, p_guest);
  if p_status = 'pending' then
    update public.bookings set status = 'pending' where id = b.id returning * into b;
  end if;
  if p_price is not null and round(p_price) is distinct from b.full_payment then
    b := public.booking_set_price(b.id, p_price, p_price_note);
  end if;
  if coalesce(p_paid, 0) > 0 then
    b := public.booking_record_payment(b.id, p_paid, coalesce(p_method, 'cash'), p_payment_note);
  end if;
  return b;
end;
$$;

-- -----------------------------------------------------------------------------
-- Demo: deposits paid by transfer, with their transfers as history
-- -----------------------------------------------------------------------------
create function public.seed_demo_booking_payments()
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
    raise exception 'FORBIDDEN: demo booking payments are only seeded on a sandbox';
  end if;
  -- An approved booking whose deposit is marked paid received it by transfer.
  update public.bookings
     set bank_transfer = deposit, real_income = coalesce(real_income, deposit)
   where status = 'approved' and deposit_status = 'completed' and coalesce(deposit, 0) > 0
     and coalesce(bank_transfer, 0) + coalesce(cash, 0) = 0;
  -- Every transferred amount came in as one transfer with the code (a deposit two days before, or on the day).
  insert into public.bank_transfers (provider, provider_ref, amount, content, received_at, status, booking_id)
  select 'sepay', 'seed-booking-' || b.id, b.bank_transfer,
         b.payment_code || case when b.status = 'completed' then ' thanh toan phong ' else ' dat coc phong ' end
           || to_char(b.date, 'DD/MM'),
         least(((b.date - case when b.status = 'completed' then 0 else 2 end) + time '20:15') at time zone 'Asia/Ho_Chi_Minh',
               now() - interval '1 hour'),
         'matched', b.id
    from public.bookings b
   where coalesce(b.bank_transfer, 0) > 0
     and b.date >= public.studio_today() - 90
     and not exists (select 1 from public.bank_transfers t where t.booking_id = b.id)
     and not exists (select 1 from public.booking_payment_entries e where e.booking_id = b.id and e.method = 'transfer')
  on conflict on constraint bank_transfers_once do nothing;
  get diagnostics v_n = row_count;
  -- Cash taken at the counter, by staff.
  insert into public.booking_payment_entries (booking_id, method, amount, created_by, created_at)
  select b.id, 'cash', b.cash, (select p.id from public.profiles p where p.email = 'staff@demo.oopsdance.test'),
         least((b.date + b.end_time) at time zone 'Asia/Ho_Chi_Minh', now() - interval '1 hour')
    from public.bookings b
   where coalesce(b.cash, 0) > 0
     and not exists (select 1 from public.booking_payment_entries e where e.booking_id = b.id and e.method = 'cash');
  return v_n;
end;
$$;

revoke execute on function private.booking_payment_code(), private.booking_due(public.bookings),
  private.apply_booking_payment(bigint, numeric, public.payment_method), private.bank_pays_booking(bigint, numeric, text),
  private.booking_for_caller(bigint), private.room_price_for(bigint, time, time), private.booking_price(),
  private.log_booking_money(public.bookings, text, jsonb) from public, anon, authenticated;
revoke execute on function public.booking_payments(bigint), public.booking_assign_transfer(bigint, bigint),
  public.booking_unassign_transfer(bigint), public.booking_simulate_transfer(bigint, numeric),
  public.booking_record_payment(bigint, numeric, public.payment_method, text), public.booking_delete_payment(bigint),
  public.booking_set_price(bigint, numeric, text, numeric),
  public.booking_staff_create(uuid, bigint, date, time, time, text, public.booking_status, numeric, text, numeric, public.payment_method, text)
  from public, anon;
grant execute on function public.booking_payments(bigint), public.booking_assign_transfer(bigint, bigint),
  public.booking_unassign_transfer(bigint), public.booking_simulate_transfer(bigint, numeric),
  public.booking_record_payment(bigint, numeric, public.payment_method, text), public.booking_delete_payment(bigint),
  public.booking_set_price(bigint, numeric, text, numeric),
  public.booking_staff_create(uuid, bigint, date, time, time, text, public.booking_status, numeric, text, numeric, public.payment_method, text)
  to authenticated;
revoke execute on function public.seed_demo_booking_payments() from public, anon, authenticated;
grant execute on function public.seed_demo_booking_payments() to service_role;
