-- End-of-month class videos (class_lessons.video_url, api-contract §3 class_lessons):
--   * YouTube links only; null allowed
--   * public read, staff write (same policies as the lesson)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
create function tests.video_of(p_lesson bigint) returns text language sql stable as $$
  select video_url from public.class_lessons where id = p_lesson;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000091', 'video-staff@test.local', 'staff', 'Video Staff');
select tests.create_user('00000000-0000-4000-b000-000000000092', 'video-teacher@test.local', 'instructor', 'Video Teacher');
insert into public.classes (id, name, instructor_id, price)
values (900091, 'Video Test Class', '00000000-0000-4000-b000-000000000092', 100000);
insert into public.class_lessons (id, class_id, month, title) overriding system value
values (900091, 900091, '2026-10-01', 'HIT ’EM — MEOVV');

-- ---------------------------------------------------------------------------
-- Only YouTube links
-- ---------------------------------------------------------------------------
select lives_ok(
  $$update public.class_lessons set video_url = 'https://www.youtube.com/watch?v=tbDUtRdhfUI' where id = 900091$$,
  'a youtube.com/watch link is accepted');
select lives_ok(
  $$update public.class_lessons set video_url = 'https://youtu.be/tbDUtRdhfUI?si=abc' where id = 900091$$,
  'a youtu.be share link is accepted');
select lives_ok(
  $$update public.class_lessons set video_url = 'https://youtube.com/shorts/M_Yp7188f44' where id = 900091$$,
  'a Shorts link is accepted');
select throws_ok(
  $$update public.class_lessons set video_url = 'https://vimeo.com/123456789' where id = 900091$$,
  '23514', null, 'other sites are rejected');
select throws_ok(
  $$update public.class_lessons set video_url = 'http://www.youtube.com/watch?v=tbDUtRdhfUI' where id = 900091$$,
  '23514', null, 'plain http is rejected');

-- ---------------------------------------------------------------------------
-- Staff write, everyone reads
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000092');
update public.class_lessons set video_url = 'https://youtu.be/iG2UbHqhIGg' where id = 900091;
select tests.logout();
select is(tests.video_of(900091), 'https://youtube.com/shorts/M_Yp7188f44', 'an instructor can''t change the video');

select tests.login_as('00000000-0000-4000-b000-000000000091');
update public.class_lessons set video_url = 'https://www.youtube.com/watch?v=tbDUtRdhfUI' where id = 900091;
select tests.logout();
select is(tests.video_of(900091), 'https://www.youtube.com/watch?v=tbDUtRdhfUI', 'staff set the video');

set local role anon;
select is(
  (select video_url from public.class_lessons where id = 900091),
  'https://www.youtube.com/watch?v=tbDUtRdhfUI',
  'visitors can read the video link');
reset role;

select tests.login_as('00000000-0000-4000-b000-000000000091');
update public.class_lessons set video_url = null where id = 900091;
select tests.logout();
select is(tests.video_of(900091), null, 'staff can clear the video');

select * from finish();
rollback;
