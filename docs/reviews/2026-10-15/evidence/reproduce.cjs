// Audit probes. Run: node <this-file> <source-root>. All service I/O is mocked.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const root = path.resolve(process.argv[2] || process.cwd());
const silentLogger = {info(){},error(){},warn(){}};
function load(relative, mocks) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename,'utf8');
  const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,esModuleInterop:true}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(output,{module,exports:module.exports,require:name=>{
    if(name in mocks)return mocks[name];
    if(['path','os','date-fns','fast-xml-parser'].includes(name))return require(name);
    throw new Error(`Unmocked dependency: ${name}`);
  },console,Buffer,process:{cwd:()=>root,env:{},platform:'win32'}},{filename});
  return module.exports;
}
(async()=>{
  let fixture='';
  const registry=load('electron/services/scanners/registry.ts',{
    fs:{existsSync:()=>true,readFileSync:()=>fixture},electron:{app:{isPackaged:false}},'../logger':{logger:silentLogger}
  });
  const ctx={targetUrl:'https://example.test',domain:'example.test',jsonFile:'mock.json',outputFile:'mock.txt',settings:{},config:{}};
  const original={'template-id':'fixture-high',info:{name:'Fixture high finding',severity:'high'},'matched-at':'https://example.test/a'};
  fixture=JSON.stringify([original]);
  const compact=registry.ScannerAdapters.nuclei.parseFindings(ctx);
  fixture=JSON.stringify([original],null,2);
  const pretty=registry.ScannerAdapters.nuclei.parseFindings(ctx);
  fixture=JSON.stringify(original)+'\n';
  const jsonl=registry.ScannerAdapters.nuclei.parseFindings(ctx);
  const report=load('electron/services/reportService.ts',{
    fs:{existsSync:()=>false,promises:{}},'./database':{dbService:{getScanById:()=>null,getFindings:()=>[]}},'./logger':{logger:silentLogger},electron:{shell:{}}
  }).reportService;
  const unknown=await report.compileReportData('missing-scan');
  let written='';
  const settings=load('electron/services/settings.ts',{
    fs:{existsSync:()=>false,mkdirSync(){},writeFileSync:(_p,v)=>{written=v}},'./logger':{logger:silentLogger},electron:{safeStorage:{isEncryptionAvailable:()=>false}}
  }).settingsStore;
  settings.save({aiApiKey:'SYNTHETIC-NOT-A-REAL-SECRET'});
  const state={scanId:'mock-scan',target:'https://example.test',status:'RUNNING',config:{tools:['nuclei']}};
  const storage=load('electron/services/storage.ts',{
    fs:{existsSync:()=>false,mkdirSync(){},promises:{}},'./logger':{logger:silentLogger},electron:{shell:{}},
    './database':{dbService:{getHistory:()=>[],getScanById:()=>state,updateScannerStatus:(_id,scanner,status)=>state[`${scanner}Status`]=status,updateScanStatus:(_id,status)=>state.status=status}}
  }).storage;
  await storage.updateStatus('mock-scan',null,'STOPPED');
  const afterStop=state.status;
  await storage.updateStatus('mock-scan','nuclei','FAILED');
  const results={sourceRoot:root,mode:'Synthetic fixtures; mocked I/O; no scanner/network/user data access',adapterCount:Object.keys(registry.ScannerAdapters).length,nuclei:{compactJsonArray:compact,prettyJsonArray:pretty,jsonl},report:{unknownScanStatus:unknown.status,emptyFindingStats:report.calculateStats([])},secrets:{plaintextFallback:JSON.parse(written).aiApiKey==='SYNTHETIC-NOT-A-REAL-SECRET'},cancel:{afterStop,afterLateExit:state.status}};
  fs.writeFileSync(path.join(__dirname,'probe-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
