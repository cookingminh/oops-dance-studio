-- =============================================================================
-- 06 · Views (security_invoker = true → caller's RLS applies)
-- Contract: docs/architecture/api-contract.md §3 "Views"
-- =============================================================================

-- Replaces the legacy Revenue table (hard-coded room1/room2 columns).
-- Only approved/completed bookings count. Bookings RLS already narrows rows to
-- the caller; the is_staff() filter makes the view staff-only outright so a
-- guest does not get aggregates of their own bookings.
create view public.v_revenue_monthly
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
where b.status in ('approved', 'completed')
  and (select public.is_staff())
group by 1, b.room_id, r.name;

revoke all on public.v_revenue_monthly from anon;
revoke insert, update, delete, truncate, references, trigger on public.v_revenue_monthly from authenticated;
