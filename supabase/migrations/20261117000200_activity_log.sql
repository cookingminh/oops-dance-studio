-- Activity log: who did what in the studio (api-contract §3 activity_log, §5 activity_summary).
--
-- One row per thing a person did: a booking approved, a session checked in, a roll call marked, tuition
-- recorded, a routine planned, a role changed… written by one trigger on the studio tables, with the
-- signed-in person as the actor (auth.uid()). Rows are facts for the admin's Activity page:
--   area     bookings | classes | routines | students | sessions | roll_call | tuition | expenses |
--            payroll | rooms | users | settings
--   action   a verb per area (created, approved, checked_in, paid, waived, enrolled, …) — see log_activity()
--   label    what it is about, in data words (a guest, a class, a student, a routine title)
--   meta     facts for the sentence (room, date, amount, method, reason, from → to…)
--   changes  for plain edits: { column: { from, to } }
-- Jobs and the bank (no signed-in person) are logged only where it matters: a payment arriving, an
-- invoice cancelled by the renewal cycle, a student leaving after their course, an account created or
-- deleted, a transfer nobody could match. Generated rows (weekly sessions, roll calls, invoices) aren't.
-- Only admins read it. Rows older than 400 days are pruned nightly.
-- For bulk maintenance: `select set_config('oops.activity', 'off', true)` skips logging in that transaction.

