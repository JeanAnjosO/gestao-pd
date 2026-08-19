create table public.unit_compensation_rates (
  unit_id bigint not null references public.units(id) on delete cascade,
  level_code smallint not null check (level_code between 0 and 4),
  half_day_amount numeric(10,2) not null default 0 check (half_day_amount >= 0),
  full_day_amount numeric(10,2) not null default 0 check (full_day_amount >= 0),
  fixed_daily_amount numeric(10,2) not null default 0 check (fixed_daily_amount >= 0),
  hourly_amount numeric(10,2) not null default 0 check (hourly_amount >= 0),
  updated_by bigint references public.people(id),
  updated_at timestamptz not null default now(),
  primary key (unit_id, level_code),
  check (
    (level_code = 0 and half_day_amount = 0 and full_day_amount = 0 and hourly_amount = 0)
    or (level_code between 1 and 4 and fixed_daily_amount = 0)
  )
);
create index unit_compensation_rates_updated_by_idx on public.unit_compensation_rates(updated_by);

insert into public.unit_compensation_rates (unit_id, level_code)
select units.id, levels.level_code
from public.units
cross join (values (0), (1), (2), (3), (4)) as levels(level_code)
on conflict do nothing;

alter table public.unit_compensation_rates enable row level security;

create policy unit_compensation_rates_read on public.unit_compensation_rates
  for select to authenticated using (private.has_unit_access(unit_id));

create policy unit_compensation_rates_manage on public.unit_compensation_rates
  for all to authenticated
  using (private.is_unit_manager(unit_id))
  with check (private.is_unit_manager(unit_id));

grant select, insert, update on public.unit_compensation_rates to authenticated;
