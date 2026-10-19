import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { toolCatalog } from '../electron/services/catalog';
import { getAdapter, parseInteractsh } from '../electron/services/scanners/registry';
import { dbService } from '../electron/services/database';
import type { ScannerContext } from '../electron/services/scanners/types';
import type Electron from 'electron';

function createMockContext(scannerName: string, targetUrl = 'https://sso.test.local/'): { ctx: ScannerContext; tmpDir: string; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `test_lifecycle_${scannerName}_`));
  const outputFile = path.join(tmpDir, `${scannerName}_out.txt`);
  const jsonFile = path.join(tmpDir, `${scannerName}_out.json`);
  const xmlFile = path.join(tmpDir, `${scannerName}_out.xml`);

  const ctx: ScannerContext = {
    scanId: `test_scan_${Date.now()}`,
    targetUrl,
    domain: 'sso.test.local',
    scannerName,
    bin: `${scannerName}.exe`,
    outDir: tmpDir,
    timestamp: '20261019_120000',
    outputFile,
    jsonFile,
    xmlFile,
    config: {},
    sender: { isDestroyed: () => false, send: () => {} } as unknown as Electron.WebContents,
    settings: {}
  };

  const cleanup = () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  };

  return { ctx, tmpDir, cleanup };
}

test('Lifecycle & Resilience Suite: Wapiti Enhanced Parser & Classification Resolution', async (t) => {
  const wapitiAdapter = getAdapter('wapiti');
  assert.ok(wapitiAdapter, 'Wapiti adapter must be registered');

  await t.test('resolves relative URLs to target origin and extracts official remediation & WSTG from classifications', () => {
    const { ctx, cleanup } = createMockContext('wapiti', 'https://sso.bkpsdmd.makassarkota.go.id');
    try {
      const mockWapitiReport = {
        classifications: {
          'CSP': {
            desc: 'Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks.',
            sol: 'Configure a Content-Security-Policy header with restrictive directives (e.g., default-src \'self\').',
            wstg: ['WSTG-CONF-06']
          },
          'HttpOnly Flag': {
            desc: 'Cookie without HttpOnly flag set can be accessed by client scripts.',
            sol: 'Set the HttpOnly flag on all sensitive session cookies.',
            wstg: ['WSTG-SESS-02']
          }
        },
        vulnerabilities: {
          'CSP': [
            {
              path: '/',
              method: 'GET',
              info: 'CSP header missing on login gateway',
              level: 1,
              http_status: 200,
              module: 'mod_csp'
            }
          ],
          'HttpOnly Flag': [
            {
              path: '/auth/login',
              method: 'POST',
              info: 'Cookie "session_id" is missing the HttpOnly flag',
              level: 2,
              http_status: 302,
              module: 'mod_cookie'
            }
          ]
        }
      };

      fs.writeFileSync(ctx.jsonFile, JSON.stringify(mockWapitiReport, null, 2), 'utf-8');
      const findings = wapitiAdapter.parseFindings(ctx);

      assert.equal(findings.length, 2, 'Must parse both CSP and HttpOnly vulnerabilities');

      const cspFinding = findings.find(f => f.name.includes('CSP'));
      assert.ok(cspFinding, 'Must identify CSP finding');
      assert.equal(cspFinding.url, 'https://sso.bkpsdmd.makassarkota.go.id/', 'Relative path "/" must be resolved to absolute target origin');
      assert.ok(cspFinding.remediation?.includes('Content-Security-Policy'), 'Must extract official remediation from classifications');
      assert.equal(cspFinding.wstg, 'WSTG-CONF-06', 'Must assign official WSTG code');

      const cookieFinding = findings.find(f => f.name.includes('HttpOnly'));
      assert.ok(cookieFinding, 'Must identify HttpOnly finding');
      assert.equal(cookieFinding.url, 'https://sso.bkpsdmd.makassarkota.go.id/auth/login', 'Relative path "/auth/login" must be resolved to absolute URL');
      assert.equal(cookieFinding.wstg, 'WSTG-SESS-02', 'Must assign WSTG-SESS-02');
      assert.ok(cookieFinding.remediation?.includes('Set the HttpOnly flag'));
    } finally {
      cleanup();
    }
  });

  await t.test('Wapiti exit codes treat 0 (clean) and 2 (findings detected) as success', () => {
    assert.equal(wapitiAdapter.isSuccessExitCode?.(0), true, 'Exit code 0 is success (clean)');
    assert.equal(wapitiAdapter.isSuccessExitCode?.(2), true, 'Exit code 2 is success (vulnerabilities found)');
    assert.equal(wapitiAdapter.isSuccessExitCode?.(1), false, 'Exit code 1 is a crash or configuration error');
  });
});

test('Lifecycle & Resilience Suite: Schemathesis Non-API Graceful Recovery', async (t) => {
  const schemathesisAdapter = getAdapter('schemathesis');
  assert.ok(schemathesisAdapter, 'Schemathesis adapter must be registered');

  await t.test('converts Schema Loading Error into informative discovery finding', () => {
    const { ctx, cleanup } = createMockContext('schemathesis', 'https://sso.test.local/login.html');
    try {
      const mockSchemaError = {
        exit_code: 2,
        stop_reason: 'error',
        errors: [
          {
            title: 'Schema Loading Error',
            message: 'Failed to load specification from https://sso.test.local/login.html'
          }
        ],
        events: []
      };

      fs.writeFileSync(ctx.jsonFile, JSON.stringify(mockSchemaError, null, 2), 'utf-8');
      const findings = schemathesisAdapter.parseFindings(ctx);

      assert.equal(findings.length, 1, 'Must return informative schema notice finding');
      assert.equal(findings[0].id, 'schemathesis-no-schema');
      assert.equal(findings[0].severity, 'info');
      assert.ok(findings[0].description.includes('OpenAPI/Swagger'));
      assert.ok(findings[0].remediation.includes('schema URL'));
    } finally {
      cleanup();
    }
  });

  await t.test('exit code contract enforces 0 and 1 as success, and 2 as non-success prior to rescue', () => {
    assert.equal(schemathesisAdapter.isSuccessExitCode?.(0), true);
    assert.equal(schemathesisAdapter.isSuccessExitCode?.(1), true);
    assert.equal(schemathesisAdapter.isSuccessExitCode?.(2), false);
  });
});

