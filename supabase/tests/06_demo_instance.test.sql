-- Public demo marker (api-contract §11): only the service role reads or sets it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(public.is_demo_instance(), false, 'a fresh database is not marked as the demo');

select ok(not has_function_privilege('anon', 'public.is_demo_instance()', 'execute'),
  'anon cannot read the marker');
select ok(not has_function_privilege('authenticated', 'public.is_demo_instance()', 'execute'),
  'signed-in users cannot read the marker');
select ok(not has_function_privilege('authenticated', 'public.set_demo_instance(boolean)', 'execute'),
  'signed-in users (admins included) cannot set the marker');
select ok(has_function_privilege('service_role', 'public.set_demo_instance(boolean)', 'execute'),
  'the service role can set the marker');

set local role service_role;
select is(public.set_demo_instance(true), true, 'mark the database');
select is(public.is_demo_instance(), true, 'marked: --reset may run');
select public.set_demo_instance(true);  -- idempotent
select public.set_demo_instance(false);
select is(public.is_demo_instance(), false, 'unmarked: --reset refuses');
reset role;

select * from finish();
rollback;
