alter table public.student_calendar_notes drop constraint student_calendar_notes_category_check;
alter table public.student_calendar_notes add constraint student_calendar_notes_category_check check (category in ('event','workshop','holiday','simulation','notice'));
