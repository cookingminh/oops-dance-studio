-- The sandbox's pretend bank transfer for a booking pays at most what is left. A booking already paid in
-- full gets nothing more: a pay dialog opened (say, from the bell) before the payment came in could
-- otherwise add a second transfer. An amount above what is left is refused. Two clicks at once wait for
-- each other, so the second sees the first's money.
-- Real transfers are unchanged: money that came in is taken, and private.match_transfer notes an overpayment.
create or replace function public.booking_simulate_transfer(p_booking bigint, p_amount numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_left numeric;
  v_amount numeric;
  v_id bigint;
begin
  if not public.tuition_sandbox() then
    raise exception 'FORBIDDEN: simulated transfers only work in the demo';
  end if;
  b := private.booking_for_caller(p_booking);
  select * into b from public.bookings where id = b.id for update;
  if b.status in ('rejected', 'cancelled') then
    raise exception 'INVALID_STATE: this booking is %', b.status;
  end if;
  v_left := greatest(coalesce(b.full_payment, 0) - coalesce(b.bank_transfer, 0) - coalesce(b.cash, 0), 0);
  if v_left <= 0 then
    raise exception 'INVALID_STATE: nothing is left to pay on this booking';
  end if;
  v_amount := coalesce(p_amount, private.booking_due(b));
  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_STATE: nothing is due on this booking';
  end if;
  if v_amount > v_left then
    raise exception 'INVALID_INPUT: more than is left to pay (%)', v_left;
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
