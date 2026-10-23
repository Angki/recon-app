import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { evaluateEngineOutcome, type EngineOutcomeInput } from '../electron/services/scanners/outcome';
import { ScanStateMachine } from '../electron/services/runner/stateMachine';
import { MigrationManager } from '../electron/services/db/migrations';
import { ScannerAdapters } from '../electron/services/scanners/registry';
import { resolveWordlist } from '../electron/services/wordlists';
import type { ScannerContext } from '../electron/services/scanners/types';

function fixture(dir: string, scannerName: string): ScannerContext {
  const outDir = fs.mkdtempSync(path.join(dir, `${scannerName}-`));
  return {
    scanId: `followup-${scannerName}-${Date.now()}`,
    targetUrl: 'https://example.com/',
    domain: 'example.com',
    scannerName,
    bin: 'fixture',
    outDir,
    timestamp: '2026-10-24T00:00:00.000Z',
    outputFile: path.join(outDir, 'engine.out'),
    jsonFile: path.join(outDir, 'engine.json'),
    xmlFile: path.join(outDir, 'engine.xml'),
    sender: {} as unknown as ScannerContext['sender'],
    settings: {}
  };
}

function input(context: ScannerContext, overrides: Partial<EngineOutcomeInput> = {}): EngineOutcomeInput {
  return {
    context,
    exitCode: 0,
    isSuccessExit: true,
    parseOk: true,
    resultCount: 0,
    timedOut: false,
    userStopped: false,
    watchdogFinalized: false,
    durationMs: 1200,
    ...overrides
  };
}

