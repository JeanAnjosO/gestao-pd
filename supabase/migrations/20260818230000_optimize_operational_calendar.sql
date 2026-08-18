create index if not exists units_calendar_mode_type_idx on public.units(calendar_mode_type_id);
create index if not exists person_operational_capabilities_type_idx on public.person_operational_capabilities(capability_type_id);
create index if not exists calendar_periods_created_by_idx on public.calendar_periods(created_by);
create index if not exists calendar_periods_published_by_idx on public.calendar_periods(published_by);
create index if not exists calendar_day_notes_updated_by_idx on public.calendar_day_notes(updated_by);
create index if not exists calendar_assignments_assignment_type_idx on public.calendar_assignments(assignment_type_id);
create index if not exists calendar_assignments_class_type_idx on public.calendar_assignments(class_type_id);
create index if not exists calendar_assignments_created_by_idx on public.calendar_assignments(created_by);
create index if not exists calendar_assignments_updated_by_idx on public.calendar_assignments(updated_by);

drop policy if exists person_operational_capabilities_manage on public.person_operational_capabilities;
create policy person_operational_capabilities_insert on public.person_operational_capabilities for insert to authenticated with check (private.is_manager());
create policy person_operational_capabilities_update on public.person_operational_capabilities for update to authenticated using (private.is_manager()) with check (private.is_manager());
create policy person_operational_capabilities_delete on public.person_operational_capabilities for delete to authenticated using (private.is_manager());

drop policy if exists calendar_periods_manage on public.calendar_periods;
create policy calendar_periods_insert on public.calendar_periods for insert to authenticated with check (private.is_unit_manager(unit_id));
create policy calendar_periods_update on public.calendar_periods for update to authenticated using (private.is_unit_manager(unit_id)) with check (private.is_unit_manager(unit_id));
create policy calendar_periods_delete on public.calendar_periods for delete to authenticated using (private.is_unit_manager(unit_id));

drop policy if exists calendar_day_notes_manage on public.calendar_day_notes;
create policy calendar_day_notes_insert on public.calendar_day_notes for insert to authenticated with check (private.is_unit_manager(unit_id));
create policy calendar_day_notes_update on public.calendar_day_notes for update to authenticated using (private.is_unit_manager(unit_id)) with check (private.is_unit_manager(unit_id));
create policy calendar_day_notes_delete on public.calendar_day_notes for delete to authenticated using (private.is_unit_manager(unit_id));

drop policy if exists calendar_assignments_manage on public.calendar_assignments;
create policy calendar_assignments_insert on public.calendar_assignments for insert to authenticated with check (private.is_unit_manager(unit_id));
create policy calendar_assignments_update on public.calendar_assignments for update to authenticated using (private.is_unit_manager(unit_id)) with check (private.is_unit_manager(unit_id));
create policy calendar_assignments_delete on public.calendar_assignments for delete to authenticated using (private.is_unit_manager(unit_id));
