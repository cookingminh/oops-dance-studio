-- A class's maximum number of students (20261117003200_class_capacity; api-contract §3 classes.max_students,
-- §5 class_seats):
--   * class_seats lists the classes with a maximum, the places taken and left — for anyone, counts only
--   * a full class refuses a join request, an approval and a direct add; a student who had left can't come back
--   * the maximum can't go below the places held; leaving frees a place
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_role public.app_role, p_name text)
returns uuid language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('full_name', p_name), '{}'::jsonb, now(), now());
  if p_role <> 'guest' then
    update public.profiles set role = p_role where id = p_id;
  end if;
  return p_id;
end $$;
create function tests.login_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function tests.today() returns date language sql stable as $$ select public.studio_today(); $$;
-- The class's row of class_seats: 'taken/max, left'.
create function tests.seats(p_class bigint) returns text language sql stable as $$
  select s.taken || '/' || s.max_students || ', ' || s.seats_left || ' left' from public.class_seats() s where s.class_id = p_class;
$$;
create function tests.request_of(p_student uuid) returns bigint language sql stable security definer as $$
  select id from public.class_join_requests where class_id = 900341 and student_id = p_student order by id desc limit 1;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('00000000-0000-4000-b000-000000000341', 'cap-staff@test.local', 'staff', 'Cap Staff');
select tests.create_user('00000000-0000-4000-b000-000000000342', 'cap-teacher@test.local', 'instructor', 'Cap Teacher');
select tests.create_user('00000000-0000-4000-b000-000000000343', 'cap-a@test.local', 'guest', 'Cap A');
select tests.create_user('00000000-0000-4000-b000-000000000344', 'cap-b@test.local', 'guest', 'Cap B');
select tests.create_user('00000000-0000-4000-b000-000000000345', 'cap-c@test.local', 'guest', 'Cap C');
select tests.create_user('00000000-0000-4000-b000-000000000346', 'cap-d@test.local', 'guest', 'Cap D');

-- No course: adding students bills nothing, so only the places matter.
insert into public.classes (id, name, instructor_id, price, starts_on) values
  (900341, 'Cap Class', '00000000-0000-4000-b000-000000000342', 500000, tests.today() - 30),
  (900342, 'Cap Open',  '00000000-0000-4000-b000-000000000342', 500000, tests.today() - 30);

-- ---------------------------------------------------------------------------
-- A maximum of 2
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000341');
select throws_ok($$update public.classes set max_students = 0 where id = 900341$$, '23514', null, 'a maximum is at least 1');
update public.classes set max_students = 2 where id = 900341;
insert into public.class_students (class_id, student_id) values (900341, '00000000-0000-4000-b000-000000000343');
select tests.logout();

select tests.login_anon();
select is(tests.seats(900341), '1/2, 1 left', 'anyone sees the places taken and left');
select is((select count(*)::int from public.class_seats() where class_id = 900342), 0, 'a class without a maximum isn''t listed');
select tests.logout();

select tests.login_as('00000000-0000-4000-b000-000000000344');
select lives_ok($$select public.class_join_request(900341)$$, 'a student asks while a place is left');
select tests.logout();

select tests.login_as('00000000-0000-4000-b000-000000000341');
insert into public.class_students (class_id, student_id) values (900341, '00000000-0000-4000-b000-000000000345');
select is(tests.seats(900341), '2/2, 0 left', 'the second place is taken: full');

-- ---------------------------------------------------------------------------
-- Full
-- ---------------------------------------------------------------------------
select throws_like($$select public.class_join_approve(tests.request_of('00000000-0000-4000-b000-000000000344'), 'now')$$,
                   '%this class is full (2 of 2 places)%', 'staff can''t approve a request into a full class');
select is((select status::text from public.class_join_requests where id = tests.request_of('00000000-0000-4000-b000-000000000344')),
          'pending', 'the request still waits');
select throws_like($$insert into public.class_students (class_id, student_id) values (900341, '00000000-0000-4000-b000-000000000346')$$,
                   '%this class is full%raise its maximum%', 'nor add a student directly');
select throws_like($$update public.classes set max_students = 1 where id = 900341$$,
                   '%2 students hold a place%can''t be lower%', 'the maximum can''t go below the places held');
select lives_ok($$insert into public.class_students (class_id, student_id) values (900341, '00000000-0000-4000-b000-000000000343') on conflict do nothing$$,
                'adding someone already in it is still a no-op');
select tests.logout();

select tests.login_as('00000000-0000-4000-b000-000000000346');
select throws_like($$select public.class_join_request(900341)$$, '%INVALID_STATE: this class is full%', 'a student can''t ask to join a full class');
select tests.logout();

-- ---------------------------------------------------------------------------
-- A place frees up
-- ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-b000-000000000341');
update public.class_students set leaves_after = tests.today() - 1
 where class_id = 900341 and student_id = '00000000-0000-4000-b000-000000000345';
select is(tests.seats(900341), '1/2, 1 left', 'a student who left frees their place');
select lives_ok($$select public.class_join_approve(tests.request_of('00000000-0000-4000-b000-000000000344'), 'now')$$,
                'the waiting request can be approved now');
select is(tests.seats(900341), '2/2, 0 left', 'full again');
select throws_like($$update public.class_students set leaves_after = null
                      where class_id = 900341 and student_id = '00000000-0000-4000-b000-000000000345'$$,
                   '%this class is full%', 'the student who left can''t come back while it is full');
update public.classes set max_students = 3 where id = 900341;
select lives_ok($$update public.class_students set leaves_after = null
                   where class_id = 900341 and student_id = '00000000-0000-4000-b000-000000000345'$$,
                'with a higher maximum they can');
select is(tests.seats(900341), '3/3, 0 left', 'three of three');
select tests.logout();

select * from finish();
rollback;
