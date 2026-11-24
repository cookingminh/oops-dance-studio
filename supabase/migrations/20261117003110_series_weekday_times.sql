-- Regular rentals with their own times per weekday: Tuesday 18:00–20:00 and Thursday 19:00–21:00 in one series.
--
-- booking_series.day_times: null when every weekday has the series' start_time–end_time (as before); else the times of
-- each weekday, {"2": {"start": "18:00", "end": "20:00"}, "4": {"start": "19:00", "end": "21:00"}} (ISO weekday keys,
-- one per weekday of the series). start_time–end_time stay the times of the first day's weekday (the form's times).
-- booking_series_preview and booking_series_create take the same object (p_day_times): each day is checked and booked
-- at its weekday's times; a day kept at other times (p_days start/end) still wins.

alter table public.booking_series add column day_times jsonb;
alter table public.booking_series add constraint booking_series_day_times check (day_times is null or jsonb_typeof(day_times) = 'object');
comment on column public.booking_series.day_times is
  'Times per weekday when they differ, {"<ISO weekday>": {"start": "HH:MM", "end": "HH:MM"}} for every weekday of the series; null = all at start_time–end_time.';

-- p_day_times checked against the weekdays: null stays null; else exactly one entry per weekday, each on the half hour,
-- within opening hours (08:00–22:00), ending after it starts. Normalised to {"2": {"start": "18:00", "end": "20:00"}}.
create function private.series_day_times(p_weekdays smallint[], p_day_times jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := '{}'::jsonb;
  d smallint;
  v_start time;
  v_end time;
begin
  if p_day_times is null or p_day_times = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(p_day_times) <> 'object' then
    raise exception 'INVALID_INPUT: times per weekday are an object keyed by ISO weekday';
  end if;
  if exists (select 1 from jsonb_object_keys(p_day_times) k where k !~ '^[1-7]$' or not (k::smallint = any (p_weekdays))) then
    raise exception 'INVALID_INPUT: times are given for a weekday the series doesn''t have';
  end if;
  foreach d in array p_weekdays loop
    begin
      v_start := (p_day_times -> d::text ->> 'start')::time;
      v_end := (p_day_times -> d::text ->> 'end')::time;
    exception when others then
      raise exception 'INVALID_INPUT: weekday % has no valid times', d;
    end;
    if v_start is null or v_end is null or v_end <= v_start or v_start < time '08:00' or v_end > time '22:00'
       or extract(minute from v_start) not in (0, 30) or extract(minute from v_end) not in (0, 30) then
      raise exception 'INVALID_INPUT: weekday % has no valid times (on the half hour, between 08:00 and 22:00, end after start)', d;
    end if;
    v := v || jsonb_build_object(d::text, jsonb_build_object('start', to_char(v_start, 'HH24:MI'), 'end', to_char(v_end, 'HH24:MI')));
  end loop;
  return v;
end;
$$;

-- Staff: every day of a series to be (p_weekdays, ISO 1 = Monday, from p_from to p_until, today on, not a time
-- already past), each at its weekday's times (p_day_times, else p_start–p_end), with what holds room p_room then and,
-- for a day that clashes, the rooms still free at those times: [{ date, start, end, clash: text | null,
-- free_rooms: [{ id, name }] }].
drop function public.booking_series_preview(bigint, smallint[], time, time, date, date);
create function public.booking_series_preview(p_room bigint, p_weekdays smallint[], p_start time, p_end time,
                                              p_from date, p_until date, p_day_times jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_now time := (now() at time zone 'Asia/Ho_Chi_Minh')::time;
  v_times jsonb;
  v jsonb;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only staff can plan a recurring rental';
  end if;
  if p_room is null or p_weekdays is null or cardinality(p_weekdays) = 0 or p_start is null or p_end is null
     or p_from is null or p_until is null then
    raise exception 'INVALID_INPUT: room, weekdays, times and dates are required';
  end if;
  if p_end <= p_start or p_start < time '08:00' or p_end > time '22:00'
     or extract(minute from p_start) not in (0, 30) or extract(minute from p_end) not in (0, 30) then
    raise exception 'INVALID_INPUT: times are on the half hour, between 08:00 and 22:00, end after start';
  end if;
  if p_until < p_from or p_until > p_from + 366 then
    raise exception 'INVALID_INPUT: a series runs up to a year';
  end if;
  v_times := private.series_day_times(p_weekdays, p_day_times);
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', d.day,
           'start', to_char(d.s, 'HH24:MI'),
           'end', to_char(d.e, 'HH24:MI'),
           'clash', private.room_clash_on(p_room, d.day, d.s, d.e, null),
           'free_rooms', case when private.room_clash_on(p_room, d.day, d.s, d.e, null) is null then '[]'::jsonb
                         else (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name) order by r.id), '[]'::jsonb)
                                 from public.rooms r
                                where r.id <> p_room and private.room_clash_on(r.id, d.day, d.s, d.e, null) is null) end)
         order by d.day), '[]'::jsonb) into v
    from (select g.day,
                 coalesce((v_times -> extract(isodow from g.day)::int::text ->> 'start')::time, p_start) as s,
                 coalesce((v_times -> extract(isodow from g.day)::int::text ->> 'end')::time, p_end) as e
            from (select x::date as day from generate_series(greatest(p_from, v_today), p_until, interval '1 day') x) g
           where extract(isodow from g.day)::smallint = any (p_weekdays)) d
   where d.day > v_today or d.s >= v_now;
  return v;
