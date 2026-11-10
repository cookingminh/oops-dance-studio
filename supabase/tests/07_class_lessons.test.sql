-- Monthly class lessons (api-contract §3 class_lessons):
--   * public read, staff write
--   * one routine per (class, start day); month = first day of its start month; title 1–120 chars
--   * classes.lesson always mirrors the latest month's title
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
create function tests.lesson_of(p_class bigint) returns text language sql stable as $$
  select lesson from public.classes where id = p_class;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000071', 'lesson-staff@test.local', 'staff', 'Lesson Staff');
select tests.create_user('00000000-0000-4000-b000-000000000072', 'lesson-teacher@test.local', 'instructor', 'Lesson Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000073', 'lesson-guest@test.local', 'guest', 'Lesson Guest');
insert into public.classes (id, name, instructor_id, price)
values (900071, 'Lesson Test Class', '00000000-0000-4000-b000-000000000072', 100000);

-- ---------------------------------------------------------------------------
-- Writes are staff-only
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000073');
select throws_ok(
  $$insert into public.class_lessons (class_id, month, title) values (900071, '2026-10-01', 'Cupid')$$,
  '42501', null, 'a guest cannot add a lesson');

select tests.login_as('00000000-0000-4000-b000-000000000071');
select lives_ok(
  $$insert into public.class_lessons (class_id, month, title) values (900071, '2026-10-01', 'Cupid — FIFTY FIFTY')$$,
  'staff adds October''s lesson');
select is(tests.lesson_of(900071), 'Cupid — FIFTY FIFTY', 'classes.lesson mirrors the only lesson');

select lives_ok(
  $$insert into public.class_lessons (class_id, month, title) values (900071, '2026-11-01', 'Super Shy — NewJeans')$$,
  'staff adds November''s lesson');
select is(tests.lesson_of(900071), 'Super Shy — NewJeans', 'classes.lesson follows the latest month');

select lives_ok(
  $$insert into public.class_lessons (class_id, month, title) values (900071, '2026-09-01', 'Seven')$$,
  'staff back-fills September');
select is(tests.lesson_of(900071), 'Super Shy — NewJeans', 'an older month does not replace the current lesson');

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.class_lessons (class_id, starts_on, title) values (900071, '2026-11-15', 'Mid-month')$$,
  'a routine can start mid-month');
select is((select month from public.class_lessons where class_id = 900071 and title = 'Mid-month'), '2026-11-01'::date,
          'and its month follows its start');
delete from public.class_lessons where class_id = 900071 and title = 'Mid-month';
select throws_ok(
  $$insert into public.class_lessons (class_id, month, title) values (900071, '2026-11-01', 'Second')$$,
  '23505', null, 'one routine per class and start day');
select throws_ok(
  $$insert into public.class_lessons (class_id, month, title) values (900071, '2026-12-01', '   ')$$,
  '23514', null, 'the title cannot be blank');

-- ---------------------------------------------------------------------------
-- Editing and deleting keep classes.lesson in sync
-- ---------------------------------------------------------------------------
update public.class_lessons set title = 'Magnetic — ILLIT' where class_id = 900071 and month = '2026-11-01';
select is(tests.lesson_of(900071), 'Magnetic — ILLIT', 'renaming the latest lesson updates classes.lesson');

delete from public.class_lessons where class_id = 900071 and month = '2026-11-01';
select is(tests.lesson_of(900071), 'Cupid — FIFTY FIFTY', 'deleting the latest lesson falls back to the previous month');

delete from public.class_lessons where class_id = 900071;
select is(tests.lesson_of(900071), null, 'no lessons left → classes.lesson is null');

select tests.logout();
select * from finish();
rollback;
