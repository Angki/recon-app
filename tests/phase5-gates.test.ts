import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ScannerAdapters } from '../electron/services/scanners/registry';
import { toolCatalog } from '../electron/services/catalog';
import type { ScannerContext } from '../electron/services/scanners/types';

function createMockContext(scannerName: string, jsonFileName: string): { ctx: ScannerContext; tmpDir: string; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `test_scanner_${scannerName}_`));
  const jsonFile = path.join(tmpDir, jsonFileName);
  const outputFile = path.join(tmpDir, `${scannerName}_out.txt`);

  const ctx: ScannerContext = {
    scanId: 'test_scan_p5',
    targetUrl: 'https://scan-target.local',
    domain: 'scan-target.local',
    scannerName,
    bin: `${scannerName}.exe`,
    outDir: tmpDir,
    timestamp: '20261015_200000',
    outputFile,
    jsonFile,
    xmlFile: path.join(tmpDir, `${scannerName}.xml`),
    sender: {} as any,
    settings: {}
  };

  const cleanup = () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };

  return { ctx, tmpDir, cleanup };
}

test('Gate Phase 5: Deepened OWASP ZAP Adapter & Automation Framework', async (t) => {
  const zap = ScannerAdapters.zap;
  assert.ok(zap, 'ZAP adapter must be registered');

  await t.test('generates Automation Framework args when zapAutomationPlan is specified', () => {
    const { ctx, cleanup } = createMockContext('zap', 'zap.json');
    ctx.config = { zapAutomationPlan: 'C:/configs/zap-plan.yaml' };
    const args = zap.getCommandArgs(ctx);

    assert.equal(args.includes('-autorun'), true);
    assert.equal(args.includes('C:/configs/zap-plan.yaml'), true);
    cleanup();
  });

  await t.test('generates OpenAPI import args when openapiUrl is specified', () => {
    const { ctx, cleanup } = createMockContext('zap', 'zap.json');
    ctx.config = { openapiUrl: 'https://scan-target.local/swagger.json' };
    const args = zap.getCommandArgs(ctx);

    assert.equal(args.includes('-openapifile'), true);
    assert.equal(args.includes('https://scan-target.local/swagger.json'), true);
    cleanup();
  });

  await t.test('parses multi-site, multi-instance alerts with CWE and confidence', () => {
    const { ctx, cleanup } = createMockContext('zap', 'zap.json');

    const zapJson = {
      site: [
        {
          '@name': 'https://site-a.local',
          alerts: [
            {
              pluginid: '40012',
              alert: 'Cross Site Scripting (Reflected)',
              riskdesc: 'High (Medium)',
              desc: 'XSS vulnerability in query parameter',
              cweid: '79',
              wascid: '8',
              solution: 'Context-aware output encoding',
              confidence: 'High',
              instances: [
                {
                  uri: 'https://site-a.local/search?q=test',
                  param: 'q',
                  method: 'GET',
                  evidence: '<script>alert(1)</script>'
                }
              ]
            }
          ]
        },
        {
          '@name': 'https://site-b.local',
          alerts: [
            {
              pluginid: '10020',
              alert: 'Anti-CSRF Tokens Missing',
              riskdesc: 'Medium (High)',
              desc: 'Form lacks CSRF protection',
              cweid: '352',
              instances: [
                {
                  uri: 'https://site-b.local/form',
                  method: 'POST'
                }
              ]
            }
          ]
        }
      ]
    };

    fs.writeFileSync(ctx.jsonFile, JSON.stringify(zapJson), 'utf8');
    const findings = zap.parseFindings!(ctx);

    assert.equal(findings.length, 2, 'Must parse findings across all sites');

    const xss = findings[0];
    assert.equal(xss.id, 'zap-40012');
    assert.equal(xss.severity, 'high');
    assert.equal(xss.cwe, 'CWE-79');
    assert.equal(xss.url, 'https://site-a.local/search?q=test');
    assert.equal(xss.param, 'q');
    assert.equal(xss.remediation, 'Context-aware output encoding');

    const csrf = findings[1];
    assert.equal(csrf.id, 'zap-10020');
    assert.equal(csrf.severity, 'medium');
    assert.equal(csrf.cwe, 'CWE-352');
    assert.equal(csrf.url, 'https://site-b.local/form');

    cleanup();
  });

  await t.test('handles empty and malformed ZAP json gracefully', () => {
    const { ctx, cleanup } = createMockContext('zap', 'zap.json');
    fs.writeFileSync(ctx.jsonFile, '{ not valid json', 'utf8');
    assert.doesNotThrow(() => {
      const res = zap.parseFindings!(ctx);
      assert.deepEqual(res, []);
    });
    cleanup();
  });
});

