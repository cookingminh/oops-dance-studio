-- =============================================================================
-- Local demo data (runs on `supabase db reset`). api-contract §11.
--   2 rooms · 1 admin · 1 staff · 5 instructors · 15 guests
--   6 classes with schedules + enrolments
--   bookings: last 3 months → next 2 weeks (relative to today, so the demo stays fresh)
--   attendance history: 8 weeks of sessions, 4 weeks of roll calls
--
-- Every demo account uses the password documented in supabase/README.md.
-- Hosted demo projects are seeded by scripts/seed-demo.mjs instead.
-- Instructor avatars and class photos cannot be uploaded from SQL: after a reset
-- run `node scripts/demo-images.mjs --local` (sets avatar_path / image_path).
-- The five instructors are the studio's teachers as named on the legacy homepage,
-- matching their photos in scripts/demo-assets/; no personal details
-- (phone, birthday) are made up for them.
-- Runs as postgres without JWT claims → allowed to set roles / generate attendance.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
create temporary table seed_users (
  id uuid, email text, role public.app_role, username text, full_name text, phone text, dob date
);

insert into seed_users values
  ('00000000-0000-4000-a000-000000000001', 'admin@demo.oopsdance.test',       'admin',      'admin',      'Trần Thị Thu Hà',  '0903111001', '1990-04-12'),
  ('00000000-0000-4000-a000-000000000002', 'staff@demo.oopsdance.test',       'staff',      'staff',      'Lê Hoàng Nam',     '0903111002', '1996-09-03'),
  ('00000000-0000-4000-a000-000000000011', 'instructor@demo.oopsdance.test',  'instructor', 'ami',        'Ami',              null,         null),
  ('00000000-0000-4000-a000-000000000012', 'instructor2@demo.oopsdance.test', 'instructor', 'bin',        'Bin',              null,         null),
  ('00000000-0000-4000-a000-000000000013', 'instructor3@demo.oopsdance.test', 'instructor', 'dolinh',     'Đỗ Linh',          null,         null),
  ('00000000-0000-4000-a000-000000000014', 'instructor4@demo.oopsdance.test', 'instructor', 'chaeng',     'Chaeng',           null,         null),
  ('00000000-0000-4000-a000-000000000015', 'instructor5@demo.oopsdance.test', 'instructor', 'ducbo',      'Duc Bo',           null,         null),
  ('00000000-0000-4000-a000-000000000101', 'guest@demo.oopsdance.test',       'guest',      'thaovy',     'Nguyễn Thảo Vy',   '0987333101', '2002-03-15'),
  ('00000000-0000-4000-a000-000000000102', 'guest02@demo.oopsdance.test',     'guest',      'giabao',     'Trần Gia Bảo',     '0987333102', '2001-06-21'),
  ('00000000-0000-4000-a000-000000000103', 'guest03@demo.oopsdance.test',     'guest',      'khanhlinh',  'Lê Khánh Linh',    '0987333103', '2003-12-02'),
  ('00000000-0000-4000-a000-000000000104', 'guest04@demo.oopsdance.test',     'guest',      'quochuy',    'Phạm Quốc Huy',    '0987333104', '1999-08-09'),
  ('00000000-0000-4000-a000-000000000105', 'guest05@demo.oopsdance.test',     'guest',      'minhthu',    'Hoàng Minh Thư',   '0987333105', '2004-02-27'),
  ('00000000-0000-4000-a000-000000000106', 'guest06@demo.oopsdance.test',     'guest',      'ducanh',     'Vũ Đức Anh',       '0987333106', '2000-10-14'),
  ('00000000-0000-4000-a000-000000000107', 'guest07@demo.oopsdance.test',     'guest',      'baongoc',    'Đỗ Bảo Ngọc',      '0987333107', '2005-05-05'),
  ('00000000-0000-4000-a000-000000000108', 'guest08@demo.oopsdance.test',     'guest',      'tuankiet',   'Bùi Tuấn Kiệt',    '0987333108', '1998-01-11'),
  ('00000000-0000-4000-a000-000000000109', 'guest09@demo.oopsdance.test',     'guest',      'phuongthao', 'Ngô Phương Thảo',  '0987333109', '2002-09-19'),
  ('00000000-0000-4000-a000-000000000110', 'guest10@demo.oopsdance.test',     'guest',      'haidang',    'Dương Hải Đăng',   '0987333110', '2001-04-30'),
  ('00000000-0000-4000-a000-000000000111', 'guest11@demo.oopsdance.test',     'guest',      'myduyen',    'Lý Mỹ Duyên',      '0987333111', '2003-07-07'),
  ('00000000-0000-4000-a000-000000000112', 'guest12@demo.oopsdance.test',     'guest',      'hoanglong',  'Đinh Hoàng Long',  '0987333112', '1997-03-25'),
  ('00000000-0000-4000-a000-000000000113', 'guest13@demo.oopsdance.test',     'guest',      'ngochan',    'Trịnh Ngọc Hân',   '0987333113', '2006-11-18'),
  ('00000000-0000-4000-a000-000000000114', 'guest14@demo.oopsdance.test',     'guest',      'thanhtung',  'Mai Thanh Tùng',   '0987333114', '1999-12-12'),
  ('00000000-0000-4000-a000-000000000115', 'guest15@demo.oopsdance.test',     'guest',      'nhuquynh',   'Phan Như Quỳnh',   '0987333115', '2004-08-01');

