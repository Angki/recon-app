import fs from 'fs';
import type { ScannerContext } from './types';

export type EngineOutcomeStatus = 'COMPLETED' | 'DEGRADED' | 'PARTIAL' | 'SKIPPED' | 'FAILED' | 'STOPPED';

export interface EngineOutcomeInput {
  context: ScannerContext;
  exitCode: number | null;
  isSuccessExit: boolean;
  parseOk: boolean;
  resultCount: number;
  timedOut: boolean;
  userStopped: boolean;
  watchdogFinalized: boolean;
  durationMs: number;
  stdoutTail?: string;
}

export interface EngineOutcome {
  status: EngineOutcomeStatus;
  reason: string;
  exitCode: number | null;
  artifactPath?: string;
  resultCount: number;
  durationMs: number;
}

const XML_ARTIFACT_TOOLS = new Set(['appscan', 'netsparker']);
const TEXT_ARTIFACT_TOOLS = new Set(['alterx', 'nmap', 'sqlmap', 'commix', 'sstimap', 'jwt_tool', 'nikto']);
/** Engines that always write a report artifact, even when zero findings are present. */
const REQUIRED_ARTIFACT_TOOLS = new Set(['wapiti', 'zap', 'ffuf', 'appscan', 'netsparker', 'acunetix']);

const FATAL_OUTPUT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[FTL\]/i, label: 'fatal engine log entry' },
  { pattern: /failed to attack the url:?\s*connection reset/i, label: 'connection reset during attack' },
  { pattern: /wordlist.*(not found|does not exist)/i, label: 'wordlist missing' },
  { pattern: /command not found|is not recognized as an internal or external command/i, label: 'binary not executable' }
];

export function resolveArtifactPath(context: ScannerContext): string {
  if (XML_ARTIFACT_TOOLS.has(context.scannerName)) return context.xmlFile;
  if (TEXT_ARTIFACT_TOOLS.has(context.scannerName)) return context.outputFile;
  return context.jsonFile;
}

export function artifactHasContent(artifactPath: string | undefined): boolean {
  try {
    return Boolean(artifactPath && fs.existsSync(artifactPath) && fs.statSync(artifactPath).size > 0);
  } catch {
    return false;
  }
}

export function readOutputTail(context: ScannerContext, maxBytes = 24 * 1024): string {
  const candidates = [context.outputFile, context.jsonFile, context.xmlFile];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const size = fs.statSync(file).size;
      if (size <= 0) continue;
      const fd = fs.openSync(file, 'r');
      const length = Math.min(size, maxBytes);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, Math.max(0, size - length));
      fs.closeSync(fd);
      return buffer.toString('utf8');
    } catch {
      // Try the next artifact candidate.
    }
  }
  return '';
}

function detectFatalOutput(output: string): string | null {
  // eslint-disable-next-line no-control-regex
  const normalized = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  for (const { pattern, label } of FATAL_OUTPUT_PATTERNS) {
    if (pattern.test(normalized)) return label;
  }
  return null;
}

interface DalfoxCoverage {
  valid: boolean;
  total: number;
  scanned: number;
  skipped: number;
  skipReasons: string[];
  incomplete: boolean;
}

function inspectDalfoxReport(context: ScannerContext): DalfoxCoverage {
  const coverage: DalfoxCoverage = { valid: false, total: 0, scanned: 0, skipped: 0, skipReasons: [], incomplete: false };
  try {
    if (!fs.existsSync(context.jsonFile)) return coverage;
    const data = JSON.parse(fs.readFileSync(context.jsonFile, 'utf8')) as {
      findings?: unknown;
      meta?: { incomplete?: unknown; target_summary?: unknown };
    };
    if (!data || typeof data !== 'object' || !Array.isArray(data.findings)) return coverage;
    coverage.valid = true;
    coverage.incomplete = data.meta?.incomplete === true;
    const summaries = Array.isArray(data.meta?.target_summary) ? data.meta.target_summary : [];
    for (const entry of summaries) {
      if (!entry || typeof entry !== 'object') continue;
      const summary = entry as { status?: unknown; error_code?: unknown };
      coverage.total++;
      if (summary.status === 'skipped' || typeof summary.error_code === 'string') {
        coverage.skipped++;
        if (typeof summary.error_code === 'string') coverage.skipReasons.push(summary.error_code);
      } else {
        coverage.scanned++;
      }
    }
    return coverage;
  } catch {
    return coverage;
  }
}

function inspectZapReport(context: ScannerContext): { siteCount: number; fatal: boolean } {
  let siteCount = 0;
  let fatal = false;
  try {
    if (fs.existsSync(context.jsonFile)) {
      const content = fs.readFileSync(context.jsonFile, 'utf8');
      const data = JSON.parse(content) as { site?: unknown[] | unknown };
      if (Array.isArray(data.site)) siteCount = data.site.length;
      else if (data.site) siteCount = 1;
      if (/failed to attack the url/i.test(content)) fatal = true;
    }
  } catch {
    // Report inspection is best-effort; parse failures are handled separately.
  }
  const tail = readOutputTail(context);
  if (/failed to attack the url/i.test(tail)) fatal = true;
  return { siteCount, fatal };
}

function inspectWapitiReport(context: ScannerContext): { crawledPages: number | null; connectError: boolean } {
  let crawledPages: number | null = null;
  try {
    if (fs.existsSync(context.jsonFile)) {
      const data = JSON.parse(fs.readFileSync(context.jsonFile, 'utf8')) as {
        infos?: { crawled_pages_nbr?: unknown };
      };
      if (typeof data.infos?.crawled_pages_nbr === 'number') crawledPages = data.infos.crawled_pages_nbr;
    }
  } catch {
    // Report inspection is best-effort; parse failures are handled separately.
  }
  const tail = readOutputTail(context);
  const connectError = /ConnectError|Wapiti found 0 URLs and forms/i.test(tail);
  return { crawledPages, connectError };
}