test('Gate Phase 5: SSLyze TLS Audit Adapter', async (t) => {
  const sslyze = ScannerAdapters.sslyze;
  assert.ok(sslyze, 'SSLyze adapter must be registered');

  await t.test('generates expected command line arguments', () => {
    const { ctx, cleanup } = createMockContext('sslyze', 'sslyze.json');
    const args = sslyze.getCommandArgs(ctx);
    assert.equal(args.includes('--json_out'), true);
    assert.equal(args.includes(ctx.jsonFile), true);
    assert.equal(args.includes(ctx.domain), true);
    cleanup();
  });

  await t.test('parses expired certificates, insecure protocols, and ROBOT attacks', () => {
    const { ctx, cleanup } = createMockContext('sslyze', 'sslyze.json');

    const sslyzeFixture = {
      server_scan_results: [
        {
          server_location: { hostname: 'scan-target.local' },
          scan_commands_results: {
            certificate_info: {
              certificate_deployments: [
                {
                  path_validation_results: [
                    { was_validation_successful: false, openssl_error_string: 'self signed certificate' }
                  ],
                  received_certificate_chain: [
                    { not_valid_after: '2020-01-01T00:00:00Z' }
                  ]
                }
              ]
            },
            ssl_2_0_cipher_suites: { ciphers_supported: ['SSL_CK_RC4_128_WITH_MD5'] },
            tls_1_0_cipher_suites: { ciphers_supported: ['TLS_RSA_WITH_AES_128_CBC_SHA'] },
            robot: { robot_result: 'VULNERABLE_WEAK_ORACLES' }
          }
        }
      ]
    };

    fs.writeFileSync(ctx.jsonFile, JSON.stringify(sslyzeFixture), 'utf8');
    const findings = sslyze.parseFindings!(ctx);

    assert.equal(findings.length >= 4, true, 'Must identify cert issues, insecure SSL 2.0, legacy TLS 1.0, and ROBOT');

    const certUntrusted = findings.find(f => f.id === 'sslyze-invalid-certificate');
    assert.ok(certUntrusted);
    assert.equal(certUntrusted.severity, 'high');

    const certExpired = findings.find(f => f.id === 'sslyze-expired-certificate');
    assert.ok(certExpired);
    assert.equal(certExpired.severity, 'high');

    const ssl2 = findings.find(f => f.id === 'sslyze-ssl-2-0-enabled');
    assert.ok(ssl2);
    assert.equal(ssl2.severity, 'high');

    const robot = findings.find(f => f.id === 'sslyze-robot-vulnerable');
    assert.ok(robot);
    assert.equal(robot.severity, 'high');

    cleanup();
  });

  await t.test('handles empty output cleanly without errors', () => {
    const { ctx, cleanup } = createMockContext('sslyze', 'sslyze.json');
    fs.writeFileSync(ctx.jsonFile, '', 'utf8');
    const findings = sslyze.parseFindings!(ctx);
    assert.deepEqual(findings, []);
    cleanup();
  });
});

test('Gate Phase 5: Gitleaks Secret Auditing Adapter', async (t) => {
  const gitleaks = ScannerAdapters.gitleaks;
  assert.ok(gitleaks, 'Gitleaks adapter must be registered');

  await t.test('enforces --redact flag in command line to protect secrets in flight', () => {
    const { ctx, cleanup } = createMockContext('gitleaks', 'gitleaks.json');
    const args = gitleaks.getCommandArgs(ctx);
    assert.equal(args.includes('--redact'), true, 'Gitleaks command must enforce --redact flag');
    assert.equal(args.includes('--report-format'), true);
    cleanup();
  });

  await t.test('parses exposed secrets and preserves redaction in descriptions', () => {
    const { ctx, cleanup } = createMockContext('gitleaks', 'gitleaks.json');

    const gitleaksFixture = [
      {
        RuleID: 'aws-access-key-id',
        Description: 'AWS Access Key ID',
        StartLine: 42,
        File: 'config/aws.ts',
        Match: 'REDACTED',
        Secret: 'REDACTED',
        Commit: '38a9d12'
      },
      {
        RuleID: 'generic-api-key',
        Description: 'Generic API Key',
        StartLine: 10,
        File: 'src/analytics.js',
        Match: 'REDACTED',
        Secret: 'REDACTED',
        Commit: 'ff02b91'
      }
    ];

    fs.writeFileSync(ctx.jsonFile, JSON.stringify(gitleaksFixture), 'utf8');
    const findings = gitleaks.parseFindings!(ctx);

    assert.equal(findings.length, 2);

    const aws = findings[0];
    assert.equal(aws.id, 'gitleaks-aws-access-key-id');
    assert.equal(aws.severity, 'critical', 'Cloud keys must be critical');
    assert.equal(aws.url, 'file://config/aws.ts#L42');
    assert.equal(aws.description.includes('redacted for confidentiality'), true);

    const generic = findings[1];
    assert.equal(generic.id, 'gitleaks-generic-api-key');
    assert.equal(generic.severity, 'high');
    assert.equal(generic.url, 'file://src/analytics.js#L10');

    cleanup();
  });

  await t.test('exit code 1 is treated as successful scan completion (leaks found)', () => {
    const { ctx, cleanup } = createMockContext('gitleaks', 'gitleaks.json');
    assert.equal(gitleaks.isSuccessExitCode!(0, ctx), true);
    assert.equal(gitleaks.isSuccessExitCode!(1, ctx), true);
    assert.equal(gitleaks.isSuccessExitCode!(2, ctx), false);
    cleanup();
  });
});

