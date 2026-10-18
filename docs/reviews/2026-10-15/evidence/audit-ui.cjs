const { chromium } = require('playwright');
const fs = require('fs');
const out = 'D:/Projects/recon-app/docs/reviews/2026-10-15/evidence';
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
    const noListener=()=>()=>{};
    window.api={checkDependencies:async()=>[],getHistory:async()=>[],getSettings:async()=>({}),getToolsHealth:async()=>[],getFindingsPaginated:async()=>({findings:[],total:0,page:1,limit:50}),onScanOutput:noListener,onScanStats:noListener,onScanStatus:noListener,onScanFindings:noListener,onAiProgress:noListener,onUpdateOutput:noListener,onUpdateStatus:noListener,onInstallProgress:noListener,onToolUpdateProgress:noListener,onToolUpdateStatus:noListener};
  });
  await page.goto('http://127.0.0.1:5178');
  await page.getByText('START SCAN',{exact:true}).waitFor();
  const measures=[];
  for (const [width,height] of [[1400,900],[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.screenshot({path:`${out}/dashboard-dark-${width}.png`});
    measures.push(await page.evaluate(()=>({viewport:[innerWidth,innerHeight],xterms:document.querySelectorAll('.xterm').length,terminals:[...document.querySelectorAll('.xterm')].slice(0,2).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),main:{height:document.querySelector('main').clientHeight,scrollHeight:document.querySelector('main').scrollHeight}})));
  }
  await page.setViewportSize({width:1400,height:900});
  await page.getByTitle('Switch to Light Clean').click();
  await page.screenshot({path:`${out}/dashboard-light-1400.png`});
  for (const [name,id] of [['Obsidian Void','obsidian'],['Liquid Glass','glass']]) {
    await page.getByTitle(`Switch to ${name}`).click();
    await page.screenshot({path:`${out}/dashboard-${id}-1400.png`});
  }
  await page.getByTitle('Switch to Light Clean').click();
  await page.getByRole('link',{name:'Settings',exact:true}).click();
  await page.screenshot({path:`${out}/settings-light-1400.png`});
  fs.writeFileSync(`${out}/ui-results.json`,JSON.stringify({mode:'Renderer only, mocked read-only IPC; no scanner or provider requests',diagnosticPatch:'Temporary snapshot only: added missing useLogStore import in TerminalPane.tsx. Original snapshot crashed without this import. Screenshots are diagnostic layout previews, not proof the original UI passes.',measures,errors},null,2));
  console.log(JSON.stringify({measures,errors}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
