// Opt-in installed-runtime smoke: only a static loopback HTTP fixture, no command evaluation.
const http = require('node:http');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const settings = JSON.parse(fs.readFileSync(path.join(os.homedir(),'Documents','SecOpsScans','settings.json'),'utf8'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'commix-runtime-'));
let requests = 0;
const server = http.createServer((_req,res)=>{
  requests++;
  res.setHeader('Content-Type','text/html');
  res.end('<html><title>Recon fixture</title><body>Static local fixture</body></html>');
});
server.listen(0,'127.0.0.1',()=>{
  const target = `http://127.0.0.1:${server.address().port}/?id=1`;
  const output = path.join(dir,'report.json');
  const child = spawn(settings.activePythonPath,[settings.commixScriptPath,'-u',target,'-p','id','--param-filter=GET','--batch','--level=1','--technique=r','--threads=1','--delay=1','--timeout=15','--retries=1','--ignore-redirects','--disable-coloring','--flush-session','--skip-waf','--time-limit=8',`--output-dir=${dir}`,`--report-json=${output}`],{shell:false,windowsHide:true});
  let log = '';
  child.stdout.on('data',d=>{log+=d;});
  child.stderr.on('data',d=>{log+=d;});
  const timer=setTimeout(()=>child.kill(),20000);
  child.on('error',error=>{console.error(error);process.exitCode=1;server.close();clearTimeout(timer);});
  child.on('close',code=>{
    clearTimeout(timer);server.close();
    fs.writeFileSync(path.join(dir,'console.txt'),log);
    try {
      const report=JSON.parse(fs.readFileSync(output,'utf8'));
      assert.equal(report.target,target);
      assert.ok(requests>0,'runtime must reach the local fixture');
      assert.ok(['completed','time-limit'].includes(report.status),JSON.stringify(report));
      assert.ok(!report.errors?.length,JSON.stringify(report.errors));
      assert.equal((report.findings||[]).length,0,'static fixture must not produce injection findings');
      console.log(JSON.stringify({code,status:report.status,requests,output}));
    } catch (error) { console.error(error);process.exitCode=1; }
  });
});
