-- =============================================================================
-- Demo tuition per course, and skipped recurring costs
--
--   * seed_demo_tuition() is rewritten for courses: every class gets past courses back to its
--     first member, members pay each finished course; the running course is part paid, a few
--     overdue who promised to pay, the rest open; one class has its next course planned and its
--     renewal opened early with a few answers; a few students left a class; a small transfer inbox.
--     guest@ has an open course in K-pop Cover Cơ Bản to try the QR flow.
--   * Deleting a recurring cost's copy for a month records a skip, so the daily job doesn't add it
--     again that month.
-- =============================================================================

create or replace function public.seed_demo_tuition()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_month date := private.tuition_month(v_today);
  v_guest uuid := (select id from public.profiles where email = 'guest@demo.oopsdance.test');
  v_songs text[] := array['Love Dive — IVE', 'Kill This Love — BLACKPINK', 'Super — SEVENTEEN', 'Hype Boy — NewJeans',
                          'Queencard — (G)I-DLE', 'Butter — BTS', 'Fancy — TWICE', 'Smoke — Dane x Bada',
                          'Rush — Troye Sivan', 'Señorita — Shawn Mendes'];
  v_n integer := 0;
  c record;
  r record;
  l record;
  m date;
  h integer;
  k integer;
  v_paid_at timestamptz;
  v_class bigint;
  v_cur bigint;
  v_next bigint;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo tuition is only seeded on a sandbox';
  end if;

  update public.tuition_settings
     set bank_code = coalesce(bank_code, '970436'), bank_name = coalesce(bank_name, 'Vietcombank'),
         account_no = coalesce(account_no, '0000000000'), account_name = coalesce(account_name, 'OOPS DANCE STUDIO DEMO')
   where id = 1;

  -- 1. Past courses: one a month back to the class's first member, before its earliest course.
  for c in
    select x.id,
           (select min(cs.joined_at) from public.class_students cs where cs.class_id = x.id) as first_join,
           (select min(le.starts_on) from public.class_lessons le where le.class_id = x.id) as first_course
      from public.classes x
     where x.ended_on is null and x.starts_on <= v_today
     order by x.id
  loop
    continue when c.first_join is null;
    m := private.tuition_month(c.first_join);
    while m < coalesce(c.first_course, v_month) loop
      v_n := v_n + 1;
      insert into public.class_lessons (class_id, starts_on, title, session_count)
      values (c.id, m, v_songs[1 + (v_n % array_length(v_songs, 1))],
              greatest(1, (select count(*)::int
                             from generate_series(m, (m + interval '1 month' - interval '1 day')::date, interval '1 day') d
                             join public.class_schedules s on s.class_id = c.id and s.day_of_week = extract(isodow from d))))
      on conflict do nothing;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  -- 2. Finished courses: every member since they joined, paid (¾ transfer, ¼ cash).
  for r in
    select cs.student_id, cs.class_id, le.id as lid, le.title, le.month, le.starts_on, le.session_count,
           coalesce(le.price, x.price) as price, x.name as cname, private.person_name(cs.student_id) as sname
      from public.class_students cs
      join public.classes x on x.id = cs.class_id
      join public.class_lessons le on le.class_id = cs.class_id
     where le.starts_on >= private.tuition_month(cs.joined_at)
       and private.course_finished(le.id, v_today)
  loop
    h := abs(hashtext(r.student_id::text || r.lid::text));
    v_paid_at := ((r.starts_on + (h % 5)) + time '19:30') at time zone 'Asia/Ho_Chi_Minh';
    insert into public.tuition_invoices (student_id, class_id, lesson_id, student_name, class_name, lesson_title, month,
                                         amount, paid_amount, sessions, status, renewal, method, due_date, paid_at, created_at)
    values (r.student_id, r.class_id, r.lid, coalesce(r.sname, ''), r.cname, r.title, r.month, r.price, r.price, r.session_count,
            'paid', 'continue', case when h % 4 = 0 then 'cash' else 'transfer' end::public.payment_method,
            coalesce(private.course_nth(r.lid, 2), r.starts_on + 7), v_paid_at, v_paid_at - interval '4 days')
    on conflict do nothing;
  end loop;

  -- 3. Students who left a class: two finished courses paid, then the latest one cancelled.
  for r in
    select p.id as sid, x.id as cid, x.price, x.name as cname, private.person_name(p.id) as sname, abs(hashtext(p.email)) as h
      from public.profiles p
      join public.classes x on x.id = (select min(y.id) + abs(hashtext(p.email || 'left')) % greatest(count(*), 1)
                                         from public.classes y where y.ended_on is null)
     where p.role = 'guest' and p.email like '%@demo.oopsdance.test' and p.id is distinct from v_guest
       and abs(hashtext(p.email)) % 3 = 1
       and not exists (select 1 from public.class_students cs where cs.student_id = p.id and cs.class_id = x.id)
  loop
    k := 0;
    for l in
      select le.* from public.class_lessons le
       where le.class_id = r.cid and private.course_finished(le.id, v_today)
       order by le.starts_on desc limit 3
    loop
      k := k + 1;
      insert into public.tuition_invoices (student_id, class_id, lesson_id, student_name, class_name, lesson_title, month,
                                           amount, paid_amount, sessions, status, renewal, void_reason, method, due_date, paid_at)
      values (r.sid, r.cid, l.id, coalesce(r.sname, ''), r.cname, l.title, l.month, coalesce(l.price, r.price),
              case when k = 1 then 0 else coalesce(l.price, r.price) end, l.session_count,
              case when k = 1 then 'void' else 'paid' end::public.tuition_status,
              case when k = 1 and r.h % 2 = 0 then 'stop' when k = 1 then null else 'continue' end::public.tuition_renewal,
              case when k = 1 and r.h % 2 = 0 then 'stopped' when k = 1 then 'not_renewed' end,
              case when k = 1 then null else 'transfer' end::public.payment_method,
              coalesce(private.course_nth(l.id, 2), l.starts_on + 7),
              case when k = 1 then null else ((l.starts_on + 2 + r.h % 4) + time '20:00') at time zone 'Asia/Ho_Chi_Minh' end)
      on conflict do nothing;
    end loop;
  end loop;

  -- 4. The running course: everyone billed; members of the previous course had to answer. Then
  --    part paid, a few overdue who promised to pay cash, the rest open.
  for c in select x.id from public.classes x where x.ended_on is null and x.starts_on <= v_today loop
    perform private.bill_class(c.id, v_today);
  end loop;
  -- (They were billed when they joined, before their history existed: full course, no answer yet.)
  update public.tuition_invoices i
     set renewal = null, amount = coalesce(le.price, x.price), sessions = le.session_count, note = null
    from public.class_lessons le, public.classes x
   where le.id = i.lesson_id and x.id = i.class_id
     and i.status = 'unpaid' and i.paid_amount = 0 and i.lesson_id = private.current_course(i.class_id, v_today)
     and exists (select 1 from public.tuition_invoices p
                  where p.student_id = i.student_id and p.class_id = i.class_id and p.status = 'paid'
                    and p.lesson_id is distinct from i.lesson_id);
  for r in
    select i.*, le.starts_on as course_start from public.tuition_invoices i
      join public.class_lessons le on le.id = i.lesson_id
     where i.status = 'unpaid' and i.paid_amount = 0 and i.lesson_id = private.current_course(i.class_id, v_today)
  loop
    h := abs(hashtext(r.payment_code));
    if r.student_id = v_guest then
      update public.tuition_invoices set renewal = 'continue' where id = r.id;  -- open, to try the QR flow
      continue;
    end if;
    if h % 10 < 6 then
      v_paid_at := least(((r.course_start + (h % 4)) + time '20:15') at time zone 'Asia/Ho_Chi_Minh', now() - interval '1 hour');
      update public.tuition_invoices
         set status = 'paid', paid_amount = amount, renewal = 'continue', paid_at = v_paid_at,
             method = case when h % 4 = 3 then 'cash' else 'transfer' end::public.payment_method
       where id = r.id;
      if h % 4 <> 3 then
        insert into public.bank_transfers (provider, provider_ref, amount, content, received_at, status, invoice_id)
        values ('sepay', 'seed-' || r.id, r.amount, r.payment_code || ' hoc phi', v_paid_at, 'matched', r.id)
        on conflict on constraint bank_transfers_once do nothing;
      end if;
    elsif h % 10 = 6 then
      update public.tuition_invoices
         set renewal = 'continue', due_date = v_today - 2, note = 'Hẹn đóng tiền mặt cuối tuần.'
       where id = r.id;
    end if;
  end loop;

  -- 5. The class whose course ends soonest plans its next course; its renewal is opened early.
  select x.id, private.current_course(x.id, v_today) into v_class, v_cur
    from public.classes x
   where x.ended_on is null and x.starts_on <= v_today and private.current_course(x.id, v_today) is not null
     and private.next_course(x.id, v_today) is null
   order by private.course_end(private.current_course(x.id, v_today)) nulls last, x.id
   limit 1;
  if v_cur is not null and private.course_end(v_cur) is not null then
    insert into public.class_lessons (class_id, starts_on, title, session_count)
    values (v_class, private.course_end(v_cur) + 1, 'Armageddon — aespa', 8)
    returning id into v_next;
    perform public.tuition_open_course(v_next);
    for r in select i.* from public.tuition_invoices i where i.lesson_id = v_next and i.status = 'unpaid' loop
      h := abs(hashtext(r.payment_code || 'next'));
      if h % 5 = 0 then
        update public.tuition_invoices set status = 'void', void_reason = 'stopped', renewal = 'stop' where id = r.id;
      elsif h % 5 = 1 then
        update public.tuition_invoices
           set status = 'paid', paid_amount = amount, renewal = 'continue', method = 'transfer',
               paid_at = now() - make_interval(hours => 2 + h % 30)
         where id = r.id;
      elsif h % 5 = 2 then
        update public.tuition_invoices set renewal = 'continue' where id = r.id;
      end if;
    end loop;
  end if;

  -- 6. One student moves on: they finish their paid course and join a dearer class's upcoming course.
  select i.student_id, i.class_id, t.id as target into r
    from public.tuition_invoices i
    join public.profiles p on p.id = i.student_id
    join public.classes f on f.id = i.class_id
    join lateral (
      select x.id from public.classes x
       where x.id <> i.class_id and x.ended_on is null and x.starts_on <= v_today and x.price > f.price
         and exists (select 1 from public.class_lessons le where le.class_id = x.id and le.starts_on >= v_today)
         and not exists (select 1 from public.class_students cs where cs.class_id = x.id and cs.student_id = i.student_id)
       order by x.price desc, x.id limit 1) t on true
   where i.status = 'paid' and i.lesson_id = private.current_course(i.class_id, v_today)
     and p.email like '%@demo.oopsdance.test' and p.id is distinct from v_guest
     and exists (select 1 from public.class_students cs where cs.class_id = i.class_id and cs.student_id = i.student_id)
   order by p.email
   limit 1;
  if r.student_id is not null then
    perform public.tuition_switch_class(r.student_id, r.class_id, r.target, 'Muốn học lớp nâng cao hơn.');
  end if;

  -- 7. The inbox: a transfer without a code, and a room deposit set aside.
  insert into public.bank_transfers (provider, provider_ref, amount, content, received_at, status, note) values
    ('sepay', 'seed-unmatched-1', 900000, 'NGUYEN THI HOA chuyen tien hoc nhay', now() - interval '5 hours', 'unmatched',
     'No invoice code in the transfer content.'),
    ('sepay', 'seed-unmatched-2', 1200000, 'MBVCB.8812 hoc phi lop kpop nang cao', now() - interval '1 day', 'unmatched',
     'No invoice code in the transfer content.'),
    ('sepay', 'seed-ignored-1', 250000, 'coc phong A thu 7', now() - interval '3 days', 'ignored', 'Room deposit, not tuition.')
  on conflict on constraint bank_transfers_once do nothing;

  return jsonb_build_object(
    'courses', (select count(*) from public.class_lessons),
    'invoices', (select count(*) from public.tuition_invoices),
    'transfers', (select count(*) from public.bank_transfers));
