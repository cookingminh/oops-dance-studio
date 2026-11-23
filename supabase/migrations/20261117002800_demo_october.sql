-- The demo follows the studio's October posts (api-contract §11; supabase/seed.sql and scripts/seed-demo.mjs hold
-- the classes and their courses):
--   * the two advanced classes are called by their places, "Choreo Cầu Giấy" and "Choreo Bà Triệu" (were
--     "Choreo CG" / "Choreo BT"): seed_demo_finance() and seed_demo_class_join_requests() look them up by name;
--   * seed_demo_venues(): the studios' real addresses; Đê La Thành nhỏ is two buildings, Studio Thỏ at no. 204 and
--     another studio at no. 300 (Girlstyle 1). Seven studios; rents are still examples.
-- Same functions otherwise; create or replace keeps their grants.

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
  v_adv   bigint := (select id from public.classes where name = 'Choreo Bà Triệu');
  v_choreo bigint := (select id from public.classes where name = 'Choreo Cầu Giấy');
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
  -- The studios on the timetable, with the addresses of the studio's October posts. Đê La Thành nhỏ is two
  -- buildings: Studio Thỏ at no. 204 (Trending, Newbie 2) and no. 300 (Girlstyle 1). Rents are examples to
  -- replace with the real ones.
  insert into public.venues (name, public_name, address, rent_per_hour, note) values
    ('Studio Baladi Vũ Thạnh', 'Vũ Thạnh',        'Tầng 6, 41 Vũ Thạnh, Đống Đa, Hà Nội', 250000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Studio Thỏ',             'Đê La Thành nhỏ', 'Tầng 2, 204 Đê La Thành nhỏ, Đống Đa, Hà Nội', 200000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('300 Đê La Thành nhỏ',    'Đê La Thành nhỏ', 'Tầng 3, 300 Đê La Thành nhỏ, Đống Đa, Hà Nội', 200000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Quan Hoa',               'Quan Hoa',        'Tầng 4, 277 Quan Hoa, Cầu Giấy, Hà Nội', 200000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Hoàng Quốc Việt',        'Hoàng Quốc Việt', 'Tầng 2, số 32 ngách 15 ngõ 106 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 220000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Bà Triệu',               'Bà Triệu',        'Tầng 6, 256 Bà Triệu, Hai Bà Trưng, Hà Nội', 250000, 'Giá thuê ví dụ, sửa lại theo giá thật.'),
    ('Hoàng Ngân',             'Hoàng Ngân',      'Hoàng Ngân, Cầu Giấy, Hà Nội', 200000, 'Giá thuê ví dụ, sửa lại theo giá thật.')
  on conflict (name) do update set public_name = excluded.public_name, address = excluded.address;

  perform set_config('oops.activity', 'off', true);
  update public.classes c
     set venue_id = v.id, room_id = null
    from (values ('Trending', 'Studio Thỏ'), ('Choreo Bà Triệu', 'Bà Triệu'), ('K-pop Dance', 'Studio Baladi Vũ Thạnh'),
                 ('Girlstyle 1', '300 Đê La Thành nhỏ'), ('Girlstyle 2', 'Quan Hoa'), ('Choreo Cầu Giấy', 'Hoàng Quốc Việt'),
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

create or replace function public.seed_demo_class_join_requests()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now() - interval '3 minutes';
  v_staff uuid := (select p.id from public.profiles p where p.email = 'staff@demo.oopsdance.test');
  -- who asks for which class, how long ago (hours), and for the declined one when and why
  v_rows jsonb := jsonb_build_array(
    jsonb_build_object('email', 'guest03@demo.oopsdance.test', 'class', 'K-pop Dance', 'start', 'now', 'hours', 3,
      'note', 'Em học Kpop được 6 tháng rồi ạ, muốn vào lớp luôn khoá này.'),
    jsonb_build_object('email', 'guest09@demo.oopsdance.test', 'class', 'Newbie 2', 'start', 'next', 'hours', 7.3,
      'note', 'Em rủ được đứa bạn chưa nhảy bao giờ, cho tụi em vào chung lớp Newbie nha.'),
    jsonb_build_object('email', 'guest08@demo.oopsdance.test', 'class', 'Trending', 'start', 'next', 'hours', 20,
      'note', 'Khoá này lớp học được nửa rồi nên em xin vào từ khoá sau ạ.'),
    jsonb_build_object('email', 'guest07@demo.oopsdance.test', 'class', 'Girlstyle 1', 'start', 'now', 'hours', 30,
      'note', 'Em đang học K-pop, muốn thử thêm Girlstyle. Lần đầu học style này, mong được hướng dẫn từ đầu ạ.'),
    jsonb_build_object('email', 'guest04@demo.oopsdance.test', 'class', 'Choreo Cầu Giấy', 'start', 'now', 'hours', 48,
      'note', 'Em muốn lên lớp nâng cao ạ.', 'decided_hours', 43,
      'reason', 'Lớp Choreo Cầu Giấy đang đủ người. Studio sẽ nhắn bạn khi có chỗ nhé.'));
  v_students uuid[];
  v_count integer;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo join requests are only seeded on a sandbox';
  end if;
  select coalesce(array_agg(p.id), '{}') into v_students
    from public.profiles p where p.email in (select x ->> 'email' from jsonb_array_elements(v_rows) x);

  delete from public.activity_log a where a.entity = 'class_join_requests' and a.subject_id = any (v_students);
  delete from public.class_join_requests q where q.student_id = any (v_students);

  -- 'next' only where the class has a next course planned; nobody already in the class.
  insert into public.class_join_requests (class_id, student_id, status, start_pref, note, decided_by, decided_at,
                                          decline_reason, created_at, updated_at)
  select c.id, p.id, (case when d.reason is null then 'pending' else 'declined' end)::public.join_request_status,
         case when d.start = 'next' and exists (select 1 from public.lesson_progress(array[c.id]) lp where lp.status = 'planned')
              then 'next' else 'now' end,
         d.note, case when d.reason is not null then v_staff end, v_now - d.decided_hours * interval '1 hour', d.reason,
         v_now - d.hours * interval '1 hour', v_now - coalesce(d.decided_hours, d.hours) * interval '1 hour'
    from jsonb_to_recordset(v_rows) as d(email text, class text, start text, hours numeric, note text,
                                         decided_hours numeric, reason text)
    join public.profiles p on p.email = d.email
    join public.classes c on c.name = d.class and c.ended_on is null
   where not exists (select 1 from public.class_students cs where cs.class_id = c.id and cs.student_id = p.id);
  get diagnostics v_count = row_count;

  -- Their lines on the Activity page (seed_demo_activity, which runs before, replaces the whole log).
  insert into public.activity_log (at, actor_id, actor_name, actor_role, area, action, entity, entity_id, class_id,
                                   subject_id, label, meta)
  select x.at, x.actor, private.person_name(x.actor), (select p.role from public.profiles p where p.id = x.actor),
         'students', x.action, 'class_join_requests', q.id::text, q.class_id, q.student_id,
         coalesce(private.person_name(q.student_id), ''),
         jsonb_strip_nulls(jsonb_build_object('class', private.class_name(q.class_id)) || x.meta)
    from public.class_join_requests q
   cross join lateral (values
     (q.created_at, q.student_id, 'join_requested', jsonb_build_object('start', q.start_pref, 'note', q.note)),
     (q.decided_at, q.decided_by, 'join_declined', jsonb_build_object('reason', q.decline_reason))) x(at, actor, action, meta)
   where q.student_id = any (v_students) and (x.action = 'join_requested' or q.status = 'declined');

  return v_count;
end;
$$;
