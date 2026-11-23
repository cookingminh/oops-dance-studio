-- Bookings for anyone — api-contract §3 bookings (guest_id, walk_in_name, walk_in_phone), §5 booking_staff_create
--
-- Staff book at the counter or on the phone for any account (a student, an instructor, staff or admin; the
-- database already took any profile, the page offered students only) and now for a walk-in with no account: their
-- name and phone are kept on the booking instead of a profile. A booking has exactly one of the two.
--   * bookings.guest_id is nullable; walk_in_name / walk_in_phone; bookings_who: an account or a walk-in name.
--   * private.insert_booking: the checks and the insert create_booking always did, for an account or a walk-in;
--     create_booking keeps its signature and who may call it.
--   * booking_staff_create(…, p_walk_in_name, p_walk_in_phone): p_guest null + a name books a walk-in.
--   * private.booking_who(bookings): who a booking is for (the account's name, else the walk-in's), for the activity
--     log lines of the booking's money; log_activity labels a walk-in's booking with their name.
-- A walk-in has nobody to notify and no "My bookings": staff show its QR (or take cash), and a refund is given back
-- in person. Guests' own pages are unchanged (their bookings always have their account).

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.bookings
  alter column guest_id drop not null,
  add column walk_in_name  text check (char_length(btrim(walk_in_name)) between 1 and 80),
  add column walk_in_phone text check (walk_in_phone ~ '^[0-9+ .()-]{6,20}$'),
  add constraint bookings_who check ((guest_id is null) = (walk_in_name is not null)),
  add constraint bookings_walk_in_phone_needs_name check (walk_in_phone is null or walk_in_name is not null);
comment on column public.bookings.guest_id is 'The account the booking is for; null for a walk-in (walk_in_name).';
comment on column public.bookings.walk_in_name is 'A walk-in with no account (staff booked it): their name. Null when guest_id is set.';
comment on column public.bookings.walk_in_phone is 'A walk-in''s phone number, to reach them about the booking.';

-- Who a booking is for: the account's name, else the walk-in's.
create function private.booking_who(b public.bookings)
returns text
language sql
stable
set search_path = ''
as $$ select coalesce(private.person_name(b.guest_id), b.walk_in_name, ''); $$;

