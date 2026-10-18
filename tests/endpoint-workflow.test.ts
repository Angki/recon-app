import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {MigrationManager,MIGRATIONS} from '../electron/services/db/migrations';
import {endpointInventory,normalizeEndpoint,parseDiscovery} from '../electron/services/endpointInventory';
import {dbService} from '../electron/services/database';
import {settingsStore} from '../electron/services/settings';
import {ScannerService} from '../electron/services/scanner';
import {ScannerAdapters} from '../electron/services/scanners/registry';

const target = 'http://127.0.0.1:49152/product?id=1';
const plan = {scopeOrigin:'http://127.0.0.1:49152',parameters:['id'],timeoutMinutes:1,delaySeconds:1};
test('v5 migrates an existing database without deleting findings; reapplying is safe', () => {
  const db = new Database(':memory:');
  for (const migration of MIGRATIONS.filter(m=>m.version<5)) migration.up(db);
  db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,appliedAt TEXT)');
  for (const migration of MIGRATIONS.filter(m=>m.version<5)) db.prepare('INSERT INTO schema_migrations VALUES(?,?,?)').run(migration.version,migration.name,'before-upgrade');
  db.exec("INSERT INTO scans VALUES('old','http://localhost','COMPLETED','today',NULL,'{}'); INSERT INTO findings(scanId,scanner,name) VALUES('old','sqlmap','preserved');");
  assert.equal(MigrationManager.runMigrations(db).appliedCount,1);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM findings').get() as {n:number}).n,1);
  assert.equal(MigrationManager.runMigrations(db).appliedCount,0);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='endpoints'").get());
  db.close();
});
test('discovery adapters extract full URL lists, methods and Arjun hidden parameters', () => {
  const katana = parseDiscovery('katana',JSON.stringify({request:{endpoint:target,method:'POST'}}));
  assert.equal(katana.endpoints[0].method,'POST');
  const gau = parseDiscovery('gau',Array.from({length:30},(_,i)=>JSON.stringify({url:`http://127.0.0.1:49152/p?id=${i}`})).join('\n'));
  assert.equal(gau.endpoints.length,30,'do not truncate to the previous 20-line summary');
  const arjun = parseDiscovery('arjun',JSON.stringify({[target]:{method:'GET',params:['debug','id'],headers:{}}}));
  assert.deepEqual(arjun.endpoints[0].parameters,['debug','id']);
  const bannerWithJson = `    _
   /_| _ _ |_ _
  (  |/ (_||_(-
${JSON.stringify({[target]:{method:'GET',params:['debug','token']}})}`;
  const arjunWithBanner = parseDiscovery('arjun', bannerWithJson);
  assert.equal(arjunWithBanner.endpoints.length, 1);
  assert.deepEqual(arjunWithBanner.endpoints[0].parameters, ['debug', 'id', 'token']);
  const arjunBannerOnly = parseDiscovery('arjun', `    _\n   /_| _ _ |_ _\n  (  |/ (_||_(-`);
  assert.equal(arjunBannerOnly.endpoints.length, 0);
  assert.equal(arjunBannerOnly.rejected, 0);
  assert.equal(parseDiscovery('gau',`${target}\nmalformed\nfile:///etc/passwd`).rejected,2);
  assert.throws(()=>normalizeEndpoint('http://user:secret@localhost/','GET'));
  assert.notEqual(normalizeEndpoint('http://localhost/Admin','GET').url,normalizeEndpoint('http://localhost/admin','GET').url);
  assert.equal(normalizeEndpoint(`${target}#fragment`,'GET').url,target);
});
test('inventory deduplication retains sources and scope; launch rejects forged provenance', () => {
  assert.equal(os.homedir(),process.env.RECON_TEST_HOME,'Use npm test isolated runner');
  dbService.insertScan('inventory-fixture',target,'COMPLETED',new Date().toISOString(),{});
  const candidate=normalizeEndpoint(target,'GET');
  endpointInventory.insert('inventory-fixture',target,'katana',[candidate,candidate,normalizeEndpoint('http://example.test/','GET'),normalizeEndpoint(target,'POST')]);
  endpointInventory.insert('inventory-fixture',target,'gau',[candidate]);
  const result=endpointInventory.list('inventory-fixture');
  assert.equal(result.total,3);
  assert.deepEqual(result.items[0].sources,['gau','katana']);
  assert.throws(()=>endpointInventory.draft({kind:'endpoint',sourceScanId:'other',endpointId:result.items[0].id},'sqlmap'));
  for (const item of result.items.slice(1)) assert.throws(()=>endpointInventory.draft({kind:'endpoint',sourceScanId:'inventory-fixture',endpointId:item.id},'nikto'));
  const draft=endpointInventory.draft({kind:'endpoint',sourceScanId:'inventory-fixture',endpointId:result.items[0].id},'sqlmap');
  const config={tools:['sqlmap'],activeValidation:plan,workflow:draft.workflow};
  endpointInventory.validateLaunch(target,config);
  assert.throws(()=>endpointInventory.validateLaunch('http://example.test/product?id=1',config));
  assert.throws(()=>endpointInventory.validateLaunch(target+'&unknown=1',config));
  assert.throws(()=>endpointInventory.validateLaunch(target.replace('id=1','id='),config));
  assert.throws(()=>endpointInventory.list('inventory-fixture',{page:-1}));
  dbService.deleteScan('inventory-fixture');
  assert.equal(endpointInventory.list('inventory-fixture').total,0);
});