-- auth.users (+ identities so email/password sign-in works). The
-- on_auth_user_created trigger creates each profile as 'guest'.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email,
       extensions.crypt('OopsDemo@2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('username', u.username, 'full_name', u.full_name,
                          'contact_number', u.phone, 'date_of_birth', u.dob),
       now() - interval '120 days', now(),
       '', '', '', ''
from seed_users u;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from seed_users u;

update public.profiles p set role = u.role
from seed_users u
where p.id = u.id and u.role <> 'guest';

-- -----------------------------------------------------------------------------
-- Rooms (price = VND per hour)
-- -----------------------------------------------------------------------------
insert into public.rooms (id, name, size, price) values
  (1, 'Phòng A', '80 m² · gương 2 mặt · loa JBL', 250000),
  (2, 'Phòng B', '45 m² · sàn gỗ · máy lạnh',     180000);
select setval(pg_get_serial_sequence('public.rooms', 'id'), 2);

-- -----------------------------------------------------------------------------
-- Classes (price = VND per month) and weekly schedules (ISO 1 = Mon … 7 = Sun)
-- Ami (instructor@, the demo instructor) teaches every day so check-in can be
-- tried any day. No two classes overlap in the same room (enforced by trigger).
--   Phòng A  Mon/Wed  K-pop CB 18:00–19:30 · Contemporary 19:30–21:00
--            Tue/Thu  Hip-hop 18:00–19:30   Fri K-pop CB 18:00–19:30
--            Sat      Contemporary 10:00–11:30 · Hip-hop 15:00–16:30
--   Phòng B  Mon/Wed  Breaking Kids 17:00–18:00   Tue/Thu K-pop NC 19:00–20:30
--            Fri      Choreography 18:00–19:30
--            Sat      K-pop NC 09:00–10:30 · Choreography 13:00–14:30
--            Sun      K-pop NC 09:00–10:30 · Breaking Kids 16:00–17:00
-- -----------------------------------------------------------------------------
-- They have been running for months (starts_on: sessions, roll calls and tuition reach back that far).
insert into public.classes (id, name, instructor_id, room_id, price, starts_on)
select v.id, v.name, v.instructor_id::uuid, v.room_id, v.price, public.studio_today() - 120
  from (values
    (1, 'K-pop Cover Cơ Bản',    '00000000-0000-4000-a000-000000000011', 1,  900000),
    (2, 'K-pop Cover Nâng Cao',  '00000000-0000-4000-a000-000000000011', 2, 1200000),
    (3, 'Hip-hop Foundation',    '00000000-0000-4000-a000-000000000012', 1, 1000000),
    (4, 'Breaking Kids',         '00000000-0000-4000-a000-000000000015', 2,  800000),
    (5, 'Contemporary & Jazz',   '00000000-0000-4000-a000-000000000013', 1, 1100000),
    (6, 'Choreography Sáng Tạo', '00000000-0000-4000-a000-000000000014', 2, 1200000)
  ) as v (id, name, instructor_id, room_id, price);
select setval(pg_get_serial_sequence('public.classes', 'id'), 6);

