-- Itqan schema: tables, helper functions and Row Level Security.
-- Every row carries school_id (and teacher_id where a teacher owns it) so several teachers and schools can share one project later.
-- Imported entities keep their original text ids (students s0011jmg, tests t_p1_1448, rounds m_p1_1448, questions q001, skills s001).

create schema if not exists app;

-- ---------------------------------------------------------------- tables
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  logo text,   -- small PNG as a data URI (printed in every PDF header, also offline)
  logo2 text,
  created_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  display_name text not null,
  subject text, grade text, term text, year text,
  pfont text default 'IBM Plex Sans Arabic',
  settings jsonb not null default '{}'::jsonb, -- gap cfg, timetable, groups, aiLog, lang
  created_at timestamptz not null default now()
);

create table public.subjects (
  id text primary key,
  school_id uuid not null references public.schools (id),
  name text not null,
  grade text
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  name text not null,
  unique (teacher_id, name)
);

create table public.students (
  id text primary key,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  class_id uuid not null references public.classes (id),
  seat_no int not null,
  name text not null,
  pin_lookup text unique,          -- HMAC-SHA256(PIN_PEPPER, pin), hex. The pin itself is never stored.
  pin_hash text,                   -- scrypt$salt$hash
  has_pin boolean generated always as (pin_hash is not null) stored,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  stars int not null default 0,
  sort int not null default 0,     -- roster order of the old app (improvement papers depend on it)
  created_at timestamptz not null default now()
);
create index on public.students (teacher_id);
create index on public.students (class_id);

create table public.skills (
  id text primary key,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  subject_id text references public.subjects (id),
  chapter text not null,
  chapter_no int,
  lesson text,
  level text not null check (level in ('K', 'A', 'R')),
  name text not null,
  sort int not null default 0
);

create table public.questions (
  id text primary key,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  skill_id text references public.skills (id),
  type text not null check (type in ('mc', 'tf', 'fix', 'match', 'mcj', 'compare', 'fig', 'essay')),
  text text not null,
  body jsonb not null default '{}'::jsonb, -- opts, ans, key, pairs, x, y, crit, parts, ul, max
  image_path text,
  src text,
  adapted boolean not null default false,
  v int,
  sort int not null default 0
);

-- question figures (small JPEG data URIs, needed offline for printing papers)
create table public.qimg (
  id text primary key,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  data text not null
);

