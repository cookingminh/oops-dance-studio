-- AI knowledge (api-contract §3 knowledge_articles, §4 RLS):
--   * visitors, guests and instructors can't read or write articles; staff and admins can, all of it
--   * people write title, category, body and status only; slug, updated_at / updated_by and published_at are the server's
--   * publishing, editing while published, unpublishing; deleting an editor's account keeps their articles
--   * every step is on the Activity page, never the body
begin;
create extension if not exists pgtap with schema extensions;
select plan(86);

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
-- Rows affected by a DML statement run as the current role.
create function tests.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
-- The article with this title, whoever asks.
create function tests.article(p_title text) returns public.knowledge_articles language sql stable security definer as $$
  select * from public.knowledge_articles where title = p_title;
$$;
-- The whole test runs in one transaction, where now() never moves: put an article's times a day back, so a later
-- change shows (the stamping trigger is off meanwhile).
create function tests.age(p_title text) returns void language plpgsql security definer as $$
begin
  alter table public.knowledge_articles disable trigger knowledge_article_stamp;
  update public.knowledge_articles
     set created_at = created_at - interval '1 day', updated_at = updated_at - interval '1 day',
         published_at = published_at - interval '1 day'
   where title = p_title;
  alter table public.knowledge_articles enable trigger knowledge_article_stamp;
end $$;
create function tests.logs() returns text[] language sql stable security definer as $$
  select coalesce(array_agg(action order by id), '{}') from public.activity_log where entity = 'knowledge_articles';
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000351', 'kb-staff@test.local', 'staff', 'KB Staff');
select tests.create_user('00000000-0000-4000-b000-000000000352', 'kb-admin@test.local', 'admin', 'KB Admin');
select tests.create_user('00000000-0000-4000-b000-000000000353', 'kb-instructor@test.local', 'instructor', 'KB Instructor');
select tests.create_user('00000000-0000-4000-b000-000000000354', 'kb-guest@test.local', 'guest', 'KB Guest');
select tests.create_user('00000000-0000-4000-b000-000000000355', 'kb-leaver@test.local', 'staff', 'KB Leaver');
-- Only this test's articles and logs (a used database may have the seed's; rolled back at the end).
delete from public.knowledge_articles where true;
delete from public.activity_log where entity = 'knowledge_articles';
insert into public.knowledge_articles (title, category, body, status) values
  ('Published one', 'faq', 'Opening hours.', 'published'),
  ('Draft one', 'policy', '', 'draft');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.knowledge_articles'::regclass), 'RLS is on');
select is((select array_agg(cmd || ':' || array_to_string(roles, ',') order by cmd) from pg_policies
            where schemaname = 'public' and tablename = 'knowledge_articles'),
  array['DELETE:authenticated', 'INSERT:authenticated', 'SELECT:authenticated', 'UPDATE:authenticated'],
  'one policy per command, for signed-in people only');
select is((select count(*) from unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p
            where has_table_privilege('anon', 'public.knowledge_articles', p)
               or (p in ('select', 'insert', 'update') and has_any_column_privilege('anon', 'public.knowledge_articles', p))),
  0::bigint, 'anon has no privilege on the table');
select is((select array_agg(column_name::text order by column_name) from information_schema.column_privileges
            where table_schema = 'public' and table_name = 'knowledge_articles' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['body', 'category', 'status', 'title'], 'people insert four columns');
select is((select array_agg(column_name::text order by column_name) from information_schema.column_privileges
            where table_schema = 'public' and table_name = 'knowledge_articles' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['body', 'category', 'status', 'title'], 'and change the same four');
select ok(not has_table_privilege('authenticated', 'public.knowledge_articles', 'truncate'), 'nobody signed in can truncate it');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'private' and p.proname like 'knowledge\_%'
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0::bigint, 'its helpers can''t be called through the API');

-- ---------------------------------------------------------------------------
-- Visitors (no account)
-- ---------------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$ select * from public.knowledge_articles $$, '42501', null, 'anon: cannot read, published or not');
select throws_ok($$ insert into public.knowledge_articles (title, category) values ('x', 'faq') $$, '42501', null, 'anon: cannot create');
select throws_ok($$ update public.knowledge_articles set title = 'x' where true $$, '42501', null, 'anon: cannot change');
select throws_ok($$ delete from public.knowledge_articles where true $$, '42501', null, 'anon: cannot delete');

