create table public.unit_recesses (
  id bigint generated always as identity primary key,
  unit_id bigint not null references public.units(id) on delete cascade,
  last_open_on date not null,
  return_on date not null,
  constraint unit_recess_has_blocked_day check (return_on - last_open_on > 1),
  unique (unit_id, last_open_on, return_on)
);

alter table public.unit_recesses enable row level security;
revoke all on public.unit_recesses from anon, authenticated;
grant select, insert, delete on public.unit_recesses to authenticated;

create policy unit_recesses_read on public.unit_recesses
for select to authenticated using (private.has_unit_access(unit_id));

create policy unit_recesses_insert on public.unit_recesses
for insert to authenticated with check (private.has_unit_access(unit_id) and private.is_manager());

create policy unit_recesses_delete on public.unit_recesses
for delete to authenticated using (private.has_unit_access(unit_id) and private.is_manager());

create function private.reject_recess_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.unit_recesses recess
    where recess.unit_id = new.unit_id
      and recess.last_open_on < new.date and new.date < recess.return_on
  ) then
    raise exception 'Data bloqueada pelo recesso.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_recess_entry() from public;

create trigger absences_recess_guard
before insert or update of unit_id, date on public.absences
for each row execute function private.reject_recess_entry();

create trigger solo_classes_recess_guard
before insert or update of unit_id, date, status on public.solo_classes
for each row execute function private.reject_recess_entry();
