-- Performance tasks for a group of students or one student, repeated until the skill is mastered.
-- One perf_tasks row per assigned student; rows of the same task share set_id. test_id stays null for these.
alter table public.perf_tasks alter column test_id drop not null;
alter table public.perf_tasks add column set_id text;
alter table public.perf_tasks add column mastery int not null default 80;          -- % of the rubric total that counts as mastered
alter table public.perf_tasks add column target jsonb;                            -- how the students were chosen (group / skill / picked)
alter table public.perf_tasks add column status text not null default 'assigned'
  check (status in ('assigned', 'submitted', 'retry', 'mastered'));
alter table public.perf_tasks add column attempts int not null default 0;
alter table public.perf_tasks add column decided_at timestamptz;
create index on public.perf_tasks (set_id);
-- status changes are part of the audit trail
create trigger audit_tasks_status after update on public.perf_tasks for each row when (old.status is distinct from new.status) execute function app.audit();
