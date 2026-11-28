-- Subjects are named per school (two schools may both have "sci9"): key them by (school_id, id).
alter table public.skills drop constraint if exists skills_subject_id_fkey;
alter table public.subjects drop constraint subjects_pkey;
alter table public.subjects add primary key (school_id, id);
