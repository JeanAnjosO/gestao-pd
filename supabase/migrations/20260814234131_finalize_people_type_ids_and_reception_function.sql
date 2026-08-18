create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.people
    where auth_user_id = (select auth.uid())
      and access_role_type_id = 1
      and active
  )
$function$;

create or replace function private.is_unit_manager(target_unit_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.people p
    join public.unit_memberships um on um.person_id = p.id
    where p.auth_user_id = (select auth.uid())
      and p.access_role_type_id = 1
      and p.active
      and um.unit_id = target_unit_id
  )
$function$;

alter table public.people
  alter column function_type_id drop not null,
  alter column function_type_id drop default;

update public.people
set function_type_id = null
where person_type_id = 4;

alter table public.people
  add constraint people_function_matches_person_type
  check (
    (person_type_id = 4 and function_type_id is null)
    or
    (person_type_id <> 4 and function_type_id is not null)
  );

alter table public.people
  drop column person_type,
  drop column access_role;
