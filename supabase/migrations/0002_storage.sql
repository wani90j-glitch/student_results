-- Private storage buckets. Nothing is public: pages get short-lived signed URLs from the server,
-- which first checks (with the user's own session and RLS) that the file belongs to her.
-- Paths: <school_id>/student/<student_id>/<key>/<file>   for sheets and submissions
--        <school_id>/<file>                                for question images and logos
insert into storage.buckets (id, name, public) values
  ('sheets', 'sheets', false), ('submissions', 'submissions', false), ('qimg', 'qimg', false), ('logos', 'logos', false)
on conflict (id) do nothing;

-- teacher: everything under her own students' folders, and her school's images
create policy itqan_teacher_student_files on storage.objects for all to authenticated
  using (bucket_id in ('sheets', 'submissions') and exists (
    select 1 from public.students s where s.id = (storage.foldername(objects.name))[3] and s.teacher_id = app.my_teacher()))
  with check (bucket_id in ('sheets', 'submissions') and exists (
    select 1 from public.students s where s.id = (storage.foldername(objects.name))[3] and s.teacher_id = app.my_teacher()));

create policy itqan_teacher_school_images on storage.objects for all to authenticated
  using (bucket_id in ('qimg', 'logos') and app.my_teacher() is not null and (storage.foldername(objects.name))[1] = app.my_school()::text)
  with check (bucket_id in ('qimg', 'logos') and app.my_teacher() is not null and (storage.foldername(objects.name))[1] = app.my_school()::text);

-- student: may upload her own performance-task work (read access goes through the server's signed URLs)
create policy itqan_student_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(objects.name))[3] = app.my_student());
