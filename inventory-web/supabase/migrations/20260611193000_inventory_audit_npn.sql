begin;

alter table public.parts
  add column if not exists is_npn boolean not null default false;

do $$
begin
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

update public.parts
set is_npn = true,
    part_number = null
where upper(coalesce(part_number, '')) = 'NPN';

alter table public.inventory_transactions
  add column if not exists audit_type text,
  add column if not exists previous_quantity integer,
  add column if not exists next_quantity integer,
  add column if not exists previous_location_id uuid,
  add column if not exists next_location_id uuid,
  add column if not exists previous_part_number text,
  add column if not exists next_part_number text,
  add column if not exists previous_is_npn boolean,
  add column if not exists next_is_npn boolean,
  add column if not exists item_part_name text,
  add column if not exists item_manufacturer text,
  add column if not exists item_category text,
  add column if not exists item_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists label_mode text,
  add column if not exists label_copies integer,
  add column if not exists actor_label text;

create or replace function public.set_inventory_transaction_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_inventory_transaction_actor on public.inventory_transactions;
create trigger set_inventory_transaction_actor
before insert on public.inventory_transactions
for each row
execute function public.set_inventory_transaction_actor();

create or replace function public.log_inventory_part_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_type text;
  delta integer;
  snapshot jsonb;
