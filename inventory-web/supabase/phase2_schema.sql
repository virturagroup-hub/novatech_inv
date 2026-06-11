begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.record_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'manager', 'technician', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_active'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'active'
  ) then
    execute 'alter table public.profiles rename column is_active to active';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'active'
  ) then
    execute 'alter table public.profiles add column active boolean';
  end if;

  execute 'update public.profiles set active = true where active is null';
  execute 'alter table public.profiles alter column active set default true';
  execute 'alter table public.profiles alter column active set not null';
  execute 'alter table public.profiles drop column if exists is_active';
end $$;

create or replace function public.is_elevated_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
      and active = true
  );
$$;

create or replace function public.can_view_activity()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager', 'technician')
      and active = true
  );
$$;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  location_code text not null unique,
  name text not null default '',
  area text not null,
  shelf integer not null default 1,
  bin integer not null default 1,
  description text not null default '',
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'locations'
      and column_name = 'name'
  ) then
    execute 'alter table public.locations add column name text';
  end if;

  execute $stmt$
    update public.locations
    set name = coalesce(nullif(trim(name), ''), nullif(trim(description), ''), location_code)
    where name is null or trim(name) = ''
  $stmt$;

  execute $stmt$alter table public.locations alter column name set default ''$stmt$;
  execute 'alter table public.locations alter column name set not null';
end $$;

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model_name text not null,
  series text not null default '',
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manufacturer, model_name)
);

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  part_number text unique,
  is_npn boolean not null default false,
  part_name text not null,
  manufacturer text not null,
  category text not null,
  location_id uuid references public.locations(id) on delete set null,
  quantity_on_hand integer not null default 0,
  reorder_point integer not null default 0,
  reorder_target integer not null default 0,
  universal boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parts'
      and column_name = 'is_npn'
  ) then
    execute 'alter table public.parts add column is_npn boolean not null default false';
  end if;

  execute $stmt$
    update public.parts
    set is_npn = true,
        part_number = null
    where upper(coalesce(part_number, '')) = 'NPN'
  $stmt$;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parts'
      and column_name = 'part_number'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.parts alter column part_number drop not null';
  end if;
end $$;

create table if not exists public.part_model_links (
  part_id uuid not null references public.parts(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (part_id, model_id)
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  transaction_type text not null,
  delta integer not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_locations_updated_at on public.locations;
create trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

drop trigger if exists set_models_updated_at on public.models;
create trigger set_models_updated_at
before update on public.models
for each row execute function public.set_updated_at();

drop trigger if exists set_parts_updated_at on public.parts;
create trigger set_parts_updated_at
before update on public.parts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'viewer',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.models enable row level security;
alter table public.parts enable row level security;
alter table public.part_model_links enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists "Profiles: self read" on public.profiles;
create policy "Profiles: self read"
on public.profiles
for select
using (id = auth.uid() or public.is_elevated_user());

drop policy if exists "Locations: authenticated read" on public.locations;
create policy "Locations: authenticated read"
on public.locations
for select
to authenticated
using (true);

drop policy if exists "Locations: elevated write" on public.locations;
create policy "Locations: elevated write"
on public.locations
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

drop policy if exists "Models: authenticated read" on public.models;
create policy "Models: authenticated read"
on public.models
for select
to authenticated
using (true);

drop policy if exists "Models: elevated write" on public.models;
create policy "Models: elevated write"
on public.models
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

drop policy if exists "Parts: authenticated read" on public.parts;
create policy "Parts: authenticated read"
on public.parts
for select
to authenticated
using (true);

drop policy if exists "Parts: elevated write" on public.parts;
create policy "Parts: elevated write"
on public.parts
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

drop policy if exists "Part model links: authenticated read" on public.part_model_links;
create policy "Part model links: authenticated read"
on public.part_model_links
for select
to authenticated
using (true);

drop policy if exists "Part model links: elevated write" on public.part_model_links;
create policy "Part model links: elevated write"
on public.part_model_links
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

drop policy if exists "Transactions: activity readers" on public.inventory_transactions;
create policy "Transactions: activity readers"
on public.inventory_transactions
for select
to authenticated
using (public.can_view_activity());

drop policy if exists "Transactions: elevated write" on public.inventory_transactions;
create policy "Transactions: elevated write"
on public.inventory_transactions
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

commit;
