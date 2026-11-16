-- Chat: who is helping (api-contract §3 / §5 Support chat, migration 20261117002000_support_chat_joined.sql):
--   * the person sees staff by first name only ("Lê Hoàng Nam" → "Nam"), never the full name
--   * taking the conversation (Take it, answering first, asking to close, a hand-over) adds a 'joined' note,
--     which isn't unread and isn't the Inbox's last message
--   * support_status: reply_minutes (the countdown while nobody has it), waiting_since and assigned_name
-- Independent of the time of day: the hours are set to "open all day" inside the test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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
create function tests.open_thread(p_customer uuid) returns bigint language sql stable security definer as $$
  select id from public.support_threads where customer_id = p_customer and status <> 'closed';
$$;
create function tests.notes(p_thread bigint) returns text[] language sql stable security definer as $$
  select coalesce(array_agg(coalesce(event, sender_kind) || ':' || coalesce(sender_name, '') order by id), '{}')
    from public.support_messages where thread_id = p_thread;
$$;
create function tests.read_a_minute_ago(p_thread bigint) returns void language sql security definer as $$
  update public.support_threads set customer_read_at = now() - interval '1 minute' where id = p_thread;
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000281', 'joined-nam@test.local', 'staff', 'Lê Hoàng Nam');
select tests.create_user('00000000-0000-4000-b000-000000000282', 'joined-ha@test.local', 'admin', 'Trần Thị Thu Hà');
select tests.create_user('00000000-0000-4000-b000-000000000283', 'joined-a@test.local', 'guest', 'Joined Student A');
select tests.create_user('00000000-0000-4000-b000-000000000284', 'joined-b@test.local', 'guest', 'Joined Student B');
select tests.create_user('00000000-0000-4000-b000-000000000285', 'joined-solo@test.local', 'staff', 'Soleck');
update public.site_settings set support_opens = '00:00', support_last_start = '24:00', support_closes = '24:00' where id = 1;

-- ---------------------------------------------------------------------------
-- First names
-- ---------------------------------------------------------------------------
select is(private.first_name('00000000-0000-4000-b000-000000000281'), 'Nam', 'a full name gives its last word');
select is(private.first_name('00000000-0000-4000-b000-000000000282'), 'Hà', 'however long it is');
select is(private.first_name('00000000-0000-4000-b000-000000000285'), 'Soleck', 'a one-word name stays as it is');

-- ---------------------------------------------------------------------------
-- Nobody has it yet: the countdown
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000283');
select lives_ok($$ select public.support_start('tuition', 'Is my transfer through?') $$, 'a student asks');
select is((public.support_status() ->> 'reply_minutes')::int, 5, 'the bubble promises an answer within 5 minutes');
select ok((public.support_status() -> 'thread' ->> 'waiting_since') is not null, 'counting from when the student asked');
select ok((public.support_status() -> 'thread' -> 'assigned_name') = 'null'::jsonb, 'nobody has it yet');

-- ---------------------------------------------------------------------------
-- Answering first: "Nam has joined the chat", then the reply, by first name
-- ---------------------------------------------------------------------------
select tests.read_a_minute_ago(tests.open_thread('00000000-0000-4000-b000-000000000283'));
select tests.login_as('00000000-0000-4000-b000-000000000281');
select is((public.support_send(tests.open_thread('00000000-0000-4000-b000-000000000283'), 'Checking now')).sender_name, 'Nam',
  'a staff reply carries their first name');
select is(tests.notes(tests.open_thread('00000000-0000-4000-b000-000000000283')),
  array['customer:Joined Student A', 'joined:Nam', 'staff:Nam'], 'Nam joined the chat before the reply');
select is((select last_event from public.support_inbox('answered') where id = tests.open_thread('00000000-0000-4000-b000-000000000283')),
  null, 'the Inbox shows the reply as the last message, not who joined');
select is((select assigned_name from public.support_inbox('answered') where id = tests.open_thread('00000000-0000-4000-b000-000000000283')),
  'Lê Hoàng Nam', 'staff still see each other''s full names');

select tests.login_as('00000000-0000-4000-b000-000000000283');
select is((public.support_status() -> 'thread' ->> 'assigned_name'), 'Nam', 'the student sees who is helping, by first name');
select is((public.support_status() ->> 'unread')::int, 1, 'the reply is unread, who joined isn''t');
select is((select count(*) from public.support_messages where sender_name = 'Lê Hoàng Nam'), 0::bigint,
  'the student never receives a staff member''s full name');

-- ---------------------------------------------------------------------------
-- Handing over and taking it
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000281');
select is((public.support_claim(tests.open_thread('00000000-0000-4000-b000-000000000283'), '00000000-0000-4000-b000-000000000282')).assigned_name,
  'Hà', 'handed to the admin: she is the one helping');
select is((tests.notes(tests.open_thread('00000000-0000-4000-b000-000000000283')))[4], 'joined:Hà', 'and she joined the chat');
select lives_ok(format($$ select public.support_claim(%s, %L) $$, tests.open_thread('00000000-0000-4000-b000-000000000283'),
  '00000000-0000-4000-b000-000000000282'), 'handing it to the one who has it changes nothing');
select is(array_length(tests.notes(tests.open_thread('00000000-0000-4000-b000-000000000283')), 1), 4, 'so nobody joins twice');

select tests.login_as('00000000-0000-4000-b000-000000000284');
select lives_ok($$ select public.support_start('booking', 'Can I move my booking?') $$, 'another student asks');
select tests.login_as('00000000-0000-4000-b000-000000000285');
select is((public.support_claim(tests.open_thread('00000000-0000-4000-b000-000000000284'))).assigned_name, 'Soleck',
  '"Take it": Soleck has it before writing anything');

-- Asking to close a conversation nobody had: the one asking joins first.
select tests.logout();
update public.support_threads set assigned_to = null, assigned_name = null
 where id = tests.open_thread('00000000-0000-4000-b000-000000000284');
select tests.login_as('00000000-0000-4000-b000-000000000281');
select lives_ok(format($$ select public.support_request_close(%s) $$, tests.open_thread('00000000-0000-4000-b000-000000000284')),
  'staff ask to close a conversation nobody has');
select is((tests.notes(tests.open_thread('00000000-0000-4000-b000-000000000284')))[3:4], array['joined:Nam', 'close_asked:Nam'],
  'Nam joins, then asks');

select * from finish();
rollback;
