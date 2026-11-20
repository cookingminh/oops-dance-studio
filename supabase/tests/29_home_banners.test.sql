-- Homepage banners (api-contract §3 home_banners, §5 Homepage banners):
--   * visitors get the banners that show today (enabled, within their dates), the first four in order
--   * staff save, show / hide, reorder and delete them; posters must be uploaded, both of them; buttons are checked
--   * guests and visitors can't change them or read the table; every change is on the Activity page
-- Dates are relative to studio_today(); nothing depends on the time of day.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

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
-- A banner as the editor sends it; `extra` overrides keys.
create function tests.banner(p_name text, p_extra jsonb default '{}'::jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'name', p_name, 'alt_text', p_name || ': what the poster says',
    'desktop_path', 'banners/t-desk.webp', 'desktop_width', 1920, 'desktop_height', 1080,
    'phone_path', 'banners/t-phone.webp', 'phone_width', 1080, 'phone_height', 1920,
    'buttons', jsonb_build_array(jsonb_build_object(
      'text_vi', 'Xem chi tiết', 'text_en', 'See more', 'link', 'url', 'url', 'https://facebook.com/oopsdance/posts/1',
      'color', 'gold', 'arrow', true, 'junk', 'dropped',
      'desktop', jsonb_build_object('x', 20, 'y', 80, 'scale', 1.3), 'phone', jsonb_build_object('x', 50, 'y', 85))))
  || p_extra;
$$;
create function tests.live_names() returns text[] language sql stable security definer as $$
  select coalesce(array_agg(name order by ord), '{}') from (select name, row_number() over () as ord from public.home_banners_live()) x;
$$;
create function tests.logs() returns text[] language sql stable security definer as $$
  select coalesce(array_agg(action order by id), '{}') from public.activity_log where entity = 'home_banners';
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000291', 'banner-staff@test.local', 'staff', 'Banner Staff');
select tests.create_user('00000000-0000-4000-b000-000000000292', 'banner-guest@test.local', 'guest', 'Banner Guest');
-- Only this test's banners and logs (a used database may have the demo's; rolled back at the end).
delete from public.home_banners where true;
delete from public.activity_log where entity = 'home_banners';
insert into storage.objects (bucket_id, name) values
  ('site-assets', 'banners/t-desk.webp'), ('site-assets', 'banners/t-phone.webp'),
  ('site-assets', 'banners/t-desk2.webp'), ('site-assets', 'banners/t-phone2.webp');

-- ---------------------------------------------------------------------------
-- Who may do what
-- ---------------------------------------------------------------------------
select tests.login_anon();
select is(tests.live_names(), '{}'::text[], 'a visitor reads the banners that show (none yet)');
select throws_ok($$ select * from public.home_banners $$, '42501', null, 'but not the table');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x')) $$, '42501', null, 'nor save one');

select tests.login_as('00000000-0000-4000-b000-000000000292');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x')) $$, 'P0001',
  'FORBIDDEN: only admins and staff change the homepage banners', 'a student cannot post a banner');

-- ---------------------------------------------------------------------------
-- Checks on save
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000291');
select throws_ok($$ select public.home_banner_save(null, tests.banner(' ')) $$, 'P0001',
  'INVALID_INPUT: give the banner a name (up to 60 characters)', 'a banner has a name');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', '{"alt_text": ""}')) $$, 'P0001',
  'INVALID_INPUT: write what the poster says (up to 400 characters)', 'and the poster''s text');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', '{"phone_path": null, "phone_width": null, "phone_height": null}')) $$, 'P0001',
  'INVALID_INPUT: both posters are needed, with their size', 'the phone poster is required');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', '{"desktop_path": "../../x.webp"}')) $$, 'P0001',
  'INVALID_INPUT: the desktop poster must be banners/<name>.webp (or .jpg, .png)', 'posters live under banners/');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', '{"phone_path": "banners/missing.webp"}')) $$, 'P0001',
  'INVALID_INPUT: the phone poster banners/missing.webp has not been uploaded', 'and are uploaded first');
select throws_ok(format($$ select public.home_banner_save(null, tests.banner('x', '{"starts_on": "%s", "ends_on": "%s"}')) $$,
  public.studio_today() + 5, public.studio_today()), 'P0001', 'INVALID_INPUT: the banner ends before it starts', 'dates in order');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons',
  (select jsonb_agg(tests.banner('x') -> 'buttons' -> 0) from generate_series(1, 5))))) $$, 'P0001',
  'INVALID_INPUT: a banner has up to 4 buttons', 'up to 4 buttons');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons', jsonb_build_array(
  (tests.banner('x') -> 'buttons' -> 0) || '{"color": "pink"}')))) $$, 'P0001',
  'INVALID_INPUT: a button''s colour is red, white, gold, dark or glass', 'one of the five colours');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons', jsonb_build_array(
  (tests.banner('x') -> 'buttons' -> 0) || '{"url": "http://facebook.com/x"}')))) $$, 'P0001',
  'INVALID_INPUT: a button''s link starts with https://', 'an own link is https');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons', jsonb_build_array(
  (tests.banner('x') -> 'buttons' -> 0) || '{"link": "admin"}')))) $$, 'P0001',
  'INVALID_INPUT: pick where the button leads', 'or one of the site''s pages');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons', jsonb_build_array(
  (tests.banner('x') -> 'buttons' -> 0) || '{"text_vi": "  "}')))) $$, 'P0001',
  'INVALID_INPUT: a button''s text is 1–30 characters', 'a button has words');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons', jsonb_build_array(
  (tests.banner('x') -> 'buttons' -> 0) || '{"desktop": {"x": 120, "y": 50}}')))) $$, 'P0001',
  'INVALID_INPUT: a button must sit on the desktop poster (0–100 %)', 'a button sits on the poster');