create table public.activity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  -- No foreign keys: the log outlives people, classes and records it mentions.
  actor_id    uuid,                 -- null = the system (a scheduled job, the bank, a sign-up)
  actor_name  text,                 -- as it was then
  actor_role  public.app_role,
  area        text not null,
  action      text not null,
  entity      text not null,        -- the table
  entity_id   text,
  class_id    bigint,
  subject_id  uuid,                 -- the person the record is about (guest, student, instructor, payee)
  label       text not null default '',
  changes     jsonb,
  meta        jsonb,
  -- label + actor folded for search: lower case, Vietnamese accents dropped ("thao vy" finds "Thảo Vy").
  search      text generated always as (lower(translate(coalesce(label, '') || ' ' || coalesce(actor_name, ''),
                'àáạảãâầấậẩẫăằắặẳẵÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴèéẹẻẽêềếệểễÈÉẸẺẼÊỀẾỆỂỄìíịỉĩÌÍỊỈĨòóọỏõôồốộổỗơờớợởỡÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠùúụủũưừứựửữÙÚỤỦŨƯỪỨỰỬỮỳýỵỷỹỲÝỴỶỸđĐ',
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd'))) stored
);

create index activity_log_at_idx on public.activity_log (at desc);
create index activity_log_actor_idx on public.activity_log (actor_id, at desc);
create index activity_log_area_idx on public.activity_log (area, at desc);
create index activity_log_class_idx on public.activity_log (class_id, at desc) where class_id is not null;
create index activity_log_subject_idx on public.activity_log (subject_id, at desc) where subject_id is not null;
create index activity_log_entity_idx on public.activity_log (entity, entity_id);

alter table public.activity_log enable row level security;
create policy activity_log_admin_read on public.activity_log
  for select to authenticated using (public.is_admin());
revoke all on public.activity_log from anon;
revoke insert, update, delete, truncate, references, trigger on public.activity_log from authenticated;
grant select on public.activity_log to authenticated;

-- { column: { from, to } } for the columns that differ, minus bookkeeping ones.
create function private.activity_diff(p_old jsonb, p_new jsonb, p_ignore text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('from', p_old -> k, 'to', p_new -> k)), '{}'::jsonb)
    from jsonb_object_keys(p_new) k
   where not (k = any (p_ignore)) and (p_old -> k) is distinct from (p_new -> k);
$$;

create function private.class_name(p_class bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select c.name from public.classes c where c.id = p_class; $$;

-- Start time of a session: a make-up's own, else the class's weekly slot that day.
create function private.session_start(p_class bigint, p_date date, p_own time)
returns time
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_own, (select min(s.start_time) from public.class_schedules s
                           where s.class_id = p_class and s.day_of_week = extract(isodow from p_date)));
$$;

-- -----------------------------------------------------------------------------
-- The trigger
-- -----------------------------------------------------------------------------
create function private.log_activity()
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
      v_label := coalesce(private.person_name(v_subject), '');
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

do $$
declare
  t text;
begin
  foreach t in array array['bookings', 'classes', 'class_schedules', 'class_lessons', 'class_students', 'instructor_attendance',
                           'student_attendance', 'tuition_invoices', 'bank_transfers', 'expenses', 'recurring_expenses',
                           'payslips', 'payroll_adjustments', 'staff_salaries', 'class_pay_rates', 'payroll_settings',
                           'tuition_settings', 'rooms', 'profiles'] loop
    execute format('create trigger zz_log_activity after insert or update or delete on public.%I
                      for each row execute function private.log_activity()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reading it
-- -----------------------------------------------------------------------------
-- Counts for the filters of a period: { total, people: [{ actor_id, name, role, count }], areas: [{ area, count }],
-- actions: [{ area, action, count }] } (people include the system as actor_id null).
create function public.activity_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: only admins can read the activity log';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.activity_log a where a.at >= p_from and a.at < p_to),
    'people', coalesce((select jsonb_agg(x order by x.count desc, x.name)
                          from (select a.actor_id, max(a.actor_name) as name, max(a.actor_role::text) as role, count(*) as count
                                  from public.activity_log a where a.at >= p_from and a.at < p_to
                                 group by a.actor_id) x), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(x order by x.count desc)
                         from (select a.area, count(*) as count from public.activity_log a
                                where a.at >= p_from and a.at < p_to group by a.area) x), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(x order by x.count desc)
                           from (select a.area, a.action, count(*) as count from public.activity_log a
                                  where a.at >= p_from and a.at < p_to group by a.area, a.action) x), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Pruning: 00:25 Asia/Ho_Chi_Minh daily (= 17:25 UTC)
-- -----------------------------------------------------------------------------
create function public.activity_prune()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not private.is_service_context() then
    raise exception 'FORBIDDEN: the activity log is pruned by the scheduled job';
  end if;
  delete from public.activity_log where at < now() - interval '400 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

select cron.schedule('activity-prune', '25 17 * * *', $$select public.activity_prune()$$);

-- -----------------------------------------------------------------------------
-- Demo: a believable last week and a half, from the seeded data
-- -----------------------------------------------------------------------------
create function public.seed_demo_activity()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_now timestamptz := now() - interval '3 minutes';
  v_admin uuid := (select id from public.profiles where email = 'admin@demo.oopsdance.test');
  v_staff uuid := (select id from public.profiles where email = 'staff@demo.oopsdance.test');
  v_tz text := 'Asia/Ho_Chi_Minh';
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo activity is only seeded on a sandbox';
  end if;
  delete from public.activity_log where true; -- (PostgREST's safeupdate wants a WHERE)

  -- Each part below writes straight into the log; names, roles and empty facts are tidied at the end.
  -- Instructors check in and out of their sessions (last 8 days).
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select x.at, a.instructor_id, 'sessions', x.action, 'instructor_attendance', a.id::text, a.class_id, a.instructor_id, c.name,
         jsonb_build_object('date', a.date, 'start', private.session_start(a.class_id, a.date, a.start_time),
                            'instructor', private.person_name(a.instructor_id))
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
    cross join lateral (values ('checked_in', a.checkin_at), ('checked_out', a.checkout_at)) x(action, at)
   where a.date >= v_today - 8 and x.at is not null and x.at <= v_now;

  -- Cancelled sessions: staff, the evening before.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(((a.date - 1) + time '20:15') at time zone v_tz, v_now), v_staff, 'sessions', 'cancelled', 'instructor_attendance',
         a.id::text, a.class_id, a.instructor_id, c.name,
         jsonb_build_object('date', a.date, 'start', private.session_start(a.class_id, a.date, a.start_time),
                            'instructor', private.person_name(a.instructor_id), 'note', a.details)
    from public.instructor_attendance a join public.classes c on c.id = a.class_id
   where a.status = 'cancelled' and a.date between v_today - 8 and v_today + 2;

  -- Roll calls: marked by the class's instructor right after class (one class in four by staff).
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(((sa.date + coalesce(ia.end_time, sl.end_time, time '20:00')) at time zone v_tz)
               + interval '6 minutes' + (abs(hashtext(sa.id::text)) % 50) * interval '1 second', v_now),
         case when abs(hashtext(sa.class_id::text || sa.date::text)) % 4 = 0 then v_staff else c.instructor_id end,
         'roll_call', case sa.status when 'attend' then 'attended' else 'absent' end, 'student_attendance', sa.id::text,
         sa.class_id, sa.student_id, coalesce(private.person_name(sa.student_id), ''),
         jsonb_build_object('class', c.name, 'date', sa.date, 'status', sa.status)
    from public.student_attendance sa
    join public.classes c on c.id = sa.class_id
    left join public.instructor_attendance ia on ia.class_id = sa.class_id and ia.date = sa.date
    left join lateral (select max(s.end_time) as end_time from public.class_schedules s
                        where s.class_id = sa.class_id and s.day_of_week = extract(isodow from sa.date)) sl on true
   where sa.date >= v_today - 6 and sa.status <> 'pending'
     and coalesce(ia.status, 'completed') <> 'cancelled';

  -- Bookings: guests ask, staff answer a few hours later.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, subject_id, label, meta)
  select least(x.at, v_now), x.actor, 'bookings', x.action, 'bookings', b.id::text, b.guest_id,
         coalesce(private.person_name(b.guest_id), ''),
         jsonb_build_object('room', rm.name, 'date', b.date, 'start', b.start_time, 'end', b.end_time, 'status', b.status)
    from public.bookings b
    join public.rooms rm on rm.id = b.room_id
    cross join lateral (select ((b.date - (2 + abs(hashtext(b.id::text)) % 5)) + time '09:00')::timestamp at time zone v_tz
                               + (abs(hashtext(b.id::text || 'h')) % 600) * interval '1 minute' as asked) q
    cross join lateral (values (q.asked, b.guest_id, 'created'),
                               (q.asked + (1 + abs(hashtext(b.id::text)) % 6) * interval '1 hour', v_staff,
                                case when b.status in ('approved', 'completed') then 'approved' when b.status = 'rejected' then 'rejected' end),
                               (q.asked + interval '1 day', b.guest_id, case when b.status = 'cancelled' then 'cancelled' end)) x(at, actor, action)
   where b.date between v_today - 8 and v_today + 14 and x.action is not null and q.asked <= v_now;

  -- Tuition received: cash by staff, transfers by the bank.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select i.paid_at, case when i.method = 'cash' then v_staff end, 'tuition', 'paid', 'tuition_invoices', i.id::text,
         i.class_id, i.student_id, i.student_name,
         jsonb_build_object('class', i.class_name, 'course', i.lesson_title, 'amount', i.amount, 'paid', i.paid_amount,
                            'received', i.paid_amount, 'method', i.method, 'status', i.status)
    from public.tuition_invoices i
   where i.paid_at between v_now - interval '12 days' and v_now and i.paid_amount > 0;

  -- Waived and cancelled invoices.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(i.updated_at, v_now) - (abs(hashtext(i.id::text)) % 72) * interval '1 hour',
         case when i.status = 'waived' then v_admin when i.void_reason in ('switched', 'removed') then v_staff end,
         'tuition', case when i.status = 'waived' then 'waived' else 'cancelled' end, 'tuition_invoices', i.id::text,
         i.class_id, i.student_id, i.student_name,
         jsonb_build_object('class', i.class_name, 'course', i.lesson_title, 'amount', i.amount, 'note', i.note, 'reason', i.void_reason)
    from public.tuition_invoices i
   where (i.status = 'waived' or (i.status = 'void' and i.void_reason in ('not_renewed', 'stopped', 'switched')))
     and i.updated_at >= v_now - interval '10 days';

  -- Renewal answers from students.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(((i.due_date - 2 - abs(hashtext(i.id::text)) % 3) + time '21:00') at time zone v_tz, v_now - interval '2 hours'),
         i.student_id, 'tuition', 'renewal', 'tuition_invoices', i.id::text, i.class_id, i.student_id, i.student_name,
         jsonb_build_object('class', i.class_name, 'course', i.lesson_title, 'renewal', i.renewal)
    from public.tuition_invoices i
    join public.class_lessons l on l.id = i.lesson_id
   where i.renewal is not null and l.starts_on > v_today and i.switched_from is null;

  -- Class switches, enrolments and routines planned by staff.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select v_now - interval '2 days 3 hours', v_staff, 'students', 'leaving', 'class_students', cs.class_id || ':' || cs.student_id,
         cs.class_id, cs.student_id, private.person_name(cs.student_id),
         jsonb_build_object('class', private.class_name(cs.class_id), 'joined_at', cs.joined_at, 'leaves_after', cs.leaves_after)
    from public.class_students cs where cs.leaves_after is not null
  union all
  select v_now - interval '2 days 3 hours' + interval '20 seconds', v_staff, 'students', 'enrolled', 'class_students',
         cs.class_id || ':' || cs.student_id, cs.class_id, cs.student_id, private.person_name(cs.student_id),
         jsonb_build_object('class', private.class_name(cs.class_id), 'joined_at', cs.joined_at)
    from public.class_students cs where cs.joined_at > v_today
  union all
  select v_now - (1 + l.id % 4) * interval '1 day' - (l.id % 9) * interval '1 hour', v_staff, 'routines', 'planned', 'class_lessons',
         l.id::text, l.class_id, null, l.title,
         jsonb_build_object('class', private.class_name(l.class_id), 'starts_on', l.starts_on, 'sessions', l.session_count)
    from public.class_lessons l where l.starts_on > v_today;

  -- Costs added this month.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, label, meta)
  select least((e.spent_on + time '20:30') at time zone v_tz, v_now), coalesce(e.created_by, v_admin), 'expenses', 'created', 'expenses',
         e.id::text, e.class_id, e.description,
         jsonb_build_object('category', e.category, 'amount', e.amount, 'spent_on', e.spent_on, 'vendor', e.vendor,
                            'class', private.class_name(e.class_id))
    from public.expenses e
   where e.spent_on >= v_today - 10 and e.spent_on <= v_today and e.recurring_id is null;

  -- Last month's payslips: finalized and paid by the admin.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, subject_id, label, meta)
  select x.at, v_admin, 'payroll', x.action, 'payslips', s.profile_id || ':' || s.month, s.profile_id,
         coalesce(private.person_name(s.profile_id), ''), jsonb_build_object('month', s.month, 'total', s.total)
    from public.payslips s
    cross join lateral (values ('payslip_finalized', s.finalized_at), ('payslip_paid', s.paid_at)) x(action, at)
   where x.at is not null and x.at between v_now - interval '12 days' and v_now;

  delete from public.activity_log where at > v_now or at < v_now - interval '14 days';
  update public.activity_log a
     set actor_name = private.person_name(a.actor_id),
         actor_role = (select p.role from public.profiles p where p.id = a.actor_id),
         meta = nullif(jsonb_strip_nulls(a.meta), '{}'::jsonb)
   where true;

  return (select count(*) from public.activity_log);
end;
$$;

revoke execute on function public.seed_demo_activity() from public, anon, authenticated;
grant execute on function public.seed_demo_activity() to service_role;
revoke execute on function public.activity_prune() from public, anon, authenticated;
grant execute on function public.activity_prune() to service_role;
revoke execute on function public.activity_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.activity_summary(timestamptz, timestamptz) to authenticated;
revoke execute on function private.log_activity(), private.activity_diff(jsonb, jsonb, text[]),
  private.class_name(bigint), private.session_start(bigint, date, time) from public, anon, authenticated;
