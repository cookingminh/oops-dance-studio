-- Chat: who is helping, and how long until someone does (api-contract §3 / §5 Support chat).
--
--   * The person sees staff by their first name only: the last word of the full name ("Lê Hoàng Nam" → "Nam";
--     a one-word name stays as it is; no name → the username). Staff messages and notes store it as sender_name,
--     and support_threads.assigned_name is the helper's. Full names stay on the staff side (Inbox, Activity).
--   * Taking a conversation — "Take it", answering it first, asking to close it, being handed it — adds a
--     'joined' note ("Nam has joined the chat"). It isn't counted as unread, nor shown as the Inbox's last message.
--   * site_settings.support_reply_minutes (default 5): while nobody has taken the conversation, the bubble counts
--     down from waiting_since to "usually within 5 minutes". support_status returns it, with the open
--     conversation's waiting_since and assigned_name.

alter table public.site_settings
  add column support_reply_minutes smallint not null default 5 check (support_reply_minutes between 1 and 120);

alter table public.support_threads add column assigned_name text;

alter table public.support_messages
  drop constraint support_messages_event_check,
  add constraint support_messages_event_check
    check (event in ('close_asked', 'kept_open', 'closed', 'auto_closed', 'paused', 'joined'));

-- "Lê Hoàng Nam" → "Nam".
create function private.first_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(regexp_replace(btrim(p.full_name), '^.*\s', ''), ''), p.username, '')
    from public.profiles p where p.id = p_id;
$$;

-- The name a message carries: staff and admins by first name, the person who asks by their full name.
create function private.support_sender_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.role in ('admin', 'staff') then private.first_name(p.id) else private.person_name(p.id) end
    from public.profiles p where p.id = p_id;
$$;

-- What's already there: first names on the staff side.
update public.support_threads set assigned_name = private.first_name(assigned_to) where assigned_to is not null;
update public.support_messages m
   set sender_name = private.first_name(m.sender_id)
 where m.sender_kind in ('staff', 'system')
   and exists (select 1 from public.profiles p where p.id = m.sender_id and p.role in ('admin', 'staff'));

create or replace function private.support_note(p_thread bigint, p_event text, p_by uuid default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, event)
  values (p_thread, 'system', p_by, case when p_by is not null then private.support_sender_name(p_by) end, p_event);
$$;

-- p_staff takes the conversation: their first name for the person, and a 'joined' note.
create function private.support_assign(p_thread bigint, p_staff uuid)
returns public.support_threads
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.support_threads;
begin
  perform private.support_note(p_thread, 'joined', p_staff);
  update public.support_threads
     set assigned_to = p_staff, assigned_name = private.first_name(p_staff)
   where id = p_thread
  returning * into t;
  return t;
end;
$$;

-- Not unread: the night notes, and who joined.
create or replace function private.support_unread_for_customer(p_thread bigint, p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.support_messages m
   where m.thread_id = p_thread and m.created_at > p_since
     and (m.sender_kind in ('staff', 'ai') or m.event in ('close_asked', 'auto_closed'));
$$;

create or replace function public.support_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'phase',         private.support_phase(now()),
           'opens',         to_char(s.support_opens, 'HH24:MI'),
           'last_start',    to_char(s.support_last_start, 'HH24:MI'),
           'closes',        to_char(s.support_closes, 'HH24:MI'),
           'reply_minutes', s.support_reply_minutes,
           'now',           now(),
           'thread',        (select jsonb_build_object('id', t.id, 'status', t.status, 'category', t.category,
                                                       'waiting_since', t.waiting_since, 'assigned_name', t.assigned_name)
                               from public.support_threads t
                              where t.customer_id = auth.uid() and t.status <> 'closed'),
           'unread',        case when auth.uid() is not null then
                              (select coalesce(sum(private.support_unread_for_customer(t.id, t.customer_read_at)), 0)::integer
                                 from public.support_threads t where t.customer_id = auth.uid())
                            end)
    from public.site_settings s where s.id = 1;
$$;

create or replace function public.support_send(p_thread bigint, p_body text, p_image_path text default null)
returns public.support_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := private.support_body(p_body);
  t public.support_threads;
  m public.support_messages;
  v_customer boolean;