test('fake-process workflow persists discovery -> selected test -> linked retests without network', async () => {
  assert.equal(os.homedir(),process.env.RECON_TEST_HOME);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'endpoint workflow '));
  const discovery=path.join(dir,'discovery.cjs');
  const sqlmap=path.join(dir,'sqlmap.py');
  const mode=path.join(dir,'mode.txt');
  const positive='sqlmap identified the following injection point(s)\nParameter: id (GET)\n    Type: boolean-based blind\n    Title: AND boolean-based blind\n';
  fs.writeFileSync(discovery,`require('fs').writeFileSync(process.argv[process.argv.indexOf('-o')+1],${JSON.stringify(JSON.stringify({request:{endpoint:target,method:'GET'}}))});`);
  fs.writeFileSync(sqlmap,`const mode=require('fs').readFileSync(${JSON.stringify(mode)},'utf8'); console.log(mode==='positive'?${JSON.stringify(positive)}:mode==='negative'?'[CRITICAL] all tested parameters do not appear to be injectable':'unexpected output');`);
  fs.writeFileSync(mode,'positive');
  settingsStore.save({katanaPath:process.execPath,activePythonPath:process.execPath,sqlmapScriptPath:sqlmap});
  const adapter=ScannerAdapters.katana;
  const oldOptions=adapter.getProcessOptions;
  adapter.getProcessOptions=(ctx)=>({executable:process.execPath,args:[discovery,...adapter.getCommandArgs(ctx)],useShell:false,cwd:ctx.outDir});
  const service=new ScannerService();
  const events:Record<string,unknown>[]=[];
  const sender={isDestroyed:()=>false,send:(channel:string,data:Record<string,unknown>)=>{if(channel==='scan:status')events.push(data);}} as unknown as Electron.WebContents;
  const run=async(config:Record<string,unknown>,expected='COMPLETED')=>{
    const result=await service.startScan(sender,target,config);
    assert.equal(result.success,true,result.error);
    const end=Date.now()+10000;
    while(!events.some(e=>e.scanId===result.scanId && e.status===expected) && Date.now()<end) await new Promise(r=>setTimeout(r,25));
    assert.ok(events.some(e=>e.scanId===result.scanId && e.status===expected),`Missing ${expected} for ${result.scanId}`);
    assert.equal(dbService.getScanById(result.scanId!)?.status,expected);
    return result.scanId!;
  };
  try {
    const source=await run({tools:['katana']});
    assert.equal(dbService.getFindings(source).length,0,'discovery must not inflate vulnerability count');
    const endpoint=endpointInventory.list(source).items[0];
    assert.equal(endpoint.url,target);
    const draft=endpointInventory.draft({kind:'endpoint',sourceScanId:source,endpointId:endpoint.id},'sqlmap');
    const assessment=await run({tools:['sqlmap'],activeValidation:plan,workflow:draft.workflow});
    const {ReportService}=await import('../electron/services/reportService');
    const report=await new ReportService().compileReportData(assessment);
    assert.equal(report.workflow?.endpointId,endpoint.id);
    assert.equal(endpointInventory.runs(source)[0].scanId,assessment);
    const finding=dbService.getFindingsPaginated(assessment,{limit:1}).findings[0];
    const retest=endpointInventory.draft({kind:'retest',sourceScanId:assessment,findingId:finding._dbId});
    assert.throws(()=>endpointInventory.validateLaunch(target,{tools:['nikto'],activeValidation:plan,workflow:retest.workflow}));
    const repeated=await run({tools:['sqlmap'],activeValidation:plan,workflow:retest.workflow});
    assert.equal(endpointInventory.runs(assessment).find(r=>r.scanId===repeated)?.verdict,'observed');
    fs.writeFileSync(mode,'negative');
    const negative=await run({tools:['sqlmap'],activeValidation:plan,workflow:retest.workflow});
    assert.equal(endpointInventory.runs(assessment).find(r=>r.scanId===negative)?.verdict,'not-observed');
    fs.writeFileSync(mode,'invalid');
    const failed=await run({tools:['sqlmap'],activeValidation:plan,workflow:retest.workflow},'FAILED');
    assert.equal(endpointInventory.runs(assessment).find(r=>r.scanId===failed)?.verdict,'inconclusive');
    assert.equal(dbService.getTriageDecisions().length,0,'retest must not automatically mark fixed');
    // A changed upstream script makes the comparison inconclusive even when it exits cleanly.
    fs.appendFileSync(sqlmap,'\n// runtime update'); fs.writeFileSync(mode,'negative');
    const changed=await run({tools:['sqlmap'],activeValidation:plan,workflow:retest.workflow});
    assert.equal(endpointInventory.runs(assessment).find(r=>r.scanId===changed)?.verdict,'inconclusive');
  } finally {adapter.getProcessOptions=oldOptions;service.killAll();}
});
