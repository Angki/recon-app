import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IScannerAdapter, ScannerContext } from './types';

export const ACTIVE_VALIDATION_TOOLS = ['sqlmap', 'nikto', 'commix'] as const;
export type ActiveTool = typeof ACTIVE_VALIDATION_TOOLS[number];
export function isActiveValidationTool(tool: string): tool is ActiveTool {
  return (ACTIVE_VALIDATION_TOOLS as readonly string[]).includes(tool);
}
export interface ActiveValidationConfig {
  scopeOrigin: string;
  parameters: string[];
  timeoutMinutes: number;
  delaySeconds: number;
}
export function validateActiveConfig(target: string, input: unknown, tools: string[]): ActiveValidationConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configure the Active Testing plan before starting.');
  const raw = input as Record<string, unknown>;
  const url = new URL(target);
  const scope = new URL(String(raw.scopeOrigin || ''));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Use an HTTP(S) URL without credentials or a fragment.');
  if (scope.origin !== url.origin || scope.pathname !== '/' || scope.search || scope.hash || scope.username || scope.password) throw new Error('Scope must be the exact target origin (scheme, host and port), without path or credentials.');
  const parameters = raw.parameters;
  if (!Array.isArray(parameters) || parameters.length > 25 || parameters.some(p => typeof p !== 'string' || !/^[a-zA-Z0-9_.[\]-]{1,80}$/.test(p))) throw new Error('Invalid parameter selection.');
  const selected = [...new Set(parameters)] as string[];
  const parameterTesting = tools.some(tool => tool === 'sqlmap' || tool === 'commix');
  if (parameterTesting && (!selected.length || selected.some(p => !url.searchParams.has(p)))) throw new Error('Parameter testing requires at least one existing query parameter selected in the plan.');
  if (parameterTesting && (url.pathname.includes('*') || [...url.searchParams].some(([key,value]) => key.includes('*') || value.includes('*')))) throw new Error('Custom injection markers are not supported in this profile.');
  const minutes = raw.timeoutMinutes;
  const delay = raw.delaySeconds;
  if (!Number.isInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 30) throw new Error('Active testing deadline must be 1–30 minutes.');
  if (!Number.isInteger(delay) || Number(delay) < 1 || Number(delay) > 10) throw new Error('Request delay must be 1–10 seconds.');
  return {scopeOrigin: scope.origin, parameters: selected, timeoutMinutes: Number(minutes), delaySeconds: Number(delay)};
}

