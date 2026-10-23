import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Database from 'better-sqlite3';
import { evaluateEngineOutcome, type EngineOutcomeInput } from '../electron/services/scanners/outcome';
import { ScanStateMachine } from '../electron/services/runner/stateMachine';
import { dbService } from '../electron/services/database';
import { endpointInventory } from '../electron/services/endpointInventory';
import { runHttpPosture } from '../electron/services/scanners/httpPosture';
import {
  correlateServiceAdvisories,
  compareVersions,
  isVersionAffected
} from '../electron/services/correlation/advisories';
import { BaselineComparator, normalizeScanTarget } from '../electron/services/db/baseline';
import { MigrationManager } from '../electron/services/db/migrations';
import { ScannerAdapters } from '../electron/services/scanners/registry';
import type { ScannerContext } from '../electron/services/scanners/types';

function outcomeFixture(dir: string, scannerName = 'nuclei'): ScannerContext {
  const engineDir = fs.mkdtempSync(path.join(dir, `${scannerName}-`));
  return {
    scanId: 'outcome-fixture',
    targetUrl: 'https://example.com',
    domain: 'example.com',
    scannerName,
    bin: 'fixture',
    outDir: engineDir,
    timestamp: '2026-01-01T00:00:00.000Z',
    outputFile: path.join(engineDir, 'engine.out'),
    jsonFile: path.join(engineDir, 'engine.json'),
    xmlFile: path.join(engineDir, 'engine.xml'),
    sender: {} as unknown as ScannerContext['sender'],
    settings: {}
  };
}

function outcomeInput(context: ScannerContext, overrides: Partial<EngineOutcomeInput> = {}): EngineOutcomeInput {
  return {
    context,
    exitCode: 0,
    isSuccessExit: true,
    parseOk: true,
    resultCount: 0,
    timedOut: false,
    userStopped: false,
    watchdogFinalized: false,
    durationMs: 1500,
    ...overrides
  };
}

test('engine outcome evaluator: completed, degraded, failed and skipped contracts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-eval-'));
  const ctx = outcomeFixture(dir);

  fs.writeFileSync(ctx.jsonFile, '{}');
  const emptyClean = evaluateEngineOutcome(outcomeInput(ctx));
  assert.equal(emptyClean.status, 'COMPLETED');
  assert.match(emptyClean.reason, /empty report|no findings/i);
  assert.equal(emptyClean.artifactPath, ctx.jsonFile);

  const wapitiCtx = outcomeFixture(dir, 'wapiti');
  const missingArtifact = evaluateEngineOutcome(outcomeInput(wapitiCtx));
  assert.equal(missingArtifact.status, 'FAILED');
  assert.match(missingArtifact.reason, /required result artifact/i);

  fs.writeFileSync(wapitiCtx.jsonFile, '{}');
  const wapitiWarn = evaluateEngineOutcome(outcomeInput(wapitiCtx, { exitCode: 1 }));
  assert.equal(wapitiWarn.status, 'PARTIAL');
  assert.match(wapitiWarn.reason, /non-fatal warnings/i);

  const zapCtx = outcomeFixture(dir, 'zap');
  fs.writeFileSync(zapCtx.jsonFile, JSON.stringify({ site: [] }));
  const emptyZap = evaluateEngineOutcome(outcomeInput(zapCtx));
  assert.equal(emptyZap.status, 'DEGRADED');
  assert.match(emptyZap.reason, /without any scanned site records/i);

  fs.writeFileSync(zapCtx.jsonFile, JSON.stringify({ site: [{ '@name': 'https://example.com' }], note: 'failed to attack the url: connection reset' }));
  const resetZap = evaluateEngineOutcome(outcomeInput(zapCtx));
  assert.equal(resetZap.status, 'FAILED');
  assert.match(resetZap.reason, /connection reset/i);

  const dalfoxCtx = outcomeFixture(dir, 'dalfox');
  fs.writeFileSync(dalfoxCtx.jsonFile, '{}');
  const dalfoxUsage = evaluateEngineOutcome(outcomeInput(dalfoxCtx, { exitCode: 2 }));
  assert.equal(dalfoxUsage.status, 'FAILED');
  assert.match(dalfoxUsage.reason, /usage error/i);

  const stopped = evaluateEngineOutcome(outcomeInput(ctx, { userStopped: true }));
  assert.equal(stopped.status, 'STOPPED');

  const watchdogNoArtifact = outcomeFixture(dir, 'nuclei');
  assert.equal(evaluateEngineOutcome(outcomeInput(watchdogNoArtifact, { watchdogFinalized: true })).status, 'FAILED');

  fs.writeFileSync(ctx.jsonFile, '{}');
  const watchdogWithArtifact = evaluateEngineOutcome(outcomeInput(ctx, { watchdogFinalized: true }));
  assert.equal(watchdogWithArtifact.status, 'COMPLETED');
  assert.match(watchdogWithArtifact.reason, /before the completion watchdog/i);

  const fatal = evaluateEngineOutcome(outcomeInput(ctx, { resultCount: 3, stdoutTail: '[FTL] engine crashed while loading templates' }));
  assert.equal(fatal.status, 'FAILED');
  assert.match(fatal.reason, /fatal execution problem/i);

  const badExit = evaluateEngineOutcome(outcomeInput(ctx, { exitCode: 3, isSuccessExit: false }));
  assert.equal(badExit.status, 'FAILED');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('aggregate scan state never reports COMPLETED when coverage was skipped or degraded', () => {
  assert.equal(
    ScanStateMachine.computeAggregateState('RUNNING', { nuclei: 'COMPLETED', arjun: 'SKIPPED' }, ['nuclei', 'arjun']),
    'PARTIAL'
  );
  assert.equal(
    ScanStateMachine.computeAggregateState('RUNNING', { nuclei: 'COMPLETED', wapiti: 'DEGRADED' }, ['nuclei', 'wapiti']),
    'PARTIAL'
  );
  assert.equal(
    ScanStateMachine.computeAggregateState('RUNNING', { sqlmap: 'SKIPPED' }, ['sqlmap']),
    'SKIPPED'
  );
  assert.equal(
    ScanStateMachine.computeAggregateState('RUNNING', { nuclei: 'COMPLETED', httpx: 'COMPLETED' }, ['nuclei', 'httpx']),
    'COMPLETED'
  );
  assert.equal(
    ScanStateMachine.computeAggregateState('RUNNING', { nuclei: 'FAILED' }, ['nuclei']),
    'FAILED'
  );
});

