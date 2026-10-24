import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAdapter, hasAdapter } from '../electron/services/scanners/registry';
import { LoggerService } from '../electron/services/logger';
import { settingsStore, MASKED_SENTINEL } from '../electron/services/settings';
import { ToolManager } from '../electron/services/toolManager';
import { InstallerError } from '../electron/services/platform/installer';
import { pythonVenv } from '../electron/services/platform/pythonVenv';
import type { ScannerContext } from '../electron/services/scanners/types';
import type Electron from 'electron';

function createContext(scannerName: string): { ctx: ScannerContext; dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `recon-trust-${scannerName}-`));
  const ctx: ScannerContext = {
    scanId: `trust_${scannerName}`,
    targetUrl: 'https://example.test/',
    domain: 'example.test',
    scannerName,
    bin: `${scannerName}.exe`,
    outDir: dir,
    timestamp: '20261022_120000',
    outputFile: path.join(dir, 'out.txt'),
    jsonFile: path.join(dir, 'out.json'),
    xmlFile: path.join(dir, 'out.xml'),
    settings: {},
    sender: { isDestroyed: () => false, send: () => {} } as unknown as Electron.WebContents,
  };
  return {
    ctx,
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('getAdapter refuses unknown and prototype-derived scanner names', () => {
  assert.equal(hasAdapter('nuclei'), true);
  assert.equal(hasAdapter('not-a-real-tool'), false);
  assert.equal(hasAdapter('__proto__'), false);

  assert.throws(
    () => getAdapter('not-a-real-tool'),
    /No scanner adapter registered/i
  );
  assert.throws(
    () => getAdapter('__proto__'),
    /No scanner adapter registered/i
  );
});

test('Acunetix parser fails closed on a missing artifact', () => {
  const { ctx, cleanup } = createContext('acunetix');
  try {
    const adapter = getAdapter('acunetix');
    assert.throws(
      () => adapter.parseFindings?.(ctx),
      /artifact missing/i
    );
  } finally {
    cleanup();
  }
});

test('Acunetix parser rejects the runner inconclusive sentinel instead of reporting clean', () => {
  const { ctx, cleanup } = createContext('acunetix');
  try {
    fs.writeFileSync(ctx.jsonFile, JSON.stringify({
      __recon_error: true,
      code: 'ACUNETIX_VULN_FETCH_FAILED',
      message: 'Failed to fetch vulnerabilities JSON: socket hang up',
    }));

    const adapter = getAdapter('acunetix');
    assert.throws(
      () => adapter.parseFindings?.(ctx),
      /inconclusive \(ACUNETIX_VULN_FETCH_FAILED\).*socket hang up/i
    );
  } finally {
    cleanup();
  }
});

test('Acunetix parser rejects non-array documents', () => {
  const { ctx, cleanup } = createContext('acunetix');
  try {
    fs.writeFileSync(ctx.jsonFile, JSON.stringify({ vulnerabilities: [] }));
    const adapter = getAdapter('acunetix');
    assert.throws(
      () => adapter.parseFindings?.(ctx),
      /not a vulnerability array/i
    );
  } finally {
    cleanup();
  }
});

test('Acunetix parser maps a valid vulnerability array', () => {
  const { ctx, cleanup } = createContext('acunetix');
  try {
    fs.writeFileSync(ctx.jsonFile, JSON.stringify([
      { vt_id: 'vt-1', vt_name: 'SQL Injection', severity: 3, affects_url: 'https://example.test/?id=1', tags: ['sqli'] },
    ]));
    const adapter = getAdapter('acunetix');
    const findings = adapter.parseFindings?.(ctx) || [];
    assert.equal(findings.length, 1);
    assert.equal(findings[0].name, 'SQL Injection');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].scanner, 'acunetix');
  } finally {
    cleanup();
  }
});