-- Monthly lessons (the piece each class learns). Every class has last month's; Hip-hop
-- Foundation and Breaking Kids have no lesson for this month yet, so the admin UI shows them
-- as "needs this month's lesson". A trigger copies the latest title into classes.lesson.
-- Last month's lessons carry the end-of-month class video (real videos from the studio's
-- YouTube channel); Breaking Kids has none yet, so its card asks for it.
insert into public.class_lessons (class_id, month, title, video_url)
select v.class_id, (date_trunc('month', public.studio_today()) + make_interval(months => v.months_ago * -1))::date, v.title, v.video_url
  from (values
    (1, 1, 'HIT ’EM — MEOVV', 'https://www.youtube.com/watch?v=tbDUtRdhfUI'),
    (1, 0, 'Super Shy — NewJeans', null),
    (2, 1, 'LIES & SUNSET GLOW — BIGBANG', 'https://www.youtube.com/watch?v=D_UzYE3U81Y'),
    (2, 0, 'Magnetic — ILLIT', null),
    (3, 1, 'MANTRA (Remix) x HOOTIE FRUITTI', 'https://www.youtube.com/watch?v=mxHD5wW5NuY'),
    (4, 1, 'Jump Around — House of Pain', null),
    (5, 1, 'HANDLEBAR x DRACULA', 'https://www.youtube.com/watch?v=tSZuWh-LMb4'),
    (5, 0, 'lovely — Billie Eilish & Khalid', null),
    (6, 1, 'WHISTLE x GOALS', 'https://www.youtube.com/watch?v=iG2UbHqhIGg'),
    (6, 0, 'Dynamite — BTS', null)
  ) as v (class_id, months_ago, title, video_url);


insert into public.class_schedules (class_id, day_of_week, start_time, end_time) values
  (1, 1, '18:00', '19:30'), (1, 3, '18:00', '19:30'), (1, 5, '18:00', '19:30'),
  (2, 2, '19:00', '20:30'), (2, 4, '19:00', '20:30'), (2, 6, '09:00', '10:30'), (2, 7, '09:00', '10:30'),
  (3, 2, '18:00', '19:30'), (3, 4, '18:00', '19:30'), (3, 6, '15:00', '16:30'),
  (4, 1, '17:00', '18:00'), (4, 3, '17:00', '18:00'), (4, 7, '16:00', '17:00'),
  (5, 1, '19:30', '21:00'), (5, 3, '19:30', '21:00'), (5, 6, '10:00', '11:30'),
  (6, 5, '18:00', '19:30'), (6, 6, '13:00', '14:30');

-- Routines last a number of sessions: last month's ran the whole month; this month's are 8-session
-- routines (so some finish mid-month and ask for the next one).
update public.class_lessons l
   set session_count = greatest(1, (
         select count(*)::int
           from generate_series(l.month, (l.month + interval '1 month' - interval '1 day')::date, interval '1 day') d
           join public.class_schedules s on s.class_id = l.class_id and s.day_of_week = extract(isodow from d)))
 where l.month < date_trunc('month', public.studio_today())::date;

-- Enrolments: each guest in 1–3 classes, joined 60–100 days ago.
insert into public.class_students (class_id, student_id, joined_at)
select c.class_id, u.id, public.studio_today() - (60 + (abs(hashtext(u.email || c.class_id)) % 41))
from seed_users u
cross join lateral (
  select distinct x as class_id
  from unnest(array[
    1 + abs(hashtext(u.email || 'a')) % 6,
    1 + abs(hashtext(u.email || 'b')) % 6,
    case when abs(hashtext(u.email)) % 3 = 0 then 1 + abs(hashtext(u.email || 'c')) % 6 end
  ]) as x
  where x is not null
) c
where u.role = 'guest';

-- The demo guest is always in K-pop Cover and Hip-hop Foundation.
insert into public.class_students (class_id, student_id, joined_at) values
  (1, '00000000-0000-4000-a000-000000000101', public.studio_today() - 90),
  (3, '00000000-0000-4000-a000-000000000101', public.studio_today() - 90)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Bookings: today-90 … today+14. Candidates that collide with a class or
-- another booking are skipped (the same guards the app relies on).
-- -----------------------------------------------------------------------------
do $$
declare
  v_today  date := public.studio_today();
  v_guests uuid[] := array(select id from seed_users where role = 'guest' order by email);
  v_slots  time[][] := array[
    array[time '08:00', time '10:00'], array[time '09:30', time '11:30'],
    array[time '13:00', time '15:00'], array[time '14:00', time '16:00'],
    array[time '16:00', time '17:30'], array[time '20:30', time '22:00']
  ];
  v_details text[] := array[
    'Tập nhảy cho đám cưới', 'Quay clip TikTok nhóm', 'Tập văn nghệ công ty',
    'Luyện bài thi cuối kỳ', 'Tập cover nhóm 5 người', 'Thuê phòng tự tập', null
  ];
  d date; room record; k int; slot int; g uuid;
  v_status public.booking_status; v_hours numeric; v_total numeric; v_cash numeric;
