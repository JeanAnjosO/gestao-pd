drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences
for insert to authenticated
with check (
  private.has_unit_access(unit_id)
  and created_by = private.current_person_id()
  and (person_id = private.current_person_id() or private.is_manager())
  and (
    private.is_manager()
    or not exists (
      select 1 from public.operation_exceptions holiday
      where holiday.unit_id = absences.unit_id
        and holiday.date = absences.date
        and holiday.open = false
    )
  )
);

drop policy if exists solo_classes_insert on public.solo_classes;
create policy solo_classes_insert on public.solo_classes
for insert to authenticated
with check (
  private.has_unit_access(unit_id)
  and teacher_id = private.current_person_id()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and not exists (
    select 1 from public.operation_exceptions holiday
    where holiday.unit_id = solo_classes.unit_id
      and holiday.date = solo_classes.date
      and holiday.open = false
  )
);

drop policy if exists solo_classes_update_teacher on public.solo_classes;
create policy solo_classes_update_teacher on public.solo_classes
for update to authenticated
using (
  teacher_id = private.current_person_id()
  and status = 'pending'
  and not exists (
    select 1 from public.operation_exceptions holiday
    where holiday.unit_id = solo_classes.unit_id
      and holiday.date = solo_classes.date
      and holiday.open = false
  )
)
with check (
  teacher_id = private.current_person_id()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and not exists (
    select 1 from public.operation_exceptions holiday
    where holiday.unit_id = solo_classes.unit_id
      and holiday.date = solo_classes.date
      and holiday.open = false
  )
);
