-- =============================================================================
-- 08 · Scheduled jobs (pg_cron, schedules are UTC)
-- Contract: docs/architecture/api-contract.md §8
-- Replaces Celery beat (whose task path `your_app.tasks…` never ran).
-- Jobs run as postgres without JWT claims → private.is_service_context().
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- Monday 00:00 Asia/Ho_Chi_Minh (= Sunday 17:00 UTC): this week's sessions.
select cron.schedule(
  'generate-instructor-attendance',
  '0 17 * * 0',
  $$select public.generate_instructor_attendance()$$
);

-- 00:05 Asia/Ho_Chi_Minh daily (= 17:05 UTC): today's student roll call.
select cron.schedule(
  'generate-student-attendance',
  '5 17 * * *',
  $$select public.generate_student_attendance()$$
);
