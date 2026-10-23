alter table public.unit_memberships add column started_on date;

create or replace function public.set_team_start_date(p_unit_id bigint, p_person_id bigint, p_started_on date)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  first_date date;
  next_date date;
  affected_end date;
  today_local date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not coalesce(private.is_unit_manager(p_unit_id), false) then
    raise exception 'Sem permissão para alterar esta unidade.';
  end if;
  perform 1 from public.unit_memberships where unit_id = p_unit_id and person_id = p_person_id for update;
  if not found then raise exception 'Pessoa não vinculada à unidade.'; end if;
  if p_started_on > today_local or p_started_on < date '2000-01-01' then
    raise exception 'Informe uma data de início válida até hoje.';
  end if;
  select min(starts_on) into first_date from public.schedules where unit_id = p_unit_id and person_id = p_person_id;
  if p_started_on is not null and first_date is not null and p_started_on <> first_date then
    select min(starts_on) into next_date from public.schedules
      where unit_id = p_unit_id and person_id = p_person_id and starts_on > first_date;
    if next_date is not null and p_started_on >= next_date then
      raise exception 'A data de início deve anteceder as alterações posteriores de escala.';
    end if;
    if exists(select 1 from public.schedules where unit_id = p_unit_id and person_id = p_person_id
      and starts_on = first_date and ends_on < p_started_on) then
      raise exception 'A data de início não pode ser posterior ao encerramento da primeira escala.';
    end if;
    affected_end := greatest(first_date, p_started_on) - 1;
    if exists(select 1 from public.monthly_periods where unit_id = p_unit_id and status = 'closed'
      and make_date(year, month, 1) <= affected_end
      and (make_date(year, month, 1) + interval '1 month')::date > least(first_date, p_started_on)) then
      raise exception 'A correção afeta uma competência fechada. Reabra a competência antes de corrigir.';
    end if;
    update public.schedules set starts_on = p_started_on
      where unit_id = p_unit_id and person_id = p_person_id and starts_on = first_date;
  end if;
  update public.unit_memberships set started_on = p_started_on where unit_id = p_unit_id and person_id = p_person_id;
end;
$$;

create or replace function public.create_initial_team_schedule(p_unit_id bigint, p_person_id bigint, p_weekdays smallint[], p_daily_type text)
returns setof public.schedules language plpgsql security invoker set search_path = '' as $$
declare
  effective_date date;
  today_local date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not coalesce(private.is_unit_manager(p_unit_id), false) then raise exception 'Sem permissão para alterar esta unidade.'; end if;
  select coalesce(started_on, today_local) into effective_date from public.unit_memberships
    where unit_id = p_unit_id and person_id = p_person_id for update;
  if not found then raise exception 'Pessoa não vinculada à unidade.'; end if;
  if exists(select 1 from public.schedules where unit_id = p_unit_id and person_id = p_person_id) then
    raise exception 'Esta pessoa já tem histórico de escala. Use a edição de escala.';
  end if;
  if effective_date > today_local or effective_date < date '2000-01-01' then raise exception 'Data de início inválida.'; end if;
  if exists(select 1 from public.monthly_periods where unit_id = p_unit_id and status = 'closed'
    and make_date(year, month, 1) <= today_local
    and (make_date(year, month, 1) + interval '1 month')::date > effective_date) then
    raise exception 'A data de início afeta uma competência fechada. Reabra a competência antes de continuar.';
  end if;
  return query select * from public.replace_schedule_from_date(p_unit_id, p_person_id, p_weekdays, p_daily_type, effective_date);
end;
$$;

revoke all on function public.set_team_start_date(bigint,bigint,date) from public, anon;
revoke all on function public.create_initial_team_schedule(bigint,bigint,smallint[],text) from public, anon;
grant execute on function public.set_team_start_date(bigint,bigint,date) to authenticated;
grant execute on function public.create_initial_team_schedule(bigint,bigint,smallint[],text) to authenticated;
