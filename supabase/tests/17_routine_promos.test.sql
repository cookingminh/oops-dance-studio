-- Routine promos (api-contract §3 class_lessons promo_*, §5 lesson_set_promo, §7 class-promos):
--   * a class's instructor (or staff) uploads into {class_id}/{lesson_id}/ of the class-promos bucket,
--     nobody else can
--   * lesson_set_promo attaches the uploaded clip, edits its caption, replaces or removes it, and returns
--     the files nothing points at any more
--   * attaching a promo clears the promos of the class's finished routines
--   * a promo can be a YouTube link (a Short or any video) instead of an upload, not both
--   * the activity log says who did it; everyone can read the promo of a routine
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

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
create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
create function tests.lesson(p_id bigint) returns public.class_lessons language sql stable security definer as $$
  select * from public.class_lessons where id = p_id;
$$;
-- An uploaded file, as the Storage API would leave it.
create function tests.put(p_name text) returns void language sql security definer as $$
  insert into storage.objects (bucket_id, name) values ('class-promos', p_name);
$$;
-- The log is admin-only: read it as the owner.
create function tests.logged(p_action text, p_entity_id text) returns public.activity_log language sql stable security definer as $$
  select a.* from public.activity_log a where a.action = p_action and a.entity_id = p_entity_id order by a.id desc limit 1;
$$;
create function tests.log_count(p_entity_id text) returns integer language sql stable security definer as $$
  select count(*)::int from public.activity_log a where a.entity = 'class_lessons' and a.entity_id = p_entity_id;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000171', 'promo-staff@test.local', 'staff', 'Promo Staff');
select tests.create_user('00000000-0000-4000-b000-000000000172', 'promo-teacher@test.local', 'instructor', 'Promo Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000173', 'promo-other@test.local', 'instructor', 'Other Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000174', 'promo-student@test.local', 'guest', 'Promo Student');

-- Class 900171 (Promo Teacher) meets every day: "Old" is finished, "Now" is running, "Next" is planned.
-- Class 900172 belongs to the other teacher.
insert into public.classes (id, name, instructor_id, price, starts_on) values
  (900171, 'Promo Class', '00000000-0000-4000-b000-000000000172', 500000, tests.today() - 60),
  (900172, 'Other Class', '00000000-0000-4000-b000-000000000173', 500000, tests.today() - 60);
insert into public.class_schedules (class_id, day_of_week, start_time, end_time)
select c, d, '10:00', '11:00' from generate_series(1, 7) d, unnest(array[900171, 900172]) c;
insert into public.class_lessons (id, class_id, starts_on, title, session_count) overriding system value values
  (900171, 900171, tests.today() - 20, 'Old', 5),
  (900172, 900171, tests.today() - 2,  'Now', 5),
  (900173, 900171, tests.today() + 5,  'Next', 5),
  (900174, 900172, tests.today() + 5,  'Other next', 5);

-- ---------------------------------------------------------------------------
-- Who can upload where
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000172');
select ok(private.can_write_class_promo('900171/900173/clip-1.mp4'), 'the teacher can upload into their routine''s folder');
select ok(private.can_write_class_promo('900171/900173/poster-1.jpg'), 'and its poster');
select ok(not private.can_write_class_promo('900172/900174/clip.mp4'), 'not into another teacher''s class');
select ok(not private.can_write_class_promo('900172/900173/clip.mp4'), 'not with a routine of another class');
select ok(not private.can_write_class_promo('900171/900173/clip.exe'), 'only video and pictures');
select ok(not private.can_write_class_promo('900171/clip.mp4'), 'only inside a routine''s folder');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('class-promos', '900171/900173/clip-0.mp4') $$,
  'the storage policy lets the teacher upload');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('class-promos', '900172/900174/clip-0.mp4') $$,
  '42501', null, 'and stops them in another class');

select tests.login_as('00000000-0000-4000-b000-000000000174');
select ok(not private.can_write_class_promo('900171/900173/clip-1.mp4'), 'a student can''t upload');
select tests.login_as('00000000-0000-4000-b000-000000000171');
select ok(private.can_write_class_promo('900172/900174/clip-1.mp4'), 'staff can upload for any class');
select tests.logout();

-- ---------------------------------------------------------------------------
-- Attaching it
-- ---------------------------------------------------------------------------
select tests.put('900171/900173/clip-1.mp4');
select tests.put('900171/900173/poster-1.jpg');

select tests.login_as('00000000-0000-4000-b000-000000000173');
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900173/clip-1.mp4') $$,
  'P0001', 'FORBIDDEN: only the class''s instructor or staff can change its promo', 'another teacher can''t attach it');
select tests.login_as('00000000-0000-4000-b000-000000000174');
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900173/clip-1.mp4') $$,
  'P0001', 'FORBIDDEN: only the class''s instructor or staff can change its promo', 'nor a student');
select tests.login_anon();
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900173/clip-1.mp4') $$,
  '42501', null, 'nor someone signed out');

select tests.login_as('00000000-0000-4000-b000-000000000172');
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900172/clip-1.mp4') $$,
  'P0001', 'INVALID_INPUT: a promo of this routine is stored under 900171/900173/', 'the clip must be in the routine''s folder');
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900173/missing.mp4') $$,
  'P0001', 'INVALID_INPUT: upload the clip before attaching it', 'and uploaded');
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900173/clip-1.mp4', null, null, 600) $$,
  'P0001', 'INVALID_INPUT: a promo is 1 to 180 seconds long', 'a promo is short');

