-- Recurring room rentals, paid by month (20261117003100_booking_series; api-contract §3 booking_series, §5):
--   * the preview lists the days with what holds the room and the rooms still free
--   * creating books the days kept (another room for a clashing day, one skipped) at the room's price less the
--     discount, with one payment code per month
--   * a transfer with a month's code pays that month's sessions in date order; staff record cash for a month
--   * the rest can be cancelled; staff only
--   * each weekday can have its own times (20261117003110_series_weekday_times): checked and booked at them
-- The series spans the end of the month after next: two days in one month, two in the next.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_role public.app_role, p_name text)
returns uuid language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('full_name', p_name), '{}'::jsonb, now(), now());
  if p_role <> 'guest' then
    update public.profiles set role = p_role where id = p_id;
  end if;
  return p_id;
end $$;
create function tests.login_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- m: the first day of the month after next; the series runs m - 2 … m + 1, every day.
create function tests.m(p_offset int default 0) returns date language sql stable as $$
  select (date_trunc('month', public.studio_today()) + interval '2 months')::date + p_offset;
$$;
create function tests.series() returns public.booking_series language sql stable security definer as $$
  select * from public.booking_series where room_id = 900331 order by id desc limit 1;
$$;
create function tests.on_day(p_offset int) returns public.bookings language sql stable security definer as $$
  select * from public.bookings where series_id = (tests.series()).id and date = tests.m(p_offset);
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000331', 'series-staff@test.local', 'staff', 'Series Staff');
select tests.create_user('00000000-0000-4000-b000-000000000332', 'series-guest@test.local', 'guest', 'Series Guest');
insert into public.rooms (id, name, price) values (900331, 'Series Room 1', 200000), (900332, 'Series Room 2', 200000);

select tests.login_as('00000000-0000-4000-b000-000000000331');
-- Room 1 is already booked on m - 1 at the series' time.
select public.booking_staff_create(null, 900331, tests.m(-1), '19:00', '20:00', p_walk_in_name => 'Khách lẻ', p_walk_in_phone => '0911000000');

-- ---------------------------------------------------------------------------
-- Preview
-- ---------------------------------------------------------------------------
create temporary table preview on commit drop as
select public.booking_series_preview(900331, array[1, 2, 3, 4, 5, 6, 7]::smallint[], '19:00', '21:00', tests.m(-2), tests.m(1)) as p;
select is(jsonb_array_length((select p from preview)), 4, 'the preview lists every day of the series');
select is((select p -> 1 ->> 'clash' from preview), 'a booking 19:00–20:00', 'a day the room is booked says so');
select ok((select (p -> 1 -> 'free_rooms') @> '[{"id": 900332}]'::jsonb from preview), 'with the rooms still free then');
select is((select p -> 0 ->> 'clash' from preview), null, 'a free day has no clash');

-- ---------------------------------------------------------------------------
-- Booking it: the clashing day in Room 2, the last day skipped, 10 % off
-- ---------------------------------------------------------------------------
select throws_like($$select public.booking_series_create(null, 900331, array[1,2,3,4,5,6,7]::smallint[], '19:00', '21:00', tests.m(-2), tests.m(1),
                     jsonb_build_array(jsonb_build_object('date', tests.m(-2))), p_discount_kind => 'percent', p_discount_value => 10,
                     p_walk_in_name => 'Nhóm Nhảy X', p_walk_in_phone => '0988000000')$$,
                   '%INVALID_INPUT%', 'a discount needs its reason');
select throws_like($$select public.booking_series_create(null, 900331, array[1,2,3,4,5,6,7]::smallint[], '19:00', '21:00', tests.m(-2), tests.m(1),
                     jsonb_build_array(jsonb_build_object('date', tests.m(-1))), p_walk_in_name => 'Nhóm Nhảy X', p_walk_in_phone => '0988000000')$$,
                   '%SLOT_TAKEN%', 'a clashing day kept in its room is refused, and nothing is booked');
select is((select count(*)::int from public.booking_series where room_id = 900331), 0, 'not even the series');

select is((public.booking_series_create(null, 900331, array[1, 2, 3, 4, 5, 6, 7]::smallint[], '19:00', '21:00', tests.m(-2), tests.m(1),
             jsonb_build_array(jsonb_build_object('date', tests.m(-2)),
                               jsonb_build_object('date', tests.m(-1), 'room_id', 900332),
                               jsonb_build_object('date', tests.m(0))),
             p_discount_kind => 'percent', p_discount_value => 10, p_discount_note => 'Thuê định kỳ',
             p_walk_in_name => 'Nhóm Nhảy X', p_walk_in_phone => '0988000000')).walk_in_name,
          'Nhóm Nhảy X', 'staff book the series for a walk-in');
select is((select count(*)::int from public.bookings where series_id = (tests.series()).id), 3, 'one booking per day kept (the skipped day has none)');
select is((tests.on_day(-1)).room_id, 900332::bigint, 'the clashing day is in Room 2');
select is((select list_price || ' → ' || full_payment || ' (' || price_note || ')' from tests.on_day(-2)), '400000 → 360000 (Thuê định kỳ)',
          'each session is the room''s price less 10 %, with the reason');
select is((select count(*)::int from public.booking_series_bills where series_id = (tests.series()).id), 2, 'one payment code per month');
select tests.logout(); -- the activity log is for admins
select is((select label from public.activity_log where entity = 'booking_series' and entity_id = (tests.series()).id::text),
          'Nhóm Nhảy X', 'one activity line for the series, naming the renter');