select throws_ok($$ select public.home_banner_save(null, tests.banner('x', jsonb_build_object('buttons', jsonb_build_array(
  (tests.banner('x') -> 'buttons' -> 0) || '{"phone": {"x": 50, "y": 50, "scale": 3}}')))) $$, 'P0001',
  'INVALID_INPUT: a button''s size is between 60 % and 200 %', 'its size stays reasonable');

-- ---------------------------------------------------------------------------
-- Saving and showing
-- ---------------------------------------------------------------------------
create temp table saved on commit drop as select public.home_banner_save(null, tests.banner('Audition')) as r;
select is((select r -> 'banner' ->> 'name' from saved), 'Audition', 'staff post a banner');
select is((select r -> 'banner' -> 'buttons' -> 0 ->> 'url' from saved), 'https://facebook.com/oopsdance/posts/1',
  'its button leads to the Facebook post');
select ok((select (r -> 'banner' -> 'buttons' -> 0) ? 'id' and not ((r -> 'banner' -> 'buttons' -> 0) ? 'junk') from saved),
  'buttons keep only what the site reads, with an id');
select is((select (r -> 'banner' -> 'buttons' -> 0 -> 'phone' ->> 'scale')::numeric from saved), 1::numeric,
  'a button without a size has the standard size');
select is(tests.live_names(), array['Audition'], 'it shows on the homepage');

select public.home_banner_save(null, tests.banner('Tomorrow', jsonb_build_object('starts_on', public.studio_today() + 1)));
select public.home_banner_save(null, tests.banner('Yesterday', jsonb_build_object('ends_on', public.studio_today() - 1)));
select public.home_banner_save(null, tests.banner('Today only', jsonb_build_object('starts_on', public.studio_today(), 'ends_on', public.studio_today())));
select public.home_banner_save(null, tests.banner('Off', '{"enabled": false}'));
select is(tests.live_names(), array['Audition', 'Today only'], 'only the ones on, within their dates, show');

select public.home_banner_save(null, tests.banner('Third'));
select public.home_banner_save(null, tests.banner('Fourth'));
select public.home_banner_save(null, tests.banner('Fifth'));
select is(tests.live_names(), array['Audition', 'Today only', 'Third', 'Fourth'], 'four at most, in order');

select lives_ok(format($$ select public.home_banners_reorder(array[%s, %s]) $$,
  (select id from public.home_banners where name = 'Fifth'), (select id from public.home_banners where name = 'Third')),
  'staff reorder them');
select is(tests.live_names(), array['Fifth', 'Third', 'Audition', 'Today only'], 'the ones moved come first, the rest keep their order');

select is((public.home_banner_set_enabled((select id from public.home_banners where name = 'Fifth'), false)).enabled, false,
  'staff hide one');
select is(tests.live_names(), array['Third', 'Audition', 'Today only', 'Fourth'], 'the next one takes its place');

-- ---------------------------------------------------------------------------
-- Changing posters, deleting
-- ---------------------------------------------------------------------------
select is((public.home_banner_save((select id from public.home_banners where name = 'Audition'),
  tests.banner('Audition', '{"desktop_path": "banners/t-desk2.webp", "phone_path": "banners/t-phone2.webp"}')) -> 'unused_paths'),
  '["banners/t-desk.webp", "banners/t-phone.webp"]'::jsonb, 'new posters: the old files are handed back to delete');
select is((public.home_banner_save((select id from public.home_banners where name = 'Audition'),
  tests.banner('Audition', '{"desktop_path": "banners/t-desk2.webp", "phone_path": "banners/t-phone2.webp"}')) -> 'unused_paths'),
  '[]'::jsonb, 'same posters: nothing to delete');
select is(public.home_banner_delete((select id from public.home_banners where name = 'Off')),
  array['banners/t-desk.webp', 'banners/t-phone.webp'], 'deleting a banner hands back its posters');
select throws_ok($$ select public.home_banner_delete(-1) $$, 'P0001', 'NOT_FOUND: no such banner', 'a banner that isn''t there');
select is((select count(*) from public.home_banners), 7::bigint, 'staff read every banner, showing or not');

select tests.login_as('00000000-0000-4000-b000-000000000292');
select is((select count(*) from public.home_banners), 0::bigint, 'a student reads none of the table');
select throws_ok(format($$ select public.home_banner_delete(%s) $$, (select id from public.home_banners_live() limit 1)),
  'P0001', 'FORBIDDEN: only admins and staff change the homepage banners', 'nor deletes one');
select throws_ok($$ select public.home_banners_reorder(array[1]) $$, 'P0001',
  'FORBIDDEN: only admins and staff change the homepage banners', 'nor reorders them');

select tests.logout();
select is((tests.logs())[1:2], array['banner_created', 'banner_created'], 'creating is on the Activity page');
select ok('banners_reordered' = any (tests.logs()) and 'banner_hidden' = any (tests.logs())
          and 'banner_updated' = any (tests.logs()) and 'banner_deleted' = any (tests.logs()),
  'and reordering, hiding, changing and deleting');
select is((select actor_name from public.activity_log where entity = 'home_banners' order by id limit 1), 'Banner Staff', 'with who did it');

select * from finish();
rollback;