-- ---------------------------------------------------------------------------
-- Guests (students)
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000354');
select is((select count(*) from public.knowledge_articles), 0::bigint, 'guest: reads nothing, published or not');
select throws_ok($$ insert into public.knowledge_articles (title, category, body) values ('x', 'faq', 'y') $$, '42501', null, 'guest: cannot create');
select is(tests.affected($$ update public.knowledge_articles set title = 'hacked' where true $$), 0, 'guest: changes nothing');
select is(tests.affected($$ update public.knowledge_articles set status = 'published', body = 'free classes' where true $$), 0, 'guest: publishes nothing');
select is(tests.affected($$ delete from public.knowledge_articles where true $$), 0, 'guest: deletes nothing');

-- ---------------------------------------------------------------------------
-- Instructors
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000353');
select is((select count(*) from public.knowledge_articles), 0::bigint, 'instructor: reads nothing, published or not');
select throws_ok($$ insert into public.knowledge_articles (title, category, body) values ('x', 'faq', 'y') $$, '42501', null, 'instructor: cannot create');
select is(tests.affected($$ update public.knowledge_articles set title = 'hacked' where true $$), 0, 'instructor: changes nothing');
select is(tests.affected($$ update public.knowledge_articles set status = 'published', body = 'free classes' where true $$), 0, 'instructor: publishes nothing');
select is(tests.affected($$ delete from public.knowledge_articles where true $$), 0, 'instructor: deletes nothing');

-- Signed in, but no profile behind the token (a deleted account).
select tests.login_as('00000000-0000-4000-b000-0000000003ff');
select is((select count(*) from public.knowledge_articles), 0::bigint, 'a token without a profile reads nothing');
select throws_ok($$ insert into public.knowledge_articles (title, category, body) values ('x', 'faq', 'y') $$, '42501', null, 'nor creates');

select tests.logout();
select is((select array_agg(title || ':' || status order by title) from public.knowledge_articles),
  array['Draft one:draft', 'Published one:published'], 'nothing of the above went through');

-- ---------------------------------------------------------------------------
-- Staff: create, read, change, delete
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000351');
select is((select count(*) from public.knowledge_articles), 2::bigint, 'staff: reads drafts and published');
select lives_ok($$ insert into public.knowledge_articles (title, category) values ('  Chính sách huỷ phòng (2026)  ', 'policy') $$, 'staff: creates one');
select is((tests.article('Chính sách huỷ phòng (2026)')).status, 'draft', 'it starts as a draft');
select is((tests.article('Chính sách huỷ phòng (2026)')).slug, 'chinh-sach-huy-phong-2026', 'its slug comes from the title, accents dropped (spaces around it too)');
select is((tests.article('Chính sách huỷ phòng (2026)')).updated_by, '00000000-0000-4000-b000-000000000351'::uuid, 'edited by whoever created it');
select is((tests.article('Chính sách huỷ phòng (2026)')).updated_at, now(), 'just now');
select is((tests.article('Chính sách huỷ phòng (2026)')).created_at, now(), 'created just now');
select is((tests.article('Chính sách huỷ phòng (2026)')).published_at, null::timestamptz, 'not published');
select is(tests.affected($$ update public.knowledge_articles set body = 'Huỷ trước 24 giờ.' where slug = 'chinh-sach-huy-phong-2026' $$), 1, 'staff: changes one');

-- ---------------------------------------------------------------------------
-- The other columns are the server's
-- ---------------------------------------------------------------------------
select throws_ok($$ insert into public.knowledge_articles (title, category, slug) values ('S', 'faq', 'mine') $$, '42501', null, 'staff: cannot send a slug');
select throws_ok($$ insert into public.knowledge_articles (title, category, updated_by) values ('S', 'faq', '00000000-0000-4000-b000-000000000352') $$, '42501', null, 'nor an editor');
select throws_ok($$ insert into public.knowledge_articles (title, category, updated_at) values ('S', 'faq', '2020-01-01') $$, '42501', null, 'nor an edit time');
select throws_ok($$ insert into public.knowledge_articles (title, category, created_at) values ('S', 'faq', '2020-01-01') $$, '42501', null, 'nor a creation time');
select throws_ok($$ insert into public.knowledge_articles (title, category, body, status, published_at) values ('S', 'faq', 'y', 'published', '2020-01-01') $$, '42501', null, 'nor a publication time');
select throws_ok($$ update public.knowledge_articles set slug = 'mine' where true $$, '42501', null, 'staff: cannot change a slug');
select throws_ok($$ update public.knowledge_articles set updated_by = '00000000-0000-4000-b000-000000000352' where true $$, '42501', null, 'nor the editor');
select throws_ok($$ update public.knowledge_articles set updated_at = '2020-01-01' where true $$, '42501', null, 'nor the edit time');
select throws_ok($$ update public.knowledge_articles set published_at = '2020-01-01' where true $$, '42501', null, 'nor the publication time');
select throws_ok($$ update public.knowledge_articles set created_at = '2020-01-01' where true $$, '42501', null, 'nor the creation time');

