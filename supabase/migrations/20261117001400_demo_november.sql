-- The studio's November timetable as the demo (api-contract §11): the old demo classes and teachers are
-- replaced by the real ones (supabase/seed.sql, scripts/seed-demo.mjs), taught at six rented studios.
--   * seed_demo_finance(): the class-specific costs (costumes, shoot location) now belong to the two
--     advanced classes, Choreo BT and Choreo CG; the demo class switch goes to a class whose next course
--     is planned (a switch lands there), with a student who isn't in it yet.
--   * seed_demo_tuition(): the past courses it adds start, like the seeded ones, on the month's first day of
--     the class's first weekly slot, and only for months before the month of the class's earliest course;
--     the next course it plans starts on the class's next day after the current one ends.
--   * seed_demo_classes(): the two Newbie classes open on the first Wednesday of next month (Đỗ Linh and
--     Soleck, Wednesdays and Fridays), with a few students already signed up. No ended class any more.
--   * seed_demo_venues(): the six studios on the timetable (example rents), each class at its own, the old
--     premises' monthly rent stopped from the month the classes moved, the sessions taught charged.

create or replace function public.seed_demo_finance()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_month date := private.tuition_month(v_today);
  v_admin uuid := (select id from public.profiles where email = 'admin@demo.oopsdance.test');
  v_staff uuid := (select id from public.profiles where email = 'staff@demo.oopsdance.test');
  v_adv   bigint := (select id from public.classes where name = 'Choreo BT');
  v_choreo bigint := (select id from public.classes where name = 'Choreo CG');
  m date;
  k integer;
  r record;
  v_target bigint;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo finance is only seeded on a sandbox';
  end if;

  insert into public.recurring_expenses (category, amount, description, vendor, day_of_month, starts_on, method, created_by) values
    ('rent', 12000000, 'Thuê mặt bằng tầng 7, 25 Trung Phụng', 'Chủ nhà', 1, (v_month - interval '3 months')::date, 'transfer', v_admin),
    ('utilities', 330000, 'Internet cáp quang', 'FPT Telecom', 5, (v_month - interval '3 months')::date, 'transfer', v_admin),
    ('marketing', 1500000, 'Quảng cáo Facebook & TikTok', 'Meta / TikTok', 3, (v_month - interval '3 months')::date, 'transfer', v_admin);

  for k in reverse 3..0 loop
    m := (v_month - make_interval(months => k))::date;
    -- the recurring ones, for past months and (when their day has come) this month
    insert into public.expenses (spent_on, category, amount, description, vendor, method, recurring_id, created_by)
    select m + (r2.day_of_month - 1), r2.category, r2.amount, r2.description, r2.vendor, r2.method, r2.id, r2.created_by
      from public.recurring_expenses r2
     where m < v_month or extract(day from v_today) >= r2.day_of_month
    on conflict on constraint expenses_recurring_once do nothing;

    if m < v_month then
      insert into public.expenses (spent_on, category, amount, description, vendor, method, created_by) values
        (m + 7,  'utilities', 1800000 + (k * 230000), format('Tiền điện tháng %s', to_char(m, 'MM')), 'EVN Hà Nội', 'transfer', v_admin),
        (m + 9,  'utilities', 380000, format('Nước & vệ sinh tháng %s', to_char(m, 'MM')), null, 'cash', v_staff),
        (m + 14, 'supplies', 320000 + (k * 40000), 'Nước uống, khăn giấy, băng dính', 'Siêu thị', 'cash', v_staff),
        (m + 26, 'video', 3000000, format('Camera man + dựng video buổi quay cuối tháng %s', to_char(m, 'MM')), 'Quang Media', 'transfer', v_admin);
    elsif extract(day from v_today) >= 8 then
      insert into public.expenses (spent_on, category, amount, description, vendor, method, created_by) values
        (m + 7, 'utilities', 2050000, format('Tiền điện tháng %s', to_char(m, 'MM')), 'EVN Hà Nội', 'transfer', v_admin);
    end if;
  end loop;

  -- one-offs
  insert into public.expenses (spent_on, category, amount, description, vendor, class_id, method, created_by) values
    ((v_month - interval '3 months')::date + 11, 'equipment', 7990000, 'Loa JBL PartyBox cho phòng A', 'Điện máy Xanh', null, 'transfer', v_admin),
    ((v_month - interval '2 months')::date + 16, 'maintenance', 2200000, 'Thay tấm gương vỡ phòng B', 'Kính Hoà Phát', null, 'cash', v_admin),
    ((v_month - interval '1 month')::date + 22, 'costumes', 1200000, 'Thuê trang phục quay bài cuối tháng', 'Tiệm đồ diễn Hàng Bạc', v_adv, 'cash', v_staff),
    ((v_month - interval '1 month')::date + 25, 'shoot_location', 2500000, 'Thuê studio quay MV cuối tháng', 'Kho Studio', v_choreo, 'transfer', v_admin),
    ((v_month - interval '2 months')::date + 24, 'costumes', 900000, 'Thuê áo đồng phục lớp quay video', 'Tiệm đồ diễn Hàng Bạc', v_choreo, 'cash', v_staff);

  -- One student switched class this month: their paid course moved to another class. A switch lands on that
  -- class's next course, so the class is one with a course planned (the dearest such); the student isn't in
  -- it yet and paid for another class's course this month.
  select c.id into v_target from public.classes c
   where c.ended_on is null and c.starts_on <= v_today and private.next_course(c.id, v_today) is not null
   order by c.price desc, c.id
   limit 1;
  if v_target is not null then
    select cs.student_id, cs.class_id into r
      from public.class_students cs
      join public.profiles p on p.id = cs.student_id
      join public.tuition_invoices i on i.student_id = cs.student_id and i.class_id = cs.class_id
                                    and i.month = v_month and i.status = 'paid'
     where p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
       and cs.class_id <> v_target
       and not exists (select 1 from public.class_students x where x.student_id = cs.student_id and x.class_id = v_target)
     order by p.email
     limit 1;
    if found then
      perform public.tuition_switch_class(r.student_id, r.class_id, v_target, 'Muốn học lớp nâng cao hơn.');
    end if;
  end if;

  return jsonb_build_object(
    'expenses', (select count(*) from public.expenses),
    'recurring', (select count(*) from public.recurring_expenses),
    'switched', (select count(*) from public.tuition_invoices where void_reason = 'switched'));