begin
  if tg_op = 'INSERT' then
    delta := coalesce(new.quantity_on_hand, 0);
    audit_type := 'added';
    snapshot := jsonb_build_object(
      'next', jsonb_build_object(
        'part_number', new.part_number,
        'is_npn', new.is_npn,
        'part_name', new.part_name,
        'manufacturer', new.manufacturer,
        'category', new.category,
        'location_id', new.location_id,
        'quantity_on_hand', new.quantity_on_hand,
        'reorder_point', new.reorder_point,
        'reorder_target', new.reorder_target,
        'universal', new.universal,
        'notes', new.notes
      ),
      'change', audit_type
    );

    insert into public.inventory_transactions (
      part_id,
      transaction_type,
      audit_type,
      delta,
      previous_quantity,
      next_quantity,
      previous_location_id,
      next_location_id,
      previous_part_number,
      next_part_number,
      previous_is_npn,
      next_is_npn,
      item_part_name,
      item_manufacturer,
      item_category,
      item_snapshot,
      note,
      created_by
    ) values (
      new.id,
      'adjustment',
      audit_type,
      delta,
      null,
      new.quantity_on_hand,
      null,
      new.location_id,
      null,
      new.part_number,
      null,
      new.is_npn,
      new.part_name,
      new.manufacturer,
      new.category,
      snapshot,
      'Part added',
      auth.uid()
    );

    return new;
  elsif tg_op = 'UPDATE' then
    if new.quantity_on_hand is distinct from old.quantity_on_hand then
      delta := coalesce(new.quantity_on_hand, 0) - coalesce(old.quantity_on_hand, 0);
      audit_type := case
        when delta > 0 then 'quantity_increased'
        when delta < 0 then 'quantity_decreased'
        else 'quantity_changed'
      end;
    elsif new.location_id is distinct from old.location_id then
      delta := 0;
      audit_type := 'location_changed';
    elsif new.is_npn is distinct from old.is_npn or new.part_number is distinct from old.part_number then
      delta := 0;
      audit_type := case when new.is_npn then 'marked_npn' else 'unmarked_npn' end;
    elsif new.part_name is distinct from old.part_name
      or new.manufacturer is distinct from old.manufacturer
      or new.category is distinct from old.category
      or new.reorder_point is distinct from old.reorder_point
      or new.reorder_target is distinct from old.reorder_target
      or new.universal is distinct from old.universal
      or new.notes is distinct from old.notes then
      delta := 0;
      audit_type := 'metadata_changed';
    else
      return new;
    end if;

    snapshot := jsonb_build_object(
      'previous', jsonb_build_object(
        'part_number', old.part_number,
        'is_npn', old.is_npn,
        'part_name', old.part_name,
        'manufacturer', old.manufacturer,
        'category', old.category,
        'location_id', old.location_id,
        'quantity_on_hand', old.quantity_on_hand,
        'reorder_point', old.reorder_point,
        'reorder_target', old.reorder_target,
        'universal', old.universal,
        'notes', old.notes
      ),
      'next', jsonb_build_object(
        'part_number', new.part_number,
        'is_npn', new.is_npn,
        'part_name', new.part_name,
        'manufacturer', new.manufacturer,
        'category', new.category,
        'location_id', new.location_id,
        'quantity_on_hand', new.quantity_on_hand,
        'reorder_point', new.reorder_point,
        'reorder_target', new.reorder_target,
        'universal', new.universal,
        'notes', new.notes
      ),
      'change', audit_type
    );

    insert into public.inventory_transactions (
      part_id,
      transaction_type,
      audit_type,
      delta,
      previous_quantity,
      next_quantity,
      previous_location_id,
      next_location_id,
      previous_part_number,
      next_part_number,
      previous_is_npn,
      next_is_npn,
      item_part_name,
      item_manufacturer,
      item_category,
      item_snapshot,
      note,
      created_by
    ) values (
      new.id,
      'adjustment',
      audit_type,
      delta,
      old.quantity_on_hand,
      new.quantity_on_hand,
      old.location_id,
      new.location_id,
      old.part_number,
      new.part_number,
      old.is_npn,
      new.is_npn,
      new.part_name,
      new.manufacturer,
      new.category,
      snapshot,
      case
        when audit_type = 'quantity_increased' then 'Quantity increased'
        when audit_type = 'quantity_decreased' then 'Quantity decreased'
        when audit_type = 'quantity_changed' then 'Quantity changed'
        when audit_type = 'location_changed' then 'Location changed'
        when audit_type = 'marked_npn' then 'Marked as NPN'
        when audit_type = 'unmarked_npn' then 'Unmarked as NPN'
        else 'Metadata updated'
      end,
      auth.uid()
    );

    return new;
  elsif tg_op = 'DELETE' then
    delta := -coalesce(old.quantity_on_hand, 0);
    audit_type := 'removed';
    snapshot := jsonb_build_object(
      'previous', jsonb_build_object(
        'part_number', old.part_number,
        'is_npn', old.is_npn,
        'part_name', old.part_name,
        'manufacturer', old.manufacturer,
        'category', old.category,
        'location_id', old.location_id,
        'quantity_on_hand', old.quantity_on_hand,
        'reorder_point', old.reorder_point,
        'reorder_target', old.reorder_target,
        'universal', old.universal,
        'notes', old.notes
      ),
      'change', audit_type
    );

    insert into public.inventory_transactions (
      part_id,
      transaction_type,
      audit_type,
      delta,
      previous_quantity,
      next_quantity,
      previous_location_id,
      next_location_id,
      previous_part_number,
      next_part_number,
      previous_is_npn,
      next_is_npn,
      item_part_name,
      item_manufacturer,
      item_category,
      item_snapshot,
      note,
      created_by
    ) values (
      old.id,
      'adjustment',
      audit_type,
      delta,
      old.quantity_on_hand,
      0,
      old.location_id,
      null,
      old.part_number,
      null,
      old.is_npn,
      null,
      old.part_name,
      old.manufacturer,
      old.category,
      snapshot,
      'Part removed',
      auth.uid()
    );

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists log_inventory_part_audit on public.parts;
create trigger log_inventory_part_audit
after insert or update or delete on public.parts
for each row
execute function public.log_inventory_part_audit();

create index if not exists inventory_transactions_audit_type_created_at_idx
  on public.inventory_transactions (audit_type, created_at desc);

create index if not exists inventory_transactions_part_created_at_idx
  on public.inventory_transactions (part_id, created_at desc);

commit;