-- The trigger holds even for a connection those privileges don't stop (the service role, the SQL editor).
select tests.logout();
select tests.age('Chính sách huỷ phòng (2026)');
update public.knowledge_articles
   set slug = 'mine', created_at = '2020-01-01', updated_at = '2020-01-01', published_at = '2020-01-01', updated_by = '00000000-0000-4000-b000-000000000352'
 where title = 'Chính sách huỷ phòng (2026)';
select is((select (a.slug, a.created_at, a.updated_at, a.published_at, a.updated_by)::text from tests.article('Chính sách huỷ phòng (2026)') a),
  ('chinh-sach-huy-phong-2026'::text, now() - interval '1 day', now() - interval '1 day', null::timestamptz, '00000000-0000-4000-b000-000000000351'::uuid)::text,
  'a change to those columns only changes nothing');

-- ---------------------------------------------------------------------------
-- Who edited last, and when
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000352');
select is(tests.affected($$ update public.knowledge_articles set body = 'Huỷ trước 24 giờ.' where slug = 'chinh-sach-huy-phong-2026' $$), 1, 'admin: saves it unchanged');
select is((tests.article('Chính sách huỷ phòng (2026)')).updated_at, now() - interval '1 day', 'saving without a change is not an edit');
select is((tests.article('Chính sách huỷ phòng (2026)')).updated_by, '00000000-0000-4000-b000-000000000351'::uuid, 'the editor stays too');
select is(tests.affected($$ update public.knowledge_articles set category = 'faq', title = 'Huỷ phòng' where slug = 'chinh-sach-huy-phong-2026' $$), 1, 'admin: changes it');
select is((tests.article('Huỷ phòng')).updated_by, '00000000-0000-4000-b000-000000000352'::uuid, 'the admin is the last editor');
select is((tests.article('Huỷ phòng')).updated_at, now(), 'the edit time moves');
select is((tests.article('Huỷ phòng')).created_at, now() - interval '1 day', 'the creation time doesn''t');
select is((tests.article('Huỷ phòng')).slug, 'chinh-sach-huy-phong-2026', 'a new title keeps the slug');

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000351');
select is(tests.affected($$ update public.knowledge_articles set status = 'published' where title = 'Huỷ phòng' $$), 1, 'staff: publishes');
select is((tests.article('Huỷ phòng')).published_at, now(), 'publishing sets the publication time');
select is((tests.article('Huỷ phòng')).updated_by, '00000000-0000-4000-b000-000000000351'::uuid, 'and who did it');
select tests.age('Huỷ phòng');
select is(tests.affected($$ update public.knowledge_articles set body = 'Huỷ trước 24 giờ: hoàn 100%.' where title = 'Huỷ phòng' $$), 1, 'staff: edits it while published');
select is((tests.article('Huỷ phòng')).published_at, now() - interval '1 day', 'editing keeps the publication time');
select is((tests.article('Huỷ phòng')).updated_at, now(), 'and moves the edit time');
select is((tests.article('Huỷ phòng')).status, 'published', 'it stays published');
select is(tests.affected($$ update public.knowledge_articles set status = 'draft' where title = 'Huỷ phòng' $$), 1, 'staff: unpublishes');
select is((tests.article('Huỷ phòng')).published_at, null::timestamptz, 'a draft has no publication time');
select is(tests.affected($$ update public.knowledge_articles set status = 'published' where title = 'Huỷ phòng' $$), 1, 'staff: publishes again');
select is((tests.article('Huỷ phòng')).published_at, now(), 'publishing again is a new time');
select lives_ok($$ insert into public.knowledge_articles (title, category, body, status) values ('Straight out', 'class', 'Newbie first.', 'published') $$, 'staff: publishes a new one at once');
select is((tests.article('Straight out')).published_at, now(), 'it has its publication time');

