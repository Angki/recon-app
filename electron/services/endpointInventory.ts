import fs from 'node:fs';
import path from 'node:path';
import { dbService } from './database';
import { storage } from './storage';
import type { ScannerContext } from './scanners/types';
import type { EndpointRecord, TestingDraft, WorkflowRef, WorkflowRun } from '../../src/types/workflow';

export const DISCOVERY_TOOLS = ['katana', 'gau', 'arjun'];
type Candidate = { url: string; method: string; parameters: string[] };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unsupported discovery record');
  return value as Record<string, unknown>;
};

export function normalizeEndpoint(raw: string, method: string, parameters: unknown = []): Candidate {
  if (raw.length > 8192) throw new Error('Endpoint URL exceeds 8192 characters');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Endpoint must use HTTP(S) without embedded credentials');
  url.hash = '';
  const verb = method.toUpperCase();
  if (!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','JSON'].includes(verb)) throw new Error('Unsupported endpoint method');
  if (!Array.isArray(parameters) || parameters.some(p => typeof p !== 'string' || p.length > 200)) throw new Error('Malformed discovery parameter list');
  return { url:url.href, method:verb, parameters:[...new Set([...url.searchParams.keys(), ...parameters as string[]])].sort() };
}

export function parseDiscovery(tool: string, text: string): { endpoints: Candidate[]; rejected: number } {
  const endpoints: Candidate[] = [];
  let rejected = 0;
  const add = (url: unknown, method: unknown = 'GET', parameters: unknown = []) => {
    try {
      if (typeof url !== 'string' || typeof method !== 'string') throw new Error('Missing URL or method');
      endpoints.push(normalizeEndpoint(url, method, parameters));
    } catch { rejected++; }
  };
  if (tool === 'arjun') {
    let rawObj: unknown = null;
    try {
      rawObj = JSON.parse(text);
    } catch {
      // Isolate outermost JSON object if stdout decorations or ASCII banner precede it
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          rawObj = JSON.parse(text.slice(start, end + 1));
        } catch {
          rejected++;
        }
      }
    }
    if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
      for (const [url, value] of Object.entries(record(rawObj))) {
        try {
          const data = Array.isArray(value) ? {params:value,method:'GET'} : record(value);
          if (!Array.isArray(data.params)) throw new Error('Missing Arjun parameter list');
          add(url,data.method ?? 'GET',data.params);
        } catch { rejected++; }
      }
    }
  } else if (tool === 'katana' || tool === 'gau') {
    for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
      try {
        if (tool === 'gau' && /^https?:\/\//i.test(line.trim())) { add(line.trim()); continue; }
        const data = record(JSON.parse(line));
        if (tool === 'katana') {
          const request = data.request ? record(data.request) : data;
          add(request.endpoint ?? data.url,request.method ?? 'GET');
        } else add(data.url);
      } catch { rejected++; }
    }
  } else throw new Error('Unsupported discovery tool');
  return {endpoints,rejected};
}

export class EndpointInventory {
  capture(ctx: ScannerContext) {
    // Explicit result artifacts only: terminal diagnostics must not become endpoint data.
    if (!fs.existsSync(ctx.jsonFile)) {
      // Arjun stdout is terminal banner and diagnostic text, not JSON endpoint data
      if (ctx.scannerName !== 'arjun' && fs.existsSync(ctx.outputFile)) {
        const text = fs.readFileSync(ctx.outputFile, 'utf8');
        const result = parseDiscovery(ctx.scannerName, text);
        this.insert(ctx.scanId, ctx.targetUrl, ctx.scannerName, result.endpoints);
        return result.endpoints.length;
      }
      return 0;
    }
    const stats = fs.statSync(ctx.jsonFile);
    let text: string;
    if (stats.size > 20 * 1024 * 1024) {
      const fd = fs.openSync(ctx.jsonFile, 'r');
      const buffer = Buffer.alloc(20 * 1024 * 1024);
      const bytesRead = fs.readSync(fd, buffer, 0, 20 * 1024 * 1024, 0);
      fs.closeSync(fd);
      text = buffer.toString('utf8', 0, bytesRead);
      const lastNl = text.lastIndexOf('\n');
      if (lastNl > 0) text = text.slice(0, lastNl);
    } else {
      text = fs.readFileSync(ctx.jsonFile, 'utf8');
    }
    const result = parseDiscovery(ctx.scannerName, text);
    this.insert(ctx.scanId, ctx.targetUrl, ctx.scannerName, result.endpoints);
    return result.endpoints.length;
  }