begin
  select * into t from public.support_threads where id = p_thread for update;
  if not found or v_uid is null or not (t.customer_id = v_uid or public.is_staff()) then
    raise exception 'NOT_FOUND: no such conversation';
  end if;
  v_customer := t.customer_id = v_uid;
  if t.status = 'closed' then
    raise exception 'INVALID_STATE: this conversation is closed; ask a new question';
  end if;
  if private.support_phase(now()) = 'closed' then
    raise exception 'SUPPORT_CLOSED: %', private.support_hours_text('answer');
  end if;
  if v_body is null and p_image_path is null then
    raise exception 'INVALID_INPUT: write a message';
  end if;

  if v_customer then
    perform private.support_rate_check(v_uid);
    if t.status = 'closing' then
      perform private.support_note(t.id, 'kept_open', v_uid);
    end if;
  elsif t.assigned_to is null then
    -- The first staff member to answer takes it ("… has joined the chat" comes before the reply).
    t := private.support_assign(t.id, v_uid);
    perform private.support_log(t, 'claimed', jsonb_build_object('auto', true, 'to', private.person_name(v_uid)));
  end if;

  insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, body, image_path)
  values (t.id, case when v_customer then 'customer' else 'staff' end, v_uid, private.support_sender_name(v_uid), v_body,
          private.support_image(t.customer_id, p_image_path))
  returning * into m;

  if v_customer then
    update public.support_threads
       set status = 'open', close_asked_at = null, close_asked_by = null,
           waiting_since = coalesce(waiting_since, now()), last_message_at = now(), customer_read_at = now()
     where id = t.id;
  else
    update public.support_threads
       set waiting_since = null, last_message_at = now(), staff_read_at = now()
     where id = t.id;
  end if;
  return m;
end;
$$;

create or replace function public.support_claim(p_thread bigint, p_staff uuid default null)
returns public.support_threads
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_to uuid := coalesce(p_staff, auth.uid());
  v_from uuid;
  t public.support_threads;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only admins and staff take conversations';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_to and p.role in ('admin', 'staff')) then
    raise exception 'INVALID_INPUT: hand the conversation to a staff member or an admin';
  end if;
  select * into t from public.support_threads where id = p_thread for update;
  if not found then
    raise exception 'NOT_FOUND: no such conversation';
  end if;
  if t.status = 'closed' then
    raise exception 'INVALID_STATE: this conversation is closed';
  end if;
  if t.assigned_to = v_to then
    return t;
  end if;
  v_from := t.assigned_to;
  t := private.support_assign(t.id, v_to);
  perform private.support_log(t, case when v_to = auth.uid() then 'claimed' else 'handed_over' end,
                              jsonb_build_object('to', private.person_name(v_to), 'from', private.person_name(v_from)));
  return t;
end;
$$;

create or replace function public.support_request_close(p_thread bigint)
returns public.support_threads
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.support_threads;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only admins and staff close conversations';
  end if;
  select * into t from public.support_threads where id = p_thread for update;
  if not found then
    raise exception 'NOT_FOUND: no such conversation';
  end if;
  if t.status = 'closing' then
    return t;
  end if;
  if t.status <> 'open' then
    raise exception 'INVALID_STATE: this conversation is closed';
  end if;
  if private.support_phase(now()) = 'closed' then
    raise exception 'SUPPORT_CLOSED: %', private.support_hours_text('answer');
  end if;

  if t.assigned_to is null then
    t := private.support_assign(t.id, auth.uid());
    perform private.support_log(t, 'claimed', jsonb_build_object('auto', true, 'to', private.person_name(auth.uid())));
  end if;
  perform private.support_note(t.id, 'close_asked', auth.uid());
  update public.support_threads
     set status = 'closing', close_asked_at = now(), close_asked_by = auth.uid(), waiting_since = null,
         last_message_at = now(), staff_read_at = now()
   where id = t.id
  returning * into t;
  perform private.support_log(t, 'close_asked');
  return t;
end;
$$;

