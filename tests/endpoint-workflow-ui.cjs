// Renderer-only workflow smoke; start docs/reviews/2026-10-16/evidence/ui-server.mjs first.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const out=path.resolve('docs/enterprise/endpoint-workflow-evidence');
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const errors=[];
  try {
    for (const kind of ['endpoint','retest']) {
      const page=await browser.newPage({viewport:{width:1366,height:768}});
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        const noop=()=>()=>{};
        const target='http://127.0.0.1:8080/product?id=1';
        window.__calls=[];
        window.api={getHistory:async()=>[{scanId:'source',target,status:'COMPLETED',sqlmapStatus:'COMPLETED'}],getSettings:async()=>({}),checkDependencies:async()=>[],getToolsHealth:async()=>[],getFindingsPaginated:async()=>({findings:[{_dbId:42,id:'sqlmap-id',scanner:'sqlmap',severity:'high',name:'SQL injection: id',url:target,parameter:'id',timestamp:'2026-10-17'}],total:1,page:1,limit:50}),getEndpoints:async()=>({items:[{id:1,scanId:'source',url:target,method:'GET',parameters:['id'],sources:['katana','gau'],inScope:true},{id:2,scanId:'source',url:'http://other.example/',method:'GET',parameters:[],sources:['gau'],inScope:false}],total:2,page:1}),getWorkflowRuns:async()=>[{scanId:'prior-retest',target,status:'COMPLETED',startTime:'2026-10-17',kind:'retest',verdict:'not-observed'}],prepareTestingWorkflow:async(workflow,tool)=>({target,tool:tool||'sqlmap',parameters:['id'],scopeOrigin:'http://127.0.0.1:8080',workflow}),startScan:async(target,config)=>{window.__calls.push({target,config});return {success:true,scanId:'child'};},onScanStatus:noop,onScanFindings:noop,onScanOutput:noop,onScanStats:noop,onAiProgress:noop,onUpdateOutput:noop,onUpdateStatus:noop,onInstallProgress:noop,onToolUpdateProgress:noop,onToolUpdateStatus:noop};
      });
      await page.goto('http://127.0.0.1:5179');
      await page.locator('a[href="#/endpoints"], a[href="/endpoints"]').click();
      await page.getByText('katana, gau',{exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Test server',exact:true}).nth(1).isDisabled(),true);
      await page.screenshot({path:path.join(out,`inventory-${kind}.png`)});
      if(kind==='endpoint') await page.getByRole('button',{name:'Test SQLi',exact:true}).first().click();
      else {
        await page.getByText('Findings from selected scan — open to retest',{exact:true}).click();
        await page.getByRole('button',{name:'Retest',exact:true}).last().click();
      }
      await page.getByText(kind==='retest'?'Linked retest':'Selected endpoint test',{exact:true}).waitFor();
      assert.equal(await page.getByRole('checkbox',{name:'id',exact:true}).isChecked(),true);
      await page.screenshot({path:path.join(out,`draft-${kind}.png`)});
      await page.getByRole('button',{name:'START SCAN',exact:true}).click();
      await page.getByRole('button',{name:'STOP SCAN',exact:true}).waitFor();
      const calls=await page.evaluate(()=>window.__calls);
      assert.equal(calls[0].config.workflow.kind,kind);
      assert.equal(calls[0].config.workflow.sourceScanId,'source');
      assert.deepEqual(calls[0].config.tools,['sqlmap']);
      if(kind==='retest') assert.equal(calls[0].config.workflow.findingId,42);
      await page.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({errors,passed:['select endpoint','out of scope disabled','review draft','launch linked test','prepare retest from stored finding','launch linked retest'],mode:'Renderer mock IPC; no network scans'},null,2));
    console.log('Endpoint workflow UI passed');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
