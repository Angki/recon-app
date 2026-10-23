import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { ReportService } from '../electron/services/reportService';
import { dbService } from '../electron/services/database';
import { defaultSelectedTools } from '../src/stores/useScanStore';
import { toolCatalog } from '../electron/services/catalog';

test('Gate Phase 4: SARIF 2.1.0 Spec Compliance & Report Assurance', async (t) => {
  // Set up in-memory DB or temporary test scan
  const testScanId = `test_sarif_scan_${Date.now()}`;
  dbService.insertScan(
    testScanId,
    'https://example-test.local',
    'COMPLETED',
    new Date(Date.now() - 60000).toISOString(),
    { tools: ['nuclei', 'wapiti', 'zap'] }
  );
  for (const engine of ['nuclei', 'wapiti', 'zap', 'sslyze']) {
    dbService.updateScannerStatus(testScanId, engine, 'COMPLETED', { resultCount: 1 });
  }

  // Insert mock findings across all severities
  const mockFindings = [
    {
      id: 'cve-2026-9999',
      name: 'Critical Remote Code Execution',
      severity: 'critical',
      scanner: 'nuclei',
      url: 'https://example-test.local/api/upload',
      description: 'Arbitrary file upload allows code execution'
    },
    {
      id: 'sqli-01',
      name: 'SQL Injection in User Search',
      severity: 'high',
      scanner: 'wapiti',
      url: 'https://example-test.local/search?q=1',
      description: 'Error-based SQL injection'
    },
    {
      id: 'xss-stored',
      name: 'Stored Cross-Site Scripting',
      severity: 'medium',
      scanner: 'zap',
      url: 'https://example-test.local/profile',
      description: 'Unescaped user profile bio'
    },
    {
      id: 'tls-weak',
      name: 'Weak Cipher Supported',
      severity: 'low',
      scanner: 'sslyze',
      url: 'https://example-test.local',
      description: 'CBC cipher suite enabled',
      evidence: { type: 'tls-handshake', protocol: 'TLSv1.0', cipher: 'TLS_RSA_WITH_AES_128_CBC_SHA' }
    },
    {
      id: 'server-fingerprint',
      name: 'Web Server Fingerprinted',
      severity: 'info',
      scanner: 'nuclei',
      url: 'https://example-test.local',
      description: 'nginx/1.24.0 detected'
    }
  ];

  for (const f of mockFindings) {
    dbService.insertFinding(testScanId, f.scanner, f);
  }

  const reportSvc = new ReportService();

  await t.test('generates valid SARIF 2.1.0 document matching OASIS specification', async () => {
    const sarifPath = await reportSvc.exportSarifReport(testScanId);
    assert.equal(fs.existsSync(sarifPath), true, 'SARIF file must exist on disk');

    const raw = fs.readFileSync(sarifPath, 'utf8');
    const sarif = JSON.parse(raw);

    assert.equal(sarif.version, '2.1.0', 'SARIF version must be 2.1.0');
    assert.equal(sarif.$schema.includes('sarif-schema-2.1.0.json'), true, 'Schema must reference 2.1.0 schema');
    assert.equal(Array.isArray(sarif.runs), true);
    assert.equal(sarif.runs.length, 4, 'One SARIF run per reporting engine');

    const runFor = (engine: string) =>
      sarif.runs.find((r: any) => r.tool.driver.name === `SecOps Recon - ${engine}`);
    for (const engine of ['nuclei', 'wapiti', 'zap', 'sslyze']) {
      const run = runFor(engine);
      assert.ok(run, `Missing SARIF run for ${engine}`);
      assert.equal(run.tool.driver.version, '2.0.0');
      assert.equal(run.invocations[0].executionSuccessful, true);
      assert.equal(run.invocations[0].properties.status, 'COMPLETED');
    }

    const allResults = sarif.runs.flatMap((r: any) => r.results);
    const totalRules = sarif.runs.reduce((sum: number, r: any) => sum + r.tool.driver.rules.length, 0);
    assert.equal(totalRules >= 5, true, 'Each unique finding type must have a rule');
    assert.equal(allResults.length, 5);

    const critResult = allResults.find((r: any) => r.ruleId === 'cve-2026-9999');
    assert.ok(critResult);
    assert.equal(critResult.level, 'error', 'Critical severity must map to SARIF level error');

    const highResult = allResults.find((r: any) => r.ruleId === 'sqli-01');
    assert.ok(highResult);
    assert.equal(highResult.level, 'error', 'High severity must map to SARIF level error');

    const medResult = allResults.find((r: any) => r.ruleId === 'xss-stored');
    assert.ok(medResult);
    assert.equal(medResult.level, 'warning', 'Medium severity must map to SARIF level warning');

    const lowResult = allResults.find((r: any) => r.ruleId === 'tls-weak');
    assert.ok(lowResult);
    assert.equal(lowResult.level, 'warning', 'Low severity must map to SARIF level warning');

    const infoResult = allResults.find((r: any) => r.ruleId === 'server-fingerprint');
    assert.ok(infoResult);
    assert.equal(infoResult.level, 'note', 'Info severity must map to SARIF level note');

    // Clean up test file
    fs.unlinkSync(sarifPath);
  });

  await t.test('HTML report includes @media print CSS layout and methodology disclosures', async () => {
    const htmlPath = await reportSvc.generateHtmlReport(testScanId);
    assert.equal(fs.existsSync(htmlPath), true);

    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.equal(html.includes('@media print'), true, 'HTML report must include @media print CSS for PDF printing');
    assert.equal(html.includes('page-break-inside: avoid'), true, 'Finding cards must avoid page break splitting');
    assert.equal(html.includes('Scoring Notice'), true, 'HTML report must explain the internal Risk Score heuristic');
    assert.equal(html.includes('distinct from official CVSS, EPSS'), true, 'Must not claim weighted count is CVSS');
    assert.equal(html.includes('Engine Coverage Matrix'), true, 'HTML must expose per-engine coverage and reasons');
    assert.equal(html.includes('Coverage Posture'), true, 'HTML must summarize degraded/skipped coverage');
    assert.equal(html.includes('HTTP Evidence'), true, 'HTML must render stored finding evidence');

    fs.unlinkSync(htmlPath);
  });

  await t.test('Markdown and JSON exports include score heuristic disclosures', async () => {
    const mdPath = await reportSvc.generateMarkdownReport(testScanId);
    const jsonPath = await reportSvc.exportJsonReport(testScanId);

    const md = fs.readFileSync(mdPath, 'utf8');
    assert.equal(md.includes('Risk Score is an internal operational index'), true);
    assert.equal(md.includes('## Engine Coverage Matrix'), true);
    assert.equal(md.toLowerCase().includes('**evidence:**'), true);

    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.ok(json.scoringNotice);
    assert.equal(json.scoringNotice.includes('not an official CVSS or EPSS metric'), true);

    fs.unlinkSync(mdPath);
    fs.unlinkSync(jsonPath);
  });

  await t.test('Non-existent scan throws clear error instead of fabricating clean report', async () => {
    await assert.rejects(
      async () => reportSvc.compileReportData('non_existent_scan_12345'),
      /Scan not found/
    );
  });
});

test('Gate Phase 4: UX Defaults & Commercial Tool Separation', async (t) => {
  await t.test('Default selected tools is conservative and excludes commercial tools', () => {
    assert.equal(Array.isArray(defaultSelectedTools), true);
    assert.equal(defaultSelectedTools.length <= 3, true, 'Default tool selection must be conservative (<= 3 tools)');
    assert.equal(defaultSelectedTools.includes('appscan'), false, 'AppScan must NOT be selected by default');
    assert.equal(defaultSelectedTools.includes('netsparker'), false, 'Netsparker must NOT be selected by default');
    assert.equal(defaultSelectedTools.includes('acunetix'), false, 'Acunetix must NOT be selected by default');
  });

  await t.test('Catalog default selected tools excludes all commercial tools', () => {
    const catalogDefaults = toolCatalog.getDefaultSelectedTools();
    assert.equal(catalogDefaults.includes('appscan'), false);
    assert.equal(catalogDefaults.includes('netsparker'), false);
    assert.equal(catalogDefaults.includes('acunetix'), false);
  });
});
