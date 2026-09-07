import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role = "technician") {
  await page.goto("/login");
  await page.getByPlaceholder("jane@novatech.com").fill(`${role}@example.test`);
  await page.getByPlaceholder("Enter your password").fill("local-test-only");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:55440/__reset");
});

test("reserve, fulfill and preserve readable history", async ({ page }) => {
  await login(page);
  await page.goto("/inventory/20000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("button", { name: "Reserve", exact: true }),
  ).toBeEnabled();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Reserve", exact: true }).click();
  await expect(
    page.getByText("Reservations require an online database confirmation.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Reserve", exact: true }).click();
  await expect(
    page.getByText("Reservation confirmed online", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fulfill / Take" }).click();
  await expect(page.getByText("fulfilled", { exact: true })).toBeVisible();
  await expect(page.getByText(/On Hand 2 · Reserved 0/)).toBeVisible();
  await fits(page);
});
test("salvage reuses Add Part, preselects source model and supports NPN Service Bin", async ({
  page,
  request,
}, testInfo) => {
  await login(page);
  await page.goto("/green-machines/machine-test");
  await expect(
    page.getByText("Salvage checklist", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pull for Use", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Put in Inventory", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/C450i/).first()).toBeVisible();
  await dialog.getByLabel("Part number", { exact: true }).fill("A161R71811");
  await dialog.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Save / Inventory Later", exact: true })
    .first()
    .click();
  await dialog.getByRole("checkbox", { name: "Mark as NPN" }).check();
  await page.screenshot({ path: testInfo.outputPath("service-bin-sheet.png") });
  await dialog
    .getByRole("button", { name: "Save to Service Bin", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const calls = await (
    await request.get("http://127.0.0.1:55440/__calls")
  ).json();
  const saves = calls.filter(
    (c: { name: string }) => c.name === "rpc/salvage_action",
  );
  expect(
    saves.map((c: { body: { p_action: string } }) => c.body.p_action),
  ).toEqual(["pulled_for_use", "inventoried", "pending_inventory"]);
  expect(saves[1].body.p_draft.compatibleModelIds).toContain(
    "30000000-0000-4000-8000-000000000001",
  );
  expect(saves[2].body.p_draft.isNpn).toBe(true);
  await fits(page);
});
test("manager completes Service Bin intake with known fields", async ({
  page,
  request,
}) => {
  await request.get("http://127.0.0.1:55440/__pending");
  await login(page, "manager");
  await page.goto("/pending-inventory");
  await page.getByRole("button", { name: "Complete inventory intake" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Part number", { exact: true })).toHaveValue(
    "KNOWN-BOARD",
  );
  await dialog.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete inventory intake" }),
  ).toHaveCount(0);
  await fits(page);
});
test("existing inventory, models, lookup, archive and reports routes remain available", async ({
  page,
  request,
}) => {
  await login(page, "admin");
  for (const route of [
    "/inventory",
    "/models",
    "/lookup",
    "/green-machines",
    "/locations",
    "/activity",
    "/import-export",
    "/notifications",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route));
    await expect(
      page.getByText("Application error", { exact: false }),
    ).toHaveCount(0);
  }
  // Use the signed-in browser's API context for the existing CSV export route.
  const exported = await page.request.get("/api/models/export");
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain("C450i");
  expect((await request.get("/api/cron/supabase-keepalive")).status()).toBe(
    401,
  );
});
test("viewer has no new write controls", async ({ page }) => {
  await login(page, "viewer");
  await page.goto("/inventory/20000000-0000-4000-8000-000000000001");
  await expect(page.getByText("Reservations", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reserve", exact: true }),
  ).toHaveCount(0);
  await page.goto("/green-machines/machine-test");
  await expect(
    page.getByText("Salvage checklist", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pull for Use", exact: true }),
  ).toHaveCount(0);
  await fits(page);
});
test("cron requires bearer secret", async ({ request }) => {
  expect((await request.get("/api/cron/supabase-keepalive")).status()).toBe(
    401,
  );
  expect(
    (
      await request.get("/api/cron/pending-inventory", {
        headers: { Authorization: "Bearer wrong" },
      })
    ).status(),
  ).toBe(401);
  const healthy = await request.get("/api/cron/supabase-keepalive", {
    headers: { Authorization: "Bearer test-cron-secret-only" },
  });
  expect(healthy.status()).toBe(200);
  expect((await healthy.json()).ok).toBe(true);
  const reads = await (await request.get("http://127.0.0.1:55440/__calls")).json();
  expect(reads).toEqual([{name:"parts",method:"GET"}]);
  const empty=await request.get("/api/cron/pending-inventory",{headers:{Authorization:"Bearer test-cron-secret-only"}});
  expect(empty.status()).toBe(200);
  expect((await empty.json()).pending).toBe(0);
});

test("unmapped legacy model keeps removal in queue for management resolution",async({page,request})=>{
  await request.get("http://127.0.0.1:55440/__unmapped");
  await login(page);
  await page.goto("/green-machines/machine-test");
  await expect(page.getByText(/cannot be matched safely/)).toBeVisible();
  await page.getByRole("button",{name:"Save / Inventory Later",exact:true}).first().click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Part number",{exact:true}).fill("UNMAPPED-FUSER");
  await dialog.getByRole("button",{name:"Save to Service Bin"}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("UNMAPPED-FUSER",{exact:false}).first()).toBeVisible();
  await page.context().clearCookies();
  await login(page,"manager");
  await page.goto("/pending-inventory");
  await expect(page.getByText(/Source model needs management review/)).toBeVisible();
  await page.getByLabel("Source model for Fuser").selectOption("30000000-0000-4000-8000-000000000001");
  await page.getByRole("button",{name:"Confirm source model"}).click();
  await page.getByRole("button",{name:"Complete inventory intake"}).click();
  await expect(dialog.getByLabel("Part number",{exact:true})).toHaveValue("UNMAPPED-FUSER");
  await dialog.getByRole("button",{name:"Add part",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await fits(page);
});

test("ordinary Add Part errors retain the form and successful save refreshes inventory",async({page,request})=>{
  await login(page,"manager");
  await page.goto("/inventory");
  await page.getByRole("link",{name:"Add part",exact:true}).click();
  await page.getByLabel("Part number",{exact:true}).fill("REJECTED-PART");
  await page.getByLabel("Part name",{exact:true}).fill("Audit new part");
  await page.getByRole("button",{name:"Save part",exact:true}).first().click();
  await expect(page.getByText(/Part changed since this form opened/)).toBeVisible();
  await expect(page).toHaveURL(/\/inventory\/new$/);
  await page.getByLabel("Part number",{exact:true}).fill("AUDIT-NEW-PART");
  await page.getByRole("button",{name:"Save part",exact:true}).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByText("AUDIT-NEW-PART",{exact:true}).filter({visible:true}).first()).toBeVisible();
  const calls=await (await request.get("http://127.0.0.1:55440/__calls")).json();
  expect(calls.filter((call:{name:string})=>call.name==="rpc/save_inventory_part")).toHaveLength(2);
  await page.goto("/inventory/20000000-0000-4000-8000-000000000001/edit");
  await page.getByLabel("Part name",{exact:true}).fill("Edited audit fuser");
  await page.getByRole("button",{name:"Save part",exact:true}).first().click();
  await expect(page).toHaveURL(/\/inventory\/20000000-0000-4000-8000-000000000001$/);
  await expect(page.getByText("Edited audit fuser",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"+1",exact:true}).click();
  await expect(page.getByText(/On Hand 4 · Reserved 0/)).toBeVisible();
  await fits(page);
});

test("existing CSV import preserves the identity of an existing part",async({page,request})=>{
  await login(page,"admin");
  const response=await page.request.post("/api/inventory/import",{data:{csvText:"part_number,part_name,manufacturer,category,quantity,universal\nTEST-FUSER,Fuser,Konica Minolta,Fusers,3,true",sourceName:"Audit fixture"}});
  expect(response.status()).toBe(200);
  const calls=await (await request.get("http://127.0.0.1:55440/__calls")).json();
  const write=calls.find((call:{name:string;method:string})=>call.name==="parts" && call.method==="POST");
  expect(write.body[0].id).toBe("20000000-0000-4000-8000-000000000001");
  expect(write.body[0].quantity_on_hand).toBe(3);
});

test("model and part details, inventory search and QR rendering remain usable",async({page})=>{
  await login(page,"manager");
  await page.goto("/models/30000000-0000-4000-8000-000000000001");
  await expect(page.getByText("TEST-FUSER",{exact:true}).filter({visible:true}).first()).toBeVisible();
  await page.goto("/inventory/20000000-0000-4000-8000-000000000001");
  await expect(page.getByText(/On Hand 3 · Reserved 0/)).toBeVisible();
  await page.goto("/print?partId=20000000-0000-4000-8000-000000000001");
  await expect(page.locator(".print-sheet svg")).toHaveCount(1);
  await expect(page.locator(".print-sheet").getByText("TEST-FUSER",{exact:true})).toBeVisible();
  await page.goto("/inventory");
  const search=page.getByPlaceholder("Part number, name, bin, model, or note");
  await search.fill("TEST-FUSER");
  await expect(page.getByText("TEST-FUSER",{exact:true}).filter({visible:true}).first()).toBeVisible();
  await search.fill("NO-MATCH-AUDIT");
  await expect(page.getByText("TEST-FUSER",{exact:true})).toHaveCount(0);
  await fits(page);
});