export function activeRuntime(tool: ActiveTool, settings: Record<string, unknown>) {
  if (tool === 'nikto' && settings.niktoRuntime === 'docker') {
    const executable = String(settings.activeDockerPath || '');
    const image = String(settings.niktoDockerImage || '');
    if (!path.isAbsolute(executable) || !fs.existsSync(executable) || !fs.statSync(executable).isFile()) throw new Error('Configure an existing absolute Docker executable path in Active Testing.');
    if (process.platform === 'win32' && path.extname(executable).toLowerCase() !== '.exe') throw new Error('Select docker.exe directly.');
    if (!/^ghcr\.io\/sullo\/nikto@sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Configure the official Nikto GHCR image pinned by SHA-256 digest.');
    return {kind:'docker' as const,executable,script:image,scriptSha256:image.split('@sha256:')[1],image};
  }
  const interpreterKey = tool === 'nikto' ? 'activePerlPath' : 'activePythonPath';
  const scriptKey = tool === 'commix' ? 'commixScriptPath' : tool === 'sqlmap' ? 'sqlmapScriptPath' : 'niktoScriptPath';
  const executable = String(settings[interpreterKey] || '');
  const script = String(settings[scriptKey] || '');
  for (const [label, value] of [[interpreterKey, executable], [scriptKey, script]]) {
    if (!path.isAbsolute(value) || !fs.existsSync(value) || !fs.statSync(value).isFile()) throw new Error(`Configure an existing absolute file path for ${label} in Active Testing.`);
  }
  if (process.platform === 'win32' && path.extname(executable).toLowerCase() !== '.exe') throw new Error('Select the interpreter .exe directly, not a batch wrapper.');
  if (path.extname(script).toLowerCase() !== (tool === 'nikto' ? '.pl' : '.py')) throw new Error(`Invalid ${tool} script extension.`);
  return {kind:'script' as const,executable, script, scriptSha256: crypto.createHash('sha256').update(fs.readFileSync(script)).digest('hex')};
}

function plan(ctx: ScannerContext) { return validateActiveConfig(ctx.targetUrl, ctx.config?.activeValidation, [ctx.scannerName]); }
function textFile(file: string): string {
  if (!fs.existsSync(file)) throw new Error('Tool produced no result artifact; assessment is inconclusive.');
  if (fs.statSync(file).size > 20 * 1024 * 1024) throw new Error('Result exceeds the 20 MB parser limit; inspect the artifact.');
  // Strip ANSI SGR sequences from CLI output before parsing.
  // eslint-disable-next-line no-control-regex
  return fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
}

export function parseSqlmap(text: string, ctx: Pick<ScannerContext, 'targetUrl'>) {
  const errors = text.split(/\r?\n/).filter(line => /\[(?:CRITICAL|ERROR)\]/i.test(line));
  if (errors.some(line => !/all tested parameters do not appear to be injectable/i.test(line))) throw new Error('SQLmap reported an execution error; inspect its log.');
  const confirmed = text.indexOf('sqlmap identified the following injection point(s)');
  if (confirmed < 0) {
    if (/all tested parameters do not appear to be injectable/i.test(text)) return [];
    throw new Error('SQLmap did not produce a conclusive result in the supported output format.');
  }
  const result: Record<string, unknown>[] = [];
  const blocks = text.slice(confirmed).split(/\r?\nParameter: /).slice(1);
  for (const block of blocks) {
    const parameter = block.match(/^(.+?) \((GET)\)/);
    const type = block.match(/^\s*Type:\s*(.+)$/m)?.[1]?.trim();
    const title = block.match(/^\s*Title:\s*(.+)$/m)?.[1]?.trim();
    if (!parameter || !type || !title) continue;
    result.push({id:`sqlmap-${parameter[1]}-${type}`,name:`SQL injection: ${parameter[1]}`,scanner:'sqlmap',severity:'high',url:ctx.targetUrl,param:parameter[1],parameter:parameter[1],confidence:'tool-confirmed',cwe:'CWE-89',description:`SQLmap reported ${type} on GET parameter ${parameter[1]}. ${title}. Impact requires analyst review.`,remediation:'Use parameterized queries and review database privileges.',evidence:{type,title,parameter:parameter[1],method:'GET'},timestamp:new Date().toISOString()});
  }
  if (!result.length) throw new Error('SQLmap confirmation could not be parsed; retain the raw artifact for review.');
  return result;
}

export function parseNikto(text: string, target: string) {
  const raw: unknown = JSON.parse(text);
  const hosts = Array.isArray(raw) ? raw : [raw];
  if (hosts.length !== 1) throw new Error('Nikto must report exactly one assessed host.');
  const findings: Record<string, unknown>[] = [];
  for (const item of hosts) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.vulnerabilities)) throw new Error('Unsupported Nikto JSON schema; assessment is inconclusive.');
    for (const v of item.vulnerabilities) {
      if (!v || typeof v.msg !== 'string' || typeof v.id === 'undefined') throw new Error('Malformed Nikto finding.');
      if (v.id === 'FAIL') throw new Error(`Nikto could not assess the host: ${v.msg}`);
      const location = typeof v.url === 'string' ? new URL(v.url, target) : new URL(target);
      if (location.origin !== new URL(target).origin) throw new Error('Nikto output references an out-of-scope origin.');
      findings.push({id:`nikto-${v.id}`,name:`Web server check: ${v.id}`,scanner:'nikto',severity:'info',url:location.href,confidence:'needs-review',description:v.msg,remediation:'Review the reported server configuration and confirm security impact before assigning severity.',evidence:{checkId:v.id,method:v.method || 'GET'},timestamp:new Date().toISOString()});
    }
  }
  return findings;
}