test('Acunetix runner cannot produce a false clean result', () => {
  const runnerPath = path.join(process.cwd(), 'electron', 'scripts', 'acunetix_runner.js');
  const source = fs.readFileSync(runnerPath, 'utf-8');

  assert.match(source, /ACUNETIX_SCAN_NOT_COMPLETED/, 'failed/aborted scans must be marked inconclusive');
  assert.match(source, /ACUNETIX_MISSING_RESULT_SESSION/, 'missing result session must be marked inconclusive');
  assert.match(source, /ACUNETIX_VULN_FETCH_FAILED/, 'vulnerability fetch failures must be marked inconclusive');
  assert.match(source, /writeInconclusive\(/, 'runner must persist a sentinel the adapter can reject');
  assert.doesNotMatch(
    source,
    /catch\s*\(\s*err\s*\)\s*\{[^}]*fs\.writeFileSync\(\s*jsonFile\s*,\s*["']\[\]["']\s*\)/s,
    'vulnerability fetch errors must not be converted into an empty clean result'
  );
});

test('Netsparker adapter propagates the child process exit code and fails closed without XML', () => {
  const { ctx, cleanup } = createContext('netsparker');
  try {
    const adapter = getAdapter('netsparker');
    const options = adapter.getProcessOptions?.(ctx, {
      executable: ctx.bin,
      args: ['/a', '/url', ctx.targetUrl, '/r', ctx.xmlFile],
      useShell: false,
      cwd: ctx.outDir,
    });

    assert.equal(options?.executable, 'powershell.exe');
    const encoded = options?.args[options.args.indexOf('-EncodedCommand') + 1];
    assert.ok(encoded, 'encoded PowerShell command must be present');
    const script = Buffer.from(encoded, 'base64').toString('utf16le');
    assert.match(script, /exit \$p\.ExitCode/, 'wrapper must return the child exit code');

    assert.throws(
      () => adapter.parseFindings?.(ctx),
      /artifact missing/i
    );
  } finally {
    cleanup();
  }
});

test('LoggerService redacts CLI secret flags and URL credentials', () => {
  const raw = [
    'wpscan --api-token SUPER_SECRET_WPSCAN',
    'interactsh -token SUPER_SECRET_OOB',
    'target https://admin:SUPER_SECRET_PASSWORD@example.test/',
    'nuclei --header "Authorization: Bearer SUPER_SECRET_BEARER"',
  ].join('\n');

  const redacted = LoggerService.redactSensitive(raw);
  assert.ok(!redacted.includes('SUPER_SECRET_WPSCAN'), 'wpscan token must be redacted');
  assert.ok(!redacted.includes('SUPER_SECRET_OOB'), 'interactsh token must be redacted');
  assert.ok(!redacted.includes('SUPER_SECRET_PASSWORD'), 'URL password must be redacted');
  assert.ok(!redacted.includes('SUPER_SECRET_BEARER'), 'bearer token must be redacted');
});

test('settings getPublic masks the interactsh token', () => {
  const previous = settingsStore.get().interactshToken || '';
  try {
    settingsStore.save({ interactshToken: 'interactsh-secret-value' });
    const pub = settingsStore.getPublic();
    assert.equal(pub.interactshToken, MASKED_SENTINEL);
    assert.equal(pub.hasInteractshToken, true);
    assert.ok(!JSON.stringify(pub).includes('interactsh-secret-value'));
  } finally {
    settingsStore.save({ interactshToken: previous });
  }
});

test('destructive tool operations reject unmanaged ids and escaped virtualenv paths', () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-bin-'));
  const manager = new ToolManager(binDir);
  try {
    for (const badId of ['..\\..\\Windows\\System32\\cmd', '../../etc/passwd', '__proto__', 'unknown-tool']) {
      assert.throws(
        () => manager.uninstallTool(badId),
        (err: unknown) => err instanceof InstallerError && err.code === 'UNKNOWN_TOOL',
        `uninstall must reject '${badId}'`
      );
      assert.throws(
        () => manager.rollbackTool(badId),
        (err: unknown) => err instanceof InstallerError && err.code === 'UNKNOWN_TOOL',
        `rollback must reject '${badId}'`
      );
    }

    assert.throws(
      () => pythonVenv.getVenvDir('../escape'),
      /Invalid tool id/i
    );
    assert.equal(
      path.dirname(pythonVenv.getVenvDir('nuclei')),
      pythonVenv.getVenvRoot()
    );
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});
