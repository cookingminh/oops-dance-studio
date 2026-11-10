-- The demo activity seed without a temporary table (api-contract §5 seed_demo_activity).
-- `supabase db lint` (plpgsql_check) can't see a table a function creates while it runs, so the seed now
-- writes straight into activity_log and tidies names, roles and empty facts at the end. Same rows as before.

create or replace function public.seed_demo_activity()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.studio_today();
  v_now timestamptz := now() - interval '3 minutes';
  v_admin uuid := (select id from public.profiles where email = 'admin@demo.oopsdance.test');
  v_staff uuid := (select id from public.profiles where email = 'staff@demo.oopsdance.test');
  v_tz text := 'Asia/Ho_Chi_Minh';
begin
  if not (private.is_service_context() and public.tuition_sandbox()) then
    raise exception 'FORBIDDEN: demo activity is only seeded on a sandbox';
  end if;
  delete from public.activity_log where true; -- (PostgREST's safeupdate wants a WHERE)

  -- Each part below writes straight into the log; names, roles and empty facts are tidied at the end.
  -- Instructors check in and out of their sessions (last 8 days).
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select x.at, a.instructor_id, 'sessions', x.action, 'instructor_attendance', a.id::text, a.class_id, a.instructor_id, c.name,
         jsonb_build_object('date', a.date, 'start', private.session_start(a.class_id, a.date, a.start_time),
                            'instructor', private.person_name(a.instructor_id))
    from public.instructor_attendance a
    join public.classes c on c.id = a.class_id
    cross join lateral (values ('checked_in', a.checkin_at), ('checked_out', a.checkout_at)) x(action, at)
   where a.date >= v_today - 8 and x.at is not null and x.at <= v_now;

  -- Cancelled sessions: staff, the evening before.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(((a.date - 1) + time '20:15') at time zone v_tz, v_now), v_staff, 'sessions', 'cancelled', 'instructor_attendance',
         a.id::text, a.class_id, a.instructor_id, c.name,
         jsonb_build_object('date', a.date, 'start', private.session_start(a.class_id, a.date, a.start_time),
                            'instructor', private.person_name(a.instructor_id), 'note', a.details)
    from public.instructor_attendance a join public.classes c on c.id = a.class_id
   where a.status = 'cancelled' and a.date between v_today - 8 and v_today + 2;

  -- Roll calls: marked by the class's instructor right after class (one class in four by staff).
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(((sa.date + coalesce(ia.end_time, sl.end_time, time '20:00')) at time zone v_tz)
               + interval '6 minutes' + (abs(hashtext(sa.id::text)) % 50) * interval '1 second', v_now),
         case when abs(hashtext(sa.class_id::text || sa.date::text)) % 4 = 0 then v_staff else c.instructor_id end,
         'roll_call', case sa.status when 'attend' then 'attended' else 'absent' end, 'student_attendance', sa.id::text,
         sa.class_id, sa.student_id, coalesce(private.person_name(sa.student_id), ''),
         jsonb_build_object('class', c.name, 'date', sa.date, 'status', sa.status)
    from public.student_attendance sa
    join public.classes c on c.id = sa.class_id
    left join public.instructor_attendance ia on ia.class_id = sa.class_id and ia.date = sa.date
    left join lateral (select max(s.end_time) as end_time from public.class_schedules s
                        where s.class_id = sa.class_id and s.day_of_week = extract(isodow from sa.date)) sl on true
   where sa.date >= v_today - 6 and sa.status <> 'pending'
     and coalesce(ia.status, 'completed') <> 'cancelled';

  -- Bookings: guests ask, staff answer a few hours later.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, subject_id, label, meta)
  select least(x.at, v_now), x.actor, 'bookings', x.action, 'bookings', b.id::text, b.guest_id,
         coalesce(private.person_name(b.guest_id), ''),
         jsonb_build_object('room', rm.name, 'date', b.date, 'start', b.start_time, 'end', b.end_time, 'status', b.status)
    from public.bookings b
    join public.rooms rm on rm.id = b.room_id
    cross join lateral (select ((b.date - (2 + abs(hashtext(b.id::text)) % 5)) + time '09:00')::timestamp at time zone v_tz
                               + (abs(hashtext(b.id::text || 'h')) % 600) * interval '1 minute' as asked) q
    cross join lateral (values (q.asked, b.guest_id, 'created'),
                               (q.asked + (1 + abs(hashtext(b.id::text)) % 6) * interval '1 hour', v_staff,
                                case when b.status in ('approved', 'completed') then 'approved' when b.status = 'rejected' then 'rejected' end),
                               (q.asked + interval '1 day', b.guest_id, case when b.status = 'cancelled' then 'cancelled' end)) x(at, actor, action)
   where b.date between v_today - 8 and v_today + 14 and x.action is not null and q.asked <= v_now;

  -- Tuition received: cash by staff, transfers by the bank.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select i.paid_at, case when i.method = 'cash' then v_staff end, 'tuition', 'paid', 'tuition_invoices', i.id::text,
         i.class_id, i.student_id, i.student_name,
         jsonb_build_object('class', i.class_name, 'course', i.lesson_title, 'amount', i.amount, 'paid', i.paid_amount,
                            'received', i.paid_amount, 'method', i.method, 'status', i.status)
    from public.tuition_invoices i
   where i.paid_at between v_now - interval '12 days' and v_now and i.paid_amount > 0;

  -- Waived and cancelled invoices.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(i.updated_at, v_now) - (abs(hashtext(i.id::text)) % 72) * interval '1 hour',
         case when i.status = 'waived' then v_admin when i.void_reason in ('switched', 'removed') then v_staff end,
         'tuition', case when i.status = 'waived' then 'waived' else 'cancelled' end, 'tuition_invoices', i.id::text,
         i.class_id, i.student_id, i.student_name,
         jsonb_build_object('class', i.class_name, 'course', i.lesson_title, 'amount', i.amount, 'note', i.note, 'reason', i.void_reason)
    from public.tuition_invoices i
   where (i.status = 'waived' or (i.status = 'void' and i.void_reason in ('not_renewed', 'stopped', 'switched')))
     and i.updated_at >= v_now - interval '10 days';

  -- Renewal answers from students.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select least(((i.due_date - 2 - abs(hashtext(i.id::text)) % 3) + time '21:00') at time zone v_tz, v_now - interval '2 hours'),
         i.student_id, 'tuition', 'renewal', 'tuition_invoices', i.id::text, i.class_id, i.student_id, i.student_name,
         jsonb_build_object('class', i.class_name, 'course', i.lesson_title, 'renewal', i.renewal)
    from public.tuition_invoices i
    join public.class_lessons l on l.id = i.lesson_id
   where i.renewal is not null and l.starts_on > v_today and i.switched_from is null;

  -- Class switches, enrolments and routines planned by staff.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, subject_id, label, meta)
  select v_now - interval '2 days 3 hours', v_staff, 'students', 'leaving', 'class_students', cs.class_id || ':' || cs.student_id,
         cs.class_id, cs.student_id, private.person_name(cs.student_id),
         jsonb_build_object('class', private.class_name(cs.class_id), 'joined_at', cs.joined_at, 'leaves_after', cs.leaves_after)
    from public.class_students cs where cs.leaves_after is not null
  union all
  select v_now - interval '2 days 3 hours' + interval '20 seconds', v_staff, 'students', 'enrolled', 'class_students',
         cs.class_id || ':' || cs.student_id, cs.class_id, cs.student_id, private.person_name(cs.student_id),
         jsonb_build_object('class', private.class_name(cs.class_id), 'joined_at', cs.joined_at)
    from public.class_students cs where cs.joined_at > v_today
  union all
  select v_now - (1 + l.id % 4) * interval '1 day' - (l.id % 9) * interval '1 hour', v_staff, 'routines', 'planned', 'class_lessons',
         l.id::text, l.class_id, null, l.title,
         jsonb_build_object('class', private.class_name(l.class_id), 'starts_on', l.starts_on, 'sessions', l.session_count)
    from public.class_lessons l where l.starts_on > v_today;

  -- Costs added this month.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, class_id, label, meta)
  select least((e.spent_on + time '20:30') at time zone v_tz, v_now), coalesce(e.created_by, v_admin), 'expenses', 'created', 'expenses',
         e.id::text, e.class_id, e.description,
         jsonb_build_object('category', e.category, 'amount', e.amount, 'spent_on', e.spent_on, 'vendor', e.vendor,
                            'class', private.class_name(e.class_id))
    from public.expenses e
   where e.spent_on >= v_today - 10 and e.spent_on <= v_today and e.recurring_id is null;

  -- Last month's payslips: finalized and paid by the admin.
  insert into public.activity_log (at, actor_id, area, action, entity, entity_id, subject_id, label, meta)
  select x.at, v_admin, 'payroll', x.action, 'payslips', s.profile_id || ':' || s.month, s.profile_id,
         coalesce(private.person_name(s.profile_id), ''), jsonb_build_object('month', s.month, 'total', s.total)
    from public.payslips s
    cross join lateral (values ('payslip_finalized', s.finalized_at), ('payslip_paid', s.paid_at)) x(action, at)
   where x.at is not null and x.at between v_now - interval '12 days' and v_now;

  delete from public.activity_log where at > v_now or at < v_now - interval '14 days';
  update public.activity_log a
     set actor_name = private.person_name(a.actor_id),
         actor_role = (select p.role from public.profiles p where p.id = a.actor_id),
         meta = nullif(jsonb_strip_nulls(a.meta), '{}'::jsonb)
   where true;

  return (select count(*) from public.activity_log);
end;
$$;
