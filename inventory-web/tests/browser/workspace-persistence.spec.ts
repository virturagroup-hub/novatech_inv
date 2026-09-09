import {test,expect,type Page} from "@playwright/test";
const fixture="http://127.0.0.1:55440";
async function login(page:Page,role="admin") {
  await page.goto("/login");
  await page.getByPlaceholder("jane@novatech.com").fill(`${role}@example.test`);
  await page.getByPlaceholder("Enter your password").fill("local-test-only");
  await page.getByRole("button",{name:/sign in/i}).click();
  await expect(page).not.toHaveURL(/\/login/, {timeout:15000});
}
test.beforeEach(async({request})=>{await request.get(`${fixture}/__reset`);});
test("deleted machine remains absent after reload and a clean second browser session",async({page,request,browser})=>{
  await request.get(`${fixture}/__workspace-empty`);
  await login(page);
  await page.goto("/green-machines");
  await page.getByRole("button",{name:"Add machine",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByPlaceholder("imageRUNNER ADVANCE DX C5840").fill("Persistence test machine");
  await dialog.getByPlaceholder("C5800",{exact:true}).fill("Test series");
  await dialog.getByRole("button",{name:/Save machine/i}).click();
  await expect(page).toHaveURL(/\/green-machines\/.+/);
  const persisted=await (await request.get(`${fixture}/__workspace`)).json();
  expect(persisted.rows).toHaveLength(1);
  expect(persisted.rows[0].payload.modelName).toBe("Persistence test machine");
  page.on("dialog",d=>d.accept());
  await page.getByRole("button",{name:"Delete",exact:true}).click();
  await expect(page).toHaveURL(/\/green-machines$/);
  const deleted=await (await request.get(`${fixture}/__workspace`)).json();
  expect(deleted.rows[0].deleted_at).toBeTruthy();
  expect(deleted.rows[0].purge_after).toBeTruthy();
  await page.reload();
  await expect(page.getByText("No machines in this view.", {exact:true})).toBeVisible();
  await expect(page.getByText("Persistence test machine",{exact:true})).toHaveCount(0);
  const context=await browser.newContext();
  const second=await context.newPage();
  await login(second);
  await second.goto("/green-machines");
  await expect(second.getByText("No machines in this view.", {exact:true})).toBeVisible();
  await expect(second.getByText("Persistence test machine",{exact:true})).toHaveCount(0);
  await context.close();
});

for (const mode of ["error", "zero"]) {
  test(`failed deletion (${mode}) keeps authoritative machine and shows error`, async ({page,request}) => {
    await login(page);
    await page.goto("/green-machines/machine-test");
    await expect(page.getByRole("button",{name:"Delete",exact:true})).toBeVisible();
    await request.get(`${fixture}/__workspace-fail?mode=${mode}`);
    page.on("dialog",d=>d.accept());
    await page.getByRole("button",{name:"Delete",exact:true}).click();
    await expect(page.getByText(mode==="error" ? "Workspace write denied by test policy" : "Record was not removed. It may no longer exist or you may not have permission.",{exact:true})).toBeVisible();
    await expect(page).toHaveURL(/\/green-machines\/machine-test$/);
    expect((await (await request.get(`${fixture}/__workspace`)).json()).rows[0].deleted_at).toBeNull();
    await page.reload();
    await expect(page.getByRole("heading",{name:"bizhub C450i",exact:true})).toBeVisible();
  });
}

test("archive survives hydration and is accessible only in archived roster",async({page,request})=>{
  await login(page,"manager");
  await page.goto("/green-machines/machine-test");
  page.on("dialog",d=>d.accept());
  await page.getByRole("button",{name:"Archive",exact:true}).click();
  await expect(page.getByText("Machine archived for 30 days",{exact:true})).toBeVisible();
  expect((await (await request.get(`${fixture}/__workspace`)).json()).rows[0].archived_at).toBeTruthy();
  await page.goto("/green-machines");
  await expect(page.getByText("No machines in this view.",{exact:true})).toBeVisible();
  await page.getByLabel("Machine view").selectOption("archived");
  await expect(page.getByText("bizhub C450i",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Restore",exact:true}).click();
  await expect(page.getByText("Machine restored",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText("bizhub C450i",{exact:true})).toBeVisible();
});

test("empty server and orphaned history do not hydrate machine snapshots or stale localStorage",async({page,request})=>{
  const {rows}=await (await request.get(`${fixture}/__workspace`)).json();
  await request.post(`${fixture}/__workspace`,{data:{rows:[{...rows[0],id:"history-only",record_type:"green_machine_event",payload:{id:"history-only",machineId:"machine-test",eventType:"note",note:"Historical source",createdAt:rows[0].created_at}}]}});
  await page.addInitScript(()=>localStorage.setItem("novatech-workspace-content-v1",JSON.stringify({greenMachines:[{id:"stale",modelName:"Stale machine",status:"active"}]})));
  await login(page);
  await page.goto("/green-machines");
  await expect(page.getByText("No machines in this view.",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText("No machines in this view.",{exact:true})).toBeVisible();
  await expect(page.getByText("Stale machine",{exact:true})).toHaveCount(0);
});

for(const role of ["technician","viewer"]) test(`${role} has no machine destructive controls`,async({page})=>{
  await login(page,role);
  await page.goto("/green-machines/machine-test");
  await expect(page.getByRole("heading",{name:"bizhub C450i",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Delete",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Archive",exact:true})).toHaveCount(0);
});

for (const [kind,path,button,empty] of [
  ["faq","/support","Delete FAQ","No FAQ entries yet."],
  ["update_log","/updates","Delete entry","No update logs yet."],
  ["coming_soon","/updates","Delete item","No coming-soon items yet."],
]) test(`${kind} delete stays absent from content editor after refresh`,async({page,request})=>{
  const now=new Date().toISOString();
  const payload={id:"content-test",question:"Persistence content",answer:"Answer",title:"Persistence content",body:"Body",description:"Details",category:"General",sortOrder:0,isPublished:true,status:"planned",createdAt:now,updatedAt:now,...(kind==="update_log"?{publishedAt:now,version:"1"}:kind==="coming_soon"?{targetDate:null}:{})};
  await request.post(`${fixture}/__workspace`,{data:{rows:[{id:payload.id,record_type:kind,payload,archived_at:null,deleted_at:null,purge_after:null}]}});
  await login(page);
  await page.goto(path);
  if(kind==="coming_soon") await page.getByRole("tab",{name:"Coming soon",exact:true}).click();
  await page.getByRole("button",{name:/Persistence content/}).click();
  page.on("dialog",d=>d.accept());
  await page.getByRole("button",{name:button,exact:true}).click();
  await expect(page.getByRole("button",{name:/Persistence content/})).toHaveCount(0);
  expect((await (await request.get(`${fixture}/__workspace`)).json()).rows[0].deleted_at).toBeTruthy();
  await page.reload();
  if(kind==="coming_soon") await page.getByRole("tab",{name:"Coming soon",exact:true}).click();
  await expect(page.getByText(empty,{exact:true})).toBeVisible();
  await expect(page.getByText("Persistence content",{exact:true})).toHaveCount(0);
});

test("failed save keeps Add Machine form and does not fabricate server content",async({page,request})=>{
  await request.get(`${fixture}/__workspace-empty`);
  await login(page);
  await page.goto("/green-machines");
  await page.getByRole("button",{name:"Add machine",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByPlaceholder("imageRUNNER ADVANCE DX C5840").fill("Unsaved machine");
  await dialog.getByPlaceholder("C5800",{exact:true}).fill("Series");
  await request.get(`${fixture}/__workspace-fail?mode=error`);
  await dialog.getByRole("button",{name:"Save machine",exact:true}).click();
  await expect(page.getByText("Workspace write denied by test policy",{exact:true})).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("imageRUNNER ADVANCE DX C5840")).toHaveValue("Unsaved machine");
  expect((await (await request.get(`${fixture}/__workspace`)).json()).rows).toHaveLength(0);
});

test("unavailable workspace is visibly distinct from an empty successful load",async({page})=>{
  await page.route("**/rest/v1/workspace_records?**",route=>route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({message:"Test database unavailable"})}));
  await login(page);
  await page.goto("/green-machines");
  await expect(page.getByRole("alert").filter({hasText:"Shared workspace data could not be loaded"})).toBeVisible();
  await page.unroute("**/rest/v1/workspace_records?**");
  await page.getByRole("button",{name:"Retry",exact:true}).click();
  await expect(page.getByText("bizhub C450i",{exact:true})).toBeVisible();
});

test("new changelog creation and subsequent edit use distinct server operations",async({page,request})=>{
  await request.get(`${fixture}/__workspace-empty`);
  await login(page);
  await page.goto("/updates");
  const editor=page.getByRole("tabpanel");
  await editor.locator("input").first().fill("New persisted release");
  await editor.locator("textarea").fill("Release body");
  await editor.getByRole("button",{name:"Save changelog entry",exact:true}).click();
  await expect(page.getByText("Update log saved",{exact:true})).toBeVisible();
  await expect.poll(async()=>{
    const {rows}=await (await request.get(`${fixture}/__workspace`)).json();
    return rows.filter((row:{record_type:string})=>row.record_type==="update_log").length;
  }).toBe(1);
  await editor.locator("input").first().fill("Edited persisted release");
  await editor.getByRole("button",{name:"Save changelog entry",exact:true}).click();
  await expect.poll(async()=>{
    const {rows}=await (await request.get(`${fixture}/__workspace`)).json();
    return rows.find((row:{record_type:string})=>row.record_type==="update_log").payload.title;
  }).toBe("Edited persisted release");
  await page.reload();
  await expect(page.getByRole("button",{name:/Edited persisted release/})).toBeVisible();
});