  insert(scanId: string, target: string, source: string, candidates: Candidate[]) {
    const db = dbService.getRawDatabase();
    if (!dbService.getScanById(scanId)) throw new Error('Scan not found');
    const origin = new URL(target).origin;
    const get = db.prepare('SELECT parameters, sources FROM endpoints WHERE scanId=? AND method=? AND url=?');
    const upsert = db.prepare(`INSERT INTO endpoints(scanId,url,method,parameters,sources,inScope) VALUES(?,?,?,?,?,?)
      ON CONFLICT(scanId,method,url) DO UPDATE SET parameters=excluded.parameters,sources=excluded.sources`);
    db.transaction(() => {
      for (const input of candidates) {
        const item = normalizeEndpoint(input.url,input.method,input.parameters);
        const previous = get.get(scanId,item.method,item.url) as {parameters:string;sources:string} | undefined;
        const parameters = [...new Set([...item.parameters,...(previous ? JSON.parse(previous.parameters) as string[] : [])])].sort();
        const sources = [...new Set([source,...(previous ? JSON.parse(previous.sources) as string[] : [])])].sort();
        upsert.run(scanId,item.url,item.method,JSON.stringify(parameters),JSON.stringify(sources),Number(new URL(item.url).origin === origin));
      }
    })();
    this.syncEndpointsFile(scanId, target);
  }

  syncEndpointsFile(scanId: string, target?: string) {
    try {
      const db = dbService.getRawDatabase();
      const rows = db.prepare('SELECT DISTINCT url FROM endpoints WHERE scanId = ? AND inScope = 1 LIMIT 500').all(scanId) as { url: string }[];
      const urls = new Set<string>();
      if (target) {
        try { urls.add(new URL(target).href); } catch { /* ignore */ }
      }
      for (const r of rows) {
        if (r.url) urls.add(r.url);
      }
      if (urls.size > 0) {
        const scanDir = storage.getScanDir(scanId);
        if (fs.existsSync(scanDir)) {
          const endpointsFile = path.join(scanDir, 'discovered_endpoints.txt');
          fs.writeFileSync(endpointsFile, Array.from(urls).join('\n'), 'utf8');
        }
      }
    } catch {
      // Non-critical background sync
    }
  }

  private decode(row: Record<string, unknown>): EndpointRecord {
    return {...row, parameters:JSON.parse(String(row.parameters)), sources:JSON.parse(String(row.sources)), inScope:Boolean(row.inScope)} as unknown as EndpointRecord;
  }
  list(scanId: string, input: {page?:number;search?:string} = {}) {
    if (!input || typeof input !== 'object') throw new Error('Invalid inventory filter');
    if (typeof scanId !== 'string' || scanId.length > 200) throw new Error('Invalid scan ID');
    const page = input.page ?? 1;
    if (!Number.isInteger(page) || page < 1 || page > 100000 || (input.search !== undefined && typeof input.search !== 'string')) throw new Error('Invalid inventory filter');
    const search = (input.search || '').slice(0,200);
    const db = dbService.getRawDatabase();
    const args = [scanId,`%${search}%`];
    const rows = db.prepare('SELECT * FROM endpoints WHERE scanId=? AND url LIKE ? ORDER BY id LIMIT 50 OFFSET ?').all(...args,(page-1)*50) as Record<string,unknown>[];
    const count = db.prepare('SELECT COUNT(*) AS total FROM endpoints WHERE scanId=? AND url LIKE ?').get(...args) as {total:number};
    return {items:rows.map(row => this.decode(row)),total:count.total,page};
  }
  get(scanId: string, id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid endpoint ID');
    const row = dbService.getRawDatabase().prepare('SELECT * FROM endpoints WHERE scanId=? AND id=?').get(scanId,id) as Record<string,unknown> | undefined;
    if (!row) throw new Error('Endpoint not found in source scan');
    return this.decode(row);
  }
  finding(scanId: string, id: number): Record<string,unknown> & {scanner:string} {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid finding ID');
    const row = dbService.getRawDatabase().prepare('SELECT scanner,rawJson FROM findings WHERE scanId=? AND id=?').get(scanId,id) as {scanner:string;rawJson:string} | undefined;
    if (!row) throw new Error('Finding not found in source scan');
    return {...record(JSON.parse(row.rawJson)),scanner:row.scanner};
  }
  draft(ref: WorkflowRef, tool?: string): TestingDraft {
    if (!ref || typeof ref.sourceScanId !== 'string' || ref.sourceScanId.length > 200) throw new Error('Invalid workflow source');
    const source = dbService.getScanById(ref.sourceScanId);
    if (!source) throw new Error('Source scan not found');
    let target: string;
    let parameters: string[];
    if (ref.kind === 'endpoint') {
      const endpoint = this.get(ref.sourceScanId,ref.endpointId!);
      if (!endpoint.inScope) throw new Error('Endpoint is outside the source scan origin');
      if (endpoint.method !== 'GET') throw new Error('This testing profile supports GET endpoints only');
      target = endpoint.url;
      parameters = endpoint.parameters;
    } else if (ref.kind === 'retest') {
      const finding = this.finding(ref.sourceScanId,ref.findingId!);
      tool = String(finding.scanner);
      target = String(finding.url);
      parameters = tool === 'sqlmap' || tool === 'commix' ? [String(finding.parameter || finding.param || '')] : [];
      if ((source as Record<string,unknown>)[`${tool}Status`] !== 'COMPLETED') throw new Error('Retest requires a finding from a completed tool assessment');
    } else throw new Error('Unknown workflow type');
    if (tool !== 'sqlmap' && tool !== 'nikto' && tool !== 'commix') throw new Error('Retest/testing currently supports SQLmap, Commix and Nikto');
    const normalized = normalizeEndpoint(target,'GET');
    if (new URL(normalized.url).origin !== new URL(String(source.target)).origin) throw new Error('Target is outside source scan scope');
    if (tool !== 'nikto' && !parameters.length) throw new Error('Parameter testing needs a discovered query parameter');
    return {target:normalized.url,tool,parameters:tool !== 'nikto' ? parameters : [],scopeOrigin:new URL(target).origin,workflow:ref};
  }