end;
$$;

-- -----------------------------------------------------------------------------
-- Skipped recurring costs
-- -----------------------------------------------------------------------------
create table public.recurring_expense_skips (
  recurring_id bigint not null references public.recurring_expenses (id) on delete cascade,
  month        date not null check (month = date_trunc('month', month)::date),
  created_at   timestamptz not null default now(),
  primary key (recurring_id, month)
);
alter table public.recurring_expense_skips enable row level security;
create policy recurring_expense_skips_admin on public.recurring_expense_skips
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.recurring_expense_skips from anon;

create function private.remember_skipped_recurring()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.recurring_id is not null and exists (select 1 from public.recurring_expenses r where r.id = old.recurring_id) then
    insert into public.recurring_expense_skips (recurring_id, month) values (old.recurring_id, old.month)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger remember_skipped_recurring after delete on public.expenses
  for each row execute function private.remember_skipped_recurring();
revoke execute on function private.remember_skipped_recurring() from public, anon, authenticated;

create or replace function public.expenses_run_recurring(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_month date;
  v_count integer;
begin
  if not (private.is_service_context() or public.is_admin()) then
    raise exception 'FORBIDDEN: only an admin can run recurring expenses';
  end if;
  v_today := case when private.is_service_context() then coalesce(p_today, public.studio_today()) else public.studio_today() end;
  v_month := private.tuition_month(v_today);
  insert into public.expenses (spent_on, category, amount, description, vendor, class_id, method, recurring_id, created_by)
  select v_month + (r.day_of_month - 1), r.category, r.amount, r.description, r.vendor, r.class_id, r.method, r.id, r.created_by
    from public.recurring_expenses r
   where r.active and r.starts_on <= v_month and (r.ends_on is null or r.ends_on >= v_month)
     and extract(day from v_today) >= r.day_of_month
     and not exists (select 1 from public.recurring_expense_skips k where k.recurring_id = r.id and k.month = v_month)
  on conflict on constraint expenses_recurring_once do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- seed_demo_classes() (class lifecycle demo) no longer names the old one-per-month constraint;
-- its invoices are tied to the summer camp's courses by month (link_invoice_course trigger).
-- -----------------------------------------------------------------------------
create or replace function public.seed_demo_classes()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today  date := public.studio_today();
  v_month  date := private.tuition_month(v_today);
  v_start  date := (private.tuition_month(v_today) - interval '4 months')::date;
  v_end    date := (private.tuition_month(v_today) - interval '1 month')::date - 1;
  v_bin    uuid := (select id from public.profiles where email = 'instructor2@demo.oopsdance.test');
  v_chaeng uuid := (select id from public.profiles where email = 'instructor4@demo.oopsdance.test');
  v_room_a bigint := (select min(id) from public.rooms);
  v_room_b bigint := (select max(id) from public.rooms);
  v_past   bigint;
  v_next   bigint;
  v_day    date;
  r record;
  m date;
  h integer;
  v_slot   record;
  v_ok     boolean := false;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo classes are only seeded on a sandbox';
  end if;

  -- Hip-hop Summer Camp: Saturdays 10:30–12:00, four students, ended last-but-one month.
  insert into public.classes (name, instructor_id, room_id, price, starts_on, ended_on, end_reason, lesson, final_schedule)
  values ('Hip-hop Summer Camp', v_bin, v_room_a, 1000000, v_start, v_end, 'Khoá hè 3 tháng đã kết thúc.',
          'Summer Breeze — Oops! Crew remix',
          '[{"day_of_week": 6, "start_time": "10:30", "end_time": "12:00"}]'::jsonb)
  returning id into v_past;

  insert into public.class_lessons (class_id, month, title, video_url)
  select v_past, (v_start + make_interval(months => k))::date, t.title, t.video
    from (values (0, 'Summer Breeze — Oops! Crew remix', null::text),
                 (1, 'Hot Stuff — Donna Summer', null),
                 (2, 'Dynamite — BTS', null)) as t(k, title, video);

  for r in
    select p.id, private.person_name(p.id) as sname
      from public.profiles p
     where p.role = 'guest' and p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
     order by p.email
     limit 4
  loop
    m := v_start;
    while m <= private.tuition_month(v_end) loop
      h := abs(hashtext(r.id::text || m::text));
      insert into public.tuition_invoices (student_id, class_id, student_name, class_name, month, amount, paid_amount,
                                           status, renewal, method, due_date, paid_at)
      values (r.id, v_past, coalesce(r.sname, ''), 'Hip-hop Summer Camp', m, 1000000, 1000000, 'paid', 'continue',
              case when h % 3 = 0 then 'cash' else 'transfer' end::public.payment_method, m + 9,
              ((m + (h % 7)) + time '19:00') at time zone 'Asia/Ho_Chi_Minh')
      on conflict do nothing;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  -- Its Saturday sessions: taught (completed), with roll calls.
  v_day := v_start + ((6 - extract(isodow from v_start)::int + 7) % 7);
  while v_day <= v_end loop
    insert into public.instructor_attendance (class_id, instructor_id, room_id, date, status, checkin_at, checkout_at)
    values (v_past, v_bin, v_room_a, v_day, 'completed',
            (v_day + time '10:25') at time zone 'Asia/Ho_Chi_Minh', (v_day + time '12:05') at time zone 'Asia/Ho_Chi_Minh')
    on conflict (class_id, date) do nothing;
    insert into public.student_attendance (class_id, student_id, date, status)
    select v_past, i.student_id, v_day,
           case when abs(hashtext(i.student_id::text || v_day::text)) % 7 = 0 then 'absent' else 'attend' end::public.student_attendance_status
      from (select distinct student_id from public.tuition_invoices where class_id = v_past) i
    on conflict (class_id, student_id, date) do nothing;
    v_day := v_day + 7;
  end loop;

  -- Waacking Basics opens next month (Chaeng). The first free Sunday-afternoon slot in room B.
  insert into public.classes (name, instructor_id, room_id, price, starts_on, lesson)
  values ('Waacking Basics', v_chaeng, v_room_b, 950000, (v_month + interval '1 month')::date, 'Vogue — Madonna')
  returning id into v_next;
  for v_slot in
    select * from (values (7, '14:00'::time, '15:30'::time), (7, '13:00', '14:30'), (3, '20:30', '22:00'), (5, '20:00', '21:30')) as t(dow, s, e)
  loop
    begin
      insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values (v_next, v_slot.dow, v_slot.s, v_slot.e);
      v_ok := true;
      exit;
    exception when others then
      null;  -- taken by a booking or a class; try the next slot
    end;
  end loop;
  insert into public.class_lessons (class_id, month, title) values (v_next, (v_month + interval '1 month')::date, 'Vogue — Madonna');
  insert into public.class_students (class_id, student_id)
  select v_next, p.id from public.profiles p
   where p.role = 'guest' and p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
   order by p.email desc
   limit 2;

  return jsonb_build_object('past_class', v_past, 'upcoming_class', v_next, 'upcoming_scheduled', v_ok);
end;
$$;