begin
  perform setseed(0.2026);
  for d in select generate_series(v_today - 90, v_today + 14, interval '1 day')::date loop
    for room in select id, price from public.rooms order by id loop
      for k in 1 .. (case when extract(isodow from d) in (6, 7) then 3 else 2 end) loop
        if random() < 0.45 then continue; end if;
        slot := 1 + floor(random() * 6)::int;
        g := v_guests[1 + floor(random() * array_length(v_guests, 1))::int];

        if d < v_today then
          v_status := case
            when random() < 0.80 then 'completed'
            when random() < 0.50 then 'cancelled'
            else 'rejected' end;
        else
          v_status := case when random() < 0.5 then 'pending' else 'approved' end;
        end if;

        v_hours := extract(epoch from (v_slots[slot][2] - v_slots[slot][1])) / 3600;
        v_total := room.price * v_hours;
        v_cash  := case when random() < 0.5 then v_total else round(v_total * 0.3, -3) end;

        begin
          insert into public.bookings (
            room_id, guest_id, date, start_time, end_time, status,
            deposit, deposit_status, full_payment, real_income, cash, bank_transfer, details, created_at
          ) values (
            room.id, g, d, v_slots[slot][1], v_slots[slot][2], v_status,
            round(v_total * 0.5),
            case v_status
              when 'pending'   then 'waiting'
              when 'cancelled' then 'cancelled'
              when 'rejected'  then 'cancelled'
              else 'completed' end::public.deposit_status,
            v_total,
            case when v_status = 'completed' then v_total end,
            case when v_status = 'completed' then v_cash end,
            case when v_status = 'completed' then v_total - v_cash end,
            v_details[1 + floor(random() * array_length(v_details, 1))::int],
            (d - 7 - floor(random() * 10)::int)::timestamptz
          );
        exception when exclusion_violation or raise_exception then
          null;  -- overlaps a booking or a class: skip this candidate
        end;
      end loop;
    end loop;
  end loop;
end;
$$;

-- Guaranteed rows for the demo guest: one upcoming pending booking, one past completed.
do $$
declare
  v_guest uuid := '00000000-0000-4000-a000-000000000101';
  v_day   date;
begin
  for v_day in select generate_series(public.studio_today() + 3, public.studio_today() + 14, interval '1 day')::date loop
    begin
      insert into public.bookings (room_id, guest_id, date, start_time, end_time, status, full_payment, deposit, details)
      values (2, v_guest, v_day, '13:00', '15:00', 'pending', 360000, 180000, 'Tập cover nhóm 5 người');
      exit;
    exception when exclusion_violation or raise_exception then null;
    end;
  end loop;
  for v_day in select generate_series(public.studio_today() - 10, public.studio_today() - 40, interval '-1 day')::date loop
    begin
      insert into public.bookings (room_id, guest_id, date, start_time, end_time, status, deposit, deposit_status,
                                   full_payment, real_income, cash, bank_transfer, details)
      values (1, v_guest, v_day, '08:00', '10:00', 'completed', 250000, 'completed',
              500000, 500000, 250000, 250000, 'Quay clip TikTok nhóm');
      exit;
    exception when exclusion_violation or raise_exception then null;
    end;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Instructor attendance: the last 8 weeks + this week.
-- Past sessions mostly completed (check-in ~5' early, check-out ~5' late, ICT),
-- some cancelled; today and later stay pending.
-- -----------------------------------------------------------------------------
select public.generate_instructor_attendance(date_trunc('week', public.studio_today())::date - 7 * w)
from generate_series(0, 8) as w;

with first_session as (
  select s.class_id, s.day_of_week, min(s.start_time) as start_time, min(s.end_time) as end_time
  from public.class_schedules s
  group by s.class_id, s.day_of_week
)
update public.instructor_attendance a
   set status = case when abs(hashtext(a.id::text)) % 12 = 0 then 'cancelled' else 'completed' end::public.instructor_attendance_status,
       checkin_at = case when abs(hashtext(a.id::text)) % 12 = 0 then null
                         else (a.date + fs.start_time - interval '5 minutes') at time zone 'Asia/Ho_Chi_Minh' end,
       checkout_at = case when abs(hashtext(a.id::text)) % 12 = 0 then null
                          else (a.date + fs.end_time + interval '5 minutes') at time zone 'Asia/Ho_Chi_Minh' end,
       details = case when abs(hashtext(a.id::text)) % 12 = 0 then 'Nghỉ lễ / giáo viên báo nghỉ' end
  from first_session fs
 where fs.class_id = a.class_id
   and fs.day_of_week = extract(isodow from a.date)
   and a.date < public.studio_today();