test('dalfox uses the v3 scan command, input type and workers flag', async () => {
  const { storage } = await import('../electron/services/storage');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dalfox-args-'));
  const ctx = fixture(dir, 'dalfox');
  const scanDir = storage.getScanDir(ctx.scanId);
  let createdScanDir = false;

  try {
    const urlArgs = ScannerAdapters.dalfox.getCommandArgs(ctx);
    assert.equal(urlArgs[0], 'scan', 'Dalfox v3 exposes scanning through the scan subcommand');
    assert.ok(!['url', 'file'].includes(urlArgs[1]), 'Dalfox v2 subcommands are invalid in v3');
    assert.equal(urlArgs[1], ctx.targetUrl);
    assert.ok(urlArgs.includes('--workers'), 'Dalfox v3 requires the long --workers flag');
    assert.ok(!urlArgs.includes('-w'), 'Dalfox v3 rejects the short -w flag with a usage error');
    assert.equal(urlArgs[urlArgs.indexOf('--workers') + 1], '5');
    assert.equal(urlArgs[urlArgs.indexOf('--input-type') + 1], 'url');
    assert.ok(urlArgs.includes(ctx.targetUrl));

    fs.mkdirSync(scanDir, { recursive: true });
    createdScanDir = true;
    const endpointsFile = path.join(scanDir, 'discovered_endpoints.txt');
    fs.writeFileSync(endpointsFile, 'https://example.com/item?id=1\n', 'utf8');

    const fileArgs = ScannerAdapters.dalfox.getCommandArgs(ctx);
    assert.equal(fileArgs[0], 'scan');
    assert.ok(fileArgs.includes(endpointsFile));
    assert.equal(fileArgs[fileArgs.indexOf('--input-type') + 1], 'file');
  } finally {
    if (createdScanDir) fs.rmSync(scanDir, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dalfox exit 2 is classified by report coverage instead of as a CLI usage error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dalfox-outcome-'));
  const report = (findings: unknown[], targetSummary: unknown[], incomplete = false) => JSON.stringify({
    findings,
    meta: { dalfox_version: '3.2.4', incomplete, target_summary: targetSummary }
  });

  const unreachable = fixture(dir, 'dalfox');
  fs.writeFileSync(unreachable.jsonFile, report([], [
    { status: 'skipped', error_code: 'REQUEST_TIMEOUT', target: 'http://127.0.0.1:9/', findings_count: 0 }
  ]));
  const failed = evaluateEngineOutcome(input(unreachable, { exitCode: 2, isSuccessExit: false }));
  assert.equal(failed.status, 'FAILED');
  assert.match(failed.reason, /could not scan|REQUEST_TIMEOUT|timeout/i);
  assert.doesNotMatch(failed.reason, /CLI|usage/i, 'exit 2 is a runtime scan failure in Dalfox v3, not a usage error');

  const mixed = fixture(dir, 'dalfox');
  fs.writeFileSync(mixed.jsonFile, report([], [
    { status: 'clean', target: 'https://example.com/', findings_count: 0 },
    { status: 'skipped', error_code: 'CONNECTION_FAILED', target: 'https://api.example.com/' }
  ]));
  const degraded = evaluateEngineOutcome(input(mixed, { exitCode: 2, isSuccessExit: false }));
  assert.equal(degraded.status, 'DEGRADED');
  assert.match(degraded.reason, /skipped|partial|coverage/i);

  const mixedFindings = fixture(dir, 'dalfox');
  fs.writeFileSync(mixedFindings.jsonFile, report(
    [{ param: 'q', type: 'VULN', url: 'https://example.com/?q=x' }],
    [
      { status: 'clean', target: 'https://example.com/', findings_count: 1 },
      { status: 'skipped', error_code: 'CONNECTION_FAILED', target: 'https://api.example.com/' }
    ]
  ));
  const degradedWithFindings = evaluateEngineOutcome(input(mixedFindings, { exitCode: 0, resultCount: 1 }));
  assert.equal(degradedWithFindings.status, 'DEGRADED');
  assert.match(degradedWithFindings.reason, /skipped|partial|coverage/i);

  const unusable = fixture(dir, 'dalfox');
  fs.writeFileSync(unusable.jsonFile, '{}');
  const noReport = evaluateEngineOutcome(input(unusable, { exitCode: 2, isSuccessExit: false }));
  assert.equal(noReport.status, 'FAILED');
  assert.doesNotMatch(noReport.reason, /usage error/i);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('ffuf builds a single-slash FUZZ url and rejects unusable wordlists in favour of a generated fallback', () => {
  assert.equal(os.homedir(), process.env.RECON_TEST_HOME, 'Use npm test isolated runner');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffuf-wordlist-'));

  const ctx = fixture(dir, 'ffuf');
  const args = ScannerAdapters.ffuf.getCommandArgs(ctx);
  assert.ok(args.includes('https://example.com/FUZZ'), 'target with a trailing slash must not produce //FUZZ');
  assert.ok(!args.includes('https://example.com//FUZZ'));

  const utf16Wordlist = path.join(dir, 'common-utf16.txt');
  fs.writeFileSync(utf16Wordlist, Buffer.from('\uFEFFadmin\nlogin\napi\n', 'utf16le'));
  const fallback = resolveWordlist(utf16Wordlist);
  assert.ok(fallback, 'an unusable configured wordlist must fall back to the generated list');
  assert.notEqual(path.resolve(utf16Wordlist), fallback);
  const fallbackEntries = fs.readFileSync(fallback as string, 'utf8').split(/\r?\n/).filter(line => line.trim());
  assert.ok(fallbackEntries.length >= 8, 'generated fallback must contain a usable number of paths');
  assert.ok(fallbackEntries.includes('admin'));

  const tinyWordlist = path.join(dir, 'tiny.txt');
  fs.writeFileSync(tinyWordlist, 'admin\nlogin\n', 'utf8');
  assert.notEqual(path.resolve(tinyWordlist), resolveWordlist(tinyWordlist));

  const validWordlist = path.join(dir, 'valid.txt');
  fs.writeFileSync(validWordlist, Array.from({ length: 12 }, (_, index) => `path-${index}`).join('\n'), 'utf8');
  assert.equal(path.resolve(validWordlist), resolveWordlist(validWordlist));

  assert.notEqual(resolveWordlist(path.join(dir, 'missing.txt')), path.resolve(path.join(dir, 'missing.txt')));

  fs.rmSync(dir, { recursive: true, force: true });
});

test('zap failures reported as any attack error are classified as FAILED, not clean coverage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zap-outcome-'));
  const ctx = fixture(dir, 'zap');
  fs.writeFileSync(ctx.jsonFile, JSON.stringify({ site: [{ '@name': 'https://example.com' }] }));
  fs.writeFileSync(ctx.outputFile, '[ZAP] Failed to attack the URL: received a 403 response code\n');

  const outcome = evaluateEngineOutcome(input(ctx));
  assert.equal(outcome.status, 'FAILED');
  assert.match(outcome.reason, /could not attack|403|coverage/i);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('wapiti reports with zero crawled pages are FAILED while normal exit code 1 reports are COMPLETED', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapiti-outcome-'));

  const blocked = fixture(dir, 'wapiti');
  fs.writeFileSync(blocked.jsonFile, JSON.stringify({
    infos: { target: 'https://example.com/', crawled_pages_nbr: 0 },
    vulnerabilities: {},
    additionals: {}
  }));
  fs.writeFileSync(blocked.outputFile, '[!] ConnectError with URL https://example.com/\n[*] Wapiti found 0 URLs and forms during the scan\n');
  const blockedOutcome = evaluateEngineOutcome(input(blocked, { exitCode: 1 }));
  assert.equal(blockedOutcome.status, 'FAILED');
  assert.match(blockedOutcome.reason, /crawl|connect/i);

  const healthy = fixture(dir, 'wapiti');
  fs.writeFileSync(healthy.jsonFile, JSON.stringify({
    infos: { target: 'https://example.com/', crawled_pages_nbr: 1, crawled_pages: [{ url: 'https://example.com/' }] },
    vulnerabilities: { 'SQL Injection': [{ level: 3, path: 'https://example.com/item?id=1' }] },
    additionals: {}
  }));
  const healthyOutcome = evaluateEngineOutcome(input(healthy, { exitCode: 1, resultCount: 1 }));
  assert.equal(healthyOutcome.status, 'COMPLETED');
  assert.doesNotMatch(healthyOutcome.reason, /partial|warning/i);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('cmseek does not emit a finding when its report contains no detected CMS', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmseek-parse-'));
  const ctx = fixture(dir, 'cmseek');
  fs.writeFileSync(path.join(ctx.outDir, 'cms.json'), JSON.stringify({
    cms_id: '',
    cms_name: '',
    cms_url: '',
    url: 'https://example.com/'
  }));

  assert.deepEqual(ScannerAdapters.cmseek.parseFindings!(ctx), []);

  fs.writeFileSync(path.join(ctx.outDir, 'cms.json'), JSON.stringify({
    cms_id: 'wordpress',
    cms_name: 'WordPress',
    cms_version: '6.6',
    url: 'https://example.com/'
  }));
  const detected = ScannerAdapters.cmseek.parseFindings!(ctx);
  assert.equal(detected.length, 1);
  assert.match(String(detected[0].name), /WordPress/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('sslyze parses v6 reports, surfaces legacy cipher suites and keeps v4 report compatibility', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sslyze-parse-'));
  const ctx = fixture(dir, 'sslyze');
  fs.writeFileSync(ctx.jsonFile, JSON.stringify({
    server_scan_results: [
      {
        server_location: { hostname: 'example.com' },
        connectivity_status: 'COMPLETED',
        scan_result: {
          certificate_info: { status: 'COMPLETED', result: { certificate_deployments: [] } },
          tls_1_0_cipher_suites: {
            status: 'COMPLETED',
            result: {
              is_tls_version_supported: true,
              accepted_cipher_suites: [{ cipher_suite: { name: 'TLS_RSA_WITH_AES_128_CBC_SHA' } }]
            }
          },
          tls_1_2_cipher_suites: {
            status: 'COMPLETED',
            result: {
              is_tls_version_supported: true,
              accepted_cipher_suites: [
                { cipher_suite: { name: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256' } },
                { cipher_suite: { name: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA' } }
              ]
            }
          },
          heartbleed: { status: 'COMPLETED', result: { is_vulnerable_to_heartbleed: true } },
          robot: { status: 'COMPLETED', result: { robot_result: 'VULNERABLE_STRONG_ORACLE' } }
        }
      },
      {
        server_location: { hostname: 'legacy.example.com' },
        scan_commands_results: {
          ssl_3_0_cipher_suites: { ciphers_supported: ['RC4-SHA'] }
        }
      }
    ]
  }));

  const findings = ScannerAdapters.sslyze.parseFindings!(ctx);
  const ids = findings.map(finding => String(finding.id));
  assert.ok(ids.includes('sslyze-tls-1-0-enabled'), 'deprecated TLS 1.0 must be derived from the v6 result wrapper');
  assert.ok(ids.includes('sslyze-ssl-3-0-enabled'), 'legacy v4 scan_commands_results must remain supported');
  assert.ok(ids.includes('sslyze-heartbleed-vulnerable'));
  assert.ok(ids.includes('sslyze-robot-vulnerable'));

  const weak = findings.find(finding => finding.id === 'sslyze-weak-cipher-suites');
  assert.ok(weak, 'accepted legacy CBC suites must be surfaced');
  assert.match(String(weak!.description), /CBC/i);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('crash recovery marks dangling scans and their running engines as STOPPED', () => {
  const db = new Database(':memory:');
  MigrationManager.runMigrations(db);
  db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('dangling', 'https://example.com', 'RUNNING', '2026-10-24T00:00:00Z')").run();
  db.prepare("INSERT INTO scan_status (scanId, scanner, status, updatedAt) VALUES ('dangling', 'subfinder', 'RUNNING', '2026-10-24T00:00:00Z')").run();
  db.prepare("INSERT INTO scan_status (scanId, scanner, status, updatedAt) VALUES ('dangling', 'nuclei', 'COMPLETED', '2026-10-24T00:00:00Z')").run();

  const recoveryDb = {
    getDanglingScans: () => db.prepare("SELECT scanId, status FROM scans WHERE status IN ('RUNNING', 'VALIDATING', 'PARSING', 'QUEUED')").all() as { scanId: string; status: string }[],
    updateScanStatus: (scanId: string, status: string, endTime?: string) => {
      db.prepare('UPDATE scans SET status = ?, endTime = ? WHERE scanId = ?').run(status, endTime ?? null, scanId);
    },
    stopNonTerminalEngines: (scanId: string, reason: string, updatedAt: string) => {
      const result = db.prepare("UPDATE scan_status SET status = 'STOPPED', reason = ?, updatedAt = ? WHERE scanId = ? AND status IN ('RUNNING', 'QUEUED', 'VALIDATING', 'PARSING')").run(reason, updatedAt, scanId);
      return result.changes;
    }
  };

  const recovered = ScanStateMachine.recoverDanglingScans(recoveryDb);
  assert.equal(recovered, 1);
  assert.equal((db.prepare("SELECT status FROM scans WHERE scanId = 'dangling'").get() as { status: string }).status, 'INTERRUPTED');

  const subfinder = db.prepare("SELECT status, reason FROM scan_status WHERE scanId = 'dangling' AND scanner = 'subfinder'").get() as { status: string; reason: string };
  assert.equal(subfinder.status, 'STOPPED');
  assert.match(subfinder.reason, /interrupted|session ended/i);

  const nuclei = db.prepare("SELECT status FROM scan_status WHERE scanId = 'dangling' AND scanner = 'nuclei'").get() as { status: string };
  assert.equal(nuclei.status, 'COMPLETED', 'already terminal engines must not be rewritten');

  db.close();
});

test('concurrent scans stage the host discovery chain so downstream engines receive discovered hosts', async () => {
  const { planExecution } = await import('../electron/services/pipeline/executionPlan');
  const priority: Record<string, number> = {
    subfinder: 10, alterx: 11, dnsx: 12, naabu: 16, tlsx: 18, httpx: 30, nuclei: 40, wapiti: 50
  };

  const concurrent = planExecution(['nuclei', 'httpx', 'subfinder', 'wapiti', 'dnsx'], 'concurrent', priority);
  assert.deepEqual(concurrent.parallel, ['nuclei', 'wapiti'], 'non-discovery engines still start together');
  assert.deepEqual(concurrent.staged, ['subfinder', 'dnsx', 'httpx'], 'host producers must run before their consumers');

  const pipeline = planExecution(['nuclei', 'httpx', 'subfinder'], 'pipeline', priority);
  assert.deepEqual(pipeline.parallel, []);
  assert.deepEqual(pipeline.staged, ['subfinder', 'httpx', 'nuclei']);

  const noDiscovery = planExecution(['nuclei', 'wapiti'], 'concurrent', priority);
  assert.deepEqual(noDiscovery.parallel, ['nuclei', 'wapiti']);
  assert.deepEqual(noDiscovery.staged, []);
});

test('host discovery is scoped, deduplicated and fed to downstream engines through list files', async () => {
  const hostInventory = await import('../electron/services/hostInventory');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-inventory-'));
  const ctx = fixture(dir, 'subfinder');
  fs.writeFileSync(ctx.jsonFile, [
    JSON.stringify({ host: 'www.example.com', source: 'fixture' }),
    JSON.stringify({ host: 'API.Example.com', source: 'fixture' }),
    JSON.stringify({ host: 'evil-example.com', source: 'fixture' }),
    JSON.stringify({ host: 'example.com.evil.test', source: 'fixture' }),
    JSON.stringify({ host: 'www.example.com', source: 'fixture' }),
    ''
  ].join('\n'));

  const hosts = hostInventory.captureDiscoveredHosts(ctx);
  assert.deepEqual(hosts, ['api.example.com', 'example.com', 'www.example.com']);

  const hostsFile = hostInventory.discoveredHostsFile(ctx);
  assert.ok(hostsFile && fs.existsSync(hostsFile));
  assert.deepEqual(fs.readFileSync(hostsFile as string, 'utf8').split(/\r?\n/).filter(Boolean), hosts);

  const dnsxArgs = ScannerAdapters.dnsx.getCommandArgs({ ...ctx, scannerName: 'dnsx' });
  const tlsxArgs = ScannerAdapters.tlsx.getCommandArgs({ ...ctx, scannerName: 'tlsx' });
  const httpxArgs = ScannerAdapters.httpx.getCommandArgs({ ...ctx, scannerName: 'httpx' });
  const naabuArgs = ScannerAdapters.naabu.getCommandArgs({ ...ctx, scannerName: 'naabu' });

  assert.ok(dnsxArgs.includes('-l') && dnsxArgs.includes(hostsFile as string));
  assert.ok(tlsxArgs.includes('-l') && tlsxArgs.includes(hostsFile as string));
  assert.ok(httpxArgs.includes('-l') && httpxArgs.includes(hostsFile as string));
  assert.ok(naabuArgs.includes('-list') && naabuArgs.includes(hostsFile as string));

  fs.rmSync(dir, { recursive: true, force: true });
});
