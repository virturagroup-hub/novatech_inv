import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";

// Real isolated PostgreSQL connections; no Supabase credentials are loaded.
const dir = await mkdtemp(path.join(tmpdir(), "novatech-db-test-"));
const database = new EmbeddedPostgres({
  databaseDir: dir,
  port: 55439,
  user: "postgres",
  password: "local-test-only",
  persistent: true,
  onLog: () => {},
  onError: () => {},
});
const clients = [];
let checks = 0;
function check(name, condition) {
  assert.ok(condition, name);
  checks++;
  console.log(`PASS ${name}`);
}
async function connect(role, user) {
  const client = database.getPgClient();
  await client.connect();
  clients.push(client);
  if (role) await client.query(`set role ${role}`);
  if (user)
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
  return client;
}
try {
  await database.initialise();
  await database.start();
  const db = await connect();
  await db.query(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    alter default privileges in schema public grant all on tables to authenticated,service_role;
    create type public.inventory_role as enum ('admin','manager','technician','viewer');
    create table public.profiles(id uuid primary key references auth.users(id), full_name text, role inventory_role not null default 'viewer', active boolean not null default true,
      created_at timestamptz default now(),updated_at timestamptz default now());
  `);
  await db.query(await readFile("supabase/phase2_schema.sql", "utf8"));
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if(file.startsWith("20260907")) {
      await db.query("insert into workspace_records(id,record_type,payload,archived_at,purge_after) values('legacy-archived','green_machine','{\"modelName\":\"Legacy copier\",\"status\":\"archived\",\"archivedStatus\":\"ready_for_disposal\"}',now(),now()+interval '30 days'),('legacy-ready','green_machine','{\"modelName\":\"Legacy copier\",\"status\":\"ready_for_disposal\"}',null,null)");
    }
    await db.query(await readFile(`supabase/migrations/${file}`, "utf8"));
    console.log(`Applied ${file}`);
  }
  const ids = Object.fromEntries(
    ["admin", "manager", "tech1", "tech2", "viewer", "inactive"].map((role) => [
      role,
      randomUUID(),
    ]),
  );
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query(
      "update profiles set full_name=$2,role=$3,active=$4 where id=$1",
      [
        id,
        name,
        name.startsWith("tech")
          ? "technician"
          : name === "inactive"
            ? "technician"
            : name,
        name !== "inactive",
      ],
    );
  }
  const tech1 = await connect("authenticated", ids.tech1),
    tech2 = await connect("authenticated", ids.tech2),
    manager = await connect("authenticated", ids.manager),
    admin = await connect("authenticated", ids.admin),
    viewer = await connect("authenticated", ids.viewer),
    inactive = await connect("authenticated", ids.inactive),
    service = await connect("service_role");
  const part = (
    await db.query(
      "insert into parts(part_number,part_name,manufacturer,category,quantity_on_hand) values('LAST-ONE','Fuser','Konica Minolta','Fusers',1) returning id",
    )
  ).rows[0].id;
  const reserve = (client, quantity = 1, id = randomUUID()) =>
    client.query("select reserve_part($1,$2,$3,$4) as id", [
      part,
      quantity,
      "Test hold",
      id,
    ]);
  const race = await Promise.allSettled([reserve(tech1), reserve(tech2)]);
  check(
    "two concurrent reservations: only one succeeds",
    race.filter((r) => r.status === "fulfilled").length === 1,
  );
  const reservation = (
    await db.query(
      "select * from inventory_reservations where part_id=$1 and status='active'",
      [part],
    )
  ).rows[0];
  const owner = reservation.user_id === ids.tech1 ? tech1 : tech2,
    other = owner === tech1 ? tech2 : tech1;
  await assert.rejects(
    other.query("select resolve_reservation($1,'cancelled')", [reservation.id]),
    /Not your reservation/,
  );
  check("technician cannot cancel another owner", true);
  await assert.rejects(
    db.query("update parts set quantity_on_hand=0 where id=$1", [part]),
    /Reserved/,
  );
  await assert.rejects(
    db.query("update parts set archived_at=now() where id=$1", [part]),
    /active reservations/,
  );
  check("existing stock and archive paths respect holds", true);
  await db.query("update parts set quantity_on_hand=3 where id=$1", [part]);
  await owner.query("select resolve_reservation($1,'fulfilled')", [
    reservation.id,
  ]);
  await owner.query("select resolve_reservation($1,'fulfilled')", [
    reservation.id,
  ]);
  check(
    "fulfillment 3/1/2 becomes 2/0/2; retry never deducts twice",
    (await db.query("select quantity_on_hand from parts where id=$1", [part]))
      .rows[0].quantity_on_hand === 2,
  );
  check(
    "exactly one fulfillment quantity audit",
    (
      await db.query(
        "select count(*)::int n from inventory_transactions where source='reservation_fulfillment'",
        [],
      )
    ).rows[0].n === 1,
  );
  for (const client of [viewer, inactive])
    await assert.rejects(reserve(client), /Not permitted/);
  await assert.rejects(
    tech1.query("update inventory_reservations set quantity=100"),
    /permission denied/,
  );
  check("viewer/inactive and direct reservation writes rejected", true);
  const ownReservation = (await reserve(tech1)).rows[0].id;
  await manager.query("select resolve_reservation($1,'cancelled')", [
    ownReservation,
  ]);
  check(
    "manager can cancel; cancelled history preserved",
    (
      await db.query("select status from inventory_reservations where id=$1", [
        ownReservation,
      ])
    ).rows[0].status === "cancelled",
  );
  const model = (
    await db.query(
      "insert into models(manufacturer,model_name,series) values('Konica Minolta','C450i','i-Series') returning id",
    )
  ).rows[0].id;
  const model2 = (
    await db.query(
      "insert into models(manufacturer,model_name,series) values('Konica Minolta','C550i','i-Series') returning id",
    )
  ).rows[0].id;
  const machine = randomUUID();
  const payload = {
    id: machine,
    modelId: model,
    modelName: "bizhub C450i",
    seriesFamily: "i-Series",
    serialNumber: "ABC12345",
    status: "active",
    createdBy: ids.manager,
    createdAt: new Date().toISOString(),
  };
  await manager.query(
    "insert into workspace_records(id,record_type,created_by,payload) values($1,'green_machine',$2,$3)",
    [machine, ids.manager, payload],
  );
  const items = (
    await db.query(
      "select * from machine_salvage_items where source_machine_id=$1 order by sort_order",
      [machine],
    )
  ).rows;
  check(
    "machine creation seeds nine configurable checklist components",
    items.length === 9,
  );
  await assert.rejects(
    manager.query(
      'update workspace_records set payload=payload || \'{"status":"ready_for_disposal"}\' where id=$1',
      [machine],
    ),
    /unresolved/,
  );
  check("manual Ready for Disposal cannot bypass unresolved checklist", true);
  const action = (client, item, kind, draft = {}) =>
    client.query("select salvage_action($1,$2,$3) id", [item.id, kind, draft]);
  const draft = {
    partNumber: "A161R71811",
    isNpn: false,
    partName: "Transfer belt",
    manufacturer: "Konica Minolta",
    category: "Transfer",
    quantityOnHand: 1,
    binId: null,
    reorderPoint: 0,
    reorderTarget: 0,
    compatibleModelIds: [model2],
    notes: "Salvaged",
  };
  await assert.rejects(
    action(viewer, items[0], "pulled_for_use"),
    /Not permitted/,
  );
  await assert.rejects(
    action(inactive, items[0], "pulled_for_use"),
    /Not permitted/,
  );
  await action(tech1, items[0], "pulled_for_use");
  check(
    "Pull for Use resolves without creating inventory",
    (await db.query("select count(*)::int n from parts")).rows[0].n === 1,
  );
  await assert.rejects(
    action(tech1, items[1], "inventoried", { ...draft, binId: randomUUID() }),
    /foreign key/,
  );
  check(
    "failed intake rolls back part, audit and checklist",
    (await db.query("select count(*)::int n from parts")).rows[0].n === 1 &&
      (
        await db.query("select status from machine_salvage_items where id=$1", [
          items[1].id,
        ])
      ).rows[0].status === "on_machine",
  );
  const intakeRace = await Promise.allSettled([
    action(tech1, items[1], "inventoried", draft),
    action(tech2, items[1], "inventoried", draft),
  ]);
  check(
    "duplicate direct intake returns same result",
    intakeRace.every((r) => r.status === "fulfilled") &&
      intakeRace[0].value.rows[0].id === intakeRace[1].value.rows[0].id,
  );
  const salvaged = intakeRace[0].value.rows[0].id;
  check(
    "source model and extra compatibility retained",
    (
      await db.query(
        "select count(*)::int n from part_model_links where part_id=$1",
        [salvaged],
      )
    ).rows[0].n === 2,
  );
  check(
    "intake stock and audit created once",
    (
      await db.query("select quantity_on_hand from parts where id=$1", [
        salvaged,
      ])
    ).rows[0].quantity_on_hand === 1 &&
      (
        await db.query(
          "select count(*)::int n from inventory_transactions where part_id=$1 and source='machine_transfer'",
          [salvaged],
        )
      ).rows[0].n === 1,
  );
  await assert.rejects(
    action(tech1, items[2], "pending_inventory", { ...draft, partNumber: "" }),
    /Part number or NPN/,
  );
  await action(tech1, items[2], "pending_inventory", {
    ...draft,
    partNumber: "",
    isNpn: true,
    partName: "Main Board",
  });
  await action(tech1, items[2], "pending_inventory", {
    ...draft,
    partNumber: "",
    isNpn: true,
    partName: "Main Board",
  });
  await assert.rejects(
    action(tech1, items[2], "inventoried", draft),
    /Only Admin\/Manager/,
  );
  check("Service Bin requires PN/NPN and restricts final intake", true);
  await action(tech2, items[3], "pending_inventory", draft);
  await assert.rejects(
    tech1.query("update machine_salvage_items set status='inventoried'"),
    /permission denied/,
  );
  await assert.rejects(
    viewer.query("select purge_expired_retained_records()"),
    /permission denied/,
  );
  check("direct salvage writes and client purge blocked", true);
  await service.query("select notify_pending_inventory()");
  await service.query("select notify_pending_inventory()");
  check(
    "daily consolidated notices deduplicate per role",
    (
      await db.query(
        "select count(*)::int n from workspace_records where payload->>'type'='pending_inventory'",
      )
    ).rows[0].n === 2,
  );
  await assert.rejects(
    tech1.query("select notify_pending_inventory()"),
    /permission denied/,
  );
  check("daily notice RPC restricted to service role", true);
  for (const item of items.slice(4)) await action(tech1, item, "missing");
  const archived = (
    await db.query("select * from workspace_records where id=$1", [machine])
  ).rows[0];
  check(
    "pending item does not block disposal/archive/30-day lifecycle",
    archived.payload.archivedStatus === "ready_for_disposal" &&
      archived.archived_at &&
      archived.purge_after,
  );
  check(
    "manager can read archived machine",
    (
      await manager.query("select id from workspace_records where id=$1", [
        machine,
      ])
    ).rowCount === 1,
  );
  check(
    "technician sees completed source machine confirmation",
    (
      await tech1.query("select id from workspace_records where id=$1", [
        machine,
      ])
    ).rowCount === 1,
  );
  check(
    "disposal notice generated for both management roles",
    (
      await db.query(
        "select count(*)::int n from workspace_records where payload->>'type'='ready_for_disposal'",
      )
    ).rows[0].n === 2,
  );
  const existingIntake = (await action(manager, items[3], "inventoried", draft))
    .rows[0].id;
  check(
    "manager intake adds to existing PN without duplicate part",
    existingIntake === salvaged &&
      (
        await db.query("select quantity_on_hand from parts where id=$1", [
          salvaged,
        ])
      ).rows[0].quantity_on_hand === 2,
  );
  check("archive retention is 30 days", Math.abs((archived.purge_after-archived.archived_at)/86400000-30)<0.001);
  await db.query("update workspace_records set purge_after=now()-interval '1 second' where id=$1", [machine]);
  await service.query("select public.purge_expired_retained_records()");
  const pending = (
    await db.query("select * from machine_salvage_items where id=$1", [
      items[2].id,
    ])
  ).rows[0];
  check(
    "machine deletion preserves pending lineage",
    pending.machine_id === null &&
      pending.machine_snapshot.serialNumber === "ABC12345",
  );
  const completed = (
    await action(admin, items[2], "inventoried", pending.draft)
  ).rows[0].id;
  check(
    "admin completes NPN intake after source deletion",
    Boolean(completed) &&
      (await db.query("select is_npn from parts where id=$1", [completed]))
        .rows[0].is_npn,
  );
  check(
    "completed pending record retained",
    (
      await db.query(
        "select completed_at,status from machine_salvage_items where id=$1",
        [items[2].id],
      )
    ).rows[0].status === "inventoried",
  );
  check(
    "machine timeline survives deletion",
    (
      await db.query(
        "select count(*)::int n from workspace_records where record_type='green_machine_event' and payload->>'machineId'=$1",
        [machine],
      )
    ).rows[0].n >= 11,
  );
  await db.query("update parts set deleted_at=now(),purge_after=now()-interval '1 second' where id=$1", [salvaged]);
  await service.query("select public.purge_expired_retained_records()");
  check(
    "part deletion preserves normal inventory audit",
    (
      await db.query(
        "select count(*)::int n from inventory_transactions where part_id is null and item_part_name='Transfer belt'",
      )
    ).rows[0].n >= 2,
  );
  // Pre-production audit: execute privileges and RLS as real database roles.
  const anon = await connect("anon");
  check("legacy active disposal readiness is reopened with history for checklist review",(await db.query("select payload->>'status' status from workspace_records where id='legacy-ready'")).rows[0].status==='active' && (await db.query("select count(*)::int n from workspace_records where id='salvage-review:legacy-ready'")).rows[0].n===1);
  await manager.query("insert into workspace_records(id,record_type,created_by,payload) values('legacy-archived','green_machine',$1,'{\"modelName\":\"Legacy copier\",\"status\":\"ready_for_disposal\"}') on conflict(id) do update set payload=excluded.payload,archived_at=null,purge_after=null",[ids.manager]);
  check("legacy archived UPSERT restore reopens and seeds checklist",(await db.query("select payload->>'status' status from workspace_records where id='legacy-archived'")).rows[0].status==='active' && (await db.query("select count(*)::int n from machine_salvage_items where source_machine_id='legacy-archived'")).rows[0].n===9);
  const hiddenArchived=(await db.query("insert into parts(part_number,part_name,manufacturer,category,quantity_on_hand,archived_at,purge_after) values('ARCHIVED-RLS','Archived','Canon','Fusers',1,now(),now()+interval '30 days') returning id")).rows[0].id;
  for(const [label,client,expected] of [["Admin",admin,1],["Manager",manager,1],["Technician",tech1,0],["Viewer",viewer,0]]) check(`${label} retains archived-part visibility rules`,(await client.query("select * from inventory_availability where part_id=$1",[hiddenArchived])).rowCount===expected);
  check("view explicitly uses caller RLS", (await db.query("select reloptions from pg_class where oid='public.inventory_availability'::regclass")).rows[0].reloptions.includes("security_invoker=true"));
  await db.query("create policy audit_hidden_part on public.parts as restrictive for select to authenticated using (part_number is distinct from 'AUDIT-HIDDEN')");
  await db.query("insert into parts(part_number,part_name,manufacturer,category,quantity_on_hand) values('AUDIT-HIDDEN','Hidden','Konica Minolta','Fusers',1)");
  for (const [label,client] of [["Admin",admin],["Manager",manager],["Technician",tech1],["Viewer",viewer]]) {
    const base = (await client.query("select id from parts order by id")).rows.map(r=>r.id);
    const view = (await client.query("select part_id from inventory_availability order by part_id")).rows.map(r=>r.part_id);
    assert.deepEqual(view,base);
    check(`${label} availability exactly matches underlying RLS, including restrictive policy`, true);
  }
  await assert.rejects(anon.query("select * from inventory_availability"),/permission denied/);
  check("anonymous view access denied",true);
  await db.query("drop policy audit_hidden_part on public.parts");
  for (const table of ["inventory_reservations","machine_salvage_items","salvage_profiles","salvage_profile_components"]) {
    for (const privilege of ["INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER"]) {
      check(`${table} does not grant ${privilege} to app users`, !(await db.query("select has_table_privilege('authenticated',$1,$2) allowed",[table,privilege])).rows[0].allowed);
    }
  }
  await assert.rejects(tech1.query("truncate inventory_reservations"),/permission denied/);
  check("private definer helpers have fixed empty search path",(await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='inventory_private' and p.prosecdef and not (p.proconfig @> array['search_path=\"\"'])")).rows[0].n===0);
  for (const signature of ["inventory_private.machine_event(text,text,text,public.machine_salvage_items,uuid)","inventory_private.capture_inventory_audit()","inventory_private.guard_reserved_stock()","public.purge_expired_retained_records()","public.notify_pending_inventory()"]) {
    check(`${signature} not client executable`,!(await db.query("select has_function_privilege('authenticated',$1,'execute') allowed",[signature])).rows[0].allowed);
  }
  await assert.rejects(admin.query("insert into parts(part_number,part_name,manufacturer,category,quantity_on_hand) values('NEGATIVE','Invalid','Canon','Fusers',-1)"),/nonnegative/);
  check("negative INSERT blocked without reservations",true);
  const hold=(await reserve(tech1)).rows[0].id;
  for (const sql of ["update parts set quantity_on_hand=0 where id=$1", "update parts set deleted_at=now() where id=$1", "update parts set purge_after=now() where id=$1", "delete from parts where id=$1"]) {
    await assert.rejects(admin.query(sql,[part]),/Reserved|reservations/);
  }
  await assert.rejects(admin.query("select adjust_inventory_part($1,-2)",[part]),/Reserved/);
  await assert.rejects(admin.query("insert into parts(id,part_number,part_name,manufacturer,category,quantity_on_hand) values($1,'LAST-ONE','Fuser','Konica Minolta','Fusers',0) on conflict(part_number) do update set quantity_on_hand=excluded.quantity_on_hand",[part]),/Reserved/);
  check("direct stock, soft delete, purge date, hard delete and adjustment cannot bypass active holds",true);
  await Promise.all([manager.query("select resolve_reservation($1,'cancelled')",[hold]),admin.query("select resolve_reservation($1,'cancelled')",[hold])]);
  check("concurrent cancellation creates one terminal event",(await db.query("select count(*)::int n from inventory_transactions where audit_type='reservation_cancelled' and item_snapshot->>'reservation_id'=$1",[hold])).rows[0].n===1);
  const rr = await connect("authenticated",ids.manager);
  await rr.query("begin isolation level repeatable read");
  await rr.query("select quantity_on_hand from parts where id=$1",[part]);
  const rrHold=(await reserve(tech1,2)).rows[0].id;
  await assert.rejects(rr.query("update parts set quantity_on_hand=0 where id=$1",[part]),/serialize/);
  await rr.query("rollback");
  check("stale REPEATABLE READ writer cannot miss a newly created reservation",true);
  await Promise.all([manager.query("select resolve_reservation($1,'fulfilled')",[rrHold]),admin.query("select resolve_reservation($1,'fulfilled')",[rrHold])]);
  check("concurrent fulfillment deducts exactly once",(await db.query("select quantity_on_hand from parts where id=$1",[part])).rows[0].quantity_on_hand===0);
  await assert.rejects(manager.query("select resolve_reservation($1,'cancelled')",[rrHold]),/already resolved/);
  await Promise.all([admin.query("select adjust_inventory_part($1,1)",[part]),manager.query("select adjust_inventory_part($1,1)",[part])]);
  check("concurrent legacy adjustments preserve both deltas",(await db.query("select quantity_on_hand from parts where id=$1",[part])).rows[0].quantity_on_hand===2);
  const ordinaryDraft={...draft,partNumber:"ORDINARY-ADD",compatibleModelIds:[model],quantityOnHand:2};
  const saved=(await admin.query("select save_inventory_part($1) id",[ordinaryDraft])).rows[0].id;
  const original=(await db.query("select * from parts where id=$1",[saved])).rows[0];
  await manager.query("select adjust_inventory_part($1,1)",[saved]);
  await assert.rejects(admin.query("select save_inventory_part($1,$2)",[{...ordinaryDraft,id:saved},original.updated_at]),/changed since/);
  check("stale Edit Part cannot restore stock removed by another user",true);
  await assert.rejects(admin.query("select save_inventory_part($1)",[{...ordinaryDraft,partNumber:"INVALID-LINK",compatibleModelIds:[randomUUID()]}]),/foreign key/);
  check("Add Part and model links roll back atomically",(await db.query("select count(*)::int n from parts where part_number='INVALID-LINK'")).rows[0].n===0);
  for (const client of [viewer,inactive]) {
    await assert.rejects(client.query("select save_inventory_part($1)",[ordinaryDraft]),/Not permitted/);
    await assert.rejects(client.query("select adjust_inventory_part($1,1)",[part]),/Not permitted/);
  }
  await tech1.query("select save_inventory_part($1)",[{...ordinaryDraft,partNumber:"TECH-EDIT"}]);
  await tech1.query("select adjust_inventory_part($1,1)",[saved]);
  await tech1.query("select adjust_inventory_part($1,-1)",[saved]);
  await assert.rejects(tech1.query("insert into models(manufacturer,model_name) values('Canon','Forbidden')"),/row-level security/);
  check("ordinary part RPCs allow active technicians without allowing model management; Viewer/inactive blocked",true);
  await Promise.all([admin.query("select save_inventory_part($1)",[ordinaryDraft]),manager.query("select save_inventory_part($1)",[ordinaryDraft])]);
  check("concurrent same-PN Add Part increments existing stock",(await db.query("select quantity_on_hand from parts where id=$1",[saved])).rows[0].quantity_on_hand===7);
  await admin.query("select save_inventory_part($1,(select updated_at from parts where id=$2))",[{...ordinaryDraft,id:saved,quantityOnHand:4,compatibleModelIds:[model2]},saved]);
  check("fresh Edit Part updates quantity and compatibility together",(await db.query("select quantity_on_hand from parts where id=$1",[saved])).rows[0].quantity_on_hand===4 && (await db.query("select model_id from part_model_links where part_id=$1",[saved])).rows[0].model_id===model2);
  await assert.rejects(admin.query("select save_inventory_part($1,(select updated_at from parts where id=$2))",[{...ordinaryDraft,id:saved,quantityOnHand:9,compatibleModelIds:[randomUUID()]},saved]),/foreign key/);
  check("failed edit preserves old quantity and model links",(await db.query("select quantity_on_hand from parts where id=$1",[saved])).rows[0].quantity_on_hand===4 && (await db.query("select model_id from part_model_links where part_id=$1",[saved])).rows[0].model_id===model2);
  const h1=(await reserve(tech1)).rows[0].id,h2=(await reserve(tech1)).rows[0].id;
  await tech1.query("begin");
  await tech1.query("select resolve_reservation($1,'fulfilled')",[h1]);
  await tech1.query("savepoint audit_subtransaction");
  await tech1.query("select resolve_reservation($1,'fulfilled')",[h2]);
  await tech1.query("release savepoint audit_subtransaction");
  await tech1.query("commit");
  for(const id of [h1,h2]) check("fulfillment audit attaches to exact row across same transaction/subtransaction",(await db.query("select count(*)::int n from inventory_transactions where source='reservation_fulfillment' and item_snapshot->>'reservation_id'=$1",[id])).rows[0].n===1);
  const unknownMachine=randomUUID();
  await manager.query("insert into workspace_records(id,record_type,created_by,payload) values($1,'green_machine',$2,$3)",[unknownMachine,ids.manager,{...payload,id:unknownMachine,modelId:null,modelName:"Unmapped legacy copier"}]);
  const unknownItems=(await db.query("select * from machine_salvage_items where source_machine_id=$1 order by sort_order",[unknownMachine])).rows;
  await action(tech1,unknownItems[0],"pulled_for_use");
  await assert.rejects(action(tech1,unknownItems[1],"inventoried",draft),/resolve the source model/);
  await action(tech1,unknownItems[1],"pending_inventory",draft);
  const unknownPending=(await db.query("select * from machine_salvage_items where id=$1",[unknownItems[1].id])).rows[0];
  check("unmapped model retains PN and source snapshot in shared queue",unknownPending.draft.modelResolutionRequired && unknownPending.draft.partNumber===draft.partNumber && unknownPending.machine_snapshot.modelName==="Unmapped legacy copier");
  for(const item of unknownItems.slice(2)) await action(tech1,item,"missing");
  await db.query("update workspace_records set purge_after=now()-interval '1 second' where id=$1",[unknownMachine]);
  await service.query("select purge_expired_retained_records()");
  await assert.rejects(tech1.query("select resolve_salvage_model($1,$2)",[unknownItems[1].id,model]),/Not permitted/);
  await manager.query("select resolve_salvage_model($1,$2)",[unknownItems[1].id,model]);
  await manager.query("select resolve_salvage_model($1,$2)",[unknownItems[1].id,model]);
  const mapped=(await db.query("select * from machine_salvage_items where id=$1",[unknownItems[1].id])).rows[0];
  check("management resolves source after actual purge, retaining original text",mapped.machine_id===null && mapped.machine_snapshot.modelId===model && mapped.machine_snapshot.modelName==="Unmapped legacy copier" && !mapped.draft.modelResolutionRequired);
  await action(manager,unknownItems[1],"inventoried",mapped.draft);
  check("mapped pending item can complete intake after source purge",true);
  const noticeCount=(await db.query("select count(*)::int n from workspace_records where payload->>'type'='pending_inventory'")).rows[0].n;
  check("empty queue sends no daily notice",(await service.query("select notify_pending_inventory() n")).rows[0].n===0 && (await db.query("select count(*)::int n from workspace_records where payload->>'type'='pending_inventory'")).rows[0].n===noticeCount);
  check("availability never negative",(await admin.query("select count(*)::int n from inventory_availability where available<0 or available<>on_hand-reserved")).rows[0].n===0);
  check("actual purge preserves unexpired parts and completed lineage",(await db.query("select count(*)::int n from parts where id=$1",[completed])).rows[0].n===1 && (await db.query("select inventory_snapshot from machine_salvage_items where id=$1",[items[1].id])).rows[0].inventory_snapshot!==null);
  const txMachine=randomUUID();
  await manager.query("insert into workspace_records(id,record_type,created_by,payload) values($1,'green_machine',$2,$3)",[txMachine,ids.manager,{...payload,id:txMachine}]);
  const txItems=(await db.query("select * from machine_salvage_items where source_machine_id=$1 order by sort_order",[txMachine])).rows;
  await manager.query("begin");
  await action(manager,txItems[0],"inventoried",{...draft,partNumber:"TX-AUDIT"});
  await manager.query("savepoint intake_subtransaction");
  await action(manager,txItems[1],"inventoried",{...draft,partNumber:"TX-AUDIT"});
  await manager.query("release savepoint intake_subtransaction");
  await manager.query("commit");
  for(const item of txItems.slice(0,2)) check("same-transaction salvage audits retain individual source item",(await db.query("select count(*)::int n from inventory_transactions where source='machine_transfer' and item_snapshot->>'salvage_item_id'=$1",[item.id])).rows[0].n===1);
  console.log(`Database checks passed: ${checks}`);
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  await database.stop();
  console.log(`Disposable test database stopped: ${dir}`);
}
