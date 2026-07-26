begin;

-- The Supabase CLI is not installed in the current workspace, so this migration
-- is kept as a normal timestamped migration file for the project deploy step.

create table if not exists public.workspace_records (
  id text primary key,
  record_type text not null check (
    record_type in (
      'faq',
      'forum_thread',
      'forum_post',
      'feature_request_vote',
      'update_log',
      'coming_soon',
      'sop',
      'notification',
      'green_machine',
      'green_machine_event'
    )
  ),
  owner_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_records_type_updated_idx
  on public.workspace_records (record_type, updated_at desc);

create index if not exists workspace_records_retention_idx
  on public.workspace_records (purge_after)
  where purge_after is not null;

create table if not exists public.workspace_notification_receipts (
  notification_id text not null references public.workspace_records(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  purge_after timestamptz,
  primary key (notification_id, user_id)
);

alter table public.workspace_notification_receipts enable row level security;

drop policy if exists "Notification receipts: own read" on public.workspace_notification_receipts;
create policy "Notification receipts: own read"
on public.workspace_notification_receipts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Notification receipts: own write" on public.workspace_notification_receipts;
create policy "Notification receipts: own write"
on public.workspace_notification_receipts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists workspace_notification_receipts_purge_idx
  on public.workspace_notification_receipts (purge_after)
  where purge_after is not null;

create or replace function public.is_admin_user()
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
      and role::text = 'admin'
      and active = true
  );
$$;

create or replace function public.is_workspace_manager()
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
      and role::text in ('admin', 'manager')
      and active = true
  );
$$;

create or replace function public.can_write_workspace_record(record_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when record_kind in ('faq', 'update_log', 'coming_soon', 'sop', 'notification')
      then public.is_workspace_manager()
    when record_kind = 'green_machine'
      then public.is_workspace_manager()
    when record_kind = 'green_machine_event'
      then exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role::text in ('admin', 'manager', 'technician')
          and active = true
      )
    when record_kind in ('forum_thread', 'forum_post', 'feature_request_vote')
      then exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and active = true
      )
    else false
  end;
$$;

create or replace function public.set_workspace_record_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.archived_at is not null and new.deleted_at is not null then
    raise exception 'A workspace record cannot be archived and deleted at the same time';
  end if;
  return new;
end;
$$;

drop trigger if exists set_workspace_record_updated_at on public.workspace_records;
create trigger set_workspace_record_updated_at
before update on public.workspace_records
for each row execute function public.set_workspace_record_updated_at();

create or replace function public.link_machine_transfer_inventory_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_quantity integer;
  event_part_id uuid;
  transaction_id uuid;
begin
  if new.record_type <> 'green_machine_event'
    or new.payload ->> 'eventType' <> 'transferred_to_inventory'
    or nullif(new.payload ->> 'partId', '') is null then
    return new;
  end if;

  event_quantity := greatest(coalesce((new.payload ->> 'quantity')::integer, 0), 0);
  event_part_id := (new.payload ->> 'partId')::uuid;

  select id
    into transaction_id
  from public.inventory_transactions
  where part_id = event_part_id
    and created_by = new.created_by
    and delta = event_quantity
    and created_at >= new.created_at - interval '2 minutes'
    and coalesce(source, '') in ('manual_add', 'adjustment')
  order by created_at desc
  limit 1;

  if transaction_id is not null then
    update public.inventory_transactions
    set source = 'machine_transfer',
        machine_id = new.payload ->> 'machineId',
        machine_event_id = new.id
    where id = transaction_id;
  end if;

  return new;
exception
  when invalid_text_representation then
    return new;
end;
$$;

drop trigger if exists link_machine_transfer_inventory_event on public.workspace_records;
create trigger link_machine_transfer_inventory_event
after insert on public.workspace_records
for each row execute function public.link_machine_transfer_inventory_event();

alter table public.workspace_records enable row level security;

drop policy if exists "Workspace records: read permitted" on public.workspace_records;
create policy "Workspace records: read permitted"
on public.workspace_records
for select
to authenticated
using (
  public.is_admin_user()
  or (
    archived_at is null
    and deleted_at is null
    and (
      record_type <> 'notification'
      or owner_id = auth.uid()
      or payload ->> 'roleTarget' = 'all'
      or payload ->> 'roleTarget' = (
        select role::text from public.profiles where id = auth.uid() and active = true
      )
    )
  )
);

drop policy if exists "Workspace records: permitted insert" on public.workspace_records;
create policy "Workspace records: permitted insert"
on public.workspace_records
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and public.can_write_workspace_record(record_type)
);

drop policy if exists "Workspace records: permitted update" on public.workspace_records;
create policy "Workspace records: permitted update"
on public.workspace_records
for update
to authenticated
using (
  public.is_workspace_manager()
  or (record_type = 'notification' and owner_id = auth.uid())
  or (record_type = 'feature_request_vote' and owner_id = auth.uid())
)
with check (
  public.is_workspace_manager()
  or (record_type = 'notification' and owner_id = auth.uid())
  or (record_type = 'feature_request_vote' and owner_id = auth.uid())
);

