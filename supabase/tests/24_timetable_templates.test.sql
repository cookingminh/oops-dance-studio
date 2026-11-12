-- The website timetable (api-contract §3 site_settings, §5 Website):
--   * everyone reads which timetable look the website uses; admins and staff change it, which is logged
--   * a class has a level (newbie / basic / advanced, or none) and the public timetable returns it
--   * a class may have its own photo on the timetable (else the instructor's avatar is shown)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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
create function tests.template_logs() returns bigint language sql stable security definer as $$
  select count(*) from public.activity_log where area = 'settings' and action = 'timetable_template';
$$;
create function tests.last_template_log() returns jsonb language sql stable security definer as $$
  select jsonb_build_object('actor', actor_name, 'meta', meta) from public.activity_log
   where area = 'settings' and action = 'timetable_template' order by id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000241', 'site-staff@test.local', 'staff', 'Site Staff');
select tests.create_user('00000000-0000-4000-b000-000000000242', 'site-teacher@test.local', 'instructor', 'Site Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000243', 'site-guest@test.local', 'guest', 'Site Guest');
update public.site_settings set timetable_template = 'poster' where id = 1;
-- Count only this test's switches (a used database may already have some; rolled back at the end).
delete from public.activity_log where area = 'settings' and action = 'timetable_template';
insert into public.classes (id, name, instructor_id, price, starts_on, level)
values (900241, 'Level Class', '00000000-0000-4000-b000-000000000242', 500000, public.studio_today() - 30, 'advanced');

-- ---------------------------------------------------------------------------
-- Which timetable the website shows
-- ---------------------------------------------------------------------------
select tests.login_anon();
select is((select timetable_template from public.site_settings), 'poster', 'a visitor reads the timetable look');
select throws_ok($$ select public.site_set_timetable_template('brush') $$, '42501', null, 'a visitor cannot change it');
select throws_ok($$ update public.site_settings set timetable_template = 'brush' $$, '42501', null, 'nor write the table');

select tests.login_as('00000000-0000-4000-b000-000000000243');
select throws_ok($$ select public.site_set_timetable_template('brush') $$, 'P0001',
  'FORBIDDEN: only admins and staff can change the website', 'a student cannot change it');

select tests.login_as('00000000-0000-4000-b000-000000000242');
select throws_ok($$ select public.site_set_timetable_template('brush') $$, 'P0001',
  'FORBIDDEN: only admins and staff can change the website', 'an instructor cannot change it');

select tests.login_as('00000000-0000-4000-b000-000000000241');
select throws_ok($$ select public.site_set_timetable_template('neon') $$, 'P0001',
  'INVALID_INPUT: the timetable template is poster or brush', 'only the two looks exist');
select throws_ok($$ select public.site_set_timetable_template(null) $$, 'P0001',
  'INVALID_INPUT: the timetable template is poster or brush', 'a look must be picked');
select is((public.site_set_timetable_template('brush')).timetable_template, 'brush', 'staff switch the website to the red card');
select is((select updated_by from public.site_settings), '00000000-0000-4000-b000-000000000241'::uuid, 'who changed it is kept');
select is(tests.template_logs(), 1::bigint, 'the change is on the Activity page');
select is(tests.last_template_log(), jsonb_build_object('actor', 'Site Staff', 'meta', jsonb_build_object('template', 'brush', 'from', 'poster')),
  'with who did it, the new look and the old one');
select is((public.site_set_timetable_template('brush')).timetable_template, 'brush', 'picking the look in use is fine');
select is(tests.template_logs(), 1::bigint, 'and logs nothing');
select is((public.site_set_timetable_template('poster')).timetable_template, 'poster', 'and back to the poster');

-- ---------------------------------------------------------------------------
-- Class levels
-- ---------------------------------------------------------------------------
select tests.logout();
select throws_ok($$ update public.classes set level = 'expert' where id = 900241 $$, '23514', null, 'a level is newbie, basic or advanced');

select tests.login_anon();
select is((select level from public.list_public_classes() where id = 900241), 'advanced', 'the public timetable gives each class its level');

select tests.login_as('00000000-0000-4000-b000-000000000241');
update public.classes set level = null where id = 900241;
select is((select level from public.list_public_classes() where id = 900241), null, 'a class can have no level');

update public.classes set timetable_photo_path = '900241/timetable.webp' where id = 900241;
select is((select timetable_photo_path from public.list_public_classes() where id = 900241), '900241/timetable.webp',
  'staff give a class its own timetable photo, and the public timetable returns it');
update public.classes set timetable_photo_path = null where id = 900241;
select is((select timetable_photo_path from public.list_public_classes() where id = 900241), null, 'or none (the avatar then)');

select * from finish();
rollback;
