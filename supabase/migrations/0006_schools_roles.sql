-- Phase 2: many schools, school roles, one sign-in per student across all her teachers, and parents with their own code.
--
-- Ownership stays as before: every row of a teacher's work belongs to that teacher (teacher_id) inside a school.
-- * An individual teacher (school not subscribed, or not joined) is seen by nobody else.
-- * In a subscribed school, the principal / deputies / counselor read the work of the teachers who JOINED the school
--   (school_members, status 'active'), each role only what it needs. They never write teachers' data.
-- * A student signs in once (her national ID) and reads her records from every teacher who has her.
-- * A parent signs in with a parent code; one parent account can follow several daughters.

-- ---------------------------------------------------------------- school directory
alter table public.schools add column code text unique;                 -- short link: itqanloop.com/s/<code>
alter table public.schools add column ministry_no text unique;          -- الرقم الوزاري: prevents duplicates
alter table public.schools add column city text;
alter table public.schools add column edu_dept text;
alter table public.schools add column stage text check (stage in ('primary', 'intermediate', 'secondary', 'other'));
alter table public.schools add column gender text check (gender in ('girls', 'boys', 'mixed'));
alter table public.schools add column plan text not null default 'none' check (plan in ('none', 'school'));
alter table public.schools add column created_by uuid references auth.users (id) on delete set null;
alter table public.schools add column reviewed boolean not null default false;
alter table public.schools add column merged_into uuid references public.schools (id);

-- ---------------------------------------------------------------- school roles
create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text,                                   -- invitation sent before the person has an account
  role text not null check (role in ('principal', 'academic_deputy', 'student_deputy', 'counselor', 'teacher')),
  status text not null default 'invited' check (status in ('invited', 'requested', 'active', 'removed')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);
create index on public.school_members (user_id);
alter table public.school_members enable row level security;

-- the school a staff member (non-teacher role) actively serves, and that role; only for subscribed schools
create or replace function app.my_staff() returns table (school_id uuid, role text)
language sql stable security definer set search_path = '' as $$
  select m.school_id, m.role from public.school_members m join public.schools s on s.id = m.school_id
  where m.user_id = auth.uid() and m.status = 'active' and m.role <> 'teacher' and s.plan = 'school'