-- -----------------------------------------------------------------------------
-- Booking a room: the checks and the insert, for an account or a walk-in
-- -----------------------------------------------------------------------------
-- Start and end on the half hour, within opening hours, not in the past, in a room that exists. Amounts are computed
-- here, never taken from the client (full_payment = the room's hourly price × hours, deposit 50 %); the price
-- triggers keep list_price. Class overlap → SLOT_TAKEN from private.check_booking_rules; booking overlap →
-- bookings_no_overlap. Callers check who may book for whom.
create function private.insert_booking(
  p_room_id       bigint,
  p_date          date,
  p_start         time,
  p_end           time,
  p_details       text,
  p_guest_id      uuid,
  p_status        public.booking_status,
  p_walk_in_name  text default null,
  p_walk_in_phone text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_price numeric;
  v_total numeric;
  v_row   public.bookings;
begin
  if p_room_id is null or p_date is null or p_start is null or p_end is null then
    raise exception 'INVALID_INPUT: room, date, start and end are required';
  end if;
  if p_end <= p_start then
    raise exception 'INVALID_INPUT: end time must be after start time';
  end if;
  if p_start < time '08:00' or p_end > time '22:00' then
    raise exception 'INVALID_INPUT: bookings must be between 08:00 and 22:00';
  end if;
  if extract(minute from p_start) not in (0, 30) or extract(second from p_start) <> 0
     or extract(minute from p_end) not in (0, 30) or extract(second from p_end) <> 0
  then
    raise exception 'INVALID_INPUT: start and end must be on the half hour (HH:00 or HH:30)';
  end if;
  if p_date < public.studio_today()
     or (p_date = public.studio_today() and p_start < (now() at time zone 'Asia/Ho_Chi_Minh')::time)
  then
    raise exception 'PAST_DATE: cannot book a time in the past';
  end if;

  select r.price into v_price from public.rooms r where r.id = p_room_id;
  if not found then
    raise exception 'NOT_FOUND: room % does not exist', p_room_id;
  end if;
  v_total := round(v_price * extract(epoch from (p_end - p_start)) / 3600);

  begin
    insert into public.bookings (room_id, guest_id, walk_in_name, walk_in_phone, date, start_time, end_time, status,
                                 full_payment, deposit, details)
    values (p_room_id, p_guest_id, nullif(btrim(p_walk_in_name), ''), nullif(btrim(p_walk_in_phone), ''), p_date, p_start,
            p_end, p_status, v_total, round(v_total * 0.5), nullif(btrim(p_details), ''))
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN: the room is already booked at that time';
  end;
  return v_row;
end;
$$;

-- Books for the caller (status pending), or — staff only — for p_guest_id (status approved: staff took the
-- booking themselves). Unchanged for its callers; the checks and the insert are private.insert_booking.
create or replace function public.create_booking(
  p_room_id  bigint,
  p_date     date,
  p_start    time,
  p_end      time,
  p_details  text default null,
  p_guest_id uuid default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_guest uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN: sign in to book a room';
  end if;
  v_guest := coalesce(p_guest_id, v_uid);
  if v_guest <> v_uid then
    if not public.is_staff() then
      raise exception 'FORBIDDEN: only staff can book for another user';
    end if;
    if not exists (select 1 from public.profiles p where p.id = v_guest) then
      raise exception 'NOT_FOUND: user % not found', v_guest;
    end if;
  end if;
  return private.insert_booking(p_room_id, p_date, p_start, p_end, p_details, v_guest,
    case when p_guest_id is not null and public.is_staff() then 'approved' else 'pending' end::public.booking_status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Staff book for an account or a walk-in
-- -----------------------------------------------------------------------------
-- In one go: the booking (approved unless p_status = 'pending'), another agreed price with its reason if given,
-- and money taken now (the deposit, the full price or any amount; cash or a transfer seen by hand). For an
-- account pass p_guest; for a walk-in leave it null and pass p_walk_in_name (and p_walk_in_phone). Its payment
-- code is set like any booking's; with nothing taken, the guest pays later by QR. → the booking.
drop function public.booking_staff_create(uuid, bigint, date, time, time, text, public.booking_status, numeric, text,
  numeric, public.payment_method, text);
create function public.booking_staff_create(
  p_guest         uuid,
  p_room          bigint,
  p_date          date,
  p_start         time,
  p_end           time,
  p_details       text default null,
  p_status        public.booking_status default 'approved',
  p_price         numeric default null,
  p_price_note    text default null,
  p_paid          numeric default 0,
  p_method        public.payment_method default 'cash',
  p_payment_note  text default null,
  p_walk_in_name  text default null,
  p_walk_in_phone text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_name text := nullif(btrim(p_walk_in_name), '');
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only staff can book for a guest';
  end if;
  if (p_guest is null) = (v_name is null) then
    raise exception 'INVALID_INPUT: pick an account, or give the walk-in''s name';
  end if;
  if p_guest is null and nullif(btrim(p_walk_in_phone), '') is null then
    raise exception 'INVALID_INPUT: give the walk-in''s phone number';
  end if;
  if p_status not in ('approved', 'pending') then
    raise exception 'INVALID_INPUT: a new booking is approved or pending';
  end if;
  if coalesce(p_paid, 0) < 0 then
    raise exception 'INVALID_INPUT: the amount taken can''t be negative';
  end if;
  if p_guest is not null then
    b := public.create_booking(p_room, p_date, p_start, p_end, p_details, p_guest);
  else
    b := private.insert_booking(p_room, p_date, p_start, p_end, p_details, null, 'approved', v_name, p_walk_in_phone);
  end if;
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
-- Activity log: a walk-in's booking is labelled with their name
-- -----------------------------------------------------------------------------
-- The bank paid a booking: apply it and log it as the bank (not as whoever triggered the match, e.g. a
-- guest simulating a transfer in the demo).
create or replace function private.bank_pays_booking(p_booking bigint, p_amount numeric, p_code text)
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
  values ('bookings', 'paid', 'bookings', b.id::text, b.guest_id, private.booking_who(b),
          jsonb_strip_nulls(jsonb_build_object(
            'received', p_amount, 'method', 'transfer', 'code', p_code, 'bank', true, 'date', b.date, 'start', b.start_time,
            'end', b.end_time, 'status', b.status,
            'room', (select r.name from public.rooms r where r.id = b.room_id))));
  return b;
end;
$$;

-- The activity log line for money on a booking, by whoever is signed in (null = the bank).
create or replace function private.log_booking_money(b public.bookings, p_action text, p_meta jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, subject_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'bookings', p_action, 'bookings', b.id::text, b.guest_id, private.booking_who(b),
         jsonb_strip_nulls(p_meta || jsonb_build_object(
           'date', b.date, 'start', b.start_time, 'end', b.end_time, 'status', b.status,
           'room', (select r.name from public.rooms r where r.id = b.room_id)));
$$;

-- The trigger (20261117000200_activity_log), unchanged but for the bookings label: the account's name, else the
-- walk-in's.
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_changes jsonb;
  v_changed text[] := '{}';
  v_area text;
  v_action text;
  v_entity_id text := r ->> 'id';
  v_class bigint;
  v_subject uuid;
  v_label text := '';
  v_meta jsonb := '{}'::jsonb;
  v_system boolean := false;   -- logged even without a signed-in person
begin
  if coalesce(current_setting('oops.activity', true), '') = 'off' then
    return null;
  end if;
  -- Cheap exits first: generated rows, and system writes to tables where only people's actions count.
  if (tg_table_name in ('student_attendance', 'tuition_invoices') and tg_op <> 'UPDATE')
     or (tg_table_name = 'instructor_attendance' and tg_op <> 'UPDATE' and not coalesce((r ->> 'is_extra')::boolean, false))
     or (v_actor is null and tg_table_name not in ('class_students', 'tuition_invoices', 'bank_transfers', 'profiles')) then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    v_changes := private.activity_diff(o, n, array['updated_at', 'created_at', 'updated_by', 'created_by', 'lesson',
      'final_schedule', 'month', 'note_before_waive', 'payment_code', 'raw', 'checkin_proof_path', 'checkout_proof_path']);
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    select array_agg(k order by k) into v_changed from jsonb_object_keys(v_changes) k;
  end if;

  -- Never let the log break the action it records.
  begin
    case tg_table_name
    when 'bookings' then
      v_area := 'bookings';
      v_subject := (r ->> 'guest_id')::uuid;
      v_label := coalesce(private.person_name(v_subject), r ->> 'walk_in_name', '');
      v_meta := jsonb_build_object('room', (select x.name from public.rooms x where x.id = (r ->> 'room_id')::bigint),
                                   'date', r -> 'date', 'start', r -> 'start_time', 'end', r -> 'end_time', 'status', r -> 'status');
      v_action := case tg_op
        when 'INSERT' then 'created'
        when 'DELETE' then 'deleted'
        else case
          when 'status' = any (v_changed) then case n ->> 'status' when 'pending' then 'reopened' else n ->> 'status' end
          when v_changed && array['deposit', 'full_payment', 'real_income', 'bank_transfer', 'cash', 'deposit_status'] then 'payment_updated'
          else 'updated' end
        end;

    when 'classes' then
      v_area := 'classes';
      v_class := (r ->> 'id')::bigint;
      v_subject := (r ->> 'instructor_id')::uuid;
      v_label := r ->> 'name';
      v_meta := jsonb_build_object('instructor', private.person_name(v_subject));
      v_action := case tg_op
        when 'INSERT' then 'created'
        when 'DELETE' then 'deleted'
        else case
          when 'ended_on' = any (v_changed) then case when n ->> 'ended_on' is null then 'reopened' else 'ended' end
          when 'instructor_id' = any (v_changed) then 'instructor_changed'
          else 'updated' end
        end;
      if v_action = 'ended' then
        v_meta := v_meta || jsonb_build_object('last_day', n -> 'ended_on', 'reason', n -> 'end_reason');
      elsif v_action = 'instructor_changed' then
        v_meta := v_meta || jsonb_build_object('from', private.person_name((o ->> 'instructor_id')::uuid));
      end if;

    when 'class_schedules' then
      v_area := 'classes';
      v_class := (r ->> 'class_id')::bigint;
      v_label := private.class_name(v_class);
      if v_label is null then
        return null; -- the class itself was deleted
      end if;
      v_meta := jsonb_build_object('day', r -> 'day_of_week', 'start', r -> 'start_time', 'end', r -> 'end_time');
      if tg_op = 'UPDATE' then
        v_meta := v_meta || jsonb_build_object('from', jsonb_build_object('day', o -> 'day_of_week', 'start', o -> 'start_time', 'end', o -> 'end_time'));
      end if;
      v_action := case tg_op when 'INSERT' then 'schedule_added' when 'DELETE' then 'schedule_removed' else 'schedule_changed' end;

    when 'class_lessons' then
      v_area := 'routines';
      v_class := (r ->> 'class_id')::bigint;
      v_label := r ->> 'title';
      v_meta := jsonb_build_object('class', private.class_name(v_class), 'starts_on', r -> 'starts_on',
                                   'sessions', r -> 'session_count', 'price', r -> 'price');
      if v_meta ->> 'class' is null then
        return null;
      end if;
      v_action := case tg_op
        when 'INSERT' then 'planned'
        when 'DELETE' then 'deleted'
        else case
          when v_changed = array['video_url'] then case
            when n ->> 'video_url' is null then 'video_removed'
            when o ->> 'video_url' is null then 'video_added'
            else 'video_changed' end
          else 'updated' end
        end;

    when 'class_students' then
      v_area := 'students';
      v_class := (r ->> 'class_id')::bigint;
      v_subject := (r ->> 'student_id')::uuid;
      v_entity_id := v_class || ':' || v_subject;
      v_label := private.person_name(v_subject);
      v_meta := jsonb_build_object('class', private.class_name(v_class), 'joined_at', r -> 'joined_at', 'leaves_after', r -> 'leaves_after');
      if v_label is null or v_meta ->> 'class' is null then
        return null; -- the person or the class was deleted
      end if;
      v_action := case tg_op
        when 'INSERT' then 'enrolled'
        when 'DELETE' then 'removed'
        else case
          when 'leaves_after' = any (v_changed) then case when n ->> 'leaves_after' is null then 'staying' else 'leaving' end
          else 'updated' end
        end;
      v_system := tg_op = 'DELETE'; -- the daily cycle: out after their last course

    when 'instructor_attendance' then
      v_area := 'sessions';
      v_class := (r ->> 'class_id')::bigint;
      v_subject := (r ->> 'instructor_id')::uuid;
      v_label := private.class_name(v_class);
      if v_label is null then
        return null;
      end if;
      v_meta := jsonb_build_object('date', r -> 'date',
                                   'start', to_jsonb(private.session_start(v_class, (r ->> 'date')::date, (r ->> 'start_time')::time)),
                                   'make_up', r -> 'is_extra', 'instructor', private.person_name(v_subject));
      if tg_op = 'INSERT' then
        v_action := 'make_up_added';
      elsif tg_op = 'DELETE' then
        v_action := 'make_up_removed';
      elsif 'status' = any (v_changed) then
        v_action := case n ->> 'status'
          when 'in_progress' then 'checked_in'
          when 'completed' then case when v_actor = v_subject then 'checked_out' else 'approved' end
          when 'cancelled' then 'cancelled'
          else 'reopened' end;
        v_meta := v_meta || jsonb_build_object('from_status', o -> 'status', 'note', n -> 'details');
      elsif 'instructor_id' = any (v_changed) then
        v_action := 'substituted';
        v_meta := v_meta || jsonb_build_object('from', private.person_name((o ->> 'instructor_id')::uuid));
      elsif 'details' = any (v_changed) then
        v_action := 'note';
        v_meta := v_meta || jsonb_build_object('note', n -> 'details');
      end if;

    when 'student_attendance' then
      v_area := 'roll_call';
      v_class := (r ->> 'class_id')::bigint;
      v_subject := (r ->> 'student_id')::uuid;
      v_label := coalesce(private.person_name(v_subject), '');
      v_meta := jsonb_build_object('class', private.class_name(v_class), 'date', r -> 'date', 'status', r -> 'status');
      if 'status' = any (v_changed) then
        v_action := case n ->> 'status' when 'attend' then 'attended' when 'absent' then 'absent' else 'unmarked' end;
      elsif 'details' = any (v_changed) then
        v_action := 'note';
        v_meta := v_meta || jsonb_build_object('note', n -> 'details');
      end if;

    when 'tuition_invoices' then
      v_area := 'tuition';
      v_class := (r ->> 'class_id')::bigint;
      v_subject := (r ->> 'student_id')::uuid;
      v_label := r ->> 'student_name';
      v_meta := jsonb_build_object('class', r -> 'class_name', 'course', r -> 'lesson_title', 'amount', r -> 'amount',
                                   'paid', r -> 'paid_amount', 'method', r -> 'method', 'status', r -> 'status');
      if v_changed && array['status', 'paid_amount'] then
        v_action := case
          when n ->> 'status' = 'waived' then 'waived'
          when n ->> 'status' = 'void' then 'cancelled'
          when (n ->> 'paid_amount')::numeric > (o ->> 'paid_amount')::numeric then 'paid'
          when (n ->> 'paid_amount')::numeric < (o ->> 'paid_amount')::numeric then 'payment_undone'
          when o ->> 'status' in ('waived', 'void') and n ->> 'status' = 'unpaid' then 'reopened'
          end;
        v_system := v_action in ('paid', 'cancelled'); -- the bank, the renewal cycle
        if v_action = 'paid' then
          v_meta := v_meta || jsonb_build_object('received', (n ->> 'paid_amount')::numeric - (o ->> 'paid_amount')::numeric);
        elsif v_action = 'waived' then
          v_meta := v_meta || jsonb_build_object('note', n -> 'note');
        elsif v_action = 'cancelled' then
          v_meta := v_meta || jsonb_build_object('reason', n -> 'void_reason');
        end if;
      elsif 'amount' = any (v_changed) then
        v_action := 'amount_changed';
        v_meta := v_meta || jsonb_build_object('from', o -> 'amount', 'note', n -> 'note');
      elsif 'renewal' = any (v_changed) then
        v_action := 'renewal';
        v_meta := v_meta || jsonb_build_object('renewal', n -> 'renewal');
      elsif 'note' = any (v_changed) then
        v_action := 'note';
        v_meta := v_meta || jsonb_build_object('note', n -> 'note');
      end if;

    when 'bank_transfers' then
      v_area := 'tuition';
      v_label := coalesce(r ->> 'content', '');
      v_meta := jsonb_build_object('amount', r -> 'amount', 'status', r -> 'status', 'invoice_id', r -> 'invoice_id',
                                   'student', (select i.student_name from public.tuition_invoices i where i.id = (r ->> 'invoice_id')::bigint));
      if tg_op = 'INSERT' then
        -- Matched on arrival: the invoice's "paid" row says it.
        v_action := case when r ->> 'status' = 'unmatched' then 'transfer_unmatched' end;
        v_system := true;
      elsif tg_op = 'UPDATE' and 'status' = any (v_changed) then
        v_action := case n ->> 'status' when 'matched' then 'transfer_assigned' when 'ignored' then 'transfer_ignored' else 'transfer_reopened' end;
      end if;

    when 'expenses' then
      v_area := 'expenses';
      v_class := (r ->> 'class_id')::bigint;
      v_label := coalesce(r ->> 'description', '');
      v_meta := jsonb_build_object('category', r -> 'category', 'amount', r -> 'amount', 'spent_on', r -> 'spent_on',
                                   'vendor', r -> 'vendor', 'class', private.class_name(v_class));
      v_action := case tg_op
        when 'INSERT' then 'created'
        when 'DELETE' then 'deleted'
        else case
          when v_changed = array['receipt_path'] then case when n ->> 'receipt_path' is null then 'receipt_removed' else 'receipt_added' end
          else 'updated' end
        end;

    when 'recurring_expenses' then
      v_area := 'expenses';
      v_class := (r ->> 'class_id')::bigint;
      v_label := coalesce(r ->> 'description', '');
      v_meta := jsonb_build_object('category', r -> 'category', 'amount', r -> 'amount', 'day', r -> 'day_of_month');
      v_action := case tg_op
        when 'INSERT' then 'recurring_created'
        when 'DELETE' then 'recurring_deleted'
        else case
          when v_changed = array['active'] then case when (n ->> 'active')::boolean then 'recurring_resumed' else 'recurring_paused' end
          else 'recurring_updated' end
        end;

    when 'payslips' then
      v_area := 'payroll';
      v_subject := (r ->> 'profile_id')::uuid;
      v_entity_id := (r ->> 'profile_id') || ':' || (r ->> 'month');
      v_label := coalesce(private.person_name(v_subject), '');
      v_meta := jsonb_build_object('month', r -> 'month', 'total', r -> 'total');
      v_action := case tg_op
        when 'INSERT' then 'payslip_finalized'
        when 'DELETE' then 'payslip_reopened'
        else case when 'status' = any (v_changed) then case n ->> 'status' when 'paid' then 'payslip_paid' else 'payslip_unpaid' end end
        end;

    when 'payroll_adjustments' then
      v_area := 'payroll';
      v_subject := (r ->> 'profile_id')::uuid;
      v_label := coalesce(private.person_name(v_subject), '');
      v_meta := jsonb_build_object('month', r -> 'month', 'amount', r -> 'amount', 'reason', r -> 'reason');
      v_action := case tg_op
        when 'INSERT' then case when (r ->> 'amount')::numeric >= 0 then 'bonus_added' else 'deduction_added' end
        when 'DELETE' then 'adjustment_removed'
        else 'adjustment_changed' end;

    when 'staff_salaries' then
      v_area := 'payroll';
      v_subject := (r ->> 'profile_id')::uuid;
      v_entity_id := r ->> 'profile_id';
      v_label := coalesce(private.person_name(v_subject), '');
      v_meta := jsonb_build_object('salary', r -> 'monthly_salary', 'from', o -> 'monthly_salary');
      v_action := case tg_op when 'DELETE' then 'salary_removed' else 'salary_set' end;

    when 'class_pay_rates' then
      v_area := 'payroll';
      v_class := (r ->> 'class_id')::bigint;
      v_entity_id := r ->> 'class_id';
      v_label := private.class_name(v_class);
      if v_label is null then
        return null;
      end if;
      v_meta := jsonb_build_object('rate', r -> 'session_rate', 'from', o -> 'session_rate');
      v_action := case tg_op when 'DELETE' then 'rate_removed' else 'rate_set' end;

    when 'payroll_settings', 'tuition_settings' then
      v_area := 'settings';
      v_label := case tg_table_name when 'payroll_settings' then 'Payroll' else 'Tuition' end;
      v_action := case when tg_op = 'UPDATE' then 'updated' end;

    when 'rooms' then
      v_area := 'rooms';
      v_label := coalesce(r ->> 'name', '');
      v_meta := jsonb_build_object('size', r -> 'size', 'price', r -> 'price');
      v_action := case tg_op
        when 'INSERT' then 'created'
        when 'DELETE' then 'deleted'
        else case when v_changed = array['image_paths'] then 'photos_changed' else 'updated' end
        end;

    when 'profiles' then
      v_area := 'users';
      v_subject := (r ->> 'id')::uuid;
      v_label := coalesce(nullif(btrim(r ->> 'full_name'), ''), r ->> 'username', r ->> 'email', '');
      v_meta := jsonb_build_object('email', r -> 'email', 'role', r -> 'role');
      if tg_op = 'INSERT' then
        v_action := 'account_created';   -- a sign-up, or an admin creating it (admin-users claims the row)
        v_system := true;
      elsif tg_op = 'DELETE' then
        v_action := 'account_deleted';
        v_system := true;
      elsif 'role' = any (v_changed) then
        v_action := 'role_changed';
        v_meta := v_meta || jsonb_build_object('from', o -> 'role');
      elsif v_actor is distinct from v_subject
            and v_changed && array['full_name', 'username', 'email', 'contact_number', 'date_of_birth'] then
        v_action := 'profile_edited'; -- someone else changed their details (own edits aren't logged)
      end if;

    else
      return null;
    end case;

    if v_action is null or (v_actor is null and not v_system) then
      return null;
    end if;

    insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, class_id, subject_id,
                                     label, changes, meta)
    values (v_actor, private.person_name(v_actor), (select p.role from public.profiles p where p.id = v_actor),
            v_area, v_action, tg_table_name, v_entity_id, v_class, v_subject, coalesce(v_label, ''),
            case when tg_op = 'UPDATE' then v_changes end, nullif(jsonb_strip_nulls(v_meta), '{}'::jsonb));
  exception when others then
    raise warning 'activity log skipped (% on %): %', tg_op, tg_table_name, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function private.booking_who(public.bookings),
  private.insert_booking(bigint, date, time, time, text, uuid, public.booking_status, text, text)
  from public, anon, authenticated;
revoke execute on function public.booking_staff_create(uuid, bigint, date, time, time, text, public.booking_status, numeric,
  text, numeric, public.payment_method, text, text, text) from public, anon;
grant execute on function public.booking_staff_create(uuid, bigint, date, time, time, text, public.booking_status, numeric,
  text, numeric, public.payment_method, text, text, text) to authenticated;
