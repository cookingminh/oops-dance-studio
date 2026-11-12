-- How a class's pictures are framed on the website, set by staff with a live preview.
--   * The class image (the poster on the /classes card) is cropped to the card: image_pos_x / image_pos_y (0–100,
--     CSS object-position %) say which part shows — e.g. a larger y shows more of the lower part.
--   * The poster timetable shows each class with its own cut-out photo (one instructor can appear in different
--     photos for different classes): timetable_photo_path — a path in the public class-images bucket
--     ({class_id}/…, written by staff like the class image); null = the instructor's avatar instead. Its frame:
--     the photo's point (timetable_photo_x %, timetable_photo_y %) sits in the middle of the circle, and the
--     photo is timetable_photo_zoom % of the circle wide.
--   * list_public_classes() also returns all of these.

alter table public.classes
  add column image_pos_x          smallint not null default 50 check (image_pos_x between 0 and 100),
  add column image_pos_y          smallint not null default 50 check (image_pos_y between 0 and 100),
  add column timetable_photo_path text check (char_length(timetable_photo_path) <= 300),
  add column timetable_photo_x    smallint not null default 50 check (timetable_photo_x between 0 and 100),
  add column timetable_photo_y    smallint not null default 50 check (timetable_photo_y between 0 and 100),
  add column timetable_photo_zoom smallint not null default 100 check (timetable_photo_zoom between 50 and 300);

drop function public.list_public_classes();
create function public.list_public_classes()
returns table (id bigint, name text, price numeric, lesson text, image_path text, room_name text, instructor_name text,
               instructor_avatar_path text, schedules jsonb, venue_address text, venue_map_url text, place_kind text,
               level text, image_pos_x smallint, image_pos_y smallint, timetable_photo_path text,
               timetable_photo_x smallint, timetable_photo_y smallint, timetable_photo_zoom smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         c.name,
         c.price,
         c.lesson,
         c.image_path,
         coalesce(r.name, v.name),
         p.full_name,
         p.avatar_path,
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'day_of_week', s.day_of_week,
                       'start_time',  s.start_time,
                       'end_time',    s.end_time)
                     order by s.day_of_week, s.start_time)
            from public.class_schedules s
            where s.class_id = c.id),
           '[]'::jsonb),
         v.address,
         v.map_url,
         case when r.id is not null then 'room' when v.id is not null then 'venue' end,
         c.level,
         c.image_pos_x,
         c.image_pos_y,
         c.timetable_photo_path,
         c.timetable_photo_x,
         c.timetable_photo_y,
         c.timetable_photo_zoom
  from public.classes c
  join public.profiles p on p.id = c.instructor_id
  left join public.rooms r on r.id = c.room_id
  left join public.venues v on v.id = c.venue_id
  where c.ended_on is null or c.ended_on >= public.studio_today()
  order by c.name;
$$;
grant execute on function public.list_public_classes() to anon, authenticated;
