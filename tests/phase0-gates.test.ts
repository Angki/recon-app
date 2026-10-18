import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ScannerAdapters } from '../electron/services/scanners/registry';
import { ReportService } from '../electron/services/reportService';
import { storage } from '../electron/services/storage';
import { dbService } from '../electron/services/database';
import { scannerService } from '../electron/services/scanner';
import type { ScannerContext } from '../electron/services/scanners/types';

test('Gate Phase 0: Nuclei JSONL and JSON Array parsing integrity', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuclei-test-'));
  const jsonFile = path.join(tmpDir, 'nuclei_out.json');

  const mockContext = {
    scanId: 'test-scan-01',
    targetUrl: 'https://example.com',
    domain: 'example.com',
    scannerName: 'nuclei',
    bin: 'nuclei',
    outDir: tmpDir,
    timestamp: '20261015',
    outputFile: path.join(tmpDir, 'out.txt'),
    jsonFile: jsonFile,
    xmlFile: path.join(tmpDir, 'out.xml'),
    sender: {} as unknown as Electron.WebContents,
    settings: {}
  } as ScannerContext;

  await t.test('parses standard JSONL format correctly', () => {
    const jsonlContent = [
      JSON.stringify({
        'template-id': 'cve-2023-1234',
        info: { name: 'Remote Code Execution', severity: 'high', description: 'Critical RCE' },
        'matched-at': 'https://example.com/vulnerable/endpoint',
        timestamp: '2026-10-15T12:00:00Z'
      }),
      JSON.stringify({
        'template-id': 'tech-detect',
        info: { name: 'Nginx Detect', severity: 'info', description: 'Web server' },
        'matched-at': 'https://example.com',
        timestamp: '2026-10-15T12:00:01Z'
      })
    ].join('\n');

    fs.writeFileSync(jsonFile, jsonlContent);
    const findings = ScannerAdapters.nuclei.parseFindings!(mockContext);

    assert.equal(findings.length, 2);
    assert.equal(findings[0].id, 'cve-2023-1234');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].url, 'https://example.com/vulnerable/endpoint');
    assert.equal(findings[1].severity, 'info');
  });

  await t.test('parses pretty JSON Array format (-je) correctly', () => {
    const jsonArrayContent = JSON.stringify([
      {
        'template-id': 'cve-2024-5678',
        info: { name: 'SQL Injection', severity: 'critical', description: 'SQLi in auth' },
        'matched-at': 'https://example.com/login',
        timestamp: '2026-10-15T12:05:00Z'
      },
      {
        'template-id': 'cors-misconfig',
        info: { name: 'CORS Misconfiguration', severity: 'medium' },
        'matched-at': 'https://example.com/api',
        timestamp: '2026-10-15T12:05:01Z'
      }
    ], null, 2);

    fs.writeFileSync(jsonFile, jsonArrayContent);
    const findings = ScannerAdapters.nuclei.parseFindings!(mockContext);

    assert.equal(findings.length, 2);
    assert.equal(findings[0].id, 'cve-2024-5678');
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].url, 'https://example.com/login');
    assert.equal(findings[1].id, 'cors-misconfig');
    assert.equal(findings[1].severity, 'medium');
  });

  await t.test('resilient against malformed lines in JSONL', () => {
    const corruptContent = `
{"template-id": "valid-1", "info": {"name": "Valid 1", "severity": "low"}}
{invalid json corrupt line here!!
{"template-id": "valid-2", "info": {"name": "Valid 2", "severity": "medium"}}
`;
    fs.writeFileSync(jsonFile, corruptContent);
    const findings = ScannerAdapters.nuclei.parseFindings!(mockContext);

    assert.equal(findings.length, 2);
    assert.equal(findings[0].id, 'valid-1');
    assert.equal(findings[1].id, 'valid-2');
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Gate Phase 0: Observation vs Vulnerability separation (R15)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'port-test-'));

  // Test Naabu
  const naabuJsonFile = path.join(tmpDir, 'naabu.json');
  fs.writeFileSync(naabuJsonFile, JSON.stringify({ host: 'example.com', port: 443, ip: '93.184.216.34' }) + '\n');
  const naabuContext = { jsonFile: naabuJsonFile } as ScannerContext;
  const naabuFindings = ScannerAdapters.naabu.parseFindings!(naabuContext);

  assert.equal(naabuFindings.length, 1);
  assert.equal(naabuFindings[0].severity, 'info', 'Naabu open port must be classified as info observation');
  assert.match(String(naabuFindings[0].name), /observation/i);

  // Test Nmap
  const nmapOutFile = path.join(tmpDir, 'nmap.txt');
  fs.writeFileSync(nmapOutFile, '80/tcp  open  http    nginx 1.18.0\n443/tcp open  ssl/http nginx 1.18.0\n');
  const nmapContext = { outputFile: nmapOutFile } as ScannerContext;
  const nmapFindings = ScannerAdapters.nmap.parseFindings!(nmapContext);

  assert.equal(nmapFindings.length, 1);
  assert.equal(nmapFindings[0].severity, 'info', 'Nmap open port must be classified as info observation');
  assert.match(String(nmapFindings[0].name), /observation/i);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Gate Phase 0: Report assessment honesty & score assurance (R02, R21)', async (t) => {
  const reportService = new ReportService();

  await t.test('failed scan with 0 findings does not receive Grade A', () => {
    const stats = reportService.calculateStats([], 'FAILED');
    assert.equal(stats.grade, 'N/A', 'Failed scans must have grade N/A instead of deceptive Grade A');
  });

  await t.test('stopped scan with 0 findings does not receive Grade A', () => {
    const stats = reportService.calculateStats([], 'STOPPED');
    assert.equal(stats.grade, 'N/A', 'Stopped scans must have grade N/A');
  });

  await t.test('completed scan with critical finding receives Grade F', () => {
    const stats = reportService.calculateStats([{ severity: 'critical', name: 'RCE' }], 'COMPLETED');
    assert.equal(stats.grade, 'F');
    assert.ok(stats.riskScore >= 10);
  });

  await t.test('unknown scan ID throws error rather than fabricating fake completed report', async () => {
    await assert.rejects(
      async () => {
        await reportService.compileReportData('non-existent-scan-id-xyz-999');
      },
      /Scan not found/
    );
  });
});

test('Gate Phase 0: Cancellation race & non-overwrite guarantee (R03, R04)', async () => {
  const { scanId: testScanId } = storage.createScanDirectory('race-test.local');

  await storage.saveMetadata(testScanId, {
    scanId: testScanId,
    target: 'http://race-test.local',
    status: 'RUNNING',
    startTime: new Date().toISOString(),
    config: { tools: ['nuclei', 'wapiti'] }
  });

  // User stops scan
  await storage.updateStatus(testScanId, null, 'STOPPED');
  let scan = dbService.getScanById(testScanId);
  assert.equal(scan.status, 'STOPPED');

  // Late child process exits after kill signal with FAILED status
  await storage.updateStatus(testScanId, 'nuclei', 'FAILED');
  await storage.updateStatus(testScanId, 'wapiti', 'FAILED');

  scan = dbService.getScanById(testScanId);
  assert.equal(scan.status, 'STOPPED', 'Overall scan status must remain STOPPED, not flipped to FAILED');
});

test('Gate Phase 0: Scan ID uniqueness & empty tools rejection (R05)', async (t) => {
  await t.test('createScanDirectory generates distinct scanIds within the same second', () => {
    const dir1 = storage.createScanDirectory('example.com');
    const dir2 = storage.createScanDirectory('example.com');
    assert.notEqual(dir1.scanId, dir2.scanId, 'Scan IDs generated in same second must be unique');
  });

  await t.test('Empty tools list is rejected immediately with error', async () => {
    const mockSender = { isDestroyed: () => false, send: () => {} } as unknown as Electron.WebContents;
    const res = await scannerService.startScan(mockSender, 'http://example.com', { tools: [] });
    assert.equal(res.success, false);
    assert.match(res.error || '', /No tools selected/i);
  });
});