select is(public.lesson_set_promo(900173, '900171/900173/clip-1.mp4', '900171/900173/poster-1.jpg', '  Lots of footwork!  ', 42),
  '{}'::text[], 'the teacher attaches their clip');
select tests.logout();
select is((tests.lesson(900173)).promo_path, '900171/900173/clip-1.mp4', 'the routine points at it');
select is((tests.lesson(900173)).promo_caption, 'Lots of footwork!', 'with the caption, trimmed');
select is((tests.lesson(900173)).promo_seconds, 42::smallint, 'and its length');
select is((tests.lesson(900173)).promo_by, '00000000-0000-4000-b000-000000000172'::uuid, 'it says who filmed it');
select is((tests.logged('promo_added', '900173')).actor_name, 'Promo Teacher', 'the activity log has it, by the teacher');
select is(tests.log_count('900173'), 1, 'once, not as a routine edit too');

-- Everyone can see it (the routine is public).
select tests.login_anon();
select is((select l.promo_path from public.class_lessons l where l.id = 900173), '900171/900173/clip-1.mp4', 'visitors can read the promo');
select tests.logout();

-- ---------------------------------------------------------------------------
-- The caption, a new take, finished routines, taking it off
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000172');
select is(public.lesson_set_promo(900173, '900171/900173/clip-1.mp4', null, 'Beginners welcome'), '{}'::text[], 'only the caption changes');
select tests.logout();
select is((tests.lesson(900173)).promo_poster_path, '900171/900173/poster-1.jpg', 'the poster stays');
select is((tests.lesson(900173)).promo_seconds, 42::smallint, 'so does the length');
select is((tests.logged('promo_caption', '900173')).meta ->> 'caption', 'Beginners welcome', 'logged as a caption change');

-- The finished routine still has an old promo; the running one has one too.
update public.class_lessons set promo_path = '900171/900171/old.mp4', promo_poster_path = '900171/900171/old.jpg' where id = 900171;
update public.class_lessons set promo_path = '900171/900172/now.mp4' where id = 900172;
select tests.put('900171/900173/clip-2.webm');

select tests.login_as('00000000-0000-4000-b000-000000000171');
select is(public.lesson_set_promo(900173, '900171/900173/clip-2.webm', null, 'Take two', 30),
  array['900171/900173/clip-1.mp4', '900171/900173/poster-1.jpg', '900171/900171/old.mp4', '900171/900171/old.jpg'],
  'staff replace it: the old take and the finished routine''s promo come back to delete');
select tests.logout();
select is((tests.lesson(900173)).promo_by, '00000000-0000-4000-b000-000000000171'::uuid, 'the new take is theirs');
select is((tests.lesson(900171)).promo_path, null, 'the finished routine''s promo is cleared');
select is((tests.lesson(900172)).promo_path, '900171/900172/now.mp4', 'the running routine keeps its promo');

select tests.login_as('00000000-0000-4000-b000-000000000172');
select is(public.lesson_set_promo(900173, null), array['900171/900173/clip-2.webm'], 'the teacher takes it off');
select tests.logout();
select is((tests.lesson(900173)).promo_caption, null, 'nothing is left of it');
select ok((tests.logged('promo_removed', '900173')).id is not null, 'logged as removed');

-- ---------------------------------------------------------------------------
-- A YouTube link (a Short or any video) instead of an upload
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000172');
select throws_ok($$ select public.lesson_set_promo(900173, p_url => 'https://vimeo.com/123456') $$,
  'P0001', 'INVALID_INPUT: a promo link is a YouTube video or Short', 'a link must be YouTube');
select throws_ok($$ select public.lesson_set_promo(900173, '900171/900173/clip-2.webm', p_url => 'https://youtube.com/shorts/abcdefghijk') $$,
  'P0001', 'INVALID_INPUT: a promo is an uploaded clip or a YouTube link, not both', 'not both at once');
select is(public.lesson_set_promo(900173, p_url => ' https://youtube.com/shorts/abcdefghijk ', p_caption => 'On YouTube'),
  '{}'::text[], 'the teacher links a YouTube Short');
select tests.logout();
select is((tests.lesson(900173)).promo_url, 'https://youtube.com/shorts/abcdefghijk', 'the routine points at the Short');
select is((tests.logged('promo_added', '900173')).meta ->> 'youtube', 'https://youtube.com/shorts/abcdefghijk', 'logged with the link');

select tests.put('900171/900173/clip-3.mp4');
select tests.login_as('00000000-0000-4000-b000-000000000172');
select is(public.lesson_set_promo(900173, '900171/900173/clip-3.mp4'), '{}'::text[], 'an upload replaces the link');
select tests.logout();
select is((tests.lesson(900173)).promo_url, null, 'the link is gone');
select tests.login_as('00000000-0000-4000-b000-000000000172');
select is(public.lesson_set_promo(900173, p_url => 'https://youtu.be/abcdefghijk'), array['900171/900173/clip-3.mp4'],
  'a link replaces the upload, whose file comes back to delete');
select tests.logout();

-- A promo can't point into another routine's folder, whoever writes the row.
select throws_ok($$ update public.class_lessons set promo_path = '900172/900174/clip.mp4' where id = 900173 $$,
  '23514', null, 'the table keeps each promo in its routine''s folder');

select * from finish();
rollback;
