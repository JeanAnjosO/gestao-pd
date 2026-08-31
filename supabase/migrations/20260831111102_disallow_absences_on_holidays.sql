drop policy if exists absences_insert on public.absences;

create policy absences_insert on public.absences
for insert to authenticated
with check (
  private.has_unit_access(unit_id)
  and created_by = private.current_person_id()
  and (person_id = private.current_person_id() or private.is_manager())
  and not exists (
    select 1
    from public.operation_exceptions holiday
    where holiday.unit_id = absences.unit_id
      and holiday.date = absences.date
      and holiday.open = false
  )
);
