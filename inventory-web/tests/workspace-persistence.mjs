import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

// Exercise the real persistence adapter and supabase-js over HTTP. SQL/RLS is
// separately executed by test:db; this transport deliberately preserves stale JSON.
const fixture = spawn(process.execPath,["tests/mock-supabase.mjs"],{
  env:{...process.env,TEST_SUPABASE_PORT:"55441"},windowsHide:true,stdio:["ignore","pipe","inherit"],
});
let checks=0;
const check=(name,condition)=>{assert.ok(condition,name);checks++;console.log(`PASS ${name}`);};
try {
  await once(fixture.stdout,"data");
  const origin="http://127.0.0.1:55441";
  const client=createClient(origin,"test-only",{auth:{persistSession:false,autoRefreshToken:false}});
  const user="10000000-0000-4000-8000-000000000001";
  const source=await readFile("src/lib/supabase/workspace-content.ts","utf8");
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  const api=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  const state=()=>api.fetchWorkspaceContentState(client,user);
  const now=new Date().toISOString();
  const payloads=[
    ["faqs",{id:"faq",question:"Question",isPublished:true}],
    ["sops",{id:"sop",title:"SOP",roleVisibility:["all"],isPublished:true}],
    ["updateLogs",{id:"update",title:"Release",publishedAt:now,isPublished:true}],
    ["comingSoonItems",{id:"soon",title:"Soon",targetDate:null,isPublished:true}],
    ["forumPosts",{id:"post",threadId:"thread",body:"Reply"}],
    ["featureRequestVotes",{id:"vote",featureRequestId:"thread",userId:user,vote:1}],
  ];
  for(const [collection,payload] of payloads) {
    await api.upsertWorkspaceRecord(client,payload,user,"create");
    check(`${collection} created and hydrated`,(await state())[collection].some(x=>x.id===payload.id));
    await api.archiveWorkspaceRecord(client,payload.id,user,"deleted");
    check(`${collection} deleted SQL flags hide stale published JSON`,!(await state())[collection].some(x=>x.id===payload.id));
    await assert.rejects(api.upsertWorkspaceRecord(client,payload,user,"update"),/not saved/);
    check(`${collection} stale edit cannot resurrect`,true);
  }
  const machine={id:"retention-machine",modelName:"Copier",status:"active",createdAt:now};
  await api.upsertWorkspaceRecord(client,machine,user,"create");
  await api.archiveWorkspaceRecord(client,machine.id,user,"archived");
  check("SQL archive normalizes old machine JSON",(await state()).greenMachines.find(x=>x.id===machine.id).status==="archived");
  await api.upsertWorkspaceRecord(client,{...machine,archivedAt:null,deletedAt:null,purgeAfter:null},user,"restore");
  check("explicit existing machine restore persists",(await state()).greenMachines.find(x=>x.id===machine.id).status==="active");
  for(const status of ["archived","deleted"]) {
    const thread={id:`thread-${status}`,type:"general",title:"Thread",status:"open"};
    await api.upsertWorkspaceRecord(client,thread,user,"create");
    await api.archiveWorkspaceRecord(client,thread.id,user,status);
    check(`thread ${status} normalized from columns`,(await state()).forumThreads.find(x=>x.id===thread.id).status===status);
  }
  const notification={id:"notice",isRead:false,title:"Notice",roleTarget:"all",userId:null};
  await api.upsertWorkspaceRecord(client,notification,user,"create");
  await api.markWorkspaceNotificationRead(client,notification.id,user);
  for(const mode of ["archived","deleted","restored"]) {
    await api.setWorkspaceNotificationLifecycle(client,notification.id,user,mode);
    const notice=(await state()).notifications.find(x=>x.id===notification.id);
    check(`notification receipt ${mode} survives hydration`,mode==="restored" ? !notice.archivedAt&&!notice.deletedAt : Boolean(mode==="archived"?notice.archivedAt:notice.deletedAt));
    check("receipt lifecycle preserves read state",notice.isRead);
  }
  await fetch(`${origin}/__workspace-fail?mode=zero`);
  await assert.rejects(api.setWorkspaceNotificationLifecycle(client,notification.id,user,"deleted"),/not saved/);
  check("zero-row notification result rejected",true);
  await fetch(`${origin}/__workspace-fail?mode=error`);
  await assert.rejects(api.archiveWorkspaceRecord(client,machine.id,user,"deleted"),{message:"Workspace write denied by test policy"});
  check("database errors propagate from destructive adapter",true);
  await fetch(`${origin}/__workspace-empty`);
  await assert.rejects(api.upsertWorkspaceRecord(client,machine,user,"restore"),/not saved/);
  await assert.rejects(api.restoreWorkspaceRecord(client,machine.id,user),/not restored/);
  check("restore after purge cannot insert stale snapshot",true);
  check("authoritative empty collections remain empty",Object.values(await state()).every(items=>items.length===0));
  console.log(`Persistence adapter checks passed: ${checks}`);
} finally {
  fixture.kill();
  await once(fixture,"exit");
}
