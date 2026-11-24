-- Audit log (accountability for accreditation): every change to a mark, an improvement result, an approved task
-- grade, a sent/withdrawn item and the roster is recorded by the database itself. Append-only: nobody can edit
-- or delete entries through the app (only the project owner, with the service key). Stores ids and numbers, no names.

create table public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid not null,
  teacher_id uuid,
  actor uuid,                      -- who made the change (auth user), null when done by the server/import
  actor_role text,                 -- teacher | student | server
  at timestamptz not null default now(),
  entity text not null,            -- test_results | improvement_items | perf_tasks | sheets | students | tests
  action text not null,            -- insert | update | delete
  test_id text,
  student_id text,
  detail jsonb not null default '{}'::jsonb
);
create index on public.audit_log (teacher_id, at desc);
create index on public.audit_log (test_id);
alter table public.audit_log enable row level security;
create policy audit_teacher_read on public.audit_log for select to authenticated using (teacher_id = app.my_teacher());
revoke insert, update, delete on public.audit_log from authenticated, anon;

create or replace function app.audit_actor_role() returns text language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then 'server' when app.my_teacher() is not null then 'teacher' when app.my_student() is not null then 'student' else 'server' end
$$;

create or replace function app.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  r jsonb := coalesce(n, o);
  d jsonb := '{}'::jsonb;
  tid text;
  i int;
begin
  if tg_table_name = 'test_results' then
    tid := r->>'test_id';
    if tg_op = 'UPDATE' then
      -- the questions whose mark changed: [[question number, old, new], ...]
      d := jsonb_build_object('changed', (
        select coalesce(jsonb_agg(jsonb_build_array(k, (o->'marks')->(k - 1), (n->'marks')->(k - 1))), '[]'::jsonb)
        from generate_series(1, greatest(jsonb_array_length(o->'marks'), jsonb_array_length(n->'marks'))) k
        where (o->'marks')->(k - 1) is distinct from (n->'marks')->(k - 1)));
    end if;
    d := d || jsonb_build_object(
      'from', case when o is null then null else (select sum(v::numeric) from jsonb_array_elements_text(o->'marks') v) end,
      'to',   case when n is null then null else (select sum(v::numeric) from jsonb_array_elements_text(n->'marks') v) end);
  elsif tg_table_name = 'improvement_items' then
    tid := (select test_id from public.improvement_rounds where id = r->>'round_id');
    d := jsonb_build_object('round', r->>'round_id',
      'from', case when o is null or o->'results' = 'null'::jsonb then null else (select sum(v::int) from jsonb_array_elements_text(o->'results') v) end,
      'to',   case when n is null or n->'results' = 'null'::jsonb then null else (select sum(v::int) from jsonb_array_elements_text(n->'results') v) end,
      'of', jsonb_array_length(r->'items'));
  elsif tg_table_name = 'perf_tasks' then
    tid := r->>'test_id';
    d := jsonb_build_object('title', r->>'title', 'from', o->'teacher_grade', 'to', n->'teacher_grade');
  elsif tg_table_name = 'sheets' then
    tid := null;
    d := jsonb_build_object('key', r->>'key', 'sent', n->>'sent_at' is not null, 'file', (n->>'storage_path') is distinct from (o->>'storage_path'));
  elsif tg_table_name = 'students' then
    d := jsonb_build_object('class', r->>'class_id', 'seat', r->'seat_no');
  elsif tg_table_name = 'tests' then
    tid := r->>'id';
    d := jsonb_build_object('name', r->>'name', 'questions', jsonb_array_length(r->'qs'));
  end if;
  insert into public.audit_log (school_id, teacher_id, actor, actor_role, entity, action, test_id, student_id, detail)
  values ((r->>'school_id')::uuid, nullif(r->>'teacher_id', '')::uuid, auth.uid(), app.audit_actor_role(), tg_table_name, lower(tg_op), tid,
          case when tg_table_name = 'students' then r->>'id' else r->>'student_id' end, d);
  return null;
end $$;

-- only real changes are logged (re-saving the same marks writes nothing)
create trigger audit_results_ins after insert or delete on public.test_results for each row execute function app.audit();
create trigger audit_results_upd after update on public.test_results for each row when (old.marks is distinct from new.marks) execute function app.audit();
create trigger audit_items_ins after insert or delete on public.improvement_items for each row execute function app.audit();
create trigger audit_items_upd after update on public.improvement_items for each row when (old.results is distinct from new.results) execute function app.audit();
create trigger audit_tasks_upd after update on public.perf_tasks for each row when (old.teacher_grade is distinct from new.teacher_grade) execute function app.audit();
create trigger audit_sheets_upd after update on public.sheets for each row when (old.sent_at is distinct from new.sent_at or old.storage_path is distinct from new.storage_path) execute function app.audit();
create trigger audit_students after insert or delete on public.students for each row execute function app.audit();
create trigger audit_tests after insert or delete on public.tests for each row execute function app.audit();