drop policy if exists "Workspace records: admin delete" on public.workspace_records;
create policy "Workspace records: admin delete"
on public.workspace_records
for delete
to authenticated
using (public.is_admin_user());

alter table public.parts
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists purge_after timestamptz;

alter table public.locations
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists purge_after timestamptz;

alter table public.models
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists purge_after timestamptz;

-- Correct a legacy type if the column was created by an earlier draft migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'deleted_at'
      and data_type <> 'timestamp with time zone'
  ) then
    alter table public.models drop column deleted_at;
    alter table public.models add column deleted_at timestamptz;
  end if;
end $$;

create or replace function public.normalize_and_guard_part_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_npn or new.part_number is null or btrim(new.part_number) = '' then
    if new.is_npn then
      new.part_number := null;
    end if;
    return new;
  end if;

  new.part_number := upper(btrim(new.part_number));
  if exists (
    select 1
    from public.parts
    where id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and not is_npn
      and lower(btrim(part_number)) = lower(new.part_number)
  ) then
    raise exception 'A part with part number % already exists', new.part_number
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_and_guard_part_number on public.parts;
create trigger normalize_and_guard_part_number
before insert or update of part_number, is_npn on public.parts
for each row execute function public.normalize_and_guard_part_number();

create or replace function public.normalize_and_guard_model_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.manufacturer := btrim(new.manufacturer);
  new.model_name := btrim(new.model_name);
  new.series := btrim(coalesce(new.series, ''));

  if exists (
    select 1
    from public.models
    where id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and lower(btrim(manufacturer)) = lower(new.manufacturer)
      and lower(btrim(model_name)) = lower(new.model_name)
  ) then
    raise exception 'A model with manufacturer % and model name % already exists', new.manufacturer, new.model_name
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_and_guard_model_key on public.models;
create trigger normalize_and_guard_model_key
before insert or update of manufacturer, model_name on public.models
for each row execute function public.normalize_and_guard_model_key();

alter table public.inventory_transactions
  add column if not exists quantity_added integer not null default 0,
  add column if not exists source text,
  add column if not exists machine_id text,
  add column if not exists machine_event_id text,
  add column if not exists batch_id text;

update public.inventory_transactions
set quantity_added = greatest(delta, 0),
    source = coalesce(
      source,
      case
        when audit_type = 'added' then 'new_part'
        when audit_type = 'quantity_increased' then 'manual_add'
        when transaction_type = 'transfer' then 'machine_transfer'
        when transaction_type = 'import' then 'csv_import'
        else 'adjustment'
      end
    )
where quantity_added = 0 or source is null;

create or replace function public.set_inventory_transaction_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quantity_added = 0 and new.delta > 0 then
    new.quantity_added := new.delta;
  end if;

  if new.source is null or btrim(new.source) = '' then
    new.source := case
      when new.audit_type = 'added' then 'new_part'
      when new.audit_type = 'quantity_increased' then 'manual_add'
      when new.transaction_type = 'transfer' then 'machine_transfer'
      when new.transaction_type = 'import' then 'csv_import'
      else 'adjustment'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists set_inventory_transaction_metadata on public.inventory_transactions;
create trigger set_inventory_transaction_metadata
before insert on public.inventory_transactions
for each row execute function public.set_inventory_transaction_metadata();

create index if not exists inventory_transactions_source_created_idx
  on public.inventory_transactions (source, created_at desc);

create index if not exists inventory_transactions_machine_event_idx
  on public.inventory_transactions (machine_event_id)
  where machine_event_id is not null;

drop policy if exists "Parts: authenticated read" on public.parts;
create policy "Parts: authenticated read"
on public.parts
for select
to authenticated
using (
  public.is_elevated_user()
  or (archived_at is null and deleted_at is null)
);

drop policy if exists "Locations: authenticated read" on public.locations;
create policy "Locations: authenticated read"
on public.locations
for select
to authenticated
using (
  public.is_elevated_user()
  or (archived_at is null and deleted_at is null)
);

drop policy if exists "Models: authenticated read" on public.models;
create policy "Models: authenticated read"
on public.models
for select
to authenticated
using (
  public.is_elevated_user()
  or (archived_at is null and deleted_at is null)
);

create or replace function public.purge_expired_retained_records()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.workspace_records where purge_after is not null and purge_after <= now();
  delete from public.workspace_notification_receipts where purge_after is not null and purge_after <= now();
  delete from public.parts where purge_after is not null and purge_after <= now();
  delete from public.locations where purge_after is not null and purge_after <= now();
  delete from public.models where purge_after is not null and purge_after <= now();
end;
$$;

-- Supabase Cron is optional in some projects. When pg_cron is enabled, the
-- database owns retention and does not depend on a browser being open.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute 'select cron.schedule(''purge-retained-records'', ''15 2 * * *'', ''select public.purge_expired_retained_records();'')';
    exception
      when unique_violation then null;
    end;
  end if;
end $$;

commit;