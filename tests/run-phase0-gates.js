const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

app.whenReady().then(async () => {
  console.log('\n========================================');
  console.log('   RUNNING PHASE 0 GATE VERIFICATIONS');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function runAsyncTest(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  const { ScannerAdapters } = require('../electron/services/scanners/registry');
  const { reportService } = require('../electron/services/reportService');
  const { storage } = require('../electron/services/storage');
  const { scannerService } = require('../electron/services/scanner');
  const { dbService } = require('../electron/services/database');

  // --- GATE 1: Nuclei Parser (R01) ---
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-test-'));
  const nucleiJson = path.join(tmpDir, 'nuclei.json');
  const mockCtx = {
    scanId: 'test-scan-gate',
    targetUrl: 'https://testphp.vulnweb.com',
    domain: 'testphp.vulnweb.com',
    scannerName: 'nuclei',
    bin: 'nuclei',
    outDir: tmpDir,
    timestamp: '20261015',
    outputFile: path.join(tmpDir, 'out.txt'),
    jsonFile: nucleiJson,
    xmlFile: path.join(tmpDir, 'out.xml'),
    sender: { isDestroyed: () => false, send: () => {} },
    settings: {}
  };

  runTest('Gate 1.1: Nuclei parser handles standard JSONL without data loss', () => {
    const jsonl = [
      JSON.stringify({
        'template-id': 'cve-2023-1234',
        info: { name: 'Remote Code Execution', severity: 'high', description: 'RCE vuln' },
        'matched-at': 'https://testphp.vulnweb.com/rce',
        timestamp: '2026-10-15T12:00:00Z'
      }),
      JSON.stringify({
        'template-id': 'tech-nginx',
        info: { name: 'Nginx Detect', severity: 'info' },
        'matched-at': 'https://testphp.vulnweb.com',
        timestamp: '2026-10-15T12:00:01Z'
      })
    ].join('\n');

    fs.writeFileSync(nucleiJson, jsonl);
    const findings = ScannerAdapters.nuclei.parseFindings(mockCtx);
    assert.equal(findings.length, 2);
    assert.equal(findings[0].id, 'cve-2023-1234');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].url, 'https://testphp.vulnweb.com/rce');
    assert.equal(findings[1].severity, 'info');
  });

  runTest('Gate 1.2: Nuclei parser handles pretty JSON Array format (-je) without returning 0 findings', () => {
    const jsonArray = JSON.stringify([
      {
        'template-id': 'cve-2024-9999',
        info: { name: 'SQL Injection', severity: 'critical', description: 'SQLi auth' },
        'matched-at': 'https://testphp.vulnweb.com/login',
        timestamp: '2026-10-15T12:05:00Z'
      },
      {
        'template-id': 'cors-header',
        info: { name: 'CORS Misconfiguration', severity: 'medium' },
        'matched-at': 'https://testphp.vulnweb.com/api',
        timestamp: '2026-10-15T12:05:01Z'
      }
    ], null, 2);

    fs.writeFileSync(nucleiJson, jsonArray);
    const findings = ScannerAdapters.nuclei.parseFindings(mockCtx);
    assert.equal(findings.length, 2);
    assert.equal(findings[0].id, 'cve-2024-9999');
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].url, 'https://testphp.vulnweb.com/login');
  });

  runTest('Gate 1.3: Nuclei parser ignores corrupt lines and recovers valid lines', () => {
    const corrupt = `
{"template-id": "valid-item-1", "info": {"name": "Item 1", "severity": "low"}}
<<<CORRUPT_RAW_DATA_CHUNK>>>
{"template-id": "valid-item-2", "info": {"name": "Item 2", "severity": "high"}}
`;
    fs.writeFileSync(nucleiJson, corrupt);
    const findings = ScannerAdapters.nuclei.parseFindings(mockCtx);
    assert.equal(findings.length, 2);
    assert.equal(findings[0].id, 'valid-item-1');
    assert.equal(findings[1].id, 'valid-item-2');
  });

  // --- GATE 2: Observation vs Vulnerability (R15) ---
  runTest('Gate 2.1: Naabu open ports are classified as info observation, not low vulnerability', () => {
    const naabuJson = path.join(tmpDir, 'naabu.json');
    fs.writeFileSync(naabuJson, JSON.stringify({ host: 'testphp.vulnweb.com', port: 80, ip: '127.0.0.1' }) + '\n');
    const naabuFindings = ScannerAdapters.naabu.parseFindings({ jsonFile: naabuJson });
    assert.equal(naabuFindings.length, 1);
    assert.equal(naabuFindings[0].severity, 'info');
    assert.match(naabuFindings[0].name, /observation/i);
  });

  runTest('Gate 2.2: Nmap open ports are classified as info observation, not medium vulnerability', () => {
    const nmapTxt = path.join(tmpDir, 'nmap.txt');
    fs.writeFileSync(nmapTxt, '80/tcp open http Apache\n443/tcp open ssl/https Apache\n');
    const nmapFindings = ScannerAdapters.nmap.parseFindings({ outputFile: nmapTxt });
    assert.equal(nmapFindings.length, 1);
    assert.equal(nmapFindings[0].severity, 'info');
    assert.match(nmapFindings[0].name, /observation/i);
  });

  // --- GATE 3: Report Honesty & Score Assurance (R02, R21) ---
  runTest('Gate 3.1: Failed scan with 0 findings does not receive deceptive Grade A', () => {
    const stats = reportService.calculateStats([], 'FAILED');
    assert.equal(stats.grade, 'N/A');
    assert.equal(stats.gradeColor, '#64748b');
  });

  runTest('Gate 3.2: Stopped scan with 0 findings does not receive deceptive Grade A', () => {
    const stats = reportService.calculateStats([], 'STOPPED');
    assert.equal(stats.grade, 'N/A');
  });

  runTest('Gate 3.3: Completed scan with critical finding receives Grade F and elevated risk score', () => {
    const stats = reportService.calculateStats([{ severity: 'critical', name: 'Critical SQLi' }], 'COMPLETED');
    assert.equal(stats.grade, 'F');
    assert.ok(stats.riskScore >= 10);
  });

  await runAsyncTest('Gate 3.4: Unknown scanId throws NotFound error instead of fabricating fake completed scan', async () => {
    await assert.rejects(
      async () => {
        await reportService.compileReportData('invalid-non-existent-scan-99999');
      },
      /Scan not found/
    );
  });

  // --- GATE 4: Cancellation State Stability (R03) ---
  await runAsyncTest('Gate 4.1: Once scan is STOPPED, subsequent tool FAILED does not flip overall status to FAILED', async () => {
    const testScanId = `cancel_test_${Date.now()}`;
    await storage.saveMetadata(testScanId, {
      scanId: testScanId,
      target: 'http://example.com',
      domain: 'example.com',
      startTime: new Date().toISOString(),
      status: 'RUNNING',
      config: { tools: ['nuclei', 'wapiti'] }
    });

    // User stops scan
    await storage.updateStatus(testScanId, null, 'STOPPED');
    let scan = dbService.getScanById(testScanId);
    assert.equal(scan.status, 'STOPPED');

    // Child processes exit with failure after being terminated
    await storage.updateStatus(testScanId, 'nuclei', 'FAILED');
    await storage.updateStatus(testScanId, 'wapiti', 'FAILED');

    scan = dbService.getScanById(testScanId);
    assert.equal(scan.status, 'STOPPED', 'Overall scan status must remain STOPPED, not flipped to FAILED');
  });

  // --- GATE 5: Scan ID Uniqueness & Empty Tools Rejection (R05) ---
  runTest('Gate 5.1: createScanDirectory generates distinct scanIds within the same second', () => {
    const dir1 = storage.createScanDirectory('example.com');
    const dir2 = storage.createScanDirectory('example.com');
    assert.notEqual(dir1.scanId, dir2.scanId, 'Scan IDs generated in same second must be unique');
  });

  await runAsyncTest('Gate 5.2: Empty tools list is rejected immediately with error', async () => {
    const mockSender = { isDestroyed: () => false, send: () => {} };
    const res = await scannerService.startScan(mockSender, 'http://example.com', { tools: [] });
    assert.equal(res.success, false);
    assert.match(res.error, /No tools selected/i);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('\n========================================');
  console.log(`Gate Verification Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    app.quit();
  }
});
