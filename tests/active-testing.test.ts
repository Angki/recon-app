import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { activeAdapters, activeRuntime, parseCommix, parseNikto, parseSqlmap, validateActiveConfig } from '../electron/services/scanners/activeValidation';
import type { ScannerContext } from '../electron/services/scanners/types';

const target = 'http://127.0.0.1:49151/item?id=1&view=short';
const plan = {scopeOrigin:'http://127.0.0.1:49151',parameters:['id'],timeoutMinutes:1,delaySeconds:1};
const positive = 'sqlmap identified the following injection point(s) with a total of 40 HTTP(s) requests:\n---\nParameter: id (GET)\n    Type: boolean-based blind\n    Title: AND boolean-based blind\n---';

test('Commix requires complete scoped JSON; unfinished and wrong-parameter reports fail', () => {
  const report = {target,http_method:'GET',status:'completed',requests:12,finished:'2026-10-18',findings:[{parameter:'id',http_method:'GET',technique:'results-based',type:'Command injection',payload:'fixture marker'}]};
  assert.equal(parseCommix(JSON.stringify(report),target,['id'])[0].cwe,'CWE-78');
  assert.deepEqual(parseCommix(JSON.stringify({...report,findings:undefined,errors:[{message:'All tested parameters do not appear to be injectable.'}]}),target,['id']),[]);
  assert.throws(()=>parseCommix(JSON.stringify({...report,findings:undefined}),target,['id']),'Windows upstream early-exit report must not become a clean result');
  for (const update of [{status:'time-limit'},{status:'failed'},{status:'running'},{target:'http://other.test'},{requests:0},{findings:{}},{findings:[{...report.findings[0],parameter:'other'}]}]) {
    assert.throws(()=>parseCommix(JSON.stringify({...report,...update}),target,['id']));
  }
  assert.throws(()=>validateActiveConfig(target,{...plan,parameters:[]},['commix']));
  const args = activeAdapters.commix.getCommandArgs({scannerName:'commix',targetUrl:target,outDir:'fixture',jsonFile:'result.json',config:{activeValidation:plan}} as ScannerContext);
  assert.ok(args.includes('--ignore-redirects'));
  assert.ok(args.includes('--technique=r'));
  assert.ok(!args.some(arg=>/--os-shell|--os-cmd|--file-write|--passwords|--tamper|--crawl/.test(arg)));
});
test('active plan rejects absent scope, wrong origin, missing parameters and invalid limits', () => {
  assert.throws(() => validateActiveConfig(target,undefined,['sqlmap']));
  for (const change of [{scopeOrigin:'http://example.test'}, {scopeOrigin:plan.scopeOrigin+'/other'}, {parameters:[]}, {parameters:['missing']}, {delaySeconds:0}, {timeoutMinutes:31}]) {
    assert.throws(() => validateActiveConfig(target,{...plan,...change},['sqlmap']));
  }
  assert.deepEqual(validateActiveConfig(target,plan,['sqlmap']),plan);
  assert.throws(() => validateActiveConfig(target.replace('id=1','id=*'),plan,['sqlmap']));
});
test('SQLmap differentiates confirmed, negative, truncated and error output', () => {
  assert.equal(parseSqlmap(positive,{targetUrl:target})[0].parameter,'id');
  assert.deepEqual(parseSqlmap('[CRITICAL] all tested parameters do not appear to be injectable',{targetUrl:target}),[]);
  assert.throws(() => parseSqlmap('[INFO] starting test',{targetUrl:target}));
  assert.throws(() => parseSqlmap(positive+'\n[ERROR] connection failed',{targetUrl:target}));
});
test('Nikto supports both report shapes and rejects malformed/out of scope/failed reports', () => {
  const host = {vulnerabilities:[{id:'123',msg:'Header missing',url:'/index',method:'GET'}]};
  for (const report of [host,[host]]) assert.equal(parseNikto(JSON.stringify(report),target)[0].severity,'info');
  assert.deepEqual(parseNikto('{"vulnerabilities":[]}',target),[]);
  for (const report of ['[]','{}','broken',JSON.stringify({vulnerabilities:[{id:'FAIL',msg:'Unable to connect'}]}), JSON.stringify({vulnerabilities:[{id:1,msg:'external',url:'http://example.test'}]})]) assert.throws(() => parseNikto(report,target));
});
test('runtime and argv preserve paths as arguments without shell', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'active runtime '));
  const script = path.join(dir,'sqlmap.py');
  fs.writeFileSync(script,'// fixture');
  const settings = {activePythonPath:process.execPath,sqlmapScriptPath:script};
  assert.match(activeRuntime('sqlmap',settings).scriptSha256,/^[a-f0-9]{64}$/);
  assert.throws(() => activeRuntime('sqlmap',{...settings,activePythonPath:'python'}));
  const ctx = {scannerName:'sqlmap',targetUrl:target,settings,outDir:dir,config:{activeValidation:plan}} as ScannerContext;
  const opts = activeAdapters.sqlmap.getProcessOptions!(ctx,{executable:'',args:[],useShell:true,cwd:dir});
  assert.equal(opts.useShell,false);
  assert.equal(opts.args[0],script);
  assert.ok(opts.args.includes('--ignore-redirects'));
  assert.equal(opts.args[opts.args.indexOf('-p')+1],'id');
  assert.ok(!opts.args.some(arg => /--dump|--os-shell|--crawl|--tamper/.test(arg)));
  ctx.config!.activeRuntimes = {sqlmap:activeRuntime('sqlmap',settings)};
  fs.writeFileSync(script,'// changed after preflight');
  assert.throws(() => activeAdapters.sqlmap.getProcessOptions!(ctx,{executable:'',args:[],useShell:false,cwd:dir}),/changed after preflight/);
});

