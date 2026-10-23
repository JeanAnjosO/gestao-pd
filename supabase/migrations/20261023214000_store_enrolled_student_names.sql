alter table public.student_count_closings
  add column cloudgym_enrolled_people jsonb default null
  check (cloudgym_enrolled_people is null or jsonb_typeof(cloudgym_enrolled_people) = 'array');

comment on column public.student_count_closings.cloudgym_enrolled_people is
  'Unique CloudGym enrolled names excluding Gympass/TotalPass; null means a legacy closing without stored names.';
