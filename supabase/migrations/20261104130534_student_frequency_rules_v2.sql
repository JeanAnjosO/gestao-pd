alter table public.student_count_closings add column frequency_rules_version smallint not null default 1 check (frequency_rules_version in (1,2));
alter table public.student_count_closings add column wellhub_below_eight integer check (wellhub_below_eight >= 0);
