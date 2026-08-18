create table public.person_types (
  id smallint primary key,
  code text not null unique,
  label text not null
);

create table public.access_role_types (
  id smallint primary key,
  code text not null unique,
  label text not null
);

create table public.person_function_types (
  id smallint primary key,
  code text not null unique,
  label text not null
);

insert into public.person_types (id, code, label) values
  (1, 'manager', 'Gestor'),
  (2, 'teacher', 'Professor'),
  (3, 'intern', 'Estagiário'),
  (4, 'reception', 'Recepção');

insert into public.access_role_types (id, code, label) values
  (1, 'manager', 'Gestor'),
  (2, 'teacher', 'Professor'),
  (3, 'intern', 'Estagiário'),
  (4, 'reception', 'Recepção');

insert into public.person_function_types (id, code, label) values
  (1, 'conductor', 'Condutor'),
  (2, 'follower', 'Conduzido'),
  (3, 'both', 'Duas funções');

alter table public.people
  add column person_type_id smallint references public.person_types(id),
  add column access_role_type_id smallint references public.access_role_types(id),
  add column function_type_id smallint references public.person_function_types(id) default 3;

update public.people
set person_type_id = case person_type
      when 'manager' then 1 when 'teacher' then 2 when 'intern' then 3 when 'reception' then 4 end,
    access_role_type_id = case
      when person_type = 'intern' then 3
      when access_role = 'manager' then 1 when access_role = 'teacher' then 2 when access_role = 'reception' then 4 end,
    function_type_id = 3;

alter table public.people
  alter column person_type_id set not null,
  alter column access_role_type_id set not null,
  alter column function_type_id set not null;

create index people_person_type_id_idx on public.people(person_type_id);
create index people_access_role_type_id_idx on public.people(access_role_type_id);
create index people_function_type_id_idx on public.people(function_type_id);

alter table public.person_types enable row level security;
alter table public.access_role_types enable row level security;
alter table public.person_function_types enable row level security;

create policy "Authenticated users can read person types"
  on public.person_types for select to authenticated using (true);
create policy "Authenticated users can read access role types"
  on public.access_role_types for select to authenticated using (true);
create policy "Authenticated users can read function types"
  on public.person_function_types for select to authenticated using (true);

grant select on public.person_types to authenticated;
grant select on public.access_role_types to authenticated;
grant select on public.person_function_types to authenticated;

comment on column public.people.person_type is 'Deprecated compatibility field; use person_type_id.';
comment on column public.people.access_role is 'Deprecated compatibility field; use access_role_type_id.';
