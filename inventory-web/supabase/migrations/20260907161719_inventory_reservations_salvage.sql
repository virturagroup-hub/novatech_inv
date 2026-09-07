begin;
set local search_path = pg_catalog;
do $$ begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'Inventory availability requires PostgreSQL 15+ for security_invoker views';
  end if;
end $$;

-- Extends phase2_schema.sql and all three preceding migrations. Role comparisons
-- deliberately cast the actual column: production may use inventory_role.
create schema if not exists inventory_private;
revoke all on schema inventory_private from public, anon, authenticated;
grant usage on schema inventory_private to authenticated, service_role;

create function inventory_private.active_role() returns text
language sql stable security definer set search_path = '' as $$
  select role::text from public.profiles where id = auth.uid() and active;
$$;
revoke all on function inventory_private.active_role() from public;
grant execute on function inventory_private.active_role() to authenticated, service_role;

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  part_id uuid references public.parts(id) on delete set null,
  part_snapshot jsonb not null,
  quantity integer not null check (quantity > 0),
  user_id uuid references public.profiles(id) on delete set null,
  actor_label text not null,
  notes text not null default '',
  status text not null default 'active' check (status in ('active','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  check ((status = 'active') = (resolved_at is null))
);
create index inventory_reservations_active_part on public.inventory_reservations(part_id) where status = 'active';
create index inventory_reservations_part_history on public.inventory_reservations(part_id);
create index inventory_reservations_user on public.inventory_reservations(user_id, created_at desc);
alter table public.inventory_reservations enable row level security;
create policy "Reservations: active users read" on public.inventory_reservations for select to authenticated
using (inventory_private.active_role() is not null);
revoke all on public.inventory_reservations from public, authenticated, anon;
grant select on public.inventory_reservations to authenticated;
create view public.inventory_availability with (security_invoker=true) as
select p.id as part_id,p.quantity_on_hand as on_hand,coalesce(r.reserved,0)::bigint as reserved,
  (p.quantity_on_hand-coalesce(r.reserved,0))::bigint as available
from public.parts p left join (
  select part_id,sum(quantity) as reserved from public.inventory_reservations where status='active' group by part_id
) r on r.part_id=p.id;
revoke all on public.inventory_availability from public, anon, authenticated;
grant select on public.inventory_availability to authenticated;

-- RLS does not protect TRUNCATE. Retention must use the guarded DELETE path.
revoke truncate on public.parts, public.inventory_transactions, public.workspace_records from public, anon, authenticated;
alter table public.parts add constraint parts_nonnegative_on_hand check (quantity_on_hand >= 0);

-- Capture the exact existing audit row, including inside subtransactions. RPCs
-- clear this transaction-local value immediately before their stock mutation.
create function inventory_private.capture_inventory_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('inventory.last_audit_id',new.id::text,true);
  return new;
end $$;
create trigger capture_inventory_audit after insert on public.inventory_transactions
for each row execute function inventory_private.capture_inventory_audit();

-- Every stock mutation (including existing imports/edit/adjustment paths) must
-- respect holds. PostgreSQL locks the parts row before this trigger executes.
create function inventory_private.guard_reserved_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
declare held bigint;
begin
  select coalesce(sum(quantity),0) into held from public.inventory_reservations
  where part_id = old.id and status = 'active';
  if tg_op = 'DELETE' then
    if held > 0 then raise exception 'Cancel or fulfill active reservations before deleting this part'; end if;
    return old;
  end if;
  if new.quantity_on_hand < held then raise exception 'On Hand cannot be less than Reserved (%)', held; end if;
  if held > 0 and (new.archived_at is not null or new.deleted_at is not null or new.purge_after is not null) then
    raise exception 'Cancel or fulfill active reservations before archiving this part';
  end if;
  return new;
end $$;
create trigger guard_reserved_stock before update or delete on public.parts
for each row execute function inventory_private.guard_reserved_stock();

-- Match the repository's existing Technician part/stock permissions without
-- broadening is_elevated_user (which also protects models, locations and users).
create policy "Parts: active technicians insert" on public.parts for insert to authenticated
with check (inventory_private.active_role()='technician');
create policy "Parts: active technicians update" on public.parts for update to authenticated
using (inventory_private.active_role()='technician') with check (inventory_private.active_role()='technician');
create policy "Parts: active technicians delete" on public.parts for delete to authenticated
using (inventory_private.active_role()='technician');
create policy "Part model links: active technicians write" on public.part_model_links for all to authenticated
using (inventory_private.active_role()='technician') with check (inventory_private.active_role()='technician');

-- Keep the existing editor and adjustment UI, but serialize their database
-- writes. A stale absolute edit must not overwrite a concurrent fulfillment.
create function inventory_private.save_inventory_part(p_draft jsonb,p_expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare d jsonb:=p_draft; p public.parts; existing public.parts; pid uuid;
  mids uuid[]; adding boolean; delta integer;
begin
  if coalesce(inventory_private.active_role(),'') not in ('admin','manager','technician') then raise exception 'Not permitted' using errcode='42501'; end if;
  if nullif(btrim(d->>'partName'),'') is null then raise exception 'Part name required'; end if;
  if not coalesce((d->>'isNpn')::boolean,false) and nullif(btrim(d->>'partNumber'),'') is null then raise exception 'Part number or NPN required'; end if;
  pid:=nullif(d->>'id','')::uuid;
  delta:=nullif(d->>'stockDelta','')::integer;
  adding:=pid is null or delta is not null;
  if not coalesce((d->>'isNpn')::boolean,false) then
    perform pg_advisory_xact_lock(hashtextextended(upper(btrim(d->>'partNumber')),0));
  end if;
  if pid is not null then
    select * into existing from public.parts where id=pid for update;
    if not found and delta is null then raise exception 'Part no longer exists'; end if;
  elsif not coalesce((d->>'isNpn')::boolean,false) then
    select * into existing from public.parts where not is_npn and upper(btrim(part_number))=upper(btrim(d->>'partNumber')) for update;
  end if;
  if existing.id is not null then
    if existing.archived_at is not null or existing.deleted_at is not null or existing.purge_after is not null then raise exception 'Restore the existing part before intake'; end if;
    if not adding and existing.updated_at is distinct from p_expected_updated_at then raise exception 'Part changed since this form opened. Reload before saving'; end if;
  end if;
  p:=jsonb_populate_record(null::public.parts,jsonb_build_object(
    'part_number',case when (d->>'isNpn')::boolean then null else upper(btrim(d->>'partNumber')) end,
    'is_npn',coalesce((d->>'isNpn')::boolean,false),'part_name',btrim(d->>'partName'),
    'manufacturer',d->>'manufacturer','category',d->>'category','location_id',nullif(d->>'binId',''),
    'quantity_on_hand',coalesce(delta,(d->>'quantityOnHand')::integer),
    'reorder_point',coalesce((d->>'reorderPoint')::integer,0),'reorder_target',coalesce((d->>'reorderTarget')::integer,0),
    'universal',coalesce((d->>'universal')::boolean,false),'notes',coalesce(d->>'notes','')));
  if p.quantity_on_hand is null or p.quantity_on_hand<0 then raise exception 'Nonnegative whole quantity required'; end if;
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into mids from jsonb_array_elements_text(coalesce(d->'compatibleModelIds','[]'::jsonb));
  if existing.id is null then
    insert into public.parts(id,part_number,is_npn,part_name,manufacturer,category,location_id,quantity_on_hand,reorder_point,reorder_target,universal,notes)
    values(coalesce(pid,gen_random_uuid()),p.part_number,p.is_npn,p.part_name,p.manufacturer,p.category,p.location_id,p.quantity_on_hand,p.reorder_point,p.reorder_target,p.universal,p.notes) returning id into pid;
  else
    pid:=existing.id;
    update public.parts set part_number=p.part_number,is_npn=p.is_npn,part_name=p.part_name,manufacturer=p.manufacturer,
      category=p.category,location_id=p.location_id,quantity_on_hand=case when adding then quantity_on_hand+p.quantity_on_hand else p.quantity_on_hand end,
      reorder_point=p.reorder_point,reorder_target=p.reorder_target,universal=p.universal,notes=p.notes where id=pid;
  end if;
  if not adding or p.universal then delete from public.part_model_links where part_id=pid; end if;
  if not p.universal then insert into public.part_model_links(part_id,model_id) select pid,v from unnest(mids) v on conflict do nothing; end if;
  return pid;
end $$;
create function public.save_inventory_part(p_draft jsonb,p_expected_updated_at timestamptz default null) returns uuid
language sql security invoker set search_path = '' as $$ select inventory_private.save_inventory_part(p_draft,p_expected_updated_at); $$;

create function inventory_private.adjust_inventory_part(p_id uuid,p_delta integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(inventory_private.active_role(),'') not in ('admin','manager','technician') then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_delta is null or p_delta=0 then raise exception 'Nonzero whole adjustment required'; end if;
  update public.parts set quantity_on_hand=quantity_on_hand+p_delta where id=p_id and archived_at is null and deleted_at is null and purge_after is null;
  if not found then raise exception 'Part is not active'; end if;
end $$;
create function public.adjust_inventory_part(p_id uuid,p_delta integer) returns void
language sql security invoker set search_path = '' as $$ select inventory_private.adjust_inventory_part(p_id,p_delta); $$;

create function inventory_private.reserve_part(p_part_id uuid, p_quantity integer, p_notes text, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.parts; r public.inventory_reservations; held bigint; actor text;
begin
  if coalesce(inventory_private.active_role(),'') not in ('admin','manager','technician') then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_quantity is null or p_quantity <= 0 or p_request_id is null then raise exception 'Positive whole quantity and request ID required'; end if;
  select * into p from public.parts where id=p_part_id for update;
  if not found or p.archived_at is not null or p.deleted_at is not null or p.purge_after is not null then raise exception 'Part is not active'; end if;
  select * into r from public.inventory_reservations where id=p_request_id;
  if found then
    if r.user_id=auth.uid() and r.part_id=p_part_id and r.quantity=p_quantity then return r.id; end if;
    raise exception 'Request ID already used';
  end if;
  select coalesce(sum(quantity),0) into held from public.inventory_reservations where part_id=p.id and status='active';
  if p_quantity > p.quantity_on_hand-held then raise exception 'Only % available', p.quantity_on_hand-held; end if;
  -- Advance the row version, not just its lock, so a stale REPEATABLE READ
  -- stock writer/reserver receives a serialization failure instead of missing holds.
  update public.parts set updated_at=clock_timestamp() where id=p.id;
  select coalesce(nullif(full_name,''),'Technician') into actor from public.profiles where id=auth.uid();
  insert into public.inventory_reservations(id,part_id,part_snapshot,quantity,user_id,actor_label,notes)
  values(p_request_id,p.id,to_jsonb(p),p_quantity,auth.uid(),actor,coalesce(p_notes,''));
  insert into public.inventory_transactions(part_id,transaction_type,audit_type,delta,note,created_by,actor_label,item_snapshot)
  values(p.id,'adjustment','reservation_created',0,format('Reserved %s units by %s',p_quantity,actor),auth.uid(),actor,jsonb_build_object('reservation_id',p_request_id,'part',to_jsonb(p)));
  return p_request_id;
end $$;
create function public.reserve_part(p_part_id uuid,p_quantity integer,p_notes text,p_request_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select inventory_private.reserve_part(p_part_id,p_quantity,p_notes,p_request_id); $$;

create function inventory_private.resolve_reservation(p_id uuid,p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.inventory_reservations; pid uuid; actor text;
begin
  if coalesce(inventory_private.active_role(),'') not in ('admin','manager','technician') then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_action is null or p_action not in ('fulfilled','cancelled') then raise exception 'Invalid reservation action'; end if;
  select part_id into pid from public.inventory_reservations where id=p_id;
  -- Same lock order as create/stock writes: part, then reservation.
  perform 1 from public.parts where id=pid for update;
  select * into r from public.inventory_reservations where id=p_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if r.user_id is distinct from auth.uid() and inventory_private.active_role() not in ('admin','manager') then raise exception 'Not your reservation' using errcode='42501'; end if;
  if r.status=p_action then return; end if;
  if r.status<>'active' then raise exception 'Reservation already resolved'; end if;
  select coalesce(nullif(full_name,''),'User') into actor from public.profiles where id=auth.uid();
  update public.inventory_reservations set status=p_action,resolved_at=now(),resolved_by=auth.uid() where id=p_id;
  if p_action='fulfilled' then
    if pid is null then raise exception 'Part no longer exists'; end if;
    perform set_config('inventory.last_audit_id','',true);
    update public.parts set quantity_on_hand=quantity_on_hand-r.quantity where id=pid;
    -- The normal quantity trigger creates exactly one deduction/audit entry.
    update public.inventory_transactions set note=format('Reservation fulfilled: %s units by %s',r.quantity,actor),
      source='reservation_fulfillment', item_snapshot=item_snapshot || jsonb_build_object('reservation_id',r.id)
    where id=nullif(current_setting('inventory.last_audit_id',true),'')::uuid and part_id=pid and audit_type='quantity_decreased';
  else
    insert into public.inventory_transactions(part_id,transaction_type,audit_type,delta,note,created_by,actor_label,item_snapshot)
    values(pid,'adjustment','reservation_cancelled',0,format('Cancelled reservation of %s units by %s',r.quantity,actor),auth.uid(),actor,jsonb_build_object('reservation_id',r.id,'part',r.part_snapshot));
  end if;
end $$;
create function public.resolve_reservation(p_id uuid,p_action text) returns void
language sql security invoker set search_path = '' as $$ select inventory_private.resolve_reservation(p_id,p_action); $$;

-- Durable audit rows survive part deletion. Log deletion BEFORE the FK clears
-- its reference; the old AFTER DELETE trigger otherwise inserts a missing FK.
alter table public.inventory_transactions alter column part_id drop not null;
do $$ declare fk record; begin
  for fk in select conname from pg_constraint where conrelid='public.inventory_transactions'::regclass
    and confrelid='public.parts'::regclass and contype='f' loop
    execute format('alter table public.inventory_transactions drop constraint %I',fk.conname);
  end loop;
end $$;
alter table public.inventory_transactions add constraint inventory_transactions_part_id_fkey
foreign key(part_id) references public.parts(id) on delete set null;
drop trigger log_inventory_part_audit on public.parts;
create trigger log_inventory_part_audit after insert or update on public.parts for each row execute function public.log_inventory_part_audit();
create trigger log_inventory_part_delete before delete on public.parts for each row execute function public.log_inventory_part_audit();

create table public.salvage_profiles (
  id uuid primary key default gen_random_uuid(), name text not null,
  model_id uuid references public.models(id) on delete cascade,
  series text, is_default boolean not null default false
);
create unique index salvage_profiles_one_default on public.salvage_profiles(is_default) where is_default;
create table public.salvage_profile_components (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.salvage_profiles(id) on delete cascade,
  name text not null, category text not null, required boolean not null default true, sort_order integer not null default 0,
  unique(profile_id,name)
);
create table public.machine_salvage_items (
  id uuid primary key default gen_random_uuid(),
  machine_id text references public.workspace_records(id) on delete set null,
  source_machine_id text not null,
  machine_snapshot jsonb not null,
  component_id uuid references public.salvage_profile_components(id) on delete set null,
  component_name text not null, category text not null, required boolean not null default true, sort_order integer not null default 0,
  status text not null default 'on_machine' check(status in ('on_machine','pulled_for_use','pending_inventory','inventoried','scrapped','missing','not_salvageable')),
  draft jsonb not null default '{}'::jsonb,
  part_id uuid references public.parts(id) on delete set null,
  inventory_snapshot jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  actor_label text,
  resolved_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(source_machine_id,component_id)
);
create index machine_salvage_source on public.machine_salvage_items(source_machine_id,sort_order);
create index machine_salvage_machine_fk on public.machine_salvage_items(machine_id);
create index machine_salvage_part_fk on public.machine_salvage_items(part_id);
create index machine_salvage_pending on public.machine_salvage_items(resolved_at) where status='pending_inventory';
alter table public.salvage_profiles enable row level security;
alter table public.salvage_profile_components enable row level security;
alter table public.machine_salvage_items enable row level security;
create policy "Salvage profiles read" on public.salvage_profiles for select to authenticated using(inventory_private.active_role() is not null);
create policy "Salvage components read" on public.salvage_profile_components for select to authenticated using(inventory_private.active_role() is not null);
create policy "Salvage items read" on public.machine_salvage_items for select to authenticated using(inventory_private.active_role() is not null);
revoke all on public.machine_salvage_items,public.salvage_profiles,public.salvage_profile_components from public,authenticated,anon;
grant select on public.salvage_profiles,public.salvage_profile_components,public.machine_salvage_items to authenticated;
insert into public.salvage_profiles(name,is_default) values('General copier salvage',true);
insert into public.salvage_profile_components(profile_id,name,category,sort_order)
select p.id,c.name,c.category,c.ordinality::integer from public.salvage_profiles p,
unnest(array['Fuser','Transfer Belt','Imaging Units','Developing Units','Feed Units','Main Board','Power Supply','Control Panel','Storage/HDD'],
array['Fusers','Transfer','Imaging','Imaging','Feeders','Boards','Power Supplies','Boards','Drives']) with ordinality c(name,category,ordinality) where p.is_default;

create function inventory_private.initialize_salvage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare profile uuid;
begin
  if new.record_type<>'green_machine' or new.archived_at is not null or new.deleted_at is not null then return new; end if;
  if exists(select 1 from public.machine_salvage_items where source_machine_id=new.id) then return new; end if;
  select id into profile from public.salvage_profiles
  where model_id::text=new.payload->>'modelId' or (series is not null and series=new.payload->>'seriesFamily') or is_default
  order by (model_id::text=new.payload->>'modelId') desc nulls last, (series=new.payload->>'seriesFamily') desc nulls last,is_default limit 1;
  insert into public.machine_salvage_items(machine_id,source_machine_id,machine_snapshot,component_id,component_name,category,required,sort_order)
  select new.id,new.id,new.payload,c.id,c.name,c.category,c.required,c.sort_order from public.salvage_profile_components c where c.profile_id=profile
  on conflict(source_machine_id,component_id) do nothing;
  return new;
end $$;
create trigger initialize_machine_salvage after insert or update on public.workspace_records for each row execute function inventory_private.initialize_salvage();
create function inventory_private.guard_disposal_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Legacy archived machines have no checklist. Preserve their existing archive;
  -- restoration reopens them for review and the AFTER trigger seeds a checklist.
  -- Lookup also covers BEFORE INSERT during the existing client's UPSERT restore.
  if new.record_type='green_machine'
    and not exists(select 1 from public.machine_salvage_items where source_machine_id=new.id)
    and exists(select 1 from public.workspace_records where id=new.id and (archived_at is not null or deleted_at is not null)) then
    if new.archived_at is null and new.deleted_at is null then
      new.payload:=new.payload || jsonb_build_object('status','active','archivedStatus',null,'readyForDisposalAt',null);
    elsif exists(select 1 from public.workspace_records where id=new.id and (payload->>'status'='ready_for_disposal' or payload->>'archivedStatus'='ready_for_disposal')) then
      return new;
    end if;
  end if;
  if new.record_type='green_machine' and (
    new.payload->>'status'='ready_for_disposal' or new.payload->>'archivedStatus'='ready_for_disposal'
  ) and (not exists(select 1 from public.machine_salvage_items where source_machine_id=new.id and required)
    or exists(select 1 from public.machine_salvage_items where source_machine_id=new.id and required and status='on_machine')) then
    raise exception 'Required salvage components remain unresolved';
  end if;
  return new;
end $$;
create trigger guard_disposal_completion before insert or update on public.workspace_records
for each row execute function inventory_private.guard_disposal_completion();
-- Existing active machines receive an unresolved checklist; legacy free-form
-- history is retained and never treated as proof that a component was removed.
do $$ declare m record; profile uuid; begin
  for m in select * from public.workspace_records where record_type='green_machine' and archived_at is null and deleted_at is null loop
    select id into profile from public.salvage_profiles where model_id::text=m.payload->>'modelId'
      or (series is not null and series=m.payload->>'seriesFamily') or is_default
      order by (model_id::text=m.payload->>'modelId') desc nulls last,(series=m.payload->>'seriesFamily') desc nulls last,is_default limit 1;
    insert into public.machine_salvage_items(machine_id,source_machine_id,machine_snapshot,component_id,component_name,category,required,sort_order)
    select m.id,m.id,m.payload,c.id,c.name,c.category,c.required,c.sort_order from public.salvage_profile_components c where c.profile_id=profile;
    if m.payload->>'status'='ready_for_disposal' then
      update public.workspace_records set payload=payload || jsonb_build_object('status','active','readyForDisposalAt',null) where id=m.id;
      insert into public.workspace_records(id,record_type,payload)
      values('salvage-review:'||m.id,'green_machine_event',jsonb_build_object('id','salvage-review:'||m.id,'machineId',m.id,'eventType','status_change',
        'note','Legacy disposal readiness reopened for required salvage checklist review','sourceMachine',m.payload,'actorLabel','Inventory migration','createdAt',now()));
    end if;
  end loop;
end $$;

create function inventory_private.machine_event(machine text,kind text,note text,item public.machine_salvage_items,part uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare event_id text:=gen_random_uuid()::text;
begin
  insert into public.workspace_records(id,record_type,created_by,updated_by,payload)
  values(event_id,'green_machine_event',auth.uid(),auth.uid(),jsonb_build_object(
    'id',event_id,'machineId',machine,'eventType',kind,'partId',part,'partName',item.component_name,
    'partCategory',item.category,'quantity',coalesce((item.draft->>'quantityOnHand')::integer,1),
    'condition',null,'note',note,'createdBy',auth.uid(),'actorLabel',item.actor_label,'createdAt',now(),
    'salvageItemId',item.id,'sourceMachine',item.machine_snapshot));
  return event_id;
end $$;

create function inventory_private.salvage_action(p_id uuid,p_action text,p_draft jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.machine_salvage_items; machine public.workspace_records; source_id text; actor text;
  d jsonb; model_ids uuid[]; source_model uuid; part public.parts; v_part_id uuid; event_id text; message text; target_role text;
begin
  if coalesce(inventory_private.active_role(),'') not in ('admin','manager','technician') then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_action is null or p_action not in ('pulled_for_use','pending_inventory','inventoried','scrapped','missing','not_salvageable') then raise exception 'Invalid salvage action'; end if;
  select machine_id into source_id from public.machine_salvage_items where id=p_id;
  select * into machine from public.workspace_records where id=source_id for update;
  select * into s from public.machine_salvage_items where id=p_id for update;
  if not found then raise exception 'Checklist item not found'; end if;
  if s.status=p_action then return s.part_id; end if;
  if s.status='pending_inventory' and inventory_private.active_role() not in ('admin','manager') then raise exception 'Only Admin/Manager can complete intake' using errcode='42501'; end if;
  if s.status<>'on_machine' and not(s.status='pending_inventory' and p_action='inventoried') then raise exception 'Component already resolved'; end if;
  if s.status='on_machine' and (machine.id is null or machine.archived_at is not null or machine.deleted_at is not null) then raise exception 'Machine is not active'; end if;
  if machine.id is not null then update public.workspace_records set updated_at=clock_timestamp() where id=machine.id; end if;
  select coalesce(nullif(full_name,''),'Technician') into actor from public.profiles where id=auth.uid();
  if s.status='on_machine' then s.machine_snapshot:=machine.payload; end if;
  d:=coalesce(p_draft,'{}'::jsonb);
  if p_action in ('pending_inventory','inventoried') then
    if coalesce((d->>'isNpn')::boolean,false)=false and nullif(btrim(d->>'partNumber'),'') is null then raise exception 'Part number or NPN required'; end if;
    if nullif(btrim(d->>'partName'),'') is null then raise exception 'Part name required'; end if;
    if coalesce((d->>'quantityOnHand')::integer,0)<=0 then raise exception 'Positive whole quantity required'; end if;
    source_model:=nullif(s.machine_snapshot->>'modelId','')::uuid;
    if source_model is null or not exists(select 1 from public.models where id=source_model) then
      select case when count(*)=1 then (array_agg(id))[1] else null end into source_model from public.models
      where lower(btrim(s.machine_snapshot->>'modelName')) in
        (lower(btrim(model_name)),lower(btrim(manufacturer||' '||model_name)),lower(btrim('bizhub '||model_name)));
    end if;
    if source_model is null and p_action='inventoried' then raise exception 'Admin/Manager must resolve the source model in Pending Inventory before intake'; end if;
    if source_model is not null then s.machine_snapshot:=s.machine_snapshot || jsonb_build_object('modelId',source_model); end if;
    select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into model_ids from jsonb_array_elements_text(coalesce(d->'compatibleModelIds','[]'::jsonb));
    if source_model is not null and exists(select 1 from public.models where id=source_model) then model_ids:=array_append(model_ids,source_model); end if;
    if cardinality(model_ids)=0 and p_action='inventoried' then raise exception 'Select at least one compatible model'; end if;
    if exists(select 1 from unnest(model_ids) v where not exists(select 1 from public.models where id=v)) then raise exception 'Compatible model no longer exists'; end if;
    d:=d || jsonb_build_object('compatibleModelIds',to_jsonb(model_ids),'universal',false,'partNumber',upper(btrim(d->>'partNumber')),'modelResolutionRequired',source_model is null);
    if p_action='inventoried' then
      perform set_config('inventory.last_audit_id','',true);
      -- Serialize same-number intakes, including creation of a previously absent PN.
      if not coalesce((d->>'isNpn')::boolean,false) then
        perform pg_advisory_xact_lock(hashtextextended(upper(btrim(d->>'partNumber')),0));
        select * into part from public.parts where not is_npn and upper(btrim(part_number))=upper(btrim(d->>'partNumber')) for update;
      end if;
      if part.id is not null then
        if part.archived_at is not null or part.deleted_at is not null or part.purge_after is not null then raise exception 'Restore the existing part before intake'; end if;
        update public.parts set quantity_on_hand=quantity_on_hand+(d->>'quantityOnHand')::integer where id=part.id returning id into v_part_id;
      else
        -- Populate the actual row type so custom category/status types are respected.
        part:=jsonb_populate_record(null::public.parts,jsonb_build_object(
          'part_number',case when (d->>'isNpn')::boolean then null else upper(btrim(d->>'partNumber')) end,
          'is_npn',coalesce((d->>'isNpn')::boolean,false),'part_name',btrim(d->>'partName'),
          'manufacturer',d->>'manufacturer','category',d->>'category','location_id',nullif(d->>'binId',''),
          'quantity_on_hand',(d->>'quantityOnHand')::integer,'reorder_point',coalesce((d->>'reorderPoint')::integer,0),
          'reorder_target',coalesce((d->>'reorderTarget')::integer,0),'notes',coalesce(d->>'notes','')));
        insert into public.parts(part_number,is_npn,part_name,manufacturer,category,location_id,quantity_on_hand,reorder_point,reorder_target,universal,notes)
        values(part.part_number,part.is_npn,part.part_name,part.manufacturer,part.category,part.location_id,part.quantity_on_hand,part.reorder_point,part.reorder_target,false,part.notes) returning id into v_part_id;
      end if;
      insert into public.part_model_links(part_id,model_id) select v_part_id,v from unnest(model_ids) v on conflict do nothing;
    end if;
  end if;
  message:=case p_action when 'pulled_for_use' then 'Pulled for Use' when 'pending_inventory' then 'Pending Inventory — Service Bin'
    when 'inventoried' then 'Added to Inventory' when 'scrapped' then 'Scrapped' when 'missing' then 'Missing / Already Removed' else 'Not Salvageable / Not Worth Saving' end;
  update public.machine_salvage_items set status=p_action,draft=case when p_action in ('pending_inventory','inventoried') then d else draft end,
    machine_snapshot=s.machine_snapshot,part_id=coalesce(s.part_id,v_part_id),
    inventory_snapshot=case when p_action='inventoried' then (select to_jsonb(p) from public.parts p where p.id=v_part_id) else inventory_snapshot end,
    resolved_by=coalesce(resolved_by,auth.uid()),actor_label=coalesce(actor_label,actor),resolved_at=coalesce(resolved_at,now()),
    completed_at=case when p_action='inventoried' then now() else null end,completed_by=case when p_action='inventoried' then auth.uid() else null end where id=p_id;
  s.draft:=d; s.actor_label:=actor;
  -- Use the existing timeline without invoking the legacy heuristic transfer matcher.
  event_id:=inventory_private.machine_event(s.source_machine_id,'note',format('%s — %s by %s',s.component_name,message,actor),s,v_part_id);
  if v_part_id is not null then
    update public.inventory_transactions set source='machine_transfer',machine_id=s.source_machine_id,machine_event_id=event_id,
      item_snapshot=item_snapshot || jsonb_build_object('source_machine',s.machine_snapshot,'salvage_item_id',s.id)
    where id=nullif(current_setting('inventory.last_audit_id',true),'')::uuid and inventory_transactions.part_id=v_part_id and audit_type in ('added','quantity_increased');
  end if;
  if machine.id is not null and machine.archived_at is null and machine.deleted_at is null
    and exists(select 1 from public.machine_salvage_items where source_machine_id=machine.id and required)
    and not exists(select 1 from public.machine_salvage_items where source_machine_id=machine.id and required and status='on_machine') then
    perform inventory_private.machine_event(machine.id,'status_change','Salvage completed — Ready for Disposal',s);
    update public.workspace_records set archived_at=now(),archived_by=auth.uid(),purge_after=now()+interval '30 days',updated_by=auth.uid(),
      payload=payload || jsonb_build_object('status','archived','archivedStatus','ready_for_disposal','readyForDisposalAt',now(),'archivedAt',now(),'purgeAfter',now()+interval '30 days','updatedAt',now(),'updatedBy',auth.uid()) where id=machine.id;
    perform inventory_private.machine_event(machine.id,'status_change','Machine archived — 30-day retention started',s);
    foreach target_role in array array['admin','manager'] loop
      insert into public.workspace_records(id,record_type,payload) values('disposal:'||machine.id||':'||target_role,'notification',jsonb_build_object(
        'id','disposal:'||machine.id||':'||target_role,'userId',null,'roleTarget',target_role,'type','ready_for_disposal','title','Machine Ready for Disposal',
        'body',format('%s / Serial %s / %s — ready %s',machine.payload->>'modelName',coalesce(machine.payload->>'serialNumber','unknown'),machine.id,now()),
        'entityType','green_machine','entityId',machine.id,'isRead',false,'createdAt',now())) on conflict(id) do nothing;
    end loop;
  end if;
  return v_part_id;
end $$;
create function public.salvage_action(p_id uuid,p_action text,p_draft jsonb default '{}'::jsonb) returns uuid
language sql security invoker set search_path = '' as $$ select inventory_private.salvage_action(p_id,p_action,p_draft); $$;

create function inventory_private.resolve_salvage_model(p_id uuid,p_model_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.machine_salvage_items; actor text;
begin
  if coalesce(inventory_private.active_role(),'') not in ('admin','manager') then raise exception 'Not permitted' using errcode='42501'; end if;
  select * into s from public.machine_salvage_items where id=p_id for update;
  if not found or s.status<>'pending_inventory' then raise exception 'Pending item required'; end if;
  if not exists(select 1 from public.models where id=p_model_id and archived_at is null and deleted_at is null) then raise exception 'Select an active source model'; end if;
  if s.machine_snapshot->>'modelId'=p_model_id::text and not coalesce((s.draft->>'modelResolutionRequired')::boolean,false) then return; end if;
  if not coalesce((s.draft->>'modelResolutionRequired')::boolean,false) then raise exception 'Source model is already resolved'; end if;
  select coalesce(nullif(full_name,''),'Manager') into actor from public.profiles where id=auth.uid();
  update public.machine_salvage_items set machine_snapshot=machine_snapshot || jsonb_build_object('modelId',p_model_id),
    draft=draft || jsonb_build_object('modelResolutionRequired',false,'compatibleModelIds',coalesce(draft->'compatibleModelIds','[]'::jsonb) || to_jsonb(p_model_id)) where id=p_id;
  s.actor_label:=actor;
  perform inventory_private.machine_event(s.source_machine_id,'note',format('Source model resolved to %s by %s; original model: %s',p_model_id,actor,s.machine_snapshot->>'modelName'),s);
end $$;
create function public.resolve_salvage_model(p_id uuid,p_model_id uuid) returns void
language sql security invoker set search_path = '' as $$ select inventory_private.resolve_salvage_model(p_id,p_model_id); $$;

-- Manager archive visibility is required for disposal and restore. Other
-- workspace read rules stay intact; inactive/missing profiles now fail closed.
drop policy "Workspace records: read permitted" on public.workspace_records;
create policy "Workspace records: read permitted" on public.workspace_records for select to authenticated using (
  inventory_private.active_role() is not null and (
    public.is_admin_user() or (record_type in ('green_machine','green_machine_event') and public.is_workspace_manager()) or
    (record_type='green_machine' and deleted_at is null and payload->>'archivedStatus'='ready_for_disposal') or
    (archived_at is null and deleted_at is null and (record_type<>'notification' or owner_id=auth.uid()
      or payload->>'roleTarget'='all' or payload->>'roleTarget'=inventory_private.active_role()))
  )
);

create function inventory_private.notify_pending_inventory() returns integer
language plpgsql security definer set search_path = '' as $$
declare pending integer; oldest timestamptz; aged integer; target_role text; nid text;
begin
  select count(*),min(resolved_at),count(*) filter(where resolved_at<now()-interval '7 days') into pending,oldest,aged
  from public.machine_salvage_items where status='pending_inventory';
  if pending=0 then return 0; end if;
  foreach target_role in array array['admin','manager'] loop
    nid:='pending-inventory:'||to_char(now() at time zone 'UTC','YYYY-MM-DD')||':'||target_role;
    insert into public.workspace_records(id,record_type,payload) values(nid,'notification',jsonb_build_object(
      'id',nid,'userId',null,'roleTarget',target_role,'type','pending_inventory','title',format('%s parts are waiting to be inventoried.',pending),
      'body',format('Service Bin: %s pending; oldest %s; %s older than 7 days.',pending,oldest,aged),
      'entityType','pending_inventory','entityId','service-bin','isRead',false,'createdAt',now())) on conflict(id) do nothing;
  end loop;
  return pending;
end $$;
create function public.notify_pending_inventory() returns integer language sql security invoker set search_path = '' as $$ select inventory_private.notify_pending_inventory(); $$;

-- Explicit execution grants: private helpers cannot be invoked directly by clients.
revoke all on all functions in schema inventory_private from public,anon,authenticated;
revoke all on function public.resolve_salvage_model(uuid,uuid) from public,anon,authenticated;
grant execute on function public.resolve_salvage_model(uuid,uuid),inventory_private.resolve_salvage_model(uuid,uuid) to authenticated;
revoke all on function public.save_inventory_part(jsonb,timestamptz),public.adjust_inventory_part(uuid,integer) from public,anon,authenticated;
grant execute on function public.save_inventory_part(jsonb,timestamptz),inventory_private.save_inventory_part(jsonb,timestamptz),public.adjust_inventory_part(uuid,integer),inventory_private.adjust_inventory_part(uuid,integer) to authenticated;
grant execute on function inventory_private.active_role(),inventory_private.reserve_part(uuid,integer,text,uuid),inventory_private.resolve_reservation(uuid,text),inventory_private.salvage_action(uuid,text,jsonb) to authenticated;
revoke all on function public.reserve_part(uuid,integer,text,uuid),public.resolve_reservation(uuid,text),public.salvage_action(uuid,text,jsonb),public.notify_pending_inventory() from public,anon,authenticated;
grant execute on function public.reserve_part(uuid,integer,text,uuid),public.resolve_reservation(uuid,text),public.salvage_action(uuid,text,jsonb) to authenticated;
grant execute on function public.notify_pending_inventory(),inventory_private.notify_pending_inventory() to service_role;
-- Existing retention job remains database-owned, never callable by app users.
revoke all on function public.purge_expired_retained_records() from public,anon,authenticated;
grant execute on function public.purge_expired_retained_records() to service_role;

commit;