select tests.login_as('00000000-0000-4000-b000-000000000331');

-- ---------------------------------------------------------------------------
-- Paying by month
-- ---------------------------------------------------------------------------
select is((select (m ->> 'total')::int || ' / ' || (m ->> 'sessions')
             from jsonb_array_elements(public.booking_series_summary((tests.series()).id) -> 'months') m
            where (m ->> 'month')::date = date_trunc('month', tests.m(-2))::date), '720000 / 2', 'the first month: two sessions, 720 000');
select tests.logout();

-- The bank: a transfer with the first month's code pays its two sessions.
insert into public.bank_transfers (provider, provider_ref, amount, content)
select 'test', 'series-1', 720000, x.payment_code || ' thue phong'
  from public.booking_series_bills x where x.series_id = (tests.series()).id and x.month = date_trunc('month', tests.m(-2));
select private.match_transfer((select id from public.bank_transfers where provider_ref = 'series-1'));
select is((select status || ' ' || series_id::text from public.bank_transfers where provider_ref = 'series-1'),
          'matched ' || (tests.series()).id, 'the transfer is matched to the rental');
select is((select string_agg(coalesce(bank_transfer, 0)::text, ',' order by date) from public.bookings
            where series_id = (tests.series()).id and date < tests.m(0)), '360000,360000', 'and pays both sessions of that month');
select is((select status::text from tests.on_day(-2)), 'completed', 'paid in full ahead: completed, as any booking');

select tests.login_as('00000000-0000-4000-b000-000000000331');
select throws_like($$select public.booking_series_record_payment((tests.series()).id, tests.m(0), 500000)$$,
                   '%INVALID_INPUT%', 'staff can''t take more than a month owes');
select is(public.booking_series_record_payment((tests.series()).id, tests.m(0), 360000, 'cash'), 0::numeric,
          'cash for the second month settles it');
select is((tests.on_day(0)).cash, 360000::numeric, 'on its session, as a cash line');

-- ---------------------------------------------------------------------------
-- Ending it; who may
-- ---------------------------------------------------------------------------
select is(public.booking_series_cancel_rest((tests.series()).id, true, 'Nhóm nghỉ'), 3, 'the sessions still ahead are cancelled');
select tests.logout();

select tests.login_as('00000000-0000-4000-b000-000000000332');
select throws_like($$select public.booking_series_summary((tests.series()).id)$$, '%NOT_FOUND%', 'someone else''s rental isn''t found');
select tests.logout();

-- ---------------------------------------------------------------------------
-- Its own times per weekday: m + 2 at 09:00–10:00, m + 3 at 10:00–12:00 (Room 2)
-- ---------------------------------------------------------------------------
create function tests.dow(p_offset int) returns text language sql stable as $$
  select extract(isodow from tests.m(p_offset))::int::text;
$$;
create function tests.day_times() returns jsonb language sql stable as $$
  select jsonb_build_object(tests.dow(2), jsonb_build_object('start', '09:00', 'end', '10:00'),
                            tests.dow(3), jsonb_build_object('start', '10:00', 'end', '12:00'));
$$;
create function tests.weekdays() returns smallint[] language sql stable as $$
  select array[tests.dow(2)::smallint, tests.dow(3)::smallint];
$$;
grant execute on all functions in schema tests to anon, authenticated;
select tests.login_as('00000000-0000-4000-b000-000000000331');
select is((select string_agg((d ->> 'start') || '–' || (d ->> 'end'), ', ' order by d ->> 'date')
             from jsonb_array_elements(public.booking_series_preview(900332, tests.weekdays(), '09:00', '10:00', tests.m(2), tests.m(3),
                                                                    tests.day_times())) d),
          '09:00–10:00, 10:00–12:00', 'the preview checks each day at its weekday''s times');
select throws_like($$select public.booking_series_preview(900332, array[tests.dow(2)::smallint], '09:00', '10:00', tests.m(2), tests.m(3),
                     tests.day_times())$$,
                   '%INVALID_INPUT%', 'times for a weekday the series doesn''t have are refused');
select throws_like($$select public.booking_series_preview(900332, tests.weekdays(), '09:00', '10:00', tests.m(2), tests.m(3),
                     tests.day_times() || jsonb_build_object(tests.dow(3), jsonb_build_object('start', '12:00', 'end', '11:00')))$$,
                   '%INVALID_INPUT%', 'so are times that end before they start');
select public.booking_series_create('00000000-0000-4000-b000-000000000332', 900332, tests.weekdays(), '09:00', '10:00', tests.m(2), tests.m(3),
         jsonb_build_array(jsonb_build_object('date', tests.m(2)), jsonb_build_object('date', tests.m(3), 'start', '14:00', 'end', '15:00')),
         p_day_times => tests.day_times());
select is((select string_agg(to_char(start_time, 'HH24:MI') || '–' || to_char(end_time, 'HH24:MI'), ', ' order by date)
             from public.bookings where series_id = (select max(id) from public.booking_series where room_id = 900332)),
          '09:00–10:00, 14:00–15:00', 'each day is booked at its weekday''s times, unless kept at other times');
select is((select day_times from public.booking_series where room_id = 900332 order by id desc limit 1), tests.day_times(),
          'the series keeps its times per weekday');
select tests.logout();

select * from finish();
rollback;
