import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import ts from "typescript";

async function loadSource(file) {
  const source = await readFile(file,"utf8");
  const { outputText } = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { isAuthorizedCron } = await loadSource("src/lib/cron-auth.ts");
const { isCronPath } = await loadSource("src/lib/cron-paths.ts");
const request = (header) => new Request("https://example.test",{headers:header ? {authorization:header} : {}});
for (const header of [undefined,"Bearer wrong","Bearer","bearer test-only","Bearer  test-only"]) assert.equal(isAuthorizedCron(request(header),"test-only"),false);
assert.equal(isAuthorizedCron(request("Bearer test-only"),"test-only"),true);
// The standard Headers constructor strips outer HTTP whitespace before auth runs.
assert.equal(isAuthorizedCron(request("Bearer test-only "),"test-only"),true);
assert.equal(isAuthorizedCron(request("Bearer test-only"),""),false);
const previous=process.env.CRON_SECRET;
delete process.env.CRON_SECRET;
assert.equal(isAuthorizedCron(request("Bearer undefined")),false);
if(previous!==undefined) process.env.CRON_SECRET=previous;
for(const path of ["/api/cron/supabase-keepalive","/api/cron/pending-inventory"]) assert.equal(isCronPath(path),true);
for(const path of ["/api/cron/","/api/cron/other","/api/cron/pending-inventory/other","/api/cron/pending-inventory/","/api/cron/supabase-keepalive-admin"]) assert.equal(isCronPath(path),false);
const config=JSON.parse(await readFile("vercel.json","utf8"));
assert.deepEqual(config.crons,[{path:"/api/cron/supabase-keepalive",schedule:"0 6 * * *"},{path:"/api/cron/pending-inventory",schedule:"15 6 * * *"}]);
console.log("PASS actual cron authorization helper: missing configuration, invalid headers and correct secret");
console.log("PASS exact middleware route allowlist and Vercel daily UTC configuration");

// Inspect production client bundles without printing credentials or contacting a server.
const env=parseEnv(await readFile(".env.local","utf8").catch(()=>""));
const secrets=[env.SUPABASE_SERVICE_ROLE_KEY,env.CRON_SECRET,process.env.CRON_SECRET].filter(value=>value && value.length>=8);
let bundles=0;
async function scan(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const file=`${dir}/${entry.name}`;
    if(entry.isDirectory()) await scan(file);
    else if(entry.name.endsWith(".js")) {
      bundles++;
      const content=await readFile(file,"utf8");
      for(const secret of secrets) assert.ok(!content.includes(secret),`Server credential found in ${file}`);
      assert.ok(!content.includes("SUPABASE_SERVICE_ROLE_KEY") && !content.includes("CRON_SECRET"),`Server credential reference in ${file}`);
    }
  }
}
await scan(".next/static");
assert.ok(bundles>0,"Run production build before this check");
console.log(`PASS ${bundles} production client bundles contain no server credential names or configured secret values`);
