-- Chat with the studio (api-contract §3 support_threads / support_messages, §5 Support chat):
--   * hours: new conversations until 21:45, messages until 22:00, nobody writes at night (staff included)
--   * one open conversation per person; staff answer, ask to close; the person closes it or keeps it open
--   * the job closes unanswered close requests after 24 hours and leaves a night note at closing time
--   * RLS: a person reads only their own conversations, photos and messages; staff read all
-- Independent of the time of day: hours are set inside the test, and the job gets fixed timestamps.
begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

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
-- 'open' | 'last_call' | 'closed' all day long.
create function tests.hours(p_phase text) returns void language sql security definer as $$
  update public.site_settings
     set support_opens = '00:00',
         support_last_start = case p_phase when 'open' then '24:00'::time else '00:00'::time end,
         support_closes = case p_phase when 'closed' then '00:00'::time else '24:00'::time end
   where id = 1;
$$;
create function tests.thread(p_id bigint) returns public.support_threads language sql stable security definer as $$
  select * from public.support_threads where id = p_id;
$$;
create function tests.open_thread(p_customer uuid) returns bigint language sql stable security definer as $$
  select id from public.support_threads where customer_id = p_customer and status <> 'closed';
$$;
-- Everything happens in one transaction (now() doesn't move): age what the person has read.
create function tests.read_a_minute_ago(p_thread bigint) returns void language sql security definer as $$
  update public.support_threads set customer_read_at = now() - interval '1 minute' where id = p_thread;
$$;
create function tests.events(p_thread bigint) returns text[] language sql stable security definer as $$
  select coalesce(array_agg(event order by id), '{}') from public.support_messages where thread_id = p_thread and event is not null;
$$;
create function tests.logs(p_thread bigint) returns text[] language sql stable security definer as $$
  select coalesce(array_agg(action order by id), '{}') from public.activity_log
   where area = 'support' and entity = 'support_threads' and entity_id = p_thread::text;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000271', 'chat-staff@test.local', 'staff', 'Chat Staff');
select tests.create_user('00000000-0000-4000-b000-000000000272', 'chat-admin@test.local', 'admin', 'Chat Admin');
select tests.create_user('00000000-0000-4000-b000-000000000273', 'chat-a@test.local', 'guest', 'Chat Student A');
select tests.create_user('00000000-0000-4000-b000-000000000274', 'chat-b@test.local', 'guest', 'Chat Student B');
select tests.create_user('00000000-0000-4000-b000-000000000275', 'chat-teacher@test.local', 'instructor', 'Chat Teacher');

-- ---------------------------------------------------------------------------
-- The hours (defaults 08:00 / 21:45 / 22:00, studio time)
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(private.support_phase((date '2026-01-05' + t) at time zone 'Asia/Ho_Chi_Minh') order by t)
     from unnest(array[time '07:59', '08:00', '21:44', '21:45', '21:59', '22:00', '23:30']) t),
  array['closed', 'open', 'open', 'last_call', 'last_call', 'closed', 'closed'],
  'new questions 08:00–21:45, open conversations until 22:00, closed at night');

select tests.hours('open');

select tests.login_anon();
select is((public.support_status() ->> 'phase'), 'open', 'a visitor reads whether the studio is answering');
select ok((public.support_status() -> 'unread') = 'null'::jsonb, 'a visitor has nothing unread');
select throws_ok($$ select * from public.support_threads $$, '42501', null, 'a visitor cannot read conversations');

-- ---------------------------------------------------------------------------
-- Asking a question
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000271');
select throws_ok($$ select public.support_start('booking', 'hi') $$, 'P0001',
  'FORBIDDEN: students, guests and instructors start a conversation; staff answer from the Inbox', 'staff answer, they do not ask');

select tests.login_as('00000000-0000-4000-b000-000000000273');
select throws_ok($$ select public.support_start('payroll', 'hi') $$, 'P0001',
  'INVALID_INPUT: pick a topic for the question', 'a student picks one of the students'' topics');
select throws_ok($$ select public.support_start('tuition', '   ') $$, 'P0001',
  'INVALID_INPUT: write your question', 'a question has words');
select throws_ok($$ select public.support_start('tuition', repeat('x', 2001)) $$, 'P0001',
  'INVALID_INPUT: a message is up to 2000 characters', 'up to 2000 characters');
select is((public.support_start('tuition', '  I paid but it says unpaid  ', null, '/profile/tuition')).status, 'open',
  'a student asks a question');
