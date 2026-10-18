// Renderer smoke check. Run the review UI server at localhost:5179 first.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const tool = process.env.ACTIVE_UI_TOOL === 'commix' ? 'commix' : 'sqlmap';
  const out = path.resolve('docs/enterprise/active-testing-evidence');
  fs.mkdirSync(out,{recursive:true});
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:768}});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(() => {
      const noListener=()=>()=>{};
      window.__calls=[];
      window.api={checkDependencies:async()=>[],getHistory:async()=>[],getSettings:async()=>({}),saveSettings:async paths=>{window.__calls.push({settings:paths});return paths;},getToolsHealth:async()=>[],getFindingsPaginated:async()=>({findings:[],total:0}),startScan:async(target,config)=>{window.__calls.push({target,config});return {success:true,scanId:'mock-scan'};},onScanOutput:noListener,onScanStats:noListener,onScanStatus:noListener,onScanFindings:noListener,onAiProgress:noListener,onUpdateOutput:noListener,onUpdateStatus:noListener,onInstallProgress:noListener,onToolUpdateProgress:noListener,onToolUpdateStatus:noListener};
    });
    await page.goto('http://127.0.0.1:5179');
    await page.getByRole('button',{name:'Customize',exact:true}).click();
    await page.getByRole('button',{name:tool,exact:true}).click();
    const targetInput=page.locator('input').filter({visible:true}).first();
    await targetInput.fill('http://127.0.0.1:8080/item?id=1');
    await page.getByLabel('Assessment origin',{exact:true}).fill('http://127.0.0.1:8080');
    await page.getByRole('checkbox',{name:'id',exact:true}).check();
    await page.getByText('Runtime setup — configure and save before first scan',{exact:true}).click();
    await page.getByLabel('Python executable (absolute path)',{exact:true}).fill('C:\\Python\\python.exe');
    await page.getByLabel(`${tool}.py (official source checkout)`,{exact:true}).fill(`C:\\Tools\\${tool}\\${tool}.py`);
    await page.getByRole('button',{name:'Save runtime paths'}).click();
    await page.getByRole('status').filter({hasText:'Paths saved'}).waitFor();
    await page.getByText('Runtime setup — configure and save before first scan',{exact:true}).click();
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.screenshot({path:path.join(out,`${tool}-active-testing-1366.png`)});
    await page.getByRole('button',{name:'START SCAN',exact:true}).click();
    await page.getByRole('button',{name:'STOP SCAN',exact:true}).waitFor();
    const calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.at(-1).config.activeValidation.parameters[0],'id');
    assert.equal(calls.at(-1).config.activeValidation.scopeOrigin,'http://127.0.0.1:8080');
    assert.equal(calls[0].settings[`${tool}ScriptPath`],`C:\\Tools\\${tool}\\${tool}.py`);
    assert.ok(calls.at(-1).config.tools.includes(tool));
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,`${tool}-ui.json`),JSON.stringify({errors,calls,mode:'Renderer IPC mock; no scans'},null,2));
    console.log('Active Testing UI passed');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