-- ---------------------------------------------------------------------------
-- What is checked
-- ---------------------------------------------------------------------------
select throws_ok($$ insert into public.knowledge_articles (title, category, body, status) values ('Empty', 'faq', E' \n\t ', 'published') $$, '23514', null, 'an empty article can''t be published');
select throws_ok($$ update public.knowledge_articles set body = '' where title = 'Straight out' $$, '23514', null, 'nor emptied while published');
select lives_ok($$ insert into public.knowledge_articles (title, category) values ('Empty draft', 'faq') $$, 'a draft may be empty');
select throws_ok($$ insert into public.knowledge_articles (title, category) values ('   ', 'faq') $$, '23514', null, 'an article has a title');
select throws_ok(format($$ insert into public.knowledge_articles (title, category) values (%L, 'faq') $$, repeat('x', 121)), '23514', null, 'of up to 120 characters');
select throws_ok($$ insert into public.knowledge_articles (title, category) values ('Bad category', 'secret') $$, '23514', null, 'one of the five categories');
select throws_ok($$ insert into public.knowledge_articles (title, category, status) values ('Bad status', 'faq', 'live') $$, '23514', null, 'draft or published');
select throws_ok(format($$ insert into public.knowledge_articles (title, category, body) values ('Too long', 'faq', %L) $$, repeat('x', 20001)), '23514', null, 'up to 20,000 characters');

-- ---------------------------------------------------------------------------
-- Slugs
-- ---------------------------------------------------------------------------
insert into public.knowledge_articles (title, category) values ('HUỶ phòng?', 'faq'), ('Huy phong', 'faq'), ('???', 'other');
select is((tests.article('HUỶ phòng?')).slug, 'huy-phong', 'capitals and accents are dropped');
select is((tests.article('Huy phong')).slug, 'huy-phong-' || (tests.article('Huy phong')).id, 'a slug already taken gets the id');
select is((tests.article('???')).slug, 'article', 'a title without letters still gets one');
insert into public.knowledge_articles (title, category) values (normalize('Đường đến lớp', NFD), 'class');
select is((select slug from public.knowledge_articles where category = 'class' and title like '%ng %n l%' limit 1), 'duong-den-lop', 'letters typed as separate accents work too');

-- ---------------------------------------------------------------------------
-- Deleting; an editor's account goes
-- ---------------------------------------------------------------------------
select is(tests.affected($$ delete from public.knowledge_articles where title = 'Straight out' $$), 1, 'staff: deletes one');
select tests.login_as('00000000-0000-4000-b000-000000000352');
select is(tests.affected($$ delete from public.knowledge_articles where title = 'Empty draft' $$), 1, 'admin: deletes one');
select lives_ok($$ insert into public.knowledge_articles (title, category, body) values ('By the admin', 'house_rules', 'x') $$, 'admin: creates one');

select tests.login_as('00000000-0000-4000-b000-000000000355');
insert into public.knowledge_articles (title, category, body, status) values ('By the leaver', 'other', 'x', 'published');
select tests.age('By the leaver');
select tests.logout();
select lives_ok($$ delete from auth.users where id = '00000000-0000-4000-b000-000000000355' $$, 'an editor''s account can be deleted');
select is((select (a.updated_by, a.updated_at, a.published_at, a.status)::text from tests.article('By the leaver') a),
  (null::uuid, now() - interval '1 day', now() - interval '1 day', 'published'::text)::text,
  'their article stays as it was, without an editor');

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
select is((tests.logs())[1:6],
  array['knowledge_created', 'knowledge_updated', 'knowledge_updated', 'knowledge_published', 'knowledge_updated', 'knowledge_unpublished'],
  'creating, changing, publishing and unpublishing are on the Activity page (saving without a change isn''t)');
select ok('knowledge_deleted' = any (tests.logs()), 'and deleting');
select is((select (l.area, l.actor_name, l.label, l.meta)::text from public.activity_log l where l.entity = 'knowledge_articles' and l.action = 'knowledge_published' order by l.id limit 1),
  ('settings'::text, 'KB Staff'::text, 'Huỷ phòng'::text, '{"category": "faq", "status": "published"}'::jsonb)::text,
  'with who, which article and its category');
select is((select count(*) from public.activity_log l where l.entity = 'knowledge_articles' and (l.changes is not null or l.meta::text like '%hoàn 100%')),
  0::bigint, 'never the text itself');

select * from finish();
rollback;