test('cross-engine dedupe merges faults while inventory and posture findings stay distinct', () => {
  assert.equal(os.homedir(), process.env.RECON_TEST_HOME, 'Use npm test isolated runner');
  const scanId = `dedupe-fixture-${Date.now()}`;
  dbService.insertScan(scanId, 'https://example.com', 'COMPLETED', new Date().toISOString(), { tools: ['nuclei', 'wapiti', 'httpx'] });
  try {
    const nuclei = dbService.insertFindings(scanId, 'nuclei', [{
      id: 'sqli-a',
      name: 'SQL Injection',
      severity: 'high',
      url: 'https://example.com/item?id=1',
      param: 'id'
    }]);
    const wapiti = dbService.insertFindings(scanId, 'wapiti', [{
      id: 'sqli-b',
      name: 'SQL Injection',
      severity: 'high',
      url: 'https://example.com/item?id=1',
      param: 'id'
    }]);
    assert.equal(nuclei.insertedFindings.length, 1);
    assert.equal(wapiti.insertedFindings.length, 0, 'same flaw from another engine must merge');
    assert.equal(wapiti.duplicateCount, 1);

    const inventory = dbService.insertFindings(scanId, 'httpx', [{
      id: 'open-ports',
      name: 'Open Ports Detected',
      severity: 'info',
      url: 'https://example.com'
    }]);
    assert.equal(inventory.insertedFindings.length, 0);
    assert.equal(inventory.observationCount, 1);
    assert.ok(dbService.getObservations(scanId).some(o => o.toolName === 'httpx' && o.assetType === 'open-ports'));

    const posture = dbService.insertFindings(scanId, 'posture', [
      { id: 'posture-csp-missing', name: 'Security Header Missing', severity: 'low', url: 'https://example.com' },
      { id: 'posture-hsts-missing', name: 'Security Header Missing', severity: 'medium', url: 'https://example.com' }
    ]);
    assert.equal(posture.insertedFindings.length, 2, 'distinct posture checks must not collapse into one signature');
    assert.equal(
      dbService.getFindings(scanId).filter(f => String(f.id || '').startsWith('posture-')).length,
      2
    );
  } finally {
    dbService.deleteScan(scanId);
  }
});

test('service version advisory correlation is conservative and deduplicated', () => {
  const discovered = [{
    id: 'whatweb-server',
    name: 'Web Server Fingerprint',
    severity: 'info',
    scanner: 'whatweb',
    url: 'https://example.com',
    description: 'Apache/2.4.49 (Unix)'
  }];

  const correlated = correlateServiceAdvisories(discovered, 'whatweb');
  assert.equal(correlated.length, 2);
  const advisory = correlated[1] as Record<string, unknown>;
  assert.equal(advisory.cveId, 'CVE-2021-41773');
  assert.equal(advisory.confidence, 'low');
  assert.match(String(advisory.description), /ADVISORY CORRELATION ONLY/);

  const alreadyKnown = correlateServiceAdvisories(
    [{ ...discovered[0], cveId: 'CVE-2021-41773' }],
    'whatweb'
  );
  assert.equal(alreadyKnown.length, 1, 'a CVE already reported must not be duplicated');

  const patched = correlateServiceAdvisories(
    [{ ...discovered[0], description: 'Apache/2.4.51 (Unix)' }],
    'whatweb'
  );
  assert.equal(patched.length, 1);

  assert.equal(isVersionAffected('1.0.1f', { minInclusive: '1.0.1', maxInclusive: '1.0.1f' }), true);
  assert.equal(isVersionAffected('1.0.1g', { minInclusive: '1.0.1', maxInclusive: '1.0.1f' }), false);
  assert.equal(compareVersions('1.0.1f', '1.0.1'), 1);
  assert.equal(compareVersions('9.7', '9.8'), -1);
});

