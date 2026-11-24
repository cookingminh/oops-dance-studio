-- A class's maximum number of students (api-contract §3 classes.max_students, §5 class_seats).
--
-- classes.max_students: null = no limit. A place counts from the day it is given until the student leaves
-- (class_students with leaves_after null or today on), so someone joining from the next course already holds one.
--   * class_seats(): every class still running that has a maximum, with its places taken and left — public, counts
--     only (the class cards say "3 places left" or "Class is full").
--   * class_join_request refuses a full class: 'INVALID_STATE: this class is full'.
--   * A new place in a full class is refused whatever adds it (staff in the class hub, a join request approved, a class
--     switch): 'INVALID_STATE: this class is full (20 of 20 places); raise its maximum to add more'. The class row is
--     locked while the places are counted, so two adds at once can't both take the last place.
--   * The maximum can't go below the places already taken: 'INVALID_INPUT: 12 students hold a place in this class; the
--     maximum can't be lower'.

alter table public.classes add column max_students integer check (max_students between 1 and 500);
comment on column public.classes.max_students is
  'The most students the class takes at once (places held: class_students not left yet); null = no limit.';

-- Places held in a class today: students in it, or joining later, who haven't left.
create function private.class_places_taken(p_class bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.class_students s
   where s.class_id = p_class and (s.leaves_after is null or s.leaves_after >= public.studio_today());
$$;

-- Anyone (the class cards, signed in or not): [{ class_id, max_students, taken, seats_left }] for every class still
-- running (or not started) that has a maximum. Classes without one aren't listed: they always have room.
create function public.class_seats()
returns table (class_id bigint, max_students integer, taken integer, seats_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.max_students, x.taken, greatest(c.max_students - x.taken, 0)
    from public.classes c
    cross join lateral (select private.class_places_taken(c.id) as taken) x
   where c.max_students is not null
     and (c.ended_on is null or c.ended_on >= public.studio_today())
   order by c.id;
$$;

-- A new place (an insert, or a student who had left coming back) in a full class is refused.
create function private.guard_class_full()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_taken integer;
  v_today date := public.studio_today();
begin
  -- Not a new place: an update that keeps the student in, or one taking them out.
  if tg_op = 'UPDATE' and ((old.leaves_after is null or old.leaves_after >= v_today)
                           or (new.leaves_after is not null and new.leaves_after < v_today)) then
    return new;
  end if;
  -- Locked: two adds at once wait for each other, so both can't take the last place.
  select c.max_students into v_max from public.classes c where c.id = new.class_id for update;
  if v_max is null then
    return new;
  end if;
  -- Already holding a place (an insert that will hit its row and do nothing).
  if tg_op = 'INSERT' and exists (select 1 from public.class_students s
                                   where s.class_id = new.class_id and s.student_id = new.student_id) then
    return new;
  end if;
  v_taken := private.class_places_taken(new.class_id);
  if v_taken >= v_max then
    raise exception 'INVALID_STATE: this class is full (% of % places); raise its maximum to add more', v_taken, v_max;
  end if;
  return new;
end;
$$;

create trigger guard_class_full before insert or update of leaves_after on public.class_students
  for each row execute function private.guard_class_full();

-- The maximum never goes below the places already held.
create function private.guard_class_max()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken integer;
begin
  if new.max_students is null or new.max_students is not distinct from old.max_students then
    return new;
  end if;
  v_taken := private.class_places_taken(new.id);
  if new.max_students < v_taken then
    raise exception 'INVALID_INPUT: % students hold a place in this class; the maximum can''t be lower', v_taken;
  end if;
  return new;
end;
$$;

create trigger guard_class_max before update of max_students on public.classes
  for each row execute function private.guard_class_max();

-- Student: ask to join a class — as before (20261117002500_class_join_requests), and a full class says so.
create or replace function public.class_join_request(p_class_id bigint, p_start text default 'now', p_note text default null)
returns public.class_join_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_today date := public.studio_today();
  v_ended date;
  v_max integer;
  v_note text := nullif(btrim(p_note), '');
  r public.class_join_requests;
begin
  if (select p.role from public.profiles p where p.id = v_me) is distinct from 'guest' then
    raise exception 'FORBIDDEN: only students can ask to join a class';
  end if;
  select c.ended_on, c.max_students into v_ended, v_max from public.classes c where c.id = p_class_id;
  if not found then
    raise exception 'NOT_FOUND: class';
  end if;
  if v_ended is not null then
    raise exception 'INVALID_STATE: this class is not taking new students';
  end if;
  if p_start is null or p_start not in ('now', 'next') then
    raise exception 'INVALID_INPUT: start must be now or next';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'INVALID_INPUT: the note is up to 500 characters';
  end if;

  -- One student's requests one at a time, so two quick clicks can't both pass the checks below.
  perform pg_advisory_xact_lock(hashtextextended('oops.join:' || v_me::text, 0));
  if exists (select 1 from public.class_students cs
              where cs.class_id = p_class_id and cs.student_id = v_me
                and (cs.leaves_after is null or cs.leaves_after >= v_today)) then
    raise exception 'INVALID_STATE: already in this class';
  end if;
  if exists (select 1 from public.class_join_requests q
              where q.class_id = p_class_id and q.student_id = v_me and q.status = 'pending') then
    raise exception 'INVALID_STATE: already asked to join this class';
  end if;
  if (select count(*) from public.class_join_requests q where q.student_id = v_me and q.status = 'pending') >= 3 then
    raise exception 'INVALID_STATE: too many open requests';
  end if;
  if v_max is not null and private.class_places_taken(p_class_id) >= v_max then
    raise exception 'INVALID_STATE: this class is full';
  end if;

  insert into public.class_join_requests (class_id, student_id, start_pref, note)
  values (p_class_id, v_me, p_start, v_note)
  returning * into r;
  perform private.join_log(r, 'join_requested', jsonb_build_object('start', r.start_pref, 'note', r.note));
  return r;
end;
$$;

revoke execute on function private.class_places_taken(bigint), private.guard_class_full(), private.guard_class_max()
  from public, anon, authenticated;
revoke execute on function public.class_seats() from public;
grant execute on function public.class_seats() to anon, authenticated;