test('Nikto Docker runtime is digest-pinned and sandboxed without a shell', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'nikto docker '));
  const docker = process.execPath;
  const image = 'ghcr.io/sullo/nikto@sha256:' + 'a'.repeat(64);
  const settings = {niktoRuntime:'docker',activeDockerPath:docker,niktoDockerImage:image};
  const ctx = {scannerName:'nikto',targetUrl:target,settings,outDir:dir,jsonFile:path.join(dir,'nikto.json'),outputFile:path.join(dir,'nikto.txt'),config:{activeValidation:plan}} as ScannerContext;
  const runtime = activeRuntime('nikto',settings);
  ctx.config!.activeRuntimes={nikto:runtime};
  const opts = activeAdapters.nikto.getProcessOptions!(ctx,{executable:docker,args:activeAdapters.nikto.getCommandArgs(ctx),useShell:true,cwd:dir});
  assert.equal(runtime.kind,'docker');
  assert.equal(opts.useShell,false);
  for (const required of ['--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=512m','--cpus=1']) assert.ok(opts.args.includes(required));
  assert.ok(opts.args.includes(`${dir}:/output`));
  assert.ok(opts.args.includes('/output/nikto.json'));
  assert.ok(!opts.args.includes(ctx.jsonFile));
  assert.throws(()=>activeRuntime('nikto',{...settings,niktoDockerImage:'ghcr.io/sullo/nikto:latest'}),/pinned/);
});