  validateLaunch(target: string, config: Record<string,unknown>) {
    if (config.workflow === undefined) return;
    const ref = record(config.workflow) as unknown as WorkflowRef;
    const tools = config.tools;
    if (!Array.isArray(tools) || tools.length !== 1) throw new Error('Selected-endpoint tests and retests must run one engine');
    const draft = this.draft(ref,String(tools[0]));
    if (tools[0] !== draft.tool) throw new Error('Retest engine differs from original finding');
    const proposed = new URL(target);
    const original = new URL(draft.target);
    if (proposed.origin !== original.origin || proposed.pathname !== original.pathname || proposed.hash || proposed.username || proposed.password) throw new Error('Testing target differs from selected endpoint');
    if (ref.kind === 'retest' && proposed.href !== original.href) throw new Error('Retest must preserve the original finding URL');
    if ([...proposed.searchParams.keys()].some(p => !draft.parameters.includes(p) && !original.searchParams.has(p))) throw new Error('Undiscovered parameter added to endpoint test');
    const plan = record(config.activeValidation);
    if (!Array.isArray(plan.parameters) || plan.parameters.some(p => typeof p !== 'string' || !draft.parameters.includes(p))) throw new Error('Selected parameter differs from the source');
    if (draft.tool !== 'nikto' && (plan.parameters as string[]).some(p => !proposed.searchParams.get(p))) throw new Error('Enter a sample value in the target URL for every selected query parameter');
    if (ref.kind === 'retest' && draft.tool !== 'nikto' && JSON.stringify(plan.parameters) !== JSON.stringify(draft.parameters)) throw new Error('Retest must preserve the original parameter');
    config.workflow = {kind:ref.kind,sourceScanId:ref.sourceScanId,...(ref.kind === 'endpoint' ? {endpointId:ref.endpointId} : {findingId:ref.findingId})};
  }

  runs(sourceScanId: string): WorkflowRun[] {
    if (typeof sourceScanId !== 'string' || sourceScanId.length > 200) throw new Error('Invalid source scan');
    const rows = dbService.getRawDatabase().prepare("SELECT scanId,target,status,startTime,config FROM scans WHERE json_extract(CASE WHEN json_valid(config) THEN config ELSE '{}' END,'$.workflow.sourceScanId')=? ORDER BY startTime DESC LIMIT 100").all(sourceScanId) as {scanId:string;target:string;status:string;startTime:string;config:string}[];
    return rows.map(row => {
      const config = JSON.parse(row.config);
      const ref = config.workflow as WorkflowRef;
      let verdict: WorkflowRun['verdict'] = row.status === 'COMPLETED' ? 'completed' : ['RUNNING','QUEUED','VALIDATING','PARSING'].includes(row.status) ? 'running' : 'inconclusive';
      if (ref.kind === 'retest' && row.status === 'COMPLETED') {
        try {
          const original = this.finding(ref.sourceScanId,ref.findingId!);
          const parentConfig = dbService.getScanById(ref.sourceScanId)?.config;
          const oldRuntime = parentConfig?.activeRuntimes?.[original.scanner];
          const newRuntime = config.activeRuntimes?.[original.scanner];
          if (!oldRuntime || !newRuntime || oldRuntime.scriptSha256 !== newRuntime.scriptSha256 || oldRuntime.executable !== newRuntime.executable) throw new Error('Runtime comparison unavailable or changed');
          const findings = dbService.getFindings(row.scanId) as Record<string,unknown>[];
          const same = findings.some(f => f.scanner === original.scanner && (['sqlmap','commix'].includes(original.scanner) ? (f.parameter || f.param) === (original.parameter || original.param) && f.url === original.url : f.id === original.id && f.url === original.url));
          verdict = same ? 'observed' : 'not-observed';
        } catch { verdict = 'inconclusive'; }
      }
      return {scanId:row.scanId,target:row.target,status:row.status,startTime:row.startTime,kind:ref.kind,verdict};
    });
  }
}
export const endpointInventory = new EndpointInventory();