test('baseline comparison requires the same target and per-engine completed coverage', () => {
  const db = new Database(':memory:');
  MigrationManager.runMigrations(db);

  db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('base', 'https://example.com/app', 'COMPLETED', '2026-10-01T00:00:00Z')").run();
  db.prepare("INSERT INTO scan_status (scanId, scanner, status, updatedAt) VALUES ('base', 'nuclei', 'COMPLETED', '2026-10-01T00:00:00Z')").run();
  db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('base', 'nuclei', 'xss', 'Reflected XSS', 'high', 'https://example.com/app', 'fp-base')").run();

  db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('current', 'https://example.com/app/', 'COMPLETED', '2026-10-02T00:00:00Z')").run();
  db.prepare("INSERT INTO scan_status (scanId, scanner, status, reason, updatedAt) VALUES ('current', 'nuclei', 'SKIPPED', 'No parameterized endpoints were found.', '2026-10-02T00:00:00Z')").run();

  const skipped = BaselineComparator.compare('current', 'base', db);
  assert.equal(skipped.summary.resolvedCount, 0);
  assert.equal(skipped.summary.notReassessedCount, 1);
  assert.match(skipped.resolutionCaveat || '', /skipped, degraded, failed, or not run/i);

  db.prepare("UPDATE scan_status SET status = 'COMPLETED', reason = NULL WHERE scanId = 'current' AND scanner = 'nuclei'").run();
  const covered = BaselineComparator.compare('current', 'base', db);
  assert.equal(covered.summary.resolvedCount, 1);
  assert.equal(covered.resolvedFindings[0].fingerprint, 'fp-base');

  db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('other-target', 'https://other.example/app', 'COMPLETED', '2026-10-03T00:00:00Z')").run();
  assert.throws(
    () => BaselineComparator.compare('other-target', 'base', db),
    /requires the same target/i
  );

  assert.equal(normalizeScanTarget('https://Example.com/app/'), normalizeScanTarget('https://example.com/app'));
  db.close();
});

test('built-in HTTP posture produces header, cookie, evidence and form inventory without external CLIs', async () => {
  assert.equal(os.homedir(), process.env.RECON_TEST_HOME, 'Use npm test isolated runner');
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Connection', 'close');
    res.setHeader('X-Powered-By', 'FixtureServer/1.2.3');
    res.setHeader('Set-Cookie', 'sessionid=abc123; Path=/');
    res.end('<html><body><form action="/login" method="POST"><input name="username"><input name="password" type="password"></form></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const target = `http://127.0.0.1:${port}/`;
  const scanId = `posture-fixture-${Date.now()}`;
  dbService.insertScan(scanId, target, 'COMPLETED', new Date().toISOString(), { tools: [] });

  try {
    const result = await runHttpPosture(scanId, target);
    assert.equal(result.status, 'COMPLETED');
    const ids = result.findings.map(f => String(f.id));
    for (const expected of [
      'posture-csp-missing',
      'posture-x-frame-options-missing',
      'posture-x-content-type-options-missing',
      'posture-referrer-policy-missing',
      'posture-permissions-policy-missing',
      'posture-version-disclosure',
      'posture-cookie-sessionid-flags'
    ]) {
      assert.ok(ids.includes(expected), `missing posture finding ${expected}`);
    }
    assert.ok(!ids.includes('posture-hsts-missing'), 'HSTS is only applicable to HTTPS targets');

    const csp = dbService.getFindings(scanId).find(f => f.id === 'posture-csp-missing');
    assert.ok(csp);
    assert.match(String(csp.evidence), /http-response/);
    assert.ok(dbService.getObservations(scanId).some(o => o.assetType === 'http-header-x-powered-by'));

    const login = endpointInventory.list(scanId).items.find(e => e.url === `${target}login`);
    assert.ok(login, 'form action must be imported into endpoint inventory');
    assert.equal(login.method, 'POST');
    assert.deepEqual([...login.parameters].sort(), ['password', 'username']);
  } finally {
    dbService.deleteScan(scanId);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('auth profile headers are injected into engine command arguments', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-headers-'));
  const ctx = outcomeFixture(dir, 'nuclei');
  ctx.authHeaders = { Authorization: 'Bearer fixture-token', 'X-API-Key': 'fixture-key' };

  const nuclei = ScannerAdapters.nuclei.getCommandArgs(ctx);
  assert.ok(nuclei.includes('Authorization: Bearer fixture-token'));
  assert.ok(nuclei.includes('X-API-Key: fixture-key'));

  const katana = ScannerAdapters.katana.getCommandArgs(ctx);
  assert.ok(katana.includes('Authorization: Bearer fixture-token'));

  const arjunCtx = { ...ctx, scannerName: 'arjun' };
  const arjun = ScannerAdapters.arjun.getCommandArgs(arjunCtx);
  assert.ok(arjun.includes('--headers'));
  assert.ok(arjun.includes('Authorization: Bearer fixture-token'));

  fs.rmSync(dir, { recursive: true, force: true });
});