test('Lifecycle & Resilience Suite: Interactsh Banner Skipping & Strict Redaction', async (t) => {
  const { ctx, cleanup } = createMockContext('interactsh', 'https://target.test.local');
  try {
    const simulatedInteractshStream = [
      '    _       __                       __       __ ',
      '   (_)___  / /____  _________ ______/ /______/ /_',
      '  / / __ \\/ __/ _ \\/ ___/ __ `/ ___/ __/ ___/ __ \\',
      ' / / / / / /_/  __/ /  / /_/ / /__/ /_(__  ) / / /',
      '/_/_/ /_/\\__/\\___/_/   \\__,_/\\___/\\__/____/_/ /_/ ',
      '[INF] interactsh-client v1.2.2 started',
      '[INF] Listening for incoming interactions on *.interact.sh...',
      '{"protocol":"dns","unique-id":"sess-xyz-01","full-id":"sess-xyz-01.interact.sh","raw-request":"DNS query A","remote-address":"203.0.113.195","timestamp":"2026-10-19T10:00:00Z"}',
      '{"protocol":"http","unique-id":"sess-xyz-02","full-id":"sess-xyz-02.interact.sh","raw-request":"GET /callback HTTP/1.1\\r\\nHost: test\\r\\nAuthorization: Bearer secret-jwt-123\\r\\nCookie: sessionid=secret-cookie-456\\r\\n\\r\\n","remote-address":"203.0.113.195","timestamp":"2026-10-19T10:00:05Z"}'
    ].join('\n');

    const findings = parseInteractsh(simulatedInteractshStream, ctx);
    assert.equal(findings.length, 2, 'Must safely skip ASCII logos and [INF] banners while parsing both JSON events');

    const dnsFinding = findings[0];
    assert.equal(dnsFinding.cwe, 'CWE-918');
    assert.equal((dnsFinding.evidence as any).remoteAddress, '[REDACTED_IP]');

    const httpFinding = findings[1];
    const snippet = (httpFinding.evidence as any).rawRequestSnippet;
    assert.ok(snippet.includes('Authorization: [REDACTED]'));
    assert.ok(snippet.includes('Cookie: [REDACTED]'));
    assert.ok(!snippet.includes('secret-jwt-123'));
    assert.ok(!snippet.includes('secret-cookie-456'));

    // Malformed JSON starting with { must throw descriptive exception
    assert.throws(
      () => parseInteractsh('{"protocol": broken-json-syntax', ctx),
      /Malformed Interactsh JSON/
    );
  } finally {
    cleanup();
  }
});

test('Lifecycle & Resilience Suite: SSLyze Catalog Success Exit Codes', () => {
  const sslyzeManifest = toolCatalog.get('sslyze');
  assert.ok(sslyzeManifest, 'SSLyze must exist in catalog');
  const successCodes = sslyzeManifest.exitCodeSemantics?.successCodes || [];
  assert.ok(successCodes.includes(0), 'Code 0 must be success');
  assert.ok(successCodes.includes(1), 'Code 1 (deprecated TLS detected) must be accepted as success');
  assert.ok(successCodes.includes(2), 'Code 2 (weak ciphers detected) must be accepted as success');
});

test('Lifecycle & Resilience Suite: Database AI Multi-Preset Persistence & Retrieval', () => {
  const scanId = `test_ai_preset_suite_${Date.now()}`;
  dbService.insertScan(scanId, 'https://test.local', 'COMPLETED', new Date().toISOString(), {});

  const presets = ['executive', 'attack_path', 'remediation', 'verification'] as const;
  const baseTime = Date.now();

  presets.forEach((preset, idx) => {
    dbService.insertAiAnalysis({
      id: `ai_${scanId}_${preset}`,
      scanId,
      preset,
      provider: 'ollama',
      model: 'recon-analyst:latest',
      analysisText: `Comprehensive AI Analysis for preset: ${preset.toUpperCase()}`,
      createdAt: new Date(baseTime + idx * 1000).toISOString()
    });
  });

  const allAnalyses = dbService.getAiAnalyses(scanId);
  assert.equal(allAnalyses.length, 4, 'Must persist all 4 distinct AI presets');

  for (const preset of presets) {
    const match = allAnalyses.find(a => a.preset === preset);
    assert.ok(match, `Must find saved analysis for preset ${preset}`);
    assert.ok(match.analysisText.includes(preset.toUpperCase()));
    assert.equal(match.model, 'recon-analyst:latest');
    assert.ok(match.createdAt, 'Must have timestamp');
  }

  const latest = dbService.getLatestAiAnalysis(scanId);
  assert.ok(latest, 'Must return the latest analysis');
  assert.equal(latest.preset, 'verification', 'Latest should be the last inserted preset');
});
