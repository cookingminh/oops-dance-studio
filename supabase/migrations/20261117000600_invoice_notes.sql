-- A note on an invoice, on its own (api-contract §5 tuition_set_note).
-- Staff could only write a note while recording a payment, changing the amount or waiving. Now they can
-- add or change it any time ("Promised to pay cash at the weekend", "Reminded on Zalo"). An empty note
-- clears it. The activity log records it as a tuition "note".

create function public.tuition_set_note(p_invoice bigint, p_note text)
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
    raise exception 'FORBIDDEN: only staff can write notes on tuition';
  end if;
  v := private.invoice_for_caller(p_invoice, false);
  update public.tuition_invoices
     set note = left(nullif(btrim(p_note), ''), 300), updated_by = auth.uid()
   where id = v.id
  returning * into v;
  return v;
end;
$$;

revoke execute on function public.tuition_set_note(bigint, text) from public, anon;
grant execute on function public.tuition_set_note(bigint, text) to authenticated;
