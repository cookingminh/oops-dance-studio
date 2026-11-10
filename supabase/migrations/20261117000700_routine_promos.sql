-- =============================================================================
-- Routine promos — api-contract §3 "class_lessons" (promo_*), §5 lesson_set_promo, §7 class-promos
--
--   Before a class starts its next routine, its instructor films a short clip (the promo): a bit of
--   the piece and a word from the teacher, so students know what they'd learn if they continue and
--   visitors see what's coming. A promo is either
--     - an uploaded clip in the public class-promos bucket at {class_id}/{lesson_id}/{name}.{mp4|mov|webm},
--       its poster frame next to it as .jpg/.webp (promo_path, promo_poster_path), or
--     - a YouTube link (promo_url): a Short or any video, same rule as class_lessons.video_url.
--   * The class's instructor or staff set it; lesson_set_promo() attaches it (or takes it off) and
--     returns the files nothing points at any more, for the app to delete through the Storage API
--     (SQL can't delete storage objects).
--   * A class keeps the promos of its running and upcoming routines only: attaching one also clears
--     the promos of the class's finished routines, and their files come back in the same list.
--   * The activity log records promo_added / promo_changed / promo_removed / promo_caption.
--   * A YouTube link must be public or unlisted (YouTube won't play a private one on the site).
-- =============================================================================

alter table public.class_lessons
  add column promo_path        text,
  add column promo_poster_path text,
  add column promo_url         text,
  add column promo_caption     text,
  add column promo_seconds     smallint,
  add column promo_by          uuid references public.profiles (id) on delete set null,
  add column promo_at          timestamptz,
  add constraint class_lessons_promo_path check (
    promo_path is null
    or promo_path ~ ('^' || class_id || '/' || id || '/[A-Za-z0-9-]{1,64}\.(mp4|mov|webm)$')),
  add constraint class_lessons_promo_poster check (
    promo_poster_path is null
    or (promo_path is not null
        and promo_poster_path ~ ('^' || class_id || '/' || id || '/[A-Za-z0-9-]{1,64}\.(jpg|webp)$'))),
  add constraint class_lessons_promo_url_youtube check (
    promo_url is null
    or promo_url ~ '^https://(www\.|m\.)?(youtube\.com/(watch\?(.*&)?v=|shorts/|embed/|live/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#/].*)?$'),
  add constraint class_lessons_promo_one check (promo_path is null or promo_url is null),
  add constraint class_lessons_promo_caption check (promo_caption is null or char_length(promo_caption) between 1 and 200),
  add constraint class_lessons_promo_seconds check (promo_seconds is null or promo_seconds between 1 and 180),
  add constraint class_lessons_promo_alone check (
    promo_path is not null or promo_url is not null
    or (promo_caption is null and promo_seconds is null and promo_by is null and promo_at is null));

create index class_lessons_promo_idx on public.class_lessons (starts_on) where promo_path is not null or promo_url is not null;

-- -----------------------------------------------------------------------------
-- Storage: public bucket, written by the class's instructor or staff
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-promos', 'class-promos', true, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- {class_id}/{lesson_id}/{name}.{ext}: the routine is that class's, and the caller teaches the class or is staff.
create function private.can_write_class_promo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := regexp_match(coalesce(p_name, ''), '^([0-9]{1,18})/([0-9]{1,18})/[A-Za-z0-9-]{1,64}\.(mp4|mov|webm|jpg|webp)$');
begin
  if v_parts is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
      from public.class_lessons l
      join public.classes c on c.id = l.class_id
     where l.id = v_parts[2]::bigint
       and l.class_id = v_parts[1]::bigint
       and (public.is_staff() or c.instructor_id = auth.uid()));
end;
$$;
revoke execute on function private.can_write_class_promo(text) from public, anon;
grant execute on function private.can_write_class_promo(text) to authenticated;

-- Reading goes through public URLs; select is for upsert and remove (the Storage API needs both).
create policy oops_promos_select on storage.objects
  for select to authenticated using (bucket_id = 'class-promos' and private.can_write_class_promo(name));
create policy oops_promos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'class-promos' and private.can_write_class_promo(name));
create policy oops_promos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'class-promos' and private.can_write_class_promo(name))
  with check (bucket_id = 'class-promos' and private.can_write_class_promo(name));
create policy oops_promos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'class-promos' and private.can_write_class_promo(name));

-- -----------------------------------------------------------------------------
-- Attaching a promo
-- -----------------------------------------------------------------------------
create function private.log_promo(l public.class_lessons, p_action text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_id, actor_name, actor_role, area, action, entity, entity_id, class_id, label, meta)
  select auth.uid(), private.person_name(auth.uid()), (select p.role from public.profiles p where p.id = auth.uid()),
         'routines', p_action, 'class_lessons', l.id::text, l.class_id, l.title,
         jsonb_strip_nulls(jsonb_build_object('class', private.class_name(l.class_id), 'starts_on', l.starts_on,
                                              'seconds', l.promo_seconds, 'caption', l.promo_caption,
                                              'youtube', l.promo_url));
$$;
revoke execute on function private.log_promo(public.class_lessons, text) from public, anon, authenticated;