export function evaluateEngineOutcome(input: EngineOutcomeInput): EngineOutcome {
  const {
    context,
    exitCode,
    isSuccessExit,
    parseOk,
    resultCount,
    timedOut,
    userStopped,
    watchdogFinalized,
    durationMs,
    stdoutTail
  } = input;

  const scanner = context.scannerName;
  const artifactPath = resolveArtifactPath(context);
  const artifactExists = artifactHasContent(artifactPath);
  const base = {
    exitCode,
    artifactPath: artifactExists ? artifactPath : undefined,
    resultCount,
    durationMs
  };

  if (userStopped) {
    return { ...base, status: 'STOPPED', reason: 'Stopped by the operator before the engine completed.' };
  }

  if (watchdogFinalized) {
    if (artifactExists && parseOk) {
      return { ...base, status: 'COMPLETED', reason: 'Report artifact was generated before the completion watchdog terminated the process.' };
    }
    return { ...base, status: 'FAILED', reason: 'Completion watchdog terminated the engine before a usable result artifact was produced.' };
  }

  if (timedOut) {
    if (scanner === 'interactsh') {
      return { ...base, status: 'COMPLETED', reason: 'Interaction capture window elapsed; collected OAST interactions were parsed.' };
    }
    if (watchdogFinalized && artifactExists && parseOk) {
      return { ...base, status: 'COMPLETED', reason: 'Report artifact was generated before the completion watchdog terminated the process.' };
    }
    return { ...base, status: 'FAILED', reason: `Engine exceeded its execution timeout after ${Math.round(durationMs / 1000)}s.` };
  }

  if (!parseOk) {
    return { ...base, status: 'FAILED', reason: 'Result artifact could not be parsed; the engine output is inconclusive.' };
  }

  if (scanner === 'zap') {
    const report = inspectZapReport(context);
    if (report.fatal) {
      return { ...base, status: 'FAILED', reason: 'ZAP could not attack the target (request failure such as a connection reset or HTTP 403). No meaningful scan coverage was obtained.' };
    }
    if (report.siteCount === 0) {
      return { ...base, status: 'DEGRADED', reason: 'ZAP produced a report without any scanned site records; coverage is unreliable.' };
    }
  }

  if (scanner === 'wapiti') {
    const report = inspectWapitiReport(context);
    if (report.connectError || report.crawledPages === 0) {
      return {
        ...base,
        status: 'FAILED',
        reason: report.connectError
          ? 'Wapiti could not crawl the target (connection error). No URLs or forms were assessed.'
          : 'Wapiti crawled 0 pages; the report contains no assessed target coverage.'
      };
    }
  }

  const dalfoxCoverage = scanner === 'dalfox' ? inspectDalfoxReport(context) : null;

  if (scanner === 'dalfox' && exitCode === 2) {
    if (!dalfoxCoverage?.valid) {
      return { ...base, status: 'FAILED', reason: 'Dalfox exited with code 2 without a usable scan report; no scan coverage was obtained.' };
    }
    if (dalfoxCoverage.scanned === 0) {
      const codes = [...new Set(dalfoxCoverage.skipReasons)].slice(0, 3).join(', ');
      return {
        ...base,
        status: 'FAILED',
        reason: `Dalfox could not scan any target${codes ? ` (${codes})` : ''}; no XSS coverage was obtained.`
      };
    }
    return {
      ...base,
      status: 'DEGRADED',
      reason: `Dalfox exited with code 2 after scanning ${dalfoxCoverage.scanned} target(s)${dalfoxCoverage.skipped > 0 ? ` and skipping ${dalfoxCoverage.skipped}` : ''}; coverage is partial.`
    };
  }

  if (!isSuccessExit) {
    return {
      ...base,
      status: 'FAILED',
      reason: `Engine exited with code ${exitCode ?? 'unknown'}${artifactExists ? '' : ' and produced no result artifact'}.`
    };
  }

  if (REQUIRED_ARTIFACT_TOOLS.has(scanner) && !artifactExists) {
    return {
      ...base,
      status: 'FAILED',
      reason: 'Engine exited successfully but did not produce the required result artifact; no assurance can be derived.'
    };
  }

  const fatal = detectFatalOutput(stdoutTail || readOutputTail(context));
  if (fatal) {
    return { ...base, status: 'FAILED', reason: `Engine reported a fatal execution problem (${fatal}); results are inconclusive.` };
  }

  if (dalfoxCoverage?.valid && (dalfoxCoverage.skipped > 0 || dalfoxCoverage.incomplete)) {
    const codes = [...new Set(dalfoxCoverage.skipReasons)].slice(0, 3).join(', ');
    return {
      ...base,
      status: 'DEGRADED',
      reason: dalfoxCoverage.skipped > 0
        ? `Dalfox skipped ${dalfoxCoverage.skipped} of ${dalfoxCoverage.total} target(s)${codes ? ` (${codes})` : ''}; coverage is partial.`
        : 'Dalfox marked the scan as incomplete; coverage is partial.'
    };
  }

  if (resultCount === 0) {
    return {
      ...base,
      status: 'COMPLETED',
      reason: artifactExists
        ? 'Engine completed and produced an empty report (no findings).'
        : 'Engine completed with no findings (exit-code contract satisfied).'
    };
  }

  return { ...base, status: 'COMPLETED', reason: 'Engine completed and produced verifiable results.' };
}