function processOptions(ctx: ScannerContext) {
  const runtime = activeRuntime(ctx.scannerName as ActiveTool, ctx.settings as unknown as Record<string, unknown>);
  const planned = (ctx.config?.activeRuntimes as Record<string, ReturnType<typeof activeRuntime>> | undefined)?.[ctx.scannerName];
  if (planned && (planned.script !== runtime.script || planned.executable !== runtime.executable || planned.scriptSha256 !== runtime.scriptSha256)) throw new Error('Active Testing runtime changed after preflight. Start a new assessment.');
  const toolArgs = activeAdapters[ctx.scannerName].getCommandArgs(ctx);
  if (runtime.kind === 'docker') {
    const outputIndex = toolArgs.indexOf('-output');
    if (outputIndex < 0) throw new Error('Nikto output contract is missing.');
    toolArgs[outputIndex + 1] = `/output/${path.basename(ctx.jsonFile)}`;
    return {executable:runtime.executable,args:[
      'run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
      '--pids-limit=128','--memory=512m','--cpus=1','--tmpfs','/tmp:rw,noexec,nosuid,size=64m',
      '--volume',`${ctx.outDir}:/output`,runtime.image,...toolArgs
    ],useShell:false,cwd:ctx.outDir};
  }
  return {executable:runtime.executable,args:[runtime.script,...toolArgs],useShell:false,cwd:ctx.outDir};
}
export function parseCommix(text: string, target: string, parameters: string[]) {
  const report = JSON.parse(text);
  if (!report || report.status !== 'completed' || report.target !== target || report.http_method !== 'GET' || !Number.isInteger(report.requests) || report.requests < 1 || typeof report.finished !== 'string') throw new Error('Commix assessment is incomplete or has an unexpected target/schema.');
  const errors = report.errors ?? [];
  const negative = (entry: Record<string,unknown>) => typeof entry?.message === 'string' && entry.message.startsWith('All tested parameters do not appear to be injectable.');
  if (!Array.isArray(errors) || errors.some(entry => !negative(entry))) throw new Error('Commix reported an execution error.');
  if (report.findings !== undefined && !Array.isArray(report.findings)) throw new Error('Invalid Commix findings.');
  if (!report.findings?.length && !errors.some(negative)) throw new Error('Commix did not report a conclusive negative assessment.');
  return (report.findings || []).map((finding: Record<string, unknown>) => {
    if (!finding || finding.http_method !== 'GET' || typeof finding.parameter !== 'string' || !parameters.includes(finding.parameter) || typeof finding.technique !== 'string' || typeof finding.payload !== 'string' || typeof finding.type !== 'string') throw new Error('Invalid or out-of-plan Commix finding.');
    return {id:`commix-${finding.parameter}-${finding.technique}`,name:`Command injection: ${finding.parameter}`,scanner:'commix',severity:'high',url:target,param:finding.parameter,parameter:finding.parameter,confidence:'tool-confirmed',cwe:'CWE-78',description:`Commix confirmed ${finding.type} using ${finding.technique}. Review impact and evidence.`,remediation:'Avoid invoking OS commands with user input; use safe library APIs and strict input validation.',evidence:{parameter:finding.parameter,method:'GET',technique:finding.technique,payload:finding.payload},timestamp:new Date().toISOString()};
  });
}

export const activeAdapters: Record<string, IScannerAdapter> = {
  commix: {
    getCommandArgs(ctx) {
      const config = plan(ctx);
      return ['-u',ctx.targetUrl,'-p',config.parameters.join(','),'--param-filter=GET','--batch','--level=1','--technique=r','--threads=1',`--delay=${config.delaySeconds}`,'--timeout=15','--retries=1','--ignore-redirects','--disable-coloring','--flush-session','--skip-waf',`--output-dir=${path.join(ctx.outDir,'commix')}`,`--report-json=${ctx.jsonFile}`];
    },
    getProcessOptions: processOptions,
    parseFindings(ctx) { return parseCommix(textFile(ctx.jsonFile),ctx.targetUrl,plan(ctx).parameters); },
    isSuccessExitCode(code) { return code === 0; },
  },
  sqlmap: {
    getCommandArgs(ctx) {
      const config = plan(ctx);
      return ['-u',ctx.targetUrl,'-p',config.parameters.join(','),'--batch','--level=1','--risk=1','--technique=BE','--threads=1',`--delay=${config.delaySeconds}`,'--timeout=15','--retries=1','--ignore-redirects','--disable-coloring','--fresh-queries',`--output-dir=${path.join(ctx.outDir, 'sqlmap')}`];
    },
    getProcessOptions: processOptions,
    parseFindings(ctx) { return parseSqlmap(textFile(ctx.outputFile), ctx); },
    isSuccessExitCode(code) { return code === 0; },
  },
  nikto: {
    getCommandArgs(ctx) {
      const config = plan(ctx);
      return ['-h',new URL(ctx.targetUrl).origin,'-Format','json','-output',ctx.jsonFile,'-Pause',String(config.delaySeconds),'-timeout','15','-maxtime',`${config.timeoutMinutes * 60}s`,'-nointeractive','-nocheck','-Tuning','123b'];
    },
    getProcessOptions: processOptions,
    parseFindings(ctx) {
      const log = textFile(ctx.outputFile);
      if (/\bERROR:|maximum execution time/i.test(log)) throw new Error('Nikto reported an incomplete assessment; inspect its log.');
      return parseNikto(textFile(ctx.jsonFile), ctx.targetUrl);
    },
    isSuccessExitCode(code) { return code === 0; },
  },
};