create table public.tests (
  id text primary key,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  name text not null,
  type text not null,
  date date not null,
  dur text,
  qs jsonb not null, -- frozen question snapshots, in paper order
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.test_results (
  test_id text not null references public.tests (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  marks numeric[] not null,
  updated_at timestamptz not null default now(),
  primary key (test_id, student_id)
);

create table public.improvement_rounds (
  id text primary key,
  test_id text not null references public.tests (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  crit text not null,
  date date not null,
  round int,
  qs jsonb not null
);

create table public.improvement_items (
  round_id text not null references public.improvement_rounds (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  items int[] not null,     -- indexes into improvement_rounds.qs
  results int[],            -- 0/1 per item, null until graded
  primary key (round_id, student_id)
);

-- Scanned papers. key = test id (answer sheet), round id (teacher's improvement paper) or '<round id>_g' (graded improvement paper).
create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  student_id text not null references public.students (id) on delete cascade,
  key text not null,
  storage_path text,        -- original file in the private bucket
  pages text[] not null default '{}', -- JPEG renditions shown on phones
  mime text,
  legacy_asset text,        -- asset id in the old app, until the file is uploaded
  sent_at timestamptz,      -- visible to the student and parent only once sent
  uploaded_at timestamptz not null default now(),
  unique (student_id, key)
);

-- What the teacher sent to a student's page for one test.
create table public.sends (
  student_id text not null references public.students (id) on delete cascade,
  test_id text not null references public.tests (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  paper_at timestamptz,
  imps jsonb not null default '{}'::jsonb,  -- round id -> sent at
  plan jsonb,                                -- {kind, text, at}
  primary key (student_id, test_id)
);

create table public.perf_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students (id) on delete cascade,
  test_id text not null references public.tests (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  skills text[] not null default '{}',
  title text not null,
  descr text not null default '',
  deliver text not null default 'any' check (deliver in ('any', 'img', 'pdf', 'vid')),
  due date,
  rubric jsonb not null,
  sent_at timestamptz not null default now(),
  ai_eval jsonb,
  teacher_grade numeric,
  teacher_note text,
  unique (student_id, test_id)
);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.perf_tasks (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  kind text not null check (kind in ('img', 'pdf', 'vid')),
  storage_path text,
  thumbs text[] not null default '{}',  -- up to 4 small JPEG data URIs
  name text, size bigint, note text, duration int,
  submitted_at timestamptz not null default now()
);

-- Parent acknowledgements: key = test id, or 'ew:<test id>' for the early-warning notice.
create table public.acks (
  student_id text not null references public.students (id) on delete cascade,
  key text not null,
  school_id uuid not null references public.schools (id),
  seen_at timestamptz not null default now(),
  primary key (student_id, key)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  test_id text references public.tests (id) on delete set null,
  by text not null check (by in ('t', 'p')),
  text text not null check (length(text) <= 4000),
  at timestamptz not null default now()
);

create table public.behavior_events (
  id text primary key,
  student_id text not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  kind text not null check (kind in ('pos', 'neg')),
  type text not null,
  note text,
  date date not null,
  shared boolean not null default false,
  parent_seen_at timestamptz
);

create table public.class_groups (
  class_id uuid not null references public.classes (id) on delete cascade,
  idx int not null,
  school_id uuid not null references public.schools (id),
  teacher_id uuid not null references public.teachers (id),
  stars int not null default 0,
  members text[] not null default '{}',
  primary key (class_id, idx)
);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.teachers (id),
  student_id text references public.students (id) on delete set null,
  kind text not null,
  status text not null default 'ok',
  input_tokens int, output_tokens int,
  created_at timestamptz not null default now()
); -- never stores prompts, answers or names

create table public.login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index on public.login_attempts (ip_hash, at);

-- ---------------------------------------------------------------- helpers
create or replace function app.my_teacher() returns uuid
language sql stable security definer set search_path = '' as $$
  select t.id from public.teachers t where t.id = auth.uid()
$$;

create or replace function app.my_student() returns text
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s where s.auth_user_id is not null and s.auth_user_id = auth.uid()
$$;

create or replace function app.my_school() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select t.school_id from public.teachers t where t.id = auth.uid()),
    (select s.school_id from public.students s where s.auth_user_id = auth.uid()))
$$;

revoke all on schema app from public;
grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.schools enable row level security;
alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.skills enable row level security;
alter table public.questions enable row level security;
alter table public.qimg enable row level security;
alter table public.tests enable row level security;
alter table public.test_results enable row level security;
alter table public.improvement_rounds enable row level security;
alter table public.improvement_items enable row level security;
alter table public.sheets enable row level security;
alter table public.sends enable row level security;
alter table public.perf_tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.acks enable row level security;
alter table public.notes enable row level security;
alter table public.behavior_events enable row level security;
alter table public.class_groups enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.login_attempts enable row level security; -- no policies: server (service role) only

-- school header: anyone signed in to that school may read it
create policy school_read on public.schools for select to authenticated using (id = app.my_school());
create policy school_write on public.schools for update to authenticated using (id = (select school_id from public.teachers where id = app.my_teacher()));

create policy teacher_self on public.teachers for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy subjects_read on public.subjects for select to authenticated using (school_id = app.my_school());
create policy subjects_teacher on public.subjects for all to authenticated
  using (app.my_teacher() is not null and school_id = app.my_school()) with check (app.my_teacher() is not null and school_id = app.my_school());

-- teacher-owned tables: the teacher reads and writes her own rows
do $$
declare t text;
begin
  foreach t in array array['classes','students','skills','questions','qimg','tests','test_results','improvement_rounds',
                           'improvement_items','sheets','sends','perf_tasks','behavior_events','class_groups'] loop
    execute format('create policy %I on public.%I for all to authenticated using (teacher_id = app.my_teacher()) with check (teacher_id = app.my_teacher() and school_id = app.my_school())', t || '_teacher', t);
  end loop;
end $$;

-- tables without teacher_id: reach the teacher through the student
create policy acks_teacher on public.acks for all to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher()))
  with check (exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher()));
