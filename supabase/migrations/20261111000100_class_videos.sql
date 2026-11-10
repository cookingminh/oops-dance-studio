-- -----------------------------------------------------------------------------
-- class_lessons.video_url: the class's end-of-month video of that month's piece.
--   * a YouTube link (watch, youtu.be, shorts, embed or live), so the site can embed it
--   * null until the studio posts the video; same RLS as the lesson (public read, staff write)
-- The /classes page shows the newest month that has videos.
-- -----------------------------------------------------------------------------
alter table public.class_lessons
  add column video_url text
  constraint class_lessons_video_url_youtube check (
    video_url is null
    or video_url ~ '^https://(www\.|m\.)?(youtube\.com/(watch\?(.*&)?v=|shorts/|embed/|live/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#/].*)?$'
  );

create index class_lessons_with_video_idx on public.class_lessons (month desc) where video_url is not null;
