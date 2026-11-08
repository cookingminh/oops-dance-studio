# Frontend mapping: legacy axios → Supabase

How every API call of the legacy frontend (axios against Django) was replaced. The API itself is specified in [api-contract.md](api-contract.md).

Paths below are relative to `frontend/src/Components/` (the app lived in `oops-dance_fe/` before the monorepo) and use the **legacy** folder names. Line numbers refer to the legacy code at commit `5b5b927` of the old frontend repository (its history is not carried into this monorepo). Since its commit `f4703b7` the folders are kebab-case: `Users/Admin & Staff/Components/Body Section/…` → `users/admin-staff/components/body/…`, `Users/Instructor & Guest/…` → `users/instructor-guest/…` (e.g. `My Classess - Guest` → `my-classes-guest`).

**Coverage:** 71 live axios calls + 1 commented-out call across 37 files. Every one is mapped below. 4 of them targeted endpoints that never existed in Django (marked ⚠️); 3 are dropped because their component was dead code.

Service functions live in `frontend/src/services/<domain>.js`. Components never import the Supabase client directly.

## Legend

- `from(t)` = `supabase.from(t)` table query under RLS
- `rpc(f)` = `supabase.rpc(f, args)`
- `storage(b)` = `supabase.storage.from(b)`
- `fn(name)` = `supabase.functions.invoke(name)`

## Auth

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 1 | `GET /test-token` — `AuthContext.jsx:24` | `auth.getSession()` + `auth.onAuthStateChange()`; then `from('profiles').select('*').eq('id', uid).single()` for the role | `auth.getSession`, `auth.onAuthChange`, `users.getProfile` |
| 2 | `POST /logout/` — `AuthContext.jsx:68` | `auth.signOut()` | `auth.signOut` |
| 3 | `POST /login/` (username) — `Login/Login.jsx:30` | `auth.signInWithPassword({ email, password })`. **Login is now by email** (Supabase Auth has no username login; a username→email lookup would leak emails). | `auth.signIn` |
| 4 | `POST /register/` (sent `role: "guest"`) — `Register/Register.jsx:29` | `rpc('is_username_available', { p_username })` first, then `auth.signUp({ email, password, options: { data: { username, full_name, contact_number, date_of_birth } } })`. Role is never sent. | `users.isUsernameAvailable`, `auth.signUp` |
| 5 | `PATCH /change-password/` — `…/Setting/Setting.jsx:129` | `auth.signInWithPassword({ email, password: old })` to verify, then `auth.updateUser({ password })` | `auth.changePassword` |
| — | *(new)* forgot password | `auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })` | `auth.requestPasswordReset` |
| — | *(new)* set new password after recovery link | `auth.updateUser({ password })` | `auth.updatePassword` |

## Profiles / users

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 6 | `GET /users/:id` — `…/Main Body/Top Section/Top.jsx:50` (instructor) | Removed: the profile comes from `AuthContext` | — |
| 7 | `GET /users/:id` (commented) — `…/Main Body/Top Section/Top.jsx:57` | Removed | — |
| 8 | `GET /users/:id` — `…/Main Body/Listing Section/Listing.jsx:24` (instructor) | Dead component (never routed), deleted | — |
| 9 | `GET /users/:id/` — `…/Setting/Setting.jsx:32` | Profile from `AuthContext` (`profiles` row of `auth.uid()`) | `users.getProfile` |
| 10 | `PATCH /users/:id/` — `…/Setting/Setting.jsx:56` | `from('profiles').update({ username, full_name, contact_number, date_of_birth }).eq('id', uid)`. Email and role are not editable here. | `users.updateProfile` |
| 11 | `PATCH /users/:id/` avatar multipart (Cloudinary) — `…/Setting/Setting.jsx:95` | HEIC→JPEG + client compression, `storage('avatars').upload('{uid}/avatar.{ext}', { upsert: true })`, then `profiles.update({ avatar_path })` | `storage.uploadAvatar`, `users.updateProfile` |
| 12 | `GET /users/` — `User Manager/Components/AllUsers.jsx:20` | `from('profiles').select('*').order('created_at')` (admin only route) | `users.listProfiles` |
| 13 | `DELETE /users/:id/` — `User Manager/Components/AllUsers.jsx:40` | `fn('admin-users')` `{ action: "delete", user_id }` | `users.deleteUser` |
| 14 | `GET /users/:id/` — `User Manager/Components/EditUserForm.jsx:32` | Row already loaded in the list; no extra call | — |
| 15 | `PATCH /users/:id/` incl. `role` — `User Manager/Components/EditUserForm.jsx:55` | `from('profiles').update({ username, full_name, contact_number, date_of_birth })`; `fn('admin-users')` `{ action: "update", user_id, email }` when the email changed; `rpc('admin_set_role', { p_user, p_role })` when the role changed. | `users.updateProfile`, `users.updateUserEmail`, `users.setRole` |
| — | *(new)* create user | `fn('admin-users')` `{ action: "create", email, password, full_name, role, contact_number?, date_of_birth? }` | `users.createUser` |
| 16 | `GET /instructor-list/` — `Attendance/Components/AttendanceChart.jsx:35` | `from('profiles').select(...).eq('role','instructor')` | `users.listInstructors` |
| 17 | `GET /instructor-list/` — `Attendance/Components/AttendanceList.jsx:33` | same | `users.listInstructors` |
| 18 | `GET /instructor-list/` — `Class Manager/Components/Classes/ClassList.jsx:56` | same | `users.listInstructors` |
| 19 | `GET /users/` then filter `role === 'guest'` — `Students/Components/AddStudentForm.jsx:27` | `from('profiles').select(...).eq('role','guest')` | `users.listGuests` |

