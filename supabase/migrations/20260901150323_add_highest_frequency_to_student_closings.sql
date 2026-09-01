alter table public.student_count_closings
  add column highest_frequency_people jsonb not null default '[]'::jsonb
    check (jsonb_typeof(highest_frequency_people) = 'array'),
  add column highest_frequency_file_name text;

drop policy if exists student_count_closings_update on public.student_count_closings;
drop policy if exists student_count_closings_delete on public.student_count_closings;

revoke update, delete on public.student_count_closings from authenticated;