select throws_ok($$ select public.support_start('booking', 'another one') $$, 'P0001',
  'INVALID_STATE: you already have an open conversation', 'one open conversation at a time');
select is((public.support_status() -> 'thread' ->> 'category'), 'tuition', 'the bubble knows the open conversation');
select ok((tests.thread(tests.open_thread('00000000-0000-4000-b000-000000000273'))).waiting_since is not null,
  'the student is waiting for the studio');
select is((select body from public.support_messages where thread_id = tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'I paid but it says unpaid', 'the question is kept trimmed');

select tests.login_as('00000000-0000-4000-b000-000000000275');
select throws_ok($$ select public.support_start('booking', 'hi') $$, 'P0001',
  'INVALID_INPUT: pick a topic for the question', 'an instructor picks one of the instructors'' topics');
select is((public.support_start('payroll', 'A session is missing on my payslip')).category, 'payroll', 'an instructor asks the studio too');

-- ---------------------------------------------------------------------------
-- Who reads what
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000274');
select is((select count(*) from public.support_threads where customer_id <> '00000000-0000-4000-b000-000000000274'), 0::bigint,
  'a student does not see other people''s conversations');
select is((select count(*) from public.support_messages), 0::bigint, 'nor their messages');
select throws_ok(format($$ select public.support_send(%s, 'hello') $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'P0001', 'NOT_FOUND: no such conversation', 'nor write in them');
select throws_ok(format($$ insert into public.support_messages (thread_id, sender_kind, body) values (%s, 'staff', 'fake') $$,
  tests.open_thread('00000000-0000-4000-b000-000000000273')), '42501', null, 'nobody writes the tables directly');
select throws_ok($$ select public.support_inbox('waiting') $$, 'P0001', 'FORBIDDEN: only admins and staff read the Inbox',
  'only staff read the Inbox');
select throws_ok(format($$ select public.support_customer_card(%L) $$, '00000000-0000-4000-b000-000000000273'),
  'P0001', 'FORBIDDEN: only admins and staff read the Inbox', 'nor the card of who is asking');

select tests.login_as('00000000-0000-4000-b000-000000000271');
select ok(tests.open_thread('00000000-0000-4000-b000-000000000273') in (select id from public.support_inbox('waiting')),
  'staff see the question under Waiting');
select is((select unread from public.support_inbox('waiting') where id = tests.open_thread('00000000-0000-4000-b000-000000000273')),
  1, 'with one message nobody at the studio has read');
select ok((public.support_counts() ->> 'waiting')::int >= 2, 'the to-do bell counts the people waiting');
select is((public.support_customer_card('00000000-0000-4000-b000-000000000273') ->> 'name'), 'Chat Student A',
  'staff see who is asking');

-- ---------------------------------------------------------------------------
-- Answering
-- ---------------------------------------------------------------------------
select tests.read_a_minute_ago(tests.open_thread('00000000-0000-4000-b000-000000000273'));
select is((public.support_send(tests.open_thread('00000000-0000-4000-b000-000000000273'), 'Let me check')).sender_name, 'Chat Staff',
  'staff answer, with their name');
select is((tests.thread(tests.open_thread('00000000-0000-4000-b000-000000000273'))).assigned_to,
  '00000000-0000-4000-b000-000000000271'::uuid, 'the first to answer takes the conversation');
select ok((tests.thread(tests.open_thread('00000000-0000-4000-b000-000000000273'))).waiting_since is null, 'nobody is waiting now');
select is(tests.logs(tests.open_thread('00000000-0000-4000-b000-000000000273')), array['claimed'], 'taking it is on the Activity page');
select ok(tests.open_thread('00000000-0000-4000-b000-000000000273') in (select id from public.support_inbox('answered')),
  'it moves under Answered');

select throws_ok(format($$ select public.support_claim(%s, %L) $$, tests.open_thread('00000000-0000-4000-b000-000000000273'),
  '00000000-0000-4000-b000-000000000274'), 'P0001', 'INVALID_INPUT: hand the conversation to a staff member or an admin',
  'a conversation goes only to staff');
select is((public.support_claim(tests.open_thread('00000000-0000-4000-b000-000000000273'), '00000000-0000-4000-b000-000000000272')).assigned_to,
  '00000000-0000-4000-b000-000000000272'::uuid, 'staff hand it to the admin');
select is(tests.logs(tests.open_thread('00000000-0000-4000-b000-000000000273')), array['claimed', 'handed_over'], 'which is logged too');

select tests.login_as('00000000-0000-4000-b000-000000000273');
select is((public.support_status() ->> 'unread')::int, 1, 'the student has one reply to read');
select lives_ok(format($$ select public.support_mark_read(%s) $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'opening the chat reads it');
select is((public.support_status() ->> 'unread')::int, 0, 'nothing left to read');
select throws_ok(format($$ select public.support_request_close(%s) $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'P0001', 'FORBIDDEN: only admins and staff close conversations', 'the studio asks to close, not the student');

-- ---------------------------------------------------------------------------
-- Closing: the studio asks, the student answers
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000272');
select is((public.support_request_close(tests.open_thread('00000000-0000-4000-b000-000000000273'))).status, 'closing',
  'the studio asks whether it is sorted');

select tests.login_as('00000000-0000-4000-b000-000000000273');
select lives_ok(format($$ select public.support_send(%s, 'One more thing') $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'the student writes again instead of answering');
select is((tests.thread(tests.open_thread('00000000-0000-4000-b000-000000000273'))).status, 'open', 'which keeps it open');
select is(tests.events(tests.open_thread('00000000-0000-4000-b000-000000000273')), array['close_asked', 'kept_open'],
  'both steps show in the conversation');
select ok((tests.thread(tests.open_thread('00000000-0000-4000-b000-000000000273'))).waiting_since is not null,
  'and the student waits for the studio again');

select tests.login_as('00000000-0000-4000-b000-000000000271');
select lives_ok(format($$ select public.support_request_close(%s) $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'the studio asks again');
select throws_ok(format($$ select public.support_answer_close(%s, true) $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'P0001', 'NOT_FOUND: no such conversation', 'only the student answers it');

select tests.logout();
create temp table closed_thread on commit drop as select tests.open_thread('00000000-0000-4000-b000-000000000273') as id;
grant select on closed_thread to authenticated;
select tests.login_as('00000000-0000-4000-b000-000000000273');
select is((public.support_answer_close((select id from closed_thread), true)).closed_by, 'customer', 'the student closes it');
select throws_ok(format($$ select public.support_send(%s, 'hello?') $$, (select id from closed_thread)), 'P0001',
  'INVALID_STATE: this conversation is closed; ask a new question', 'a closed conversation stays closed');
select ok((public.support_start('classes', 'A new question')).id <> (select id from closed_thread), 'a new question is a new conversation');
select is(tests.logs((select id from closed_thread)), array['claimed', 'handed_over', 'close_asked', 'close_asked', 'closed'],
  'asking and closing are logged, never the text');

-- ---------------------------------------------------------------------------
-- After hours
-- ---------------------------------------------------------------------------
select tests.hours('last_call');
select tests.login_as('00000000-0000-4000-b000-000000000274');
select throws_like($$ select public.support_start('booking', 'Late question') $$, 'SUPPORT_CLOSED: new conversations start from%',
  'from 21:45 no new conversation starts');
select tests.login_as('00000000-0000-4000-b000-000000000273');
select lives_ok(format($$ select public.support_send(%s, 'Still there?') $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'an open conversation goes on until 22:00');

select tests.hours('closed');
select throws_like(format($$ select public.support_send(%s, 'Hello?') $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'SUPPORT_CLOSED: the studio answers from%', 'at night the student cannot write');
select tests.login_as('00000000-0000-4000-b000-000000000271');
select throws_like(format($$ select public.support_send(%s, 'Late answer') $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'SUPPORT_CLOSED: the studio answers from%', 'nor can staff');
select throws_like(format($$ select public.support_request_close(%s) $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'SUPPORT_CLOSED: the studio answers from%', 'nor ask to close');
select throws_ok($$ select public.support_run() $$, '42501', null, 'the job is the server''s');

-- ---------------------------------------------------------------------------
-- The job: night notes (default hours, fixed day) and unanswered close requests
-- ---------------------------------------------------------------------------
select tests.logout();
update public.site_settings set support_opens = '08:00', support_last_start = '21:45', support_closes = '22:00' where id = 1;
update public.support_threads
   set last_message_at = (date '2026-01-05' + time '21:50') at time zone 'Asia/Ho_Chi_Minh'
 where id = tests.open_thread('00000000-0000-4000-b000-000000000273');
select public.support_run((date '2026-01-05' + time '22:01') at time zone 'Asia/Ho_Chi_Minh');
select is(tests.events(tests.open_thread('00000000-0000-4000-b000-000000000273')), array['paused'],
  'at closing time the conversation gets its night note');
select is((tests.thread(tests.open_thread('00000000-0000-4000-b000-000000000273'))).status, 'open', 'and stays open for the morning');
select public.support_run((date '2026-01-05' + time '22:06') at time zone 'Asia/Ho_Chi_Minh');
select public.support_run((date '2026-01-06' + time '07:30') at time zone 'Asia/Ho_Chi_Minh');
select is(tests.events(tests.open_thread('00000000-0000-4000-b000-000000000273')), array['paused'], 'once a night');
select tests.login_as('00000000-0000-4000-b000-000000000273');
select is((public.support_status() ->> 'unread')::int, 0, 'the night note is not an unread reply');

select tests.logout();
update public.support_threads
   set status = 'closing', close_asked_at = now() - interval '25 hours', waiting_since = null
 where id = tests.open_thread('00000000-0000-4000-b000-000000000275');
create temp table teacher_thread on commit drop as select tests.open_thread('00000000-0000-4000-b000-000000000275') as id;
select public.support_run(now());
select is((tests.thread((select id from teacher_thread))).closed_by, 'system', 'no answer in 24 hours: the conversation closes by itself');
select is(tests.events((select id from teacher_thread)), array['auto_closed'], 'with a note saying so');

-- ---------------------------------------------------------------------------
-- Photos and limits
-- ---------------------------------------------------------------------------
select tests.hours('open');
insert into storage.objects (bucket_id, name, owner)
values ('support-images', '00000000-0000-4000-b000-000000000273/transfer.webp', '00000000-0000-4000-b000-000000000273');

select tests.login_as('00000000-0000-4000-b000-000000000273');
select throws_ok(format($$ select public.support_send(%s, null, %L) $$, tests.open_thread('00000000-0000-4000-b000-000000000273'),
  '00000000-0000-4000-b000-000000000274/x.webp'), 'P0001',
  'INVALID_INPUT: the chat photo must be 00000000-0000-4000-b000-000000000273/<name>.{jpg|jpeg|png|webp}',
  'a photo comes from the person''s own folder');
select throws_ok(format($$ select public.support_send(%s, null, %L) $$, tests.open_thread('00000000-0000-4000-b000-000000000273'),
  '00000000-0000-4000-b000-000000000273/missing.webp'), 'P0001',
  'INVALID_INPUT: chat photo 00000000-0000-4000-b000-000000000273/missing.webp has not been uploaded', 'and is uploaded first');
select is((public.support_send(tests.open_thread('00000000-0000-4000-b000-000000000273'), null,
  '00000000-0000-4000-b000-000000000273/transfer.webp')).image_path, '00000000-0000-4000-b000-000000000273/transfer.webp',
  'a transfer screenshot is sent');
select is((select count(*) from storage.objects where bucket_id = 'support-images'
            and name = '00000000-0000-4000-b000-000000000273/transfer.webp'), 1::bigint, 'the student sees their photo');
select tests.login_as('00000000-0000-4000-b000-000000000274');
select is((select count(*) from storage.objects where bucket_id = 'support-images'
            and name = '00000000-0000-4000-b000-000000000273/transfer.webp'), 0::bigint, 'another student does not');
select tests.login_as('00000000-0000-4000-b000-000000000271');
select is((select count(*) from storage.objects where bucket_id = 'support-images'
            and name = '00000000-0000-4000-b000-000000000273/transfer.webp'), 1::bigint, 'staff do');

select tests.logout();
insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, body)
select tests.open_thread('00000000-0000-4000-b000-000000000273'), 'customer', '00000000-0000-4000-b000-000000000273', 'Chat Student A', 'spam ' || g
  from generate_series(1, 20) g;
select tests.login_as('00000000-0000-4000-b000-000000000273');
select throws_ok(format($$ select public.support_send(%s, 'and more') $$, tests.open_thread('00000000-0000-4000-b000-000000000273')),
  'P0001', 'RATE_LIMITED: too many messages; wait a few minutes', 'up to 20 messages in 10 minutes');

select tests.logout();
-- (CI's backend job may start the stack without Realtime: then there is no publication to join.)
select ok(not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
          or (select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
               and schemaname = 'public' and tablename in ('support_threads', 'support_messages')) = 2,
  'conversations reach open chat windows in real time');

select * from finish();
rollback;