-- -----------------------------------------------------------------------------
-- Student roll calls: the last 4 weeks + today. Past: ~85% attend.
-- -----------------------------------------------------------------------------
select public.generate_student_attendance(d::date)
from generate_series(public.studio_today() - 28, public.studio_today(), interval '1 day') as d;

update public.student_attendance sa
   set status = case when abs(hashtext(sa.id::text || 'roll')) % 100 < 85 then 'attend' else 'absent' end::public.student_attendance_status,
       details = case when abs(hashtext(sa.id::text || 'roll')) % 100 >= 95 then 'Xin phép nghỉ ốm' end
 where sa.date < public.studio_today()
   and exists (
     select 1 from public.instructor_attendance a
     where a.class_id = sa.class_id and a.date = sa.date and a.status = 'completed'
   );

-- Sessions that were cancelled: everyone marked absent with a note.
update public.student_attendance sa
   set status = 'absent', details = 'Buổi học bị huỷ'
 where sa.date < public.studio_today()
   and exists (
     select 1 from public.instructor_attendance a
     where a.class_id = sa.class_id and a.date = sa.date and a.status = 'cancelled'
   );

-- -----------------------------------------------------------------------------
-- Payroll: a monthly salary for the staff account, two advanced classes paid 350,000 a
-- session (the rest use the 300,000 default), last month's bonuses and deductions, last
-- month finalized and paid; this month stays a live draft with one deduction in it.
-- (Runs without a signed-in user, which the payroll RPCs accept as a service context.)
-- -----------------------------------------------------------------------------
insert into public.staff_salaries (profile_id, monthly_salary) values
  ('00000000-0000-4000-a000-000000000002', 8000000);

insert into public.class_pay_rates (class_id, session_rate)
select c.id, 350000 from public.classes c where c.name in ('K-pop Cover Nâng Cao', 'Choreography Sáng Tạo');

insert into public.payroll_adjustments (profile_id, month, amount, reason, created_by)
select v.pid, (date_trunc('month', public.studio_today()) - make_interval(months => v.months_ago))::date, v.amount, v.reason,
       '00000000-0000-4000-a000-000000000001'
  from (values
    ('00000000-0000-4000-a000-000000000012'::uuid, 1, -50000,  'Check-in trễ 15 phút'),
    ('00000000-0000-4000-a000-000000000011'::uuid, 1, 200000,  'Dạy thay lớp Hip-hop Foundation'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 1, 500000,  'Thưởng hỗ trợ sự kiện cuối tháng'),
    ('00000000-0000-4000-a000-000000000015'::uuid, 0, -30000,  'Về sớm 10 phút')
  ) as v (pid, months_ago, amount, reason);

select public.payroll_finalize(m.profile_id, (date_trunc('month', public.studio_today()) - interval '1 month')::date)
  from public.payroll_month((date_trunc('month', public.studio_today()) - interval '1 month')::date) m;
select public.payroll_set_paid(s.profile_id, s.month, true)
  from public.payslips s
 where s.month = (date_trunc('month', public.studio_today()) - interval '1 month')::date;

-- -----------------------------------------------------------------------------
-- Tuition: the local stack is a payment sandbox (the QR dialog can simulate the bank's
-- webhook), with a demo bank account and months of invoices — see seed_demo_tuition().
-- -----------------------------------------------------------------------------
insert into private.payment_sandbox default values on conflict do nothing;
select public.seed_demo_tuition();
-- Past routines (and the older ones the tuition seed added) last as many sessions as their month held
-- (cancelled ones don't count), so each ends inside its month and the next one starts after it.
select public.seed_demo_fit_routines();
-- Expenses (recurring rent, internet, ads; the monthly shoot; a few one-offs) and one class switch.
select public.seed_demo_finance();
-- A summer class that ran three months and ended, and one opening next month.
select public.seed_demo_classes();
update public.class_lessons set session_count = 4
 where class_id = (select id from public.classes where name = 'Hip-hop Summer Camp');

-- The admin's Activity page: the last week and a half, made from the data above (replaces what seeding logged).
select public.seed_demo_activity();

drop table seed_users;