end;
$$;

-- Staff: books a series. p_days: the days kept, [{ date, room_id?, start?, end? }] — another room or other times for
-- a day that clashed (default: the series' room, and its weekday's times: p_day_times, else p_start–p_end); days
-- left out are skipped. Each day is an ordinary booking (approved, or held with p_status 'pending'; SLOT_TAKEN when its
-- room is taken then), priced as the room says less the discount: p_discount_kind 'percent' (1–99) or 'amount' (VND
-- off each session), with its reason p_discount_note. For an account (p_guest) or a walk-in (p_walk_in_name +
-- p_walk_in_phone). One payment code per month (booking_series_bills). One activity line for the whole series.
drop function public.booking_series_create(uuid, bigint, smallint[], time, time, date, date, jsonb, public.booking_status,
                                           text, numeric, text, text, text, text);
create function public.booking_series_create(
  p_guest          uuid,
  p_room           bigint,
  p_weekdays       smallint[],
  p_start          time,
  p_end            time,
  p_from           date,
  p_until          date,
  p_days           jsonb,
  p_status         public.booking_status default 'approved',
  p_discount_kind  text default null,
  p_discount_value numeric default null,
  p_discount_note  text default null,
  p_details        text default null,
  p_walk_in_name   text default null,
  p_walk_in_phone  text default null,
  p_day_times      jsonb default null
)
returns public.booking_series
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.booking_series;
  b public.bookings;
  x record;
  v_name text := nullif(btrim(p_walk_in_name), '');
  v_note text := left(nullif(btrim(p_discount_note), ''), 300);
  v_times jsonb;
  v_day text;
  v_price numeric;
  v_n integer := 0;
  v_logging text := coalesce(current_setting('oops.activity', true), '');
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only staff can book a recurring rental';
  end if;
  if (p_guest is null) = (v_name is null) then
    raise exception 'INVALID_INPUT: pick an account, or give the walk-in''s name';
  end if;
  if p_guest is null and nullif(btrim(p_walk_in_phone), '') is null then
    raise exception 'INVALID_INPUT: give the walk-in''s phone number';
  end if;
  if p_guest is not null and not exists (select 1 from public.profiles p where p.id = p_guest) then
    raise exception 'NOT_FOUND: user % not found', p_guest;
  end if;
  if p_status not in ('approved', 'pending') then
    raise exception 'INVALID_INPUT: a new booking is approved or pending';
  end if;
  if p_discount_kind is not null then
    if p_discount_kind not in ('percent', 'amount') or p_discount_value is null or p_discount_value <= 0
       or (p_discount_kind = 'percent' and p_discount_value >= 100) then
      raise exception 'INVALID_INPUT: a discount is 1–99 percent, or an amount off each session';
    end if;
    if v_note is null then
      raise exception 'INVALID_INPUT: say why there is a discount';
    end if;
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'INVALID_INPUT: keep at least one day';
  end if;
  v_times := private.series_day_times(p_weekdays, p_day_times);

  insert into public.booking_series (guest_id, walk_in_name, walk_in_phone, room_id, weekdays, start_time, end_time,
                                     day_times, starts_on, ends_on, discount_kind, discount_value, discount_note, details)
  values (p_guest, v_name, nullif(btrim(p_walk_in_phone), ''), p_room, p_weekdays, p_start, p_end, v_times, p_from, p_until,
          p_discount_kind, case when p_discount_kind is null then null else round(p_discount_value) end,
          case when p_discount_kind is null then null else v_note end, nullif(btrim(p_details), ''))
  returning * into s;

  perform set_config('oops.activity', 'off', true);
  for x in select * from jsonb_to_recordset(p_days) as t(date date, room_id bigint, start time, "end" time) order by 1 loop
    if x.date is null or x.date < p_from or x.date > p_until then
      raise exception 'INVALID_INPUT: % is outside the series', x.date;
    end if;
    v_day := extract(isodow from x.date)::int::text;
    b := private.insert_booking(coalesce(x.room_id, p_room), x.date,
                                coalesce(x.start, (v_times -> v_day ->> 'start')::time, p_start),
                                coalesce(x."end", (v_times -> v_day ->> 'end')::time, p_end),
                                p_details, p_guest, 'approved', v_name, p_walk_in_phone);
    v_price := case p_discount_kind
                 when 'percent' then round(b.list_price * (100 - p_discount_value) / 100 / 1000) * 1000
                 when 'amount' then greatest(b.list_price - round(p_discount_value), 0)
                 else b.full_payment end;
    update public.bookings
       set series_id = s.id,
           status = p_status,
           full_payment = v_price,
           deposit = round(v_price * 0.5),
           price_note = case when v_price is distinct from b.list_price then v_note else price_note end
     where id = b.id;
    v_n := v_n + 1;
  end loop;
  insert into public.booking_series_bills (series_id, month, payment_code)
  select s.id, m.month, private.new_payment_code()
    from (select distinct date_trunc('month', b2.date)::date as month from public.bookings b2 where b2.series_id = s.id) m;
  perform set_config('oops.activity', v_logging, true);

  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, subject_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'bookings', 'series_created', 'booking_series', s.id::text, s.guest_id, private.series_who(s),
         jsonb_strip_nulls(jsonb_build_object(
           'room', (select r.name from public.rooms r where r.id = s.room_id), 'weekdays', to_jsonb(s.weekdays),
           'start', s.start_time, 'end', s.end_time, 'day_times', s.day_times, 'from', s.starts_on, 'until', s.ends_on,
           'sessions', v_n, 'discount_kind', s.discount_kind, 'discount_value', s.discount_value, 'reason', s.discount_note));
  return s;
end;
$$;

revoke execute on function private.series_day_times(smallint[], jsonb) from public, anon, authenticated;
revoke execute on function
  public.booking_series_preview(bigint, smallint[], time, time, date, date, jsonb),
  public.booking_series_create(uuid, bigint, smallint[], time, time, date, date, jsonb, public.booking_status, text, numeric,
                               text, text, text, text, jsonb)
  from public, anon;
grant execute on function
  public.booking_series_preview(bigint, smallint[], time, time, date, date, jsonb),
  public.booking_series_create(uuid, bigint, smallint[], time, time, date, date, jsonb, public.booking_status, text, numeric,
                               text, text, text, text, jsonb)
  to authenticated;