-- The Inbox: as before, but who joined isn't "the last message".
create or replace function public.support_inbox(p_tab text default 'waiting', p_category text default null)
returns table (id bigint, customer_id uuid, customer_name text, customer_role public.app_role, customer_avatar text,
               category text, status text, assigned_to uuid, assigned_name text, waiting_since timestamptz,
               last_message_at timestamptz, created_at timestamptz, closed_at timestamptz, closed_by text,
               opened_from text, unread integer, last_sender_kind text, last_body text, last_event text,
               last_has_image boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: only admins and staff read the Inbox';
  end if;
  if p_tab is null or p_tab not in ('waiting', 'answered', 'closed') then
    raise exception 'INVALID_INPUT: the Inbox tab is waiting, answered or closed';
  end if;
  return query
  select t.id, t.customer_id, private.person_name(t.customer_id), p.role, p.avatar_path,
         t.category, t.status, t.assigned_to, private.person_name(t.assigned_to), t.waiting_since,
         t.last_message_at, t.created_at, t.closed_at, t.closed_by, t.opened_from,
         private.support_unread_for_staff(t.id, t.staff_read_at),
         l.sender_kind, l.body, l.event, l.image_path is not null
    from public.support_threads t
    join public.profiles p on p.id = t.customer_id
    left join lateral (select m.sender_kind, m.body, m.event, m.image_path from public.support_messages m
                        where m.thread_id = t.id and coalesce(m.event, '') not in ('paused', 'joined')
                        order by m.id desc limit 1) l on true
   where (p_category is null or t.category = p_category)
     and case p_tab
           when 'waiting'  then t.status <> 'closed' and t.waiting_since is not null
           when 'answered' then t.status <> 'closed' and t.waiting_since is null
           else t.status = 'closed'
         end
   order by case when p_tab = 'waiting' then t.waiting_since end asc,
            case when p_tab = 'answered' then t.last_message_at end desc,
            case when p_tab = 'closed' then t.closed_at end desc
   limit case when p_tab = 'closed' then 100 else 500 end;
end;
$$;

-- Demo: the same four conversations, with who joined and staff by first name.
create or replace function public.seed_demo_support()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tz text := 'Asia/Ho_Chi_Minh';
  v_local timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  v_closes time := (select s.support_closes from public.site_settings s where s.id = 1);
  v_base timestamptz;   -- "now" for the story: now during hours, else a quarter of an hour before the last closing
  v_staff uuid := (select id from public.profiles where email = 'staff@demo.oopsdance.test');
  v_nam text;
  v_vy uuid := (select id from public.profiles where email = 'guest@demo.oopsdance.test');
  v_bao uuid := (select id from public.profiles where email = 'guest02@demo.oopsdance.test');
  v_linh uuid := (select id from public.profiles where email = 'guest03@demo.oopsdance.test');
  v_trinh uuid := (select id from public.profiles where email = 'instructor3@demo.oopsdance.test');
  v_thread bigint;
  v_count integer := 0;
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo conversations are only seeded on a sandbox';
  end if;
  delete from public.support_threads where true;  -- (PostgREST's safeupdate wants a WHERE)
  v_nam := private.first_name(v_staff);
  v_base := case when private.support_phase(now()) <> 'closed' then now() - interval '2 minutes'
                 else ((v_local::date - case when v_local::time >= v_closes then 0 else 1 end) + v_closes) at time zone v_tz
                      - interval '15 minutes' end;

  -- A student waits about a transfer; nobody has taken it yet (the bubble counts down).
  if v_vy is not null then
    insert into public.support_threads (customer_id, category, opened_from, created_at, last_message_at, waiting_since, customer_read_at)
    values (v_vy, 'tuition', '/profile/tuition', v_base - interval '25 minutes', v_base - interval '24 minutes',
            v_base - interval '25 minutes', v_base - interval '24 minutes')
    returning id into v_thread;
    insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, body, created_at) values
      (v_thread, 'customer', v_vy, private.person_name(v_vy),
       'Chị ơi em chuyển khoản học phí khoá này từ tối qua rồi mà trang Học phí vẫn báo chưa đóng ạ.', v_base - interval '25 minutes'),
      (v_thread, 'customer', v_vy, private.person_name(v_vy),
       'Nội dung chuyển khoản em ghi tên em với tên lớp, không ghi mã ạ.', v_base - interval '24 minutes');
    v_count := v_count + 1;
  end if;

  -- A guest's booking question, answered; the studio asked whether it is sorted.
  if v_bao is not null then
    insert into public.support_threads (customer_id, category, opened_from, assigned_to, assigned_name, status, created_at,
                                        last_message_at, close_asked_at, close_asked_by, customer_read_at, staff_read_at)
    values (v_bao, 'booking', '/profile/bookings', v_staff, v_nam, 'closing', v_base - interval '3 hours',
            v_base - interval '2 hours 40 minutes', v_base - interval '2 hours 40 minutes', v_staff,
            v_base - interval '2 hours 50 minutes', v_base - interval '2 hours 40 minutes')
    returning id into v_thread;
    insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, body, event, created_at) values
      (v_thread, 'customer', v_bao, private.person_name(v_bao),
       'Mình muốn đổi lượt đặt phòng cuối tuần từ 14:00 sang 16:00 được không ạ?', null, v_base - interval '3 hours'),
      (v_thread, 'system', v_staff, v_nam, null, 'joined', v_base - interval '2 hours 52 minutes'),
      (v_thread, 'staff', v_staff, v_nam,
       'Chào Bảo, khung 16:00–18:00 hôm đó còn trống, mình đổi giúp bạn rồi nhé. Tiền phòng giữ nguyên.', null, v_base - interval '2 hours 50 minutes'),
      (v_thread, 'customer', v_bao, private.person_name(v_bao), 'Dạ cảm ơn ạ!', null, v_base - interval '2 hours 45 minutes'),
      (v_thread, 'system', v_staff, v_nam, null, 'close_asked', v_base - interval '2 hours 40 minutes');
    v_count := v_count + 1;
  end if;

  -- Yesterday: a make-up question, answered and closed by the student.
  if v_linh is not null then
    insert into public.support_threads (customer_id, category, opened_from, assigned_to, assigned_name, status, created_at,
                                        last_message_at, close_asked_at, close_asked_by, closed_at, closed_by,
                                        customer_read_at, staff_read_at)
    values (v_linh, 'absence', '/profile/classes', v_staff, v_nam, 'closed', v_base - interval '1 day 2 hours',
            v_base - interval '1 day 1 hour', v_base - interval '1 day 1 hour 20 minutes', v_staff,
            v_base - interval '1 day 1 hour', 'customer', v_base - interval '1 day 1 hour', v_base - interval '1 day 1 hour')
    returning id into v_thread;
    insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, body, event, created_at) values
      (v_thread, 'customer', v_linh, private.person_name(v_linh),
       'Buổi nghỉ hôm thứ Tư của lớp em có được học bù không ạ?', null, v_base - interval '1 day 2 hours'),
      (v_thread, 'system', v_staff, v_nam, null, 'joined', v_base - interval '1 day 1 hour 33 minutes'),
      (v_thread, 'staff', v_staff, v_nam,
       'Có em nhé, lớp học bù vào thứ Sáu tuần này, cùng giờ. Lịch mới đã hiện ở trang Lớp của tôi.', null, v_base - interval '1 day 1 hour 30 minutes'),
      (v_thread, 'system', v_staff, v_nam, null, 'close_asked', v_base - interval '1 day 1 hour 20 minutes'),
      (v_thread, 'system', v_linh, private.person_name(v_linh), null, 'closed', v_base - interval '1 day 1 hour');
    v_count := v_count + 1;
  end if;

  -- An instructor's check-out question, answered; waiting for her.
  if v_trinh is not null then
    insert into public.support_threads (customer_id, category, opened_from, assigned_to, assigned_name, created_at,
                                        last_message_at, customer_read_at, staff_read_at)
    values (v_trinh, 'checkin', '/profile/check-in', v_staff, v_nam, v_base - interval '1 hour 10 minutes',
            v_base - interval '55 minutes', v_base - interval '1 hour 10 minutes', v_base - interval '55 minutes')
    returning id into v_thread;
    insert into public.support_messages (thread_id, sender_kind, sender_id, sender_name, body, event, created_at) values
      (v_thread, 'customer', v_trinh, private.person_name(v_trinh),
       'Hôm qua mình check-out quên chụp ảnh, buổi đó có bị tính muộn không?', null, v_base - interval '1 hour 10 minutes'),
      (v_thread, 'system', v_staff, v_nam, null, 'joined', v_base - interval '57 minutes'),
      (v_thread, 'staff', v_staff, v_nam,
       'Không sao chị ạ, em sửa giờ check-out giúp chị rồi. Buổi đó tính đủ nhé.', null, v_base - interval '55 minutes');
    v_count := v_count + 1;
  end if;

  return v_count;
end;
$$;

revoke execute on function private.first_name(uuid), private.support_sender_name(uuid), private.support_assign(bigint, uuid)
  from public, anon, authenticated;
