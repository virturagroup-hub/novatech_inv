begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.inventory_role as enum ('admin', 'manager', 'technician', 'viewer');
exception
  when duplicate_object then null;
end $$;

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
  role public.inventory_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
      and is_active = true
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
      and is_active = true
  );
$$;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  location_code text not null unique,
  area text not null,
  shelf integer not null default 1,
  bin integer not null default 1,
  description text not null default '',
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  part_number text not null unique,
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

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create trigger set_models_updated_at
before update on public.models
for each row execute function public.set_updated_at();

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
  insert into public.profiles (id, full_name, role)
  values (new.id, null, 'viewer')
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

create policy "Profiles: self read"
on public.profiles
for select
using (id = auth.uid() or public.is_elevated_user());

create policy "Profiles: self update"
on public.profiles
for update
using (id = auth.uid() or public.is_elevated_user())
with check (id = auth.uid() or public.is_elevated_user());

create policy "Locations: authenticated read"
on public.locations
for select
to authenticated
using (true);

create policy "Locations: elevated write"
on public.locations
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

create policy "Models: authenticated read"
on public.models
for select
to authenticated
using (true);

create policy "Models: elevated write"
on public.models
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

create policy "Parts: authenticated read"
on public.parts
for select
to authenticated
using (true);

create policy "Parts: elevated write"
on public.parts
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

create policy "Part model links: authenticated read"
on public.part_model_links
for select
to authenticated
using (true);

create policy "Part model links: elevated write"
on public.part_model_links
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

create policy "Transactions: activity readers"
on public.inventory_transactions
for select
to authenticated
using (public.can_view_activity());

create policy "Transactions: elevated write"
on public.inventory_transactions
for all
to authenticated
using (public.is_elevated_user())
with check (public.is_elevated_user());

commit;
