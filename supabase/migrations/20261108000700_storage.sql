-- =============================================================================
-- 07 · Storage buckets and policies
-- Contract: docs/architecture/api-contract.md §7
--
-- Public buckets serve files through getPublicUrl() without RLS; the select
-- policies below only matter for list / upsert / createSignedUrl.
-- One policy per command on storage.objects (covers all four buckets).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',           'avatars',           true,  5242880,
     array['image/jpeg', 'image/png', 'image/webp']),
  ('class-images',      'class-images',      true,  5242880,
     array['image/jpeg', 'image/png', 'image/webp']),
  ('attendance-proofs', 'attendance-proofs', false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp']),
  -- Homepage images and video. SVG deliberately excluded (script-capable).
  ('site-assets',       'site-assets',       true,  52428800,
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- attendance-proofs write check:
--   {auth.uid()}/{attendance_id}/{checkin|checkout}.{jpg|jpeg|png|webp}
--   the attendance row is the caller's, and still in the matching phase
--   (checkin: pending/waiting, checkout: in_progress) — so a proof cannot be
--   replaced after the RPC has recorded it.
-- -----------------------------------------------------------------------------
create or replace function private.can_write_attendance_proof(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_parts  text[];
  v_status public.instructor_attendance_status;
begin
  if v_uid is null or p_name is null then
    return false;
  end if;

  v_parts := regexp_match(
    p_name,
    '^([0-9a-f-]{36})/([0-9]{1,18})/(checkin|checkout)\.(jpg|jpeg|png|webp)$');
  if v_parts is null or v_parts[1] <> v_uid::text then
    return false;
  end if;

  select a.status into v_status
  from public.instructor_attendance a
  where a.id = v_parts[2]::bigint and a.instructor_id = v_uid;
  if not found then
    return false;
  end if;

  return (v_parts[3] = 'checkin'  and v_status in ('pending', 'waiting'))
      or (v_parts[3] = 'checkout' and v_status = 'in_progress');
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.can_write_attendance_proof(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
--   avatars            owner folder {user_id}/…            write: owner
--   class-images       {class_id}/{uuid}.{ext}             write: staff
--   attendance-proofs  {instructor_id}/{attendance_id}/…   write: owning instructor
--                                                          read: owner + staff (signed URL)
--   site-assets        free-form                           write: staff
-- -----------------------------------------------------------------------------
create policy oops_objects_select on storage.objects
  for select to authenticated
  using (
    (bucket_id = 'avatars'
       and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id in ('class-images', 'site-assets')
       and (select public.is_staff()))
    or (bucket_id = 'attendance-proofs'
       and ((storage.foldername(name))[1] = (select auth.uid())::text
            or (select public.is_staff())))
  );

create policy oops_objects_insert on storage.objects
  for insert to authenticated
  with check (
    (bucket_id = 'avatars'
       and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id in ('class-images', 'site-assets')
       and (select public.is_staff()))
    or (bucket_id = 'attendance-proofs'
       and private.can_write_attendance_proof(name))
  );

create policy oops_objects_update on storage.objects
  for update to authenticated
  using (
    (bucket_id = 'avatars'
       and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id in ('class-images', 'site-assets')
       and (select public.is_staff()))
    or (bucket_id = 'attendance-proofs'
       and private.can_write_attendance_proof(name))
  )
  with check (
    (bucket_id = 'avatars'
       and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id in ('class-images', 'site-assets')
       and (select public.is_staff()))
    or (bucket_id = 'attendance-proofs'
       and private.can_write_attendance_proof(name))
  );

create policy oops_objects_delete on storage.objects
  for delete to authenticated
  using (
    (bucket_id = 'avatars'
       and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id in ('class-images', 'site-assets', 'attendance-proofs')
       and (select public.is_staff()))
  );