test('Gate Phase 5: Semgrep Static Code Analysis Adapter', async (t) => {
  const semgrep = ScannerAdapters.semgrep;
  assert.ok(semgrep, 'Semgrep adapter must be registered');

  await t.test('parses SAST vulnerabilities with CWE metadata and file locations', () => {
    const { ctx, cleanup } = createMockContext('semgrep', 'semgrep.json');

    const semgrepFixture = {
      results: [
        {
          check_id: 'rules.security.sql-injection',
          path: 'backend/api/users.py',
          start: { line: 88, col: 12 },
          extra: {
            message: 'Direct SQL query construction with untrusted parameter.',
            severity: 'ERROR',
            metadata: {
              cwe: ['CWE-89'],
              remediation: 'Use parameterized queries or ORM functions.'
            }
          }
        },
        {
          check_id: 'rules.security.weak-crypto',
          path: 'common/crypto.py',
          start: { line: 15, col: 4 },
          extra: {
            message: 'Use of MD5 hashing algorithm.',
            severity: 'WARNING',
            metadata: {
              cwe: ['CWE-327']
            }
          }
        }
      ]
    };

    fs.writeFileSync(ctx.jsonFile, JSON.stringify(semgrepFixture), 'utf8');
    const findings = semgrep.parseFindings!(ctx);

    assert.equal(findings.length, 2);

    const sqli = findings[0];
    assert.equal(sqli.id, 'semgrep-rules.security.sql-injection');
    assert.equal(sqli.severity, 'high', 'Semgrep ERROR must map to high');
    assert.equal(sqli.url, 'file://backend/api/users.py#L88');
    assert.equal(sqli.cwe, 'CWE-89');
    assert.equal(sqli.remediation, 'Use parameterized queries or ORM functions.');

    const weakCrypto = findings[1];
    assert.equal(weakCrypto.severity, 'medium', 'Semgrep WARNING must map to medium');
    assert.equal(weakCrypto.cwe, 'CWE-327');

    cleanup();
  });
});

test('Gate Phase 5: Trivy Dependency & Misconfiguration Adapter', async (t) => {
  const trivy = ScannerAdapters.trivy;
  assert.ok(trivy, 'Trivy adapter must be registered');

  await t.test('parses package CVEs and IaC misconfigurations', () => {
    const { ctx, cleanup } = createMockContext('trivy', 'trivy.json');

    const trivyFixture = {
      Results: [
        {
          Target: 'package-lock.json',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2026-1001',
              PkgName: 'axios',
              InstalledVersion: '0.21.1',
              FixedVersion: '0.21.2',
              Severity: 'HIGH',
              Title: 'Server-Side Request Forgery in Axios',
              Description: 'SSRF vulnerability allowed via redirect bypass.',
              PrimaryURL: 'https://avd.aquasec.com/nvd/cve-2026-1001',
              CweIDs: ['CWE-918']
            }
          ]
        },
        {
          Target: 'Dockerfile',
          Misconfigurations: [
            {
              ID: 'DS002',
              Title: 'Image user should not be root',
              Description: 'Running containers as root poses container breakout risk.',
              Severity: 'MEDIUM',
              Resolution: 'Add USER appuser to Dockerfile'
            }
          ]
        }
      ]
    };

    fs.writeFileSync(ctx.jsonFile, JSON.stringify(trivyFixture), 'utf8');
    const findings = trivy.parseFindings!(ctx);

    assert.equal(findings.length, 2);

    const cve = findings[0];
    assert.equal(cve.id, 'CVE-2026-1001');
    assert.equal(cve.severity, 'high');
    assert.equal(cve.cwe, 'CWE-918');
    assert.equal(cve.cve, 'CVE-2026-1001');
    assert.equal(cve.remediation, 'Upgrade axios to version 0.21.2 or later.');

    const misconfig = findings[1];
    assert.equal(misconfig.id, 'DS002');
    assert.equal(misconfig.severity, 'medium');
    assert.equal(misconfig.remediation, 'Add USER appuser to Dockerfile');

    cleanup();
  });
});

test('Gate Phase 5: Tool Catalog Manifests Verification', async (t) => {
  await t.test('all Phase 5 tools are declared in tool catalog with complete manifests', () => {
    const tools = ['sslyze', 'gitleaks', 'semgrep', 'trivy'];
    for (const toolId of tools) {
      const manifest = toolCatalog.getManifest(toolId);
      assert.ok(manifest, `Tool ${toolId} must have manifest in catalog`);
      assert.ok(manifest.displayName);
      assert.ok(manifest.category);
      assert.ok(manifest.sourceUrl);
      assert.ok(manifest.installStrategy);
      assert.ok(manifest.exitCodeSemantics);
      assert.equal(!!manifest.isCommercial, false, `${toolId} is open-source/community tool`);
    }
  });
});
