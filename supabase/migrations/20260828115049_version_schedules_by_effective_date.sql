create or replace function public.replace_schedule_from_date(
  p_unit_id bigint,
  p_person_id bigint,
  p_weekdays smallint[],
  p_daily_type text,
  p_effective_on date
)
returns setof public.schedules
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'A escala deve ter ao menos um dia da semana.';
  end if;

  if exists (select 1 from unnest(p_weekdays) as weekday where weekday < 0 or weekday > 6) then
    raise exception 'Dia da semana inválido.';
  end if;

  if p_daily_type not in ('half', 'full', 'manager_support') then
    raise exception 'Tipo de diária inválido.';
  end if;

  update public.schedules
  set ends_on = p_effective_on - 1
  where unit_id = p_unit_id
    and person_id = p_person_id
    and ends_on is null
    and starts_on < p_effective_on;

  delete from public.schedules
  where unit_id = p_unit_id
    and person_id = p_person_id
    and ends_on is null
    and starts_on >= p_effective_on;

  insert into public.schedules (unit_id, person_id, weekday, daily_type, starts_on, ends_on)
  select p_unit_id, p_person_id, weekday, p_daily_type, p_effective_on, null
  from (select distinct unnest(p_weekdays) as weekday) as selected_days;

  return query
  select schedule.*
  from public.schedules as schedule
  where schedule.unit_id = p_unit_id
    and schedule.person_id = p_person_id
    and schedule.ends_on is null
  order by schedule.weekday;
end;
$$;

revoke execute on function public.replace_schedule_from_date(bigint, bigint, smallint[], text, date) from public, anon;
grant execute on function public.replace_schedule_from_date(bigint, bigint, smallint[], text, date) to authenticated;
