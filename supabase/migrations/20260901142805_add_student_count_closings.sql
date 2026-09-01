create table public.student_count_closings (
  id bigint generated always as identity primary key,
  unit_id bigint not null references public.units(id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  month smallint not null check (month between 1 and 12),
  wellhub_frequent integer not null check (wellhub_frequent >= 0),
  wellhub_twelve_or_more integer not null check (wellhub_twelve_or_more >= 0),
  wellhub_below_four integer not null check (wellhub_below_four >= 0),
  wellhub_twelve_or_more_people jsonb not null default '[]'::jsonb check (jsonb_typeof(wellhub_twelve_or_more_people) = 'array'),
  cloudgym_enrolled integer not null check (cloudgym_enrolled >= 0),
  cloudgym_frequent_totalpass integer not null check (cloudgym_frequent_totalpass >= 0),
  wellhub_file_name text,
  cloudgym_file_name text,
  saved_by bigint not null references public.people(id),
  saved_at timestamptz not null default now(),
  constraint student_count_closings_unit_competence_key unique (unit_id, year, month)
);

alter table public.student_count_closings enable row level security;

create policy student_count_closings_select on public.student_count_closings
  for select to authenticated
  using (private.is_unit_manager(unit_id));

create policy student_count_closings_insert on public.student_count_closings
  for insert to authenticated
  with check (private.is_unit_manager(unit_id));

create policy student_count_closings_update on public.student_count_closings
  for update to authenticated
  using (private.is_unit_manager(unit_id))
  with check (private.is_unit_manager(unit_id));

create policy student_count_closings_delete on public.student_count_closings
  for delete to authenticated
  using (private.is_unit_manager(unit_id));

grant select, insert, update, delete on public.student_count_closings to authenticated;
grant usage, select on sequence public.student_count_closings_id_seq to authenticated;
