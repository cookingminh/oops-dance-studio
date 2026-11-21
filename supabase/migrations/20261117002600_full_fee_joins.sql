-- =============================================================================
-- New students pay the full course fee — api-contract §3 "Tuition"
--
--   Minh's decision (2026-11), an interim default until the studio sends its rules for new students: someone
--   who joins a class pays the whole course, whatever the session they start on. No pro-rata for the sessions
--   left and no free first class. private.bill_course already bills the full price when
--   tuition_settings.prorate_late_join is off; this turns it off and makes off the default.
--   The toggle stays: Tuition → Settings, "Joining mid-course pays only for the sessions left", turns pro-rata
--   back on.
-- =============================================================================

alter table public.tuition_settings
  alter column prorate_late_join set default false;

update public.tuition_settings set prorate_late_join = false;

comment on column public.tuition_settings.prorate_late_join is
  'Someone new joining after a course started pays only for the sessions left (rounded to 1,000 ₫). '
  'Off by default (2026-11): new students pay the full course.';