## Rooms

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 20 | `GET /rooms/` — `HomePage/Components/Search/Search.jsx:39` | `from('rooms').select('id, name, size, price, image_paths').order('id')` (anon allowed); also feeds the homepage Rooms section and the dashboard | `rooms.listRooms` |
| 21 | `GET /rooms/` — `Room Manager/Components/RoomDetails.jsx:20` | same | `rooms.listRooms` |
| 22 | `PATCH /rooms/:id/update/` — `Room Manager/Components/EditForm.jsx:41` | `from('rooms').update({ name, size, price }).eq('id', id)` | `rooms.updateRoom` |

## Classes, enrolment

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 23 | `GET /class-list/` — `HomePage/Components/Participants/Participants.jsx:22` | `rpc('list_public_classes')`. The old card showed the first *student* of each class publicly; it now shows the class and its instructor. | `classes.listPublicClasses` |
| 24 | `GET /class-list/` — `HomePage/Components/Classes/Components/Slider.jsx:12` | `rpc('list_public_classes')`; images via `getPublicUrl` on `class-images` | `classes.listPublicClasses` |
| 25 | `GET /class-list/` — `Class Manager/Components/Classes/ClassList.jsx:39` | `from('classes').select('*, instructor:profiles(...), room:rooms(...), schedules:class_schedules(*)')` | `classes.listClasses` |
| 26 | `GET /schedule-list/` — `Class Manager/Components/Classes/ClassList.jsx:73` | Removed: schedules are no longer shared and are not picked in the class form | — |
| 27 | `DELETE /class/:id/` — `Class Manager/Components/Classes/ClassList.jsx:98` | `from('classes').delete().eq('id', id)` (cascades schedules/enrolments/attendance), then remove its image from `class-images` | `classes.deleteClass` |
| 28 | `POST /add_class/` multipart (+ `schedules_ids`) — `Class Manager/Components/Classes/AddClassForm.jsx:50` | `from('classes').insert({ name, instructor_id, room_id, price, lesson }).select().single()`, then optional image upload to `class-images/{class_id}/{uuid}.{ext}` + `update({ image_path })` | `classes.createClass`, `classes.setClassImage` |
| 29 | `GET /class/:id/` — `Class Manager/Components/Classes/EditClassForm.jsx:30` | Row already loaded in the list; no extra call | — |
| 30 | `PATCH /class/:id/` (unused handler) — `Class Manager/Components/Classes/EditClassForm.jsx:59` | Removed (duplicate of #31) | — |
| 31 | `PATCH /class/:id/` — `Class Manager/Components/Classes/EditClassForm.jsx:95` | `from('classes').update({ name, instructor_id, room_id, price, lesson }).eq('id', id)` | `classes.updateClass` |
| 32 | `PATCH /class/:id/` image — `Class Manager/Components/Classes/ChangeClassImageForm.jsx:28` | upload new file to `class-images/{class_id}/{uuid}.{ext}`, `update({ image_path })`, remove the old object | `classes.setClassImage` |
| 33 | `GET /class-list/?instructor_id=` — `…/My Classes - Instructor/MyClasses.jsx:18` | `from('classes').select('*, room:rooms(...), schedules:class_schedules(*), students:class_students(joined_at, student:profiles(...))').eq('instructor_id', uid)` | `classes.listInstructorClasses` |
| 34 | `GET /class-list/?guest_id=` — `…/My Classess - Guest/MyClasses.jsx:19` | `from('class_students').select('class_id, joined_at')` (RLS: own rows) + `rpc('list_public_classes')` for name/instructor/schedules. Guests can no longer see the other members of their class (RLS on `profiles`). | `classes.listMyEnrolledClasses` |
| 35 | `GET /class-list/` — `Students/Components/StudentList.jsx:17` | `from('classes').select('*, room:rooms(...), schedules:class_schedules(*), students:class_students(joined_at, student:profiles(...))')` | `classes.listClassesWithStudents` |
| 36 | `PATCH /class/:id/remove_student/` — `Students/Components/StudentList.jsx:50` | `from('class_students').delete().eq('class_id', c).eq('student_id', s)` | `classes.removeStudent` |
| 37 | `GET /class/:id/` — `Students/Components/AddStudentForm.jsx:40` | Removed: existing members come from the already-loaded class | — |
| 38 | `PATCH /class/:id/` `student_ids` (full replace) — `Students/Components/AddStudentForm.jsx:67` | `from('class_students').insert({ class_id, student_id })` | `classes.addStudent` |
| 39 | `GET /class-list/` — `Charts/Components/ClassChart.jsx:31` | `from('classes').select('id, name, class_students(count)')` | `stats.classEnrolment` |

## Schedules (now one-to-many, ISO weekday 1–7)

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 40 | `GET /schedule-list/` — `Class Manager/Components/Schedules/Schedule.jsx:21` | `from('class_schedules').select('*, class:classes(id, name)').order(...)` | `schedules.listSchedules` |
| 41 | `DELETE /schedule/:id/` — `Class Manager/Components/Schedules/Schedule.jsx:31` | `from('class_schedules').delete().eq('id', id)` | `schedules.deleteSchedule` |
| 42 | `POST /add_schedule/` (`day_of_the_week` '0'=Mon) — `Class Manager/Components/Schedules/AddScheduleForm.jsx:37` | `from('class_schedules').insert({ class_id, day_of_week /*1–7*/, start_time, end_time })`. The form now asks for the class. | `schedules.createSchedule` |
| 43 | `GET /schedule/:id/` — `Class Manager/Components/Schedules/EditScheduleForm.jsx:24` | Row already loaded in the list; no extra call | — |
| 44 | `PATCH /schedule/:id/` — `Class Manager/Components/Schedules/EditScheduleForm.jsx:52` | `from('class_schedules').update({ class_id, day_of_week, start_time, end_time }).eq('id', id)` | `schedules.updateSchedule` |

## Bookings

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 45 | `GET /available-rooms?date=` — `HomePage/Components/Search/Search.jsx:56` | `rpc('get_available_slots', { p_date })` → rows grouped by room on the client. Date is formatted locally (`yyyy-MM-dd`), fixing the old `toISOString()` UTC shift. | `bookings.getAvailableSlots` |
| 46 | `POST /bookings/` (client-side deposit, `room_name`, `guest`) — `HomePage/Components/Search/Search.jsx:187` | `rpc('create_booking', { p_room_id, p_date, p_start, p_end, p_details })`. Not signed in → the visitor is asked to log in. The server computes the amounts from the room price (api-contract §5). | `bookings.createBooking` |
| 47 | `GET /bookings/?guest_id=` — `…/My Bookings/MyBookings.jsx:29` | `from('bookings').select('*, room:rooms(id, name)').eq('guest_id', uid)` | `bookings.listMyBookings` |
| — | *(new)* guest cancels a pending booking; staff cancel a pending/approved one | `rpc('cancel_booking', { p_booking_id })` | `bookings.cancelBooking` |
| 48 | `GET /bookings/` — `Booking Manager/Components/BookingList/BookingList.jsx:20` | `from('bookings').select('*, guest:profiles(id, username, full_name, email, avatar_path), room:rooms(id, name)')` | `bookings.listBookings` |
| 49 | ⚠️ `DELETE /booking/:id/` (route never existed; Django had `/bookings/:id/`) — `BookingList.jsx:113` | `from('bookings').delete().eq('id', id)` | `bookings.deleteBooking` |
| 50 | ⚠️ `POST /add_booking/` (never existed) — `Booking Manager/Components/BookingList/AddBookingForm.jsx:24` | `rpc('create_booking', { p_room_id, p_date, p_start, p_end, p_details, p_guest_id })` (staff; creates an approved booking with server-computed amounts), then `from('bookings').update(...)` for any status / payment values the staff entered. | `bookings.createBookingForGuest` |
| 51 | ⚠️ `GET /booking/:id/` (never existed) — `Booking Manager/Components/BookingList/EditBookingForm.jsx:24` | Row already loaded in the list; no extra call | — |
| 52 | ⚠️ `PATCH /booking/:id/` (never existed) — `Booking Manager/Components/BookingList/EditBookingForm.jsx:41` | `from('bookings').update({ room_id, date, start_time, end_time, status, deposit, deposit_status, full_payment, real_income, bank_transfer, cash, details }).eq('id', id)` | `bookings.updateBooking` |
| 53 | `GET /bookings/` — `Charts/Components/BookingChart.jsx:34` | `from('bookings').select('room_id, status, room:rooms(name)').gte('date', from).lt('date', to)` (filtered by the selected month on the server) | `stats.bookingStatusByRoom` |
| — | *(new)* revenue chart | `from('v_revenue_monthly').select('*').order('month')` | `stats.revenueMonthly` |

## Instructor attendance

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 54 | `GET /classes_today/:id/` — `…/Attendance/Attendance.jsx:25` | `rpc('studio_today')`, then `from('instructor_attendance').select('*, class:classes(id, name, image_path, schedules:class_schedules(*)), room:rooms(id, name)').eq('instructor_id', uid).eq('date', today)` | `attendance.listMyInstructorAttendance({ date })` |
| 55 | `GET /attendance-list/:id` — `…/Attendance/Attendance.jsx:34` | same without the date filter; proofs via `createSignedUrls(paths, 3600)` | `attendance.listMyInstructorAttendance`, `storage.signProofUrls` |
| 56 | `PATCH /attendance/:id/` multipart, client `checkin_time`, status `in_progress` — `…/Attendance/CheckinForm.jsx:45` | upload proof to `attendance-proofs/{uid}/{attendance_id}/checkin.{ext}` (upsert), then `rpc('instructor_check_in', { p_attendance_id, p_proof_path })`. Time is set by the server. | `attendance.checkIn` |
| 57 | `PATCH /attendance/:id/` multipart, client `checkout_time`, status `waiting` — `…/Attendance/CheckoutForm.jsx:43` | same with `checkout.{ext}` and `rpc('instructor_check_out', …)` (→ `completed`) | `attendance.checkOut` |
| 58 | `GET /attendance-list/` — `Attendance/Components/AttendanceList.jsx:46` | `from('instructor_attendance').select('*, class:classes(id, name, image_path), instructor:profiles(...), room:rooms(id, name)')` + signed proof URLs | `attendance.listInstructorAttendance` |
| 59 | `PATCH /attendance/:id/` `{status:'completed'}` — `AttendanceList.jsx:60` | `from('instructor_attendance').update({ status: 'completed' }).eq('id', id)` (staff) | `attendance.updateInstructorAttendance` |
| 60 | `PATCH /attendance/:id/` `{status:'cancelled'}` — `AttendanceList.jsx:74` | same, `cancelled` | `attendance.updateInstructorAttendance` |
| 61 | `PATCH /attendance/:id/` `{details}` — `AttendanceList.jsx:86` | same, `details` | `attendance.updateInstructorAttendance` |
| 62 | `PATCH /attendance/:id/` `{instructor_id}` — `AttendanceList.jsx:98` | same, `instructor_id` (UI allows it only while `pending`) | `attendance.updateInstructorAttendance` |
| 63 | `GET /update-instructor-attendance/` — `AttendanceList.jsx:109` | `rpc('generate_instructor_attendance')` → number of rows created (0 = already generated) | `attendance.generateInstructorAttendance` |
| 64 | `GET /attendance-list/` — `Attendance/Components/AttendanceChart.jsx:48` | `from('instructor_attendance').select('status, instructor_id, instructor:profiles(...)').gte('date', from).lt('date', to)` | `attendance.listInstructorAttendance({ from, to })` |

## Student attendance

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 65 | `GET /today-student-attendance/` — `Students/Components/StudentAttendance.jsx:16` | `rpc('studio_today')`, then `from('student_attendance').select('*, student:profiles(...), class:classes(id, name, image_path)').eq('date', today)` | `attendance.listStudentAttendance({ date })` |
| 66 | `PATCH /student-attendance/:id/` — `StudentAttendance.jsx:72` | `from('student_attendance').update({ status }).eq('id', id)` | `attendance.setStudentAttendanceStatus` |
| 67 | `GET /update-student-attendance/` — `StudentAttendance.jsx:84` | `rpc('generate_student_attendance')` | `attendance.generateStudentAttendance` |
| 68 | `GET /student-attendance-records/:id/` — `…/My Classess - Guest/StudentChart.jsx:29` | `from('student_attendance').select('*, class:classes(id, name, image_path)').eq('student_id', uid)`; totals from `rpc('my_stats')` | `attendance.listMyStudentAttendance`, `stats.myStats` |

## Stats

| # | Legacy call (file:line) | Replacement | Service |
|---|---|---|---|
| 69 | `GET /monthly-booking-count/` — `Main Body/Top Section/Top.jsx:32` (admin) | `rpc('dashboard_stats')` → `monthly_booking_count` | `stats.dashboardStats` |
| 70 | `GET /total-student-count/` — `Main Body/Top Section/Top.jsx:41` (admin) | `rpc('dashboard_stats')` → `total_students` (also shows `classes_today`, `revenue_this_month`) | `stats.dashboardStats` |
| 71 | `GET /class_count_by_instructor/:id/` — `…/Main Body/Top Section/Top.jsx:32` (instructor) | `rpc('my_stats')` → `class_count` | `stats.myStats` |
| 72 | `GET /attendance_count_by_instructor/:id/` — `…/Main Body/Top Section/Top.jsx:41` (instructor) | `rpc('my_stats')` → `completed_sessions` (instructor) / `attended_count`, `absent_count` (guest) | `stats.myStats` |
| — | *(new)* dashboard "Today's classes" and "Recent activity" (were hard-coded) | `from('instructor_attendance').select(...)` for today, and the latest `checkin_at` rows | `attendance.listInstructorAttendance` |

## Storage (replaces Cloudinary)

Every hard-coded `https://res.cloudinary.com/dqgu13tbd` base URL (15 files) is removed. Paths are stored in the DB and resolved by `src/services/storage.js`:

| Use | Bucket | Path written | URL |
|---|---|---|---|
| Avatar | `avatars` | `{user_id}/avatar.{ext}` (upsert) | `getPublicUrl` + `?v=updated_at` cache-buster |
| Class image | `class-images` | `{class_id}/{uuid}.{ext}` | `getPublicUrl` |
| Check-in/out proof | `attendance-proofs` (private) | `{instructor_id}/{attendance_id}/{checkin\|checkout}.{ext}` (upsert) | `createSignedUrls(paths, 3600)` |
| Room photos | `site-assets` | `rooms/{room_id}/{file}`, listed in order in `rooms.image_paths` (read only; uploads are not in the UI yet) | `getPublicUrl`; studio photo when the list is empty |
| Homepage media | `site-assets` | not used: hero/dashboard videos and decorative images are bundled after compression | — |

Uploads go through `src/lib/image.js`: HEIC → JPEG with `heic2any`, resized to ≤1600 px, re-encoded as WebP (JPEG fallback), and kept ≤5 MB.

## Error codes

`src/services/errors.js` maps RPC prefixes and Postgres codes to UI messages: `SLOT_TAKEN`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE`, `INVALID_INPUT`, `PAST_DATE`, plus `23505` (duplicate), `23P01` (overlap → `SLOT_TAKEN`), `23514` (check → `INVALID_INPUT`), `42501` (RLS → `FORBIDDEN`), `PGRST116` (no row → `NOT_FOUND`), auth errors and network failures.