create policy notes_teacher on public.notes for all to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher()))
  with check (by = 't' and exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher()));
create policy subs_teacher on public.task_submissions for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher()));
create policy ai_jobs_teacher on public.ai_jobs for select to authenticated using (teacher_id = app.my_teacher());

-- student (and parent, who uses the same login): only her own rows
create policy students_self on public.students for select to authenticated using (id = app.my_student());
create policy classes_self on public.classes for select to authenticated
  using (id = (select class_id from public.students where id = app.my_student()));
create policy skills_student on public.skills for select to authenticated using (school_id = app.my_school());
create policy results_self on public.test_results for select to authenticated using (student_id = app.my_student());
create policy items_self on public.improvement_items for select to authenticated using (student_id = app.my_student());
create policy sheets_self on public.sheets for select to authenticated using (student_id = app.my_student() and sent_at is not null);
create policy sends_self on public.sends for select to authenticated using (student_id = app.my_student());
create policy tasks_self on public.perf_tasks for select to authenticated using (student_id = app.my_student());
create policy subs_self_read on public.task_submissions for select to authenticated using (student_id = app.my_student());
create policy subs_self_insert on public.task_submissions for insert to authenticated
  with check (student_id = app.my_student()
    and exists (select 1 from public.perf_tasks p where p.id = task_id and p.student_id = app.my_student() and p.teacher_grade is null));
create policy acks_self_read on public.acks for select to authenticated using (student_id = app.my_student());
create policy acks_self_write on public.acks for insert to authenticated with check (student_id = app.my_student());
create policy notes_self_read on public.notes for select to authenticated using (student_id = app.my_student());
create policy notes_self_write on public.notes for insert to authenticated with check (student_id = app.my_student() and by = 'p');
create policy beh_self_read on public.behavior_events for select to authenticated using (student_id = app.my_student() and shared);
create policy beh_self_seen on public.behavior_events for update to authenticated
  using (student_id = app.my_student() and shared) with check (student_id = app.my_student() and shared);

-- ---------------------------------------------------------------- column privileges
-- Test papers, question bank and improvement papers hold answer keys: students never read them directly
-- (the student page is built on the server and strips the keys). RLS above already limits them to the teacher;
-- column grants below add a second lock on the secrets inside students.
revoke all on all tables in schema public from anon;
revoke select, update on public.students from authenticated;
grant select (id, school_id, teacher_id, class_id, seat_no, name, stars, sort, has_pin, auth_user_id, created_at) on public.students to authenticated;
grant insert (id, school_id, teacher_id, class_id, seat_no, name, sort) on public.students to authenticated;
grant delete on public.students to authenticated;
-- the PIN columns are written only by the server (service role) after hashing
revoke update on public.teachers from authenticated;
grant update (display_name, subject, grade, term, year, pfont, settings) on public.teachers to authenticated;
revoke insert, delete on public.teachers from authenticated;
grant update (id, school_id, teacher_id, class_id, seat_no, name, stars, sort) on public.students to authenticated;
-- a student may only stamp parent_seen_at on a shared behaviour note
revoke update on public.behavior_events from authenticated;
grant update (parent_seen_at, kind, type, note, date, shared) on public.behavior_events to authenticated;
create or replace function app.beh_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if app.my_teacher() is null and (new.kind, new.type, new.note, new.date, new.shared) is distinct from (old.kind, old.type, old.note, old.date, old.shared) then
    raise exception 'students may only confirm they have seen a note';
  end if;
  return new;
end $$;
create trigger beh_guard before update on public.behavior_events for each row execute function app.beh_guard();
