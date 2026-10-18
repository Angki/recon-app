import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ReportService} from '../../../../electron/services/reportService';
import {dbService} from '../../../../electron/services/database';
import {storage} from '../../../../electron/services/storage';
import {computeFindingFingerprint} from '../../../../electron/services/db/fingerprint';
import {ScanStateMachine} from '../../../../electron/services/runner/stateMachine';
import {ScannerAdapters} from '../../../../electron/services/scanners/registry';
import {BackupManager} from '../../../../electron/services/db/backup';
import {aiService} from '../../../../electron/services/aiService';
import {settingsStore} from '../../../../electron/services/settings';
async function main(){
const report=new ReportService();
console.log('GRADES',JSON.stringify(Object.fromEntries(['COMPLETED','PARTIAL','RUNNING','INTERRUPTED','FAILED'].map(s=>[s,report.calculateStats([],s).grade]))));
const base='review_base';dbService.insertScan(base,'https://example.invalid','COMPLETED',new Date().toISOString(),{tools:['nuclei']});
dbService.insertFindings(base,'nuclei',[{id:'rule',url:'https://example.invalid/a',name:'example',severity:'high'}]);
for(const status of ['PARTIAL','RUNNING','COMPLETED']){const id='review_'+status;dbService.insertScan(id,'https://other.invalid',status,new Date().toISOString(),{tools:['httpx']});console.log('BASELINE',status,JSON.stringify(dbService.compareWithBaseline(id,base).summary));}
console.log('AGGREGATE', ScanStateMachine.computeAggregateState('RUNNING',{nuclei:'STOPPED'},['nuclei']));
const s=storage.createScanDirectory('review.invalid');await storage.saveMetadata(s.scanId,{target:'https://example.invalid',status:'RUNNING',config:{tools:['nuclei']}});await storage.updateStatus(s.scanId,null,'STOPPED');console.log('STOP_CONSISTENCY',dbService.getScanById(s.scanId)?.status,JSON.parse(fs.readFileSync(path.join(s.scanDir,'scan_metadata.json'),'utf8')).status);
console.log('FINGERPRINT_CASE_COLLISION',computeFindingFingerprint({scanner:'nuclei',type:'r',url:'https://example.invalid/Admin'})===computeFindingFingerprint({scanner:'nuclei',type:'r',url:'https://example.invalid/admin'}));
console.log('FINGERPRINT_LINE_COLLISION',computeFindingFingerprint({scanner:'semgrep',type:'r',url:'file://src/a.ts#L1'})===computeFindingFingerprint({scanner:'semgrep',type:'r',url:'file://src/a.ts#L99'}));
const ctx:any={targetUrl:'https://example.invalid',domain:'example.invalid',outDir:s.scanDir,jsonFile:path.join(s.scanDir,'out.json')};
console.log('SEMGREP_URL_ARGS',ScannerAdapters.semgrep.getCommandArgs(ctx));console.log('SEMGREP_ERROR2_SUCCESS',ScannerAdapters.semgrep.isSuccessExitCode!(2,ctx));
fs.writeFileSync(ctx.jsonFile,JSON.stringify({server_scan_results:[{server_location:{hostname:'example.invalid'},scan_result:{heartbleed:{status:'COMPLETED',result:{is_vulnerable_to_heartbleed:true}}}}]}));console.log('SSLYZE_UPSTREAM_SHAPE_COUNT',ScannerAdapters.sslyze.parseFindings!(ctx).length);
const backup=new BackupManager(path.join(os.homedir(),'probe-backup'));for(const [name,time] of [['old.sqlite',5000],['new.sqlite',1000]] as const){const f=path.join(backup.getBackupDir(),name);fs.writeFileSync(f,Buffer.alloc(100));fs.utimesSync(f,new Date(Date.now()-time),new Date(Date.now()-time));}backup.enforceRetention(30,100);console.log('BACKUP_SURVIVOR',backup.listBackups().map(x=>x.filename));
settingsStore.save({aiProvider:'ollama',aiPolicy:'local-only',aiBaseUrl:'http://127.0.0.1:11434',aiModel:'example:cloud'});
const original=globalThis.fetch;let called=false;globalThis.fetch=(async(_url:any,options:any)=>{called=true;console.log('MOCK_AI_PAYLOAD',JSON.parse(options.body).model);return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"res'));c.enqueue(new TextEncoder().encode('ponse":"hello"}\n'));c.close();}}),{status:200});}) as any;
try{console.log('AI_RESULT',await aiService.analyzeLogs({send(){}} as any,'synthetic data','summarize'));console.log('LOCAL_POLICY_ALLOWED_CLOUD_MODEL',called);}finally{globalThis.fetch=original;}
}
main().catch(e=>{console.error(e);process.exitCode=1});
