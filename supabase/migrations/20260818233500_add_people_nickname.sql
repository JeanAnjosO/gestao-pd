alter table public.people add column if not exists nickname text;

alter table public.people
  drop constraint if exists people_nickname_length_check;

alter table public.people
  add constraint people_nickname_length_check
  check (nickname is null or char_length(trim(nickname)) between 1 and 40);