test('runner persists success/failure and rejects missing active plan before launch', async () => {
  assert.equal(os.homedir(),process.env.RECON_TEST_HOME,'Use scripts/test-isolated.cjs');
  const { settingsStore } = await import('../electron/services/settings');
  const { ScannerService } = await import('../electron/services/scanner');
  const { dbService } = await import('../electron/services/database');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'fake sqlmap '));
  const script = path.join(dir,'sqlmap.py');
  settingsStore.save({activePythonPath:process.execPath,sqlmapScriptPath:script});
  const service = new ScannerService();
  const events: {channel:string;data:Record<string,unknown>}[] = [];
  const sender = {isDestroyed:() => false,send:(channel:string,data:Record<string,unknown>) => events.push({channel,data})} as unknown as Electron.WebContents;
  try {
    fs.writeFileSync(script,`console.log(${JSON.stringify(positive)});`);
    const invalid = await service.startScan(sender,target,{tools:['sqlmap']});
    assert.equal(invalid.success,false);
    for (const [output,expected] of [[positive,'COMPLETED'],['incomplete output','FAILED']] as const) {
      fs.writeFileSync(script,`console.log(${JSON.stringify(output)});`);
      const result = await service.startScan(sender,target,{tools:['sqlmap'],activeValidation:plan});
      assert.equal(result.success,true,result.error);
      const end = Date.now()+10000;
      while (!events.some(e => e.channel==='scan:status' && e.data.scanId===result.scanId && e.data.status===expected) && Date.now()<end) await new Promise(r => setTimeout(r,25));
      assert.ok(events.some(e => e.channel==='scan:status' && e.data.scanId===result.scanId && e.data.status===expected));
      if (expected==='COMPLETED') {
        assert.ok(events.some(e => e.channel==='scan:findings' && e.data.scanId===result.scanId));
        const {ReportService} = await import('../electron/services/reportService');
        const report = await new ReportService().compileReportData(result.scanId!);
        assert.equal(report.findings[0].scanner,'sqlmap');
        assert.match(report.findings[0].description!,/GET parameter id/);
        assert.equal(report.status,'COMPLETED');
        assert.match(JSON.stringify(dbService.getScanById(result.scanId!)?.config),/scriptSha256/);
      }
    }
    assert.ok(dbService.getHistory().length >= 2);
    const niktoScript = path.join(dir,'nikto.pl');
    settingsStore.save({activePerlPath:process.execPath,niktoScriptPath:niktoScript});
    for (const bad of [false,true]) {
      fs.writeFileSync(niktoScript, `const fs=require('fs'); const out=process.argv[process.argv.indexOf('-output')+1]; console.log('Nikto fixture'); fs.writeFileSync(out, ${JSON.stringify(bad ? 'invalid json' : JSON.stringify([{vulnerabilities:[{id:'123',msg:'Fixture finding',url:'/index',method:'GET'}]}]))});`);
      const result = await service.startScan(sender,target,{tools:['nikto'],activeValidation:plan});
      assert.equal(result.success,true,result.error);
      const expected = bad ? 'FAILED' : 'COMPLETED';
      const end = Date.now()+10000;
      while (!events.some(e => e.channel==='scan:status' && e.data.scanId===result.scanId && e.data.status===expected) && Date.now()<end) await new Promise(r => setTimeout(r,25));
      assert.equal(dbService.getScanById(result.scanId!)?.status,expected);
    }
    const commixScript = path.join(dir,'commix.py');
    settingsStore.save({commixScriptPath:commixScript});
    for (const status of ['completed','time-limit']) {
      const report = {target,http_method:'GET',status,requests:12,finished:'2026-10-18',findings:[{parameter:'id',http_method:'GET',technique:'results-based',type:'Command injection',payload:'fixture marker'}]};
      fs.writeFileSync(commixScript,`const fs=require('fs'); const out=process.argv.find(a=>a.startsWith('--report-json=')).slice('--report-json='.length); console.log('Commix fixture'); fs.writeFileSync(out,${JSON.stringify(JSON.stringify(report))});`);
      const result = await service.startScan(sender,target,{tools:['commix'],activeValidation:plan});
      assert.equal(result.success,true,result.error);
      const expected = status === 'completed' ? 'COMPLETED' : 'FAILED';
      const end = Date.now()+10000;
      while (!events.some(e=>e.channel==='scan:status' && e.data.scanId===result.scanId && e.data.status===expected) && Date.now()<end) await new Promise(r=>setTimeout(r,25));
      assert.equal(dbService.getScanById(result.scanId!)?.status,expected);
      if (expected==='COMPLETED') assert.equal(dbService.getFindings(result.scanId!)[0].scanner,'commix');
    }
    // Cancel a running process and ensure a queued tool never launches.
    fs.writeFileSync(script, "console.log('waiting'); setInterval(()=>{},1000);");
    fs.writeFileSync(niktoScript, "console.log('waiting'); setInterval(()=>{},1000);");
    const cancelled = await service.startScan(sender,target,{tools:['nikto','sqlmap'],activeValidation:plan});
    assert.equal(cancelled.success,true);
    await service.stopScan(cancelled.scanId!);
    await new Promise(r => setTimeout(r,250));
    assert.equal(dbService.getScanById(cancelled.scanId!)?.status,'STOPPED');
    assert.ok(!events.some(e => e.channel==='scan:status' && e.data.scanId===cancelled.scanId && e.data.scanner==='sqlmap' && e.data.status==='RUNNING'));
  } finally { service.killAll(); }
});