$$;
-- teachers whose work this staff member may read: active teacher members of her subscribed school
create or replace function app.staff_teachers(area text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.school_members m
  join app.my_staff() st on st.school_id = m.school_id
  where m.role = 'teacher' and m.status = 'active' and m.user_id is not null
    and case area
      when 'academic' then st.role in ('principal', 'academic_deputy')
      when 'behavior' then st.role in ('principal', 'student_deputy', 'counselor')
      when 'parents'  then st.role in ('principal', 'student_deputy', 'counselor', 'academic_deputy')
      when 'warning'  then st.role in ('principal', 'academic_deputy', 'counselor')
      when 'roster'   then true
      else false end
$$;

-- members: each person sees her own memberships; a principal manages her school's
create policy members_self on public.school_members for select to authenticated using (user_id = auth.uid());
create policy members_principal on public.school_members for select to authenticated
  using (school_id in (select school_id from app.my_staff() where role = 'principal'));
-- (invitations, requests and approvals are written by the server after checking the caller)

-- ---------------------------------------------------------------- one sign-in per student
create table public.student_identities (
  pin_lookup text primary key,                  -- HMAC of the national ID (never the number itself)
  pin_hash text not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.student_identities enable row level security;  -- server only
insert into public.student_identities (pin_lookup, pin_hash, auth_user_id)
  select distinct on (pin_lookup) pin_lookup, pin_hash, auth_user_id from public.students where pin_lookup is not null and pin_hash is not null
  on conflict do nothing;
-- the same student may now appear once per teacher
alter table public.students drop constraint if exists students_pin_lookup_key;
alter table public.students drop constraint if exists students_auth_user_id_key;
create unique index students_teacher_pin on public.students (teacher_id, pin_lookup);

-- ---------------------------------------------------------------- parents
create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.parent_codes (
  code_lookup text primary key,                 -- HMAC of the code; the code itself is shown once to the teacher
  code_hash text not null,
  student_pin_lookup text not null,             -- the daughter (through her identity, so it covers all her teachers)
  guardian_id uuid references public.guardians (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.guardians enable row level security;    -- server only
alter table public.parent_codes enable row level security; -- server only

-- ---------------------------------------------------------------- who the signed-in student or parent is
create or replace function app.my_student_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s join public.student_identities i on i.pin_lookup = s.pin_lookup
  where i.auth_user_id is not null and i.auth_user_id = auth.uid()
$$;
create or replace function app.my_child_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  join public.parent_codes c on c.student_pin_lookup = s.pin_lookup and not c.revoked
  join public.guardians g on g.id = c.guardian_id
  where g.auth_user_id is not null and g.auth_user_id = auth.uid()
$$;
-- records a student or a parent may read
create or replace function app.my_reader_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select app.my_student_ids() union select app.my_child_ids()
$$;
-- kept for older code paths: one of the student's records
create or replace function app.my_student() returns text
language sql stable security definer set search_path = '' as $$
  select app.my_student_ids() limit 1
$$;
create or replace function app.my_school() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select t.school_id from public.teachers t where t.id = auth.uid()),
    (select school_id from app.my_staff() limit 1),
    (select s.school_id from public.students s where s.id in (select app.my_reader_ids()) limit 1))
$$;
create or replace function app.audit_actor_role() returns text language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then 'server' when app.my_teacher() is not null then 'teacher'
    when exists (select 1 from app.my_staff()) then 'staff'
    when exists (select 1 from app.my_child_ids()) then 'guardian'
    when exists (select 1 from app.my_student_ids()) then 'student' else 'server' end
$$;
grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------- student & parent policies (replace the single-student ones)
drop policy students_self on public.students;
drop policy classes_self on public.classes;
drop policy results_self on public.test_results;
drop policy items_self on public.improvement_items;
drop policy sheets_self on public.sheets;
drop policy sends_self on public.sends;
drop policy tasks_self on public.perf_tasks;
drop policy subs_self_read on public.task_submissions;
drop policy subs_self_insert on public.task_submissions;
drop policy acks_self_read on public.acks;
drop policy acks_self_write on public.acks;
drop policy notes_self_read on public.notes;
drop policy notes_self_write on public.notes;
drop policy beh_self_read on public.behavior_events;
drop policy beh_self_seen on public.behavior_events;

create policy students_reader on public.students for select to authenticated using (id in (select app.my_reader_ids()));
create policy classes_reader on public.classes for select to authenticated
  using (id in (select class_id from public.students where id in (select app.my_reader_ids())));
create policy results_reader on public.test_results for select to authenticated using (student_id in (select app.my_reader_ids()));
create policy items_reader on public.improvement_items for select to authenticated using (student_id in (select app.my_reader_ids()));
create policy sheets_reader on public.sheets for select to authenticated using (student_id in (select app.my_reader_ids()) and sent_at is not null);
create policy sends_reader on public.sends for select to authenticated using (student_id in (select app.my_reader_ids()));
create policy tasks_reader on public.perf_tasks for select to authenticated using (student_id in (select app.my_reader_ids()));
create policy subs_reader on public.task_submissions for select to authenticated using (student_id in (select app.my_reader_ids()));
-- the student hands in her own work (the server records it); a parent does not
create policy subs_student_insert on public.task_submissions for insert to authenticated
  with check (student_id in (select app.my_student_ids())
    and exists (select 1 from public.perf_tasks p where p.id = task_id and p.student_id = task_submissions.student_id
                and (case when p.set_id is null then p.teacher_grade is null else p.status <> 'mastered' end)));
create policy acks_reader on public.acks for select to authenticated using (student_id in (select app.my_reader_ids()));
create policy notes_reader on public.notes for select to authenticated using (student_id in (select app.my_reader_ids()));
create policy beh_reader on public.behavior_events for select to authenticated using (student_id in (select app.my_reader_ids()) and shared);
-- acknowledgements, parent notes and "seen" on behaviour notes come from the PARENT only
create policy acks_guardian_write on public.acks for insert to authenticated with check (student_id in (select app.my_child_ids()));
create policy notes_guardian_write on public.notes for insert to authenticated with check (student_id in (select app.my_child_ids()) and by = 'p');
create policy beh_guardian_seen on public.behavior_events for update to authenticated
  using (student_id in (select app.my_child_ids()) and shared) with check (student_id in (select app.my_child_ids()) and shared);

drop policy itqan_student_upload on storage.objects;
create policy itqan_student_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(objects.name))[3] in (select app.my_student_ids()));

-- ---------------------------------------------------------------- school staff: read-only, by role
create policy staff_roster_students on public.students for select to authenticated using (teacher_id in (select app.staff_teachers('roster')));
create policy staff_roster_classes on public.classes for select to authenticated using (teacher_id in (select app.staff_teachers('roster')));
create policy staff_tests on public.tests for select to authenticated
  using (teacher_id in (select app.staff_teachers('academic')) or teacher_id in (select app.staff_teachers('warning')) or teacher_id in (select app.staff_teachers('parents')));
create policy staff_results on public.test_results for select to authenticated
  using (teacher_id in (select app.staff_teachers('academic')) or teacher_id in (select app.staff_teachers('warning')));
create policy staff_rounds on public.improvement_rounds for select to authenticated using (teacher_id in (select app.staff_teachers('academic')) or teacher_id in (select app.staff_teachers('warning')));
create policy staff_items on public.improvement_items for select to authenticated using (teacher_id in (select app.staff_teachers('academic')) or teacher_id in (select app.staff_teachers('warning')));
create policy staff_skills on public.skills for select to authenticated using (teacher_id in (select app.staff_teachers('academic')) or teacher_id in (select app.staff_teachers('warning')));
create policy staff_questions on public.questions for select to authenticated using (teacher_id in (select app.staff_teachers('academic')));
create policy staff_tasks on public.perf_tasks for select to authenticated using (teacher_id in (select app.staff_teachers('academic')));
create policy staff_sends on public.sends for select to authenticated using (teacher_id in (select app.staff_teachers('parents')));
create policy staff_behavior on public.behavior_events for select to authenticated using (teacher_id in (select app.staff_teachers('behavior')));
create policy staff_acks on public.acks for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.teacher_id in (select app.staff_teachers('parents'))));
create policy staff_notes on public.notes for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.teacher_id in (select app.staff_teachers('parents'))));
create policy staff_audit on public.audit_log for select to authenticated using (teacher_id in (select app.staff_teachers('academic')));
-- staff may read the teachers' names of their school
create policy staff_teachers on public.teachers for select to authenticated using (id in (select app.staff_teachers('roster')));