end;
$$;

create or replace function public.seed_demo_classes()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_next   date := (private.tuition_month(public.studio_today()) + interval '1 month')::date;
  -- "Dự kiến khai giảng" on the first Wednesday of next month.
  v_open   date := v_next + ((3 - extract(isodow from v_next)::int + 7) % 7);
  v_linh   uuid := (select id from public.profiles where email = 'instructor@demo.oopsdance.test');
  v_soleck uuid := (select id from public.profiles where email = 'instructor2@demo.oopsdance.test');
  v_n1     bigint;
  v_n2     bigint;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo classes are only seeded on a sandbox';
  end if;

  insert into public.classes (name, instructor_id, price, starts_on, lesson)
  values ('Newbie 1', v_linh, 800000, v_open, 'APT. — ROSÉ & Bruno Mars')
  returning id into v_n1;
  insert into public.classes (name, instructor_id, price, starts_on, lesson)
  values ('Newbie 2', v_soleck, 800000, v_open, 'Like JENNIE — JENNIE')
  returning id into v_n2;

  insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values
    (v_n1, 3, '18:45', '20:00'), (v_n1, 5, '18:45', '20:00'),
    (v_n2, 3, '18:30', '19:45'), (v_n2, 5, '18:30', '19:45');
  insert into public.class_lessons (class_id, month, starts_on, title) values
    (v_n1, v_next, v_open, 'APT. — ROSÉ & Bruno Mars'),
    (v_n2, v_next, v_open, 'Like JENNIE — JENNIE');

  -- A few students already signed up for each.
  insert into public.class_students (class_id, student_id)
  select case when g.n % 2 = 0 then v_n1 else v_n2 end, g.id
    from (select p.id, row_number() over (order by p.email desc) as n
            from public.profiles p
           where p.role = 'guest' and p.email like '%@demo.oopsdance.test' and p.email <> 'guest@demo.oopsdance.test'
           order by p.email desc
           limit 6) g
  on conflict do nothing;

  return jsonb_build_object('upcoming_classes', jsonb_build_array(v_n1, v_n2), 'opens_on', v_open);
