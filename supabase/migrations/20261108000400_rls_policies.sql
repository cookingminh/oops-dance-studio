-- =============================================================================
-- 04 · Row Level Security (deny by default)
-- Contract: docs/architecture/api-contract.md §4
--
-- Conventions
--   * RLS enabled on every table; anything not granted by a policy is denied.
--   * One permissive policy per (table, command) to avoid the
--     "multiple permissive policies" performance lint.
--   * auth.uid() and role helpers are wrapped in (select …) so Postgres
--     evaluates them once per statement (initplan), not once per row.
-- =============================================================================

alter table public.profiles              enable row level security;
alter table public.rooms                 enable row level security;
alter table public.classes               enable row level security;
alter table public.class_schedules       enable row level security;
alter table public.class_students        enable row level security;
alter table public.bookings              enable row level security;
alter table public.instructor_attendance enable row level security;
alter table public.student_attendance    enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
--   guest       select/update own (role/email blocked by guard trigger)
--   instructor  own + select students enrolled in own classes
--   staff       select all, update non-role fields
--   admin       all
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_staff())
    or exists (
      select 1
      from public.class_students cs
      join public.classes c on c.id = cs.class_id
      where cs.student_id = profiles.id
        and c.instructor_id = (select auth.uid())
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()))
  with check (id = (select auth.uid()) or (select public.is_staff()));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));

create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- rooms, classes, class_schedules: public read, staff write
-- -----------------------------------------------------------------------------
create policy rooms_select on public.rooms
  for select to anon, authenticated using (true);
create policy rooms_insert on public.rooms
  for insert to authenticated with check ((select public.is_staff()));
create policy rooms_update on public.rooms
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy rooms_delete on public.rooms
  for delete to authenticated using ((select public.is_staff()));

create policy classes_select on public.classes
  for select to anon, authenticated using (true);
create policy classes_insert on public.classes
  for insert to authenticated with check ((select public.is_staff()));
create policy classes_update on public.classes
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy classes_delete on public.classes
  for delete to authenticated using ((select public.is_staff()));

create policy class_schedules_select on public.class_schedules
  for select to anon, authenticated using (true);
create policy class_schedules_insert on public.class_schedules
  for insert to authenticated with check ((select public.is_staff()));
create policy class_schedules_update on public.class_schedules
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy class_schedules_delete on public.class_schedules
  for delete to authenticated using ((select public.is_staff()));

-- -----------------------------------------------------------------------------
-- class_students
--   guest own rows · instructor rows of own classes · staff CRUD
-- -----------------------------------------------------------------------------
create policy class_students_select on public.class_students
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.is_staff())
    or exists (
      select 1 from public.classes c
      where c.id = class_students.class_id
        and c.instructor_id = (select auth.uid())
    )
  );
create policy class_students_insert on public.class_students
  for insert to authenticated with check ((select public.is_staff()));
create policy class_students_update on public.class_students
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy class_students_delete on public.class_students
  for delete to authenticated using ((select public.is_staff()));

-- -----------------------------------------------------------------------------
-- bookings
--   guest/instructor: select own; insert via create_booking(); cancel via
--   cancel_booking(). Staff CRUD.
-- -----------------------------------------------------------------------------
create policy bookings_select on public.bookings
  for select to authenticated
  using (guest_id = (select auth.uid()) or (select public.is_staff()));
create policy bookings_insert on public.bookings
  for insert to authenticated with check ((select public.is_staff()));
create policy bookings_update on public.bookings
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy bookings_delete on public.bookings
  for delete to authenticated using ((select public.is_staff()));

-- -----------------------------------------------------------------------------
-- instructor_attendance
--   instructor: select own; writes only via instructor_check_in/out RPC.
--   Staff CRUD. Guests: nothing.
-- -----------------------------------------------------------------------------
create policy instructor_attendance_select on public.instructor_attendance
  for select to authenticated
  using (instructor_id = (select auth.uid()) or (select public.is_staff()));
create policy instructor_attendance_insert on public.instructor_attendance
  for insert to authenticated with check ((select public.is_staff()));
create policy instructor_attendance_update on public.instructor_attendance
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy instructor_attendance_delete on public.instructor_attendance
  for delete to authenticated using ((select public.is_staff()));

-- -----------------------------------------------------------------------------
-- student_attendance
--   guest: select own · instructor: select + update status/details for own
--   classes (column restriction: private.guard_student_attendance_update)
--   staff CRUD
-- -----------------------------------------------------------------------------
create policy student_attendance_select on public.student_attendance
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.is_staff())
    or exists (
      select 1 from public.classes c
      where c.id = student_attendance.class_id
        and c.instructor_id = (select auth.uid())
    )
  );
create policy student_attendance_update on public.student_attendance
  for update to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.classes c
      where c.id = student_attendance.class_id
        and c.instructor_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_staff())
    or exists (
      select 1 from public.classes c
      where c.id = student_attendance.class_id
        and c.instructor_id = (select auth.uid())
    )
  );
create policy student_attendance_insert on public.student_attendance
  for insert to authenticated with check ((select public.is_staff()));
create policy student_attendance_delete on public.student_attendance
  for delete to authenticated using ((select public.is_staff()));
