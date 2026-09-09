// Browser-test transport fixtures only. Never reads .env.local or contacts Supabase.
import { createServer } from "node:http";
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  manager: "10000000-0000-4000-8000-000000000002",
  technician: "10000000-0000-4000-8000-000000000003",
  viewer: "10000000-0000-4000-8000-000000000004",
};
const partId = "20000000-0000-4000-8000-000000000001",
  modelId = "30000000-0000-4000-8000-000000000001";
const now = new Date().toISOString();
const machine = {
  id: "machine-test",
  modelId,
  modelName: "bizhub C450i",
  seriesFamily: "i-Series",
  serialNumber: "ABC12345",
  locationId: null,
  status: "active",
  notes: "",
  qrToken: "test",
  createdBy: ids.admin,
  updatedBy: ids.admin,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
  archivedStatus: null,
};
let parts, items, reservations, calls, workspaceRows, receipts, workspaceFailure;
function reset() {
  machine.modelId=modelId;
  machine.modelName="bizhub C450i";
  parts = [
    {
      id: partId,
      part_number: "TEST-FUSER",
      is_npn: false,
      part_name: "Fuser",
      manufacturer: "Konica Minolta",
      category: "Fusers",
      location_id: null,
      quantity_on_hand: 3,
      reorder_point: 0,
      reorder_target: 0,
      universal: false,
      notes: "",
      created_at: now,
      updated_at: now,
    },
  ];
  items = ["Fuser", "Transfer Belt", "Main Board"].map((component_name, i) => ({
    id: `40000000-0000-4000-8000-00000000000${i + 1}`,
    source_machine_id: machine.id,
    machine_snapshot: machine,
    component_name,
    category: i === 0 ? "Fusers" : i === 1 ? "Transfer" : "Boards",
    required: true,
    sort_order: i,
    status: "on_machine",
    draft: {},
    part_id: null,
    actor_label: null,
    resolved_at: null,
  }));
  reservations = [];
  calls = [];
  workspaceFailure = null;
  receipts = [];
  workspaceRows = [{id:machine.id,record_type:"green_machine",payload:machine,created_at:now,updated_at:now,archived_at:null,deleted_at:null,purge_after:null}];
}
reset();
const userFor = (role) => ({
  id: ids[role] ?? ids.viewer,
  email: `${role}@example.test`,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: now,
});
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3105");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:55440");
  let text = "";
  for await (const c of req) text += c;
  const body = text ? JSON.parse(text) : {};
  let role = "viewer";
  try {
    const jwt = JSON.parse(
      Buffer.from(
        (req.headers.authorization ?? "").split(".")[1],
        "base64url",
      ).toString(),
    );
    role = Object.keys(ids).find((r) => ids[r] === jwt.sub) ?? "viewer";
  } catch {}
  const send = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/__reset") {
    reset();
    return send({ ok: true });
  }
  if (url.pathname === "/__pending") {
    items[2].status = "pending_inventory";
    items[2].resolved_at = now;
    items[2].actor_label = "technician";
    items[2].draft = {
      partNumber: "KNOWN-BOARD",
      partName: "Main Board",
      isNpn: false,
      manufacturer: "Konica Minolta",
      category: "Boards",
      quantityOnHand: 1,
      compatibleModelIds: [modelId],
      notes: "Saved for intake",
    };
    return send({ ok: true });
  }
  if (url.pathname === "/__calls") return send(calls);
  if (url.pathname === "/__workspace") {
    if (req.method === "POST") workspaceRows=body.rows;
    return send({rows:workspaceRows,receipts});
  }
  if (url.pathname === "/__workspace-empty") { workspaceRows=[]; items=[]; return send({ok:true}); }
  if (url.pathname === "/__workspace-fail") { workspaceFailure=url.searchParams.get("mode") ?? "error"; return send({ok:true}); }
  if (url.pathname === "/__unmapped") {
    machine.modelId=null;
    machine.modelName="Unmapped legacy copier";
    return send({ok:true});
  }
  if (url.pathname === "/auth/v1/token") {
    role = (body.email ?? "viewer").split("@")[0];
    const user = userFor(role);
    const token = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "testsignature",
    ].join(".");
    return send({
      access_token: token,
      refresh_token: "test-refresh",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user,
    });
  }
  if (url.pathname === "/auth/v1/user") return send(userFor(role));
  if (url.pathname.startsWith("/auth/")) return send({});
  const table = url.pathname.replace("/rest/v1/", "");
  if ((table === "workspace_records" || table === "workspace_notification_receipts") && req.method !== "GET") {
    calls.push({name:table,method:req.method,body,role});
    if (workspaceFailure) {
      const failure=workspaceFailure; workspaceFailure=null;
      res.setHeader("Content-Range", "*/0");
      return failure==="zero" ? send([]) : send({message:"Workspace write denied by test policy"},403);
    }
    const records=table==="workspace_records" ? workspaceRows : receipts;
    let changed=[];
    if(req.method==="POST") {
      for(const row of Array.isArray(body)?body:[body]) {
        const existing=records.find(r=>table==="workspace_records"?r.id===row.id:r.notification_id===row.notification_id&&r.user_id===row.user_id);
        if(existing) {Object.assign(existing,row);changed.push(existing);}
        else {const next={archived_at:null,deleted_at:null,purge_after:null,...row};records.push(next);changed.push(next);}
      }
    } else if(req.method==="PATCH") {
      changed=records.filter(r=>[...url.searchParams].every(([k,v])=>v.startsWith("eq.")?String(r[k])===v.slice(3):v==="is.null"?r[k]==null:true));
      changed.forEach(r=>Object.assign(r,body));
    }
    res.setHeader("Content-Range", `*/${changed.length}`);
    return send(req.headers.accept?.includes("application/vnd.pgrst.object+json") ? changed[0]??null : changed);
  }
  if (table.startsWith("rpc/")) {
    calls.push({ name: table, body, role });
    if (table === "rpc/save_inventory_part") {
      const d=body.p_draft;
      if(d.partNumber==="REJECTED-PART") return send({message:"Part changed since this form opened. Reload before saving"},409);
      const p=parts.find(p=>p.id===d.id || p.part_number===d.partNumber);
      if(p) Object.assign(p,{part_name:d.partName,quantity_on_hand:d.id?d.quantityOnHand:p.quantity_on_hand+d.quantityOnHand,updated_at:new Date().toISOString()});
      else parts.push({...parts[0],id:crypto.randomUUID(),part_number:d.partNumber,part_name:d.partName,is_npn:d.isNpn,quantity_on_hand:d.quantityOnHand});
      return send(p?.id ?? parts.at(-1).id);
    }
    if (table === "rpc/adjust_inventory_part") {
      parts.find(p=>p.id===body.p_id).quantity_on_hand+=body.p_delta;
      return send(null);
    }
    if (table === "rpc/resolve_salvage_model") {
      const item=items.find(s=>s.id===body.p_id);
      item.machine_snapshot={...item.machine_snapshot,modelId:body.p_model_id};
      item.draft.modelResolutionRequired=false;
      item.draft.compatibleModelIds=[body.p_model_id];
      return send(null);
    }
    if (table === "rpc/reserve_part") {
      reservations.push({
        id: body.p_request_id,
        part_id: partId,
        quantity: body.p_quantity,
        user_id: ids[role],
        actor_label: role,
        status: "active",
        notes: body.p_notes,
        created_at: now,
      });
      return send(body.p_request_id);
    }
    if (table === "rpc/resolve_reservation") {
      const r = reservations.find((r) => r.id === body.p_id);
      r.status = body.p_action;
      if (body.p_action === "fulfilled")
        parts[0].quantity_on_hand -= r.quantity;
      return send(null);
    }
    if (table === "rpc/salvage_action") {
      const item = items.find((s) => s.id === body.p_id);
      item.status = body.p_action;
      item.draft = body.p_draft;
      if(body.p_action==="pending_inventory" && !item.machine_snapshot.modelId) item.draft.modelResolutionRequired=true;
      item.resolved_at = now;
      item.actor_label = role;
      if (body.p_action === "inventoried") item.part_id = partId;
      return send(item.part_id);
    }
    return send(0);
  }
  let data = [];
  calls.push({name:table,method:req.method,...(req.method !== "GET" ? {body} : {})});
  if (table === "profiles")
    data = [
      {
        id: ids[role],
        full_name: role,
        role,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ];
  if (table === "parts") data = parts;
  if (table === "models")
    data = [
      {
        id: modelId,
        manufacturer: "Konica Minolta",
        model_name: "C450i",
        series: "i-Series",
        status: "active",
        notes: "",
        created_at: now,
        updated_at: now,
      },
    ];
  if (table === "part_model_links")
    data = [{ part_id: partId, model_id: modelId }];
  if (table === "inventory_reservations") data = reservations;
  if (table === "inventory_availability")
    data = parts.map((p) => ({
      part_id: p.id,
      on_hand: p.quantity_on_hand,
      reserved: reservations
        .filter((r) => r.status === "active")
        .reduce((sum, r) => sum + r.quantity, 0),
    }));
  if (table === "machine_salvage_items") data = items;
  if (table === "workspace_records") data=workspaceRows;
  if (table === "workspace_notification_receipts") data=receipts;
  for (const [key, value] of url.searchParams)
    if (value.startsWith("eq."))
      data = data.filter((r) => String(r[key]) === value.slice(3));
  if (req.headers.accept?.includes("application/vnd.pgrst.object+json"))
    return send(data[0] ?? null);
  send(data);
}).listen(Number(process.env.TEST_SUPABASE_PORT ?? 55440), "127.0.0.1", () =>
  console.log("Browser fixture transport ready"),
);