end;
$$;

create or replace function public.seed_demo_venues()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_moved date;
  s public.instructor_attendance;
  v_logging text := coalesce(current_setting('oops.activity', true), '');
begin
  -- The studios on the timetable ("Các cơ sở tại …"; Đê La Thành nhỏ is Studio Thỏ). Rents are examples to replace
  -- with the real ones.
  insert into public.venues (name, address, rent_per_hour, note) values
    ('Studio Baladi Vũ Thạnh', 'Vũ Thạnh, Đống Đa, Hà Nội', 250000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Studio Thỏ',             'Đê La Thành nhỏ, Hà Nội',   200000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Quan Hoa',               'Quan Hoa, Cầu Giấy, Hà Nội', 200000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Hoàng Quốc Việt',        'Hoàng Quốc Việt, Hà Nội',   220000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Bà Triệu',               'Bà Triệu, Hà Nội',          250000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Hoàng Ngân',             'Hoàng Ngân, Hà Nội',        200000, 'Giá thuê ví dụ, sửa lại theo giá thật.')
  on conflict (name) do nothing;

  perform set_config('oops.activity', 'off', true);
  update public.classes c
     set venue_id = v.id, room_id = null
    from (values ('Trending', 'Studio Thỏ'), ('Choreo BT', 'Bà Triệu'), ('K-pop Dance', 'Studio Baladi Vũ Thạnh'),
                 ('Girlstyle 1', 'Studio Thỏ'), ('Girlstyle 2', 'Quan Hoa'), ('Choreo CG', 'Hoàng Quốc Việt'),
                 ('Newbie 1', 'Hoàng Ngân'), ('Newbie 2', 'Studio Thỏ')) as m (class_name, venue_name)
    join public.venues v on v.name = m.venue_name
   where c.name = m.class_name and c.ended_on is null;
  -- Every session of those classes, taught or not, was at its studio.
  update public.instructor_attendance a
     set venue_id = c.venue_id, room_id = null
    from public.classes c
   where c.id = a.class_id and c.venue_id is not null and (a.venue_id is distinct from c.venue_id or a.room_id is not null);

  -- The premises closed when the classes moved out: its monthly rent stops from that month.
  select date_trunc('month', min(x.date))::date into v_moved
    from public.instructor_attendance x join public.classes c on c.id = x.class_id
   where x.venue_id is not null and c.ended_on is null;
  if v_moved is not null then
    update public.recurring_expenses r
       set ends_on = greatest((v_moved - interval '1 month')::date, r.starts_on), active = false  -- the last month it ran
     where r.category = 'rent' and (r.ends_on is null or r.ends_on >= v_moved);
    delete from public.expenses e where e.category = 'rent' and e.recurring_id is not null and e.month >= v_moved;
  end if;
  perform set_config('oops.activity', v_logging, true);

  for s in
    select x.* from public.instructor_attendance x
     where x.venue_id is not null and x.status <> 'cancelled' and x.date <= public.studio_today()
       and not exists (select 1 from public.expenses e where e.session_id = x.id)
  loop
    perform private.charge_venue_rent(s);
  end loop;
end;
$$;

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
    -- Months before the month of its earliest course; each starts on the month's first day of the class's
    -- first weekly slot, like the seeded ones.
    while m < private.tuition_month(coalesce(c.first_course, v_month)) loop
      v_n := v_n + 1;
      insert into public.class_lessons (class_id, starts_on, title, session_count)
      values (c.id,
              m + coalesce(((select min(s.day_of_week)::int from public.class_schedules s where s.class_id = c.id)
                            - extract(isodow from m)::int + 7) % 7, 0),
              v_songs[1 + (v_n % array_length(v_songs, 1))],
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
    -- It starts on the class's next day after the current course ends.
    insert into public.class_lessons (class_id, starts_on, title, session_count)
    values (v_class,
            coalesce((select min(d)::date
                        from generate_series(private.course_end(v_cur) + 1, private.course_end(v_cur) + 7, interval '1 day') d
                        join public.class_schedules s on s.class_id = v_class and s.day_of_week = extract(isodow from d)),
                     private.course_end(v_cur) + 1),
            'Armageddon — aespa', 8)
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