-- Set the promo of routine p_lesson: the uploaded clip p_path (with its poster p_poster and length
-- p_seconds), or the YouTube link p_url — one of them. Both null takes the promo off. p_caption is the
-- line for students (≤ 200 characters, '' = none). The same clip or link as now = only the caption
-- changes (a null p_poster / p_seconds then keeps what is there).
-- Returns the storage paths (bucket class-promos) nothing points at any more: the replaced clip and
-- poster, and the promos of the class's finished routines.
create function public.lesson_set_promo(p_lesson bigint, p_path text default null, p_poster text default null,
                                        p_caption text default null, p_seconds integer default null,
                                        p_url text default null)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v         public.class_lessons;
  v_prefix  text;
  v_url     text := nullif(btrim(p_url), '');
  v_same    boolean;
  v_caption text := left(nullif(btrim(p_caption), ''), 200);
  v_poster  text := p_poster;
  v_seconds smallint;
  v_action  text;
  v_gone    text[] := '{}'::text[];
  v_running date;
begin
  select * into v from public.class_lessons l where l.id = p_lesson for update;
  if not found then
    raise exception 'NOT_FOUND: routine % does not exist', p_lesson;
  end if;
  if not (public.is_staff() or private.is_service_context()
          or exists (select 1 from public.classes c where c.id = v.class_id and c.instructor_id = auth.uid())) then
    raise exception 'FORBIDDEN: only the class''s instructor or staff can change its promo';
  end if;
  if p_path is not null and v_url is not null then
    raise exception 'INVALID_INPUT: a promo is an uploaded clip or a YouTube link, not both';
  end if;

  perform set_config('oops.activity', 'off', true); -- logged below as promo_*, not as a routine edit

  if p_path is null and v_url is null then
    if v.promo_path is not null or v.promo_url is not null then
      v_gone := array_remove(array[v.promo_path, v.promo_poster_path], null);
      update public.class_lessons l
         set promo_path = null, promo_poster_path = null, promo_url = null, promo_caption = null,
             promo_seconds = null, promo_by = null, promo_at = null
       where l.id = v.id;
      perform private.log_promo(v, 'promo_removed');
    end if;
    perform set_config('oops.activity', '', true);
    return v_gone;
  end if;

  v_same := coalesce(p_path = v.promo_path, v_url = v.promo_url, false);
  if v_same then
    v_poster := coalesce(p_poster, v.promo_poster_path);
    v_seconds := coalesce(p_seconds, v.promo_seconds);
  else
    v_seconds := p_seconds;
  end if;
  if v_seconds is not null and v_seconds not between 1 and 180 then
    raise exception 'INVALID_INPUT: a promo is 1 to 180 seconds long';
  end if;

  if v_url is not null then
    if v_url !~ '^https://(www\.|m\.)?(youtube\.com/(watch\?(.*&)?v=|shorts/|embed/|live/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#/].*)?$' then
      raise exception 'INVALID_INPUT: a promo link is a YouTube video or Short';
    end if;
    v_poster := null; -- YouTube has the picture
  else
    v_prefix := v.class_id || '/' || v.id || '/';
    if p_path !~ ('^' || v_prefix || '[A-Za-z0-9-]{1,64}\.(mp4|mov|webm)$')
       or (v_poster is not null and v_poster !~ ('^' || v_prefix || '[A-Za-z0-9-]{1,64}\.(jpg|webp)$')) then
      raise exception 'INVALID_INPUT: a promo of this routine is stored under %', v_prefix;
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'class-promos' and o.name = p_path)
       or (v_poster is not null
           and not exists (select 1 from storage.objects o where o.bucket_id = 'class-promos' and o.name = v_poster)) then
      raise exception 'INVALID_INPUT: upload the clip before attaching it';
    end if;
  end if;

  if not v_same then
    v_action := case when v.promo_path is null and v.promo_url is null then 'promo_added' else 'promo_changed' end;
  elsif v_caption is distinct from v.promo_caption then
    v_action := 'promo_caption';
  end if;
  v_gone := array_remove(array[
    case when v.promo_path is distinct from p_path then v.promo_path end,
    case when v.promo_poster_path is distinct from v_poster then v.promo_poster_path end], null);

  update public.class_lessons l
     set promo_path = p_path, promo_poster_path = v_poster, promo_url = v_url, promo_caption = v_caption,
         promo_seconds = v_seconds,
         promo_by = case when v_same then v.promo_by else auth.uid() end,
         promo_at = case when v_same then v.promo_at else now() end
   where l.id = v.id
  returning * into v;

  -- The class's finished routines (started before the one it is on now) give their promos up.
  select max(l.starts_on) into v_running
    from public.class_lessons l
   where l.class_id = v.class_id and l.starts_on <= public.studio_today();
  if v_running is not null then
    select v_gone || coalesce(array_agg(f.path) filter (where f.path is not null), '{}') into v_gone
      from public.class_lessons l
      cross join lateral unnest(array[l.promo_path, l.promo_poster_path]) as f(path)
     where l.class_id = v.class_id and l.id <> v.id and (l.promo_path is not null or l.promo_url is not null)
       and l.starts_on < v_running;
    update public.class_lessons l
       set promo_path = null, promo_poster_path = null, promo_url = null, promo_caption = null,
           promo_seconds = null, promo_by = null, promo_at = null
     where l.class_id = v.class_id and l.id <> v.id and (l.promo_path is not null or l.promo_url is not null)
       and l.starts_on < v_running;
  end if;

  if v_action is not null then
    perform private.log_promo(v, v_action);
  end if;
  perform set_config('oops.activity', '', true);
  return v_gone;
end;
$$;

revoke execute on function public.lesson_set_promo(bigint, text, text, text, integer, text) from public, anon;
grant execute on function public.lesson_set_promo(bigint, text, text, text, integer, text) to authenticated;
