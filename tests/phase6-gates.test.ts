import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { LoggerService } from '../electron/services/logger';
import { BackupManager } from '../electron/services/db/backup';
import { ScannerAdapters } from '../electron/services/scanners/registry';
import { toolCatalog } from '../electron/services/catalog';
import { ToolManager } from '../electron/services/toolManager';
import { storage } from '../electron/services/storage';
import { dbService } from '../electron/services/database';

describe('Gate Phase 6: Operational Logging, Redaction & Diagnostics', () => {
  test('strictly redacts sensitive Bearer tokens, Basic auth, and API keys from logs', () => {
    const raw = 'Request to https://target.com with Bearer eyJhbGciOiJIUzI1NiJ9 and api_key: superSecretKey123 and Basic dXNlcjpwYXNz';
    const redacted = LoggerService.redactSensitive(raw);

    assert.ok(!redacted.includes('eyJhbGciOiJIUzI1NiJ9'), 'Bearer token must be redacted');
    assert.ok(redacted.includes('Bearer [REDACTED]'), 'Bearer placeholder present');
    assert.ok(!redacted.includes('superSecretKey123'), 'API key must be redacted');
    assert.ok(redacted.includes('api_key=[REDACTED]'), 'API key placeholder present');
    assert.ok(!redacted.includes('dXNlcjpwYXNz'), 'Basic auth token must be redacted');
    assert.ok(redacted.includes('Basic [REDACTED]'), 'Basic auth placeholder present');
  });

  test('structured operations log formats audit entries accurately', () => {
    const logger = new LoggerService();
    const testRunId = `run_${Date.now()}`;
    logger.logOperation({
      runId: testRunId,
      jobId: 'job_42',
      tool: 'nuclei',
      toolVersion: 'v3.3.0',
      action: 'scan:complete',
      status: 'SUCCESS',
      durationMs: 4500,
      details: { target: 'https://example.com', sensitiveToken: 'token=secretVal' }
    });

    const opsPath = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'logs', 'operations.jsonl');
    assert.ok(fs.existsSync(opsPath), 'Operations log file must exist');

    const lines = fs.readFileSync(opsPath, 'utf-8').trim().split('\n');
    const matched = lines.map(l => JSON.parse(l)).find(e => e.runId === testRunId);

    assert.ok(matched, 'Logged operation must be retrievable from operations.jsonl');
    assert.strictEqual(matched.tool, 'nuclei');
    assert.strictEqual(matched.status, 'SUCCESS');
    assert.strictEqual(matched.durationMs, 4500);
    assert.ok(!JSON.stringify(matched.details).includes('secretVal'), 'Sensitive details must be redacted in operational logs');
  });

  test('diagnostics summary provides non-sensitive system environment metrics', () => {
    const logger = new LoggerService();
    const diag = logger.getDiagnosticsSummary();

    assert.ok(diag.os, 'OS details present');
    assert.ok(diag.process, 'Process details present');
    assert.ok(diag.logStats, 'Log file stats present');
    assert.strictEqual(typeof (diag.os as any).platform, 'string');
    assert.strictEqual(typeof (diag.process as any).nodeVersion, 'string');
  });
});

describe('Gate Phase 6: Database Backup, Verification & Retention Engine', () => {
  const testDir = path.join(os.tmpdir(), `test_recon_backup_${Date.now()}`);

  test('creates a valid SQLite backup with official file header', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const dbPath = path.join(testDir, 'recon_app.sqlite');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE test_data (id INTEGER PRIMARY KEY, note TEXT);');
    db.exec("INSERT INTO test_data (note) VALUES ('enterprise test');");

    const manager = new BackupManager(testDir);
    const result = await manager.createBackup(db, 'test_backup.sqlite');

    assert.ok(fs.existsSync(result.backupPath), 'Backup file must exist on disk');
    assert.ok(result.sizeBytes > 0, 'Backup file must not be empty');

    const validation = manager.validateBackupFile(result.backupPath);
    assert.strictEqual(validation.valid, true, 'Validation must confirm valid SQLite format');

    // Verify backup contents can be read by opening it
    const backupDb = new Database(result.backupPath);
    const row = backupDb.prepare('SELECT note FROM test_data WHERE id = 1').get() as { note: string };
    assert.strictEqual(row.note, 'enterprise test');
    backupDb.close();
    db.close();
  });

  test('validateBackupFile rejects corrupt or non-sqlite files', () => {
    const manager = new BackupManager(testDir);
    const dummyPath = path.join(testDir, 'fake.sqlite');
    fs.writeFileSync(dummyPath, 'This is definitely not an SQLite database file header. '.repeat(4));

    const validation = manager.validateBackupFile(dummyPath);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.reason?.includes('Invalid SQLite file header'));
  });

  test('enforceRetention prunes expired or excess backups safely', () => {
    const manager = new BackupManager(testDir);
    const backupDir = manager.getBackupDir();

    // Create an artificial old backup
    const oldPath = path.join(backupDir, 'old_backup.sqlite');
    fs.writeFileSync(oldPath, 'SQLite format 3\0' + '0'.repeat(100));
    
    // Set mtime to 40 days ago
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldPath, fortyDaysAgo, fortyDaysAgo);

    const retention = manager.enforceRetention(30); // 30-day retention
    assert.ok(retention.deletedFiles >= 1, 'At least one expired backup must be deleted');
    assert.ok(!fs.existsSync(oldPath), 'Old backup file must be removed');
  });
});

describe('Gate Phase 6: Schemathesis API Fuzzer Integration', () => {
  const adapter = ScannerAdapters['schemathesis'];

  test('manifest is declared in catalog with pip and api-fuzz capability', () => {
    const manifest = toolCatalog.get('schemathesis');
    assert.ok(manifest, 'Schemathesis manifest must be registered');
    assert.strictEqual(manifest.category, 'fuzz');
    assert.ok(manifest.capabilities.includes('api-fuzz'), 'Capability api-fuzz must be present');
    assert.strictEqual(manifest.runtime, 'python-pip');
    assert.strictEqual(manifest.installStrategy.type, 'pip');
  });

  test('generates expected CLI arguments with safety controls', () => {
    const ctxSafe: any = {
      targetUrl: 'https://api.example.com',
      jsonFile: 'C:\\test\\st_report.json',
      config: { schemathesisSchema: 'https://api.example.com/openapi.json', schemathesisSafeOnly: true }
    };
    const argsSafe = adapter.getCommandArgs(ctxSafe);
    assert.ok(argsSafe.includes('run'));
    assert.ok(argsSafe.includes('https://api.example.com/openapi.json'));
    assert.ok(argsSafe.includes('--include-method'));
    assert.ok(argsSafe.includes('GET,HEAD,OPTIONS'));

    const ctxDefault: any = {
      targetUrl: 'https://api.example.com',
      jsonFile: 'C:\\test\\st_report.json'
    };
    const argsDefault = adapter.getCommandArgs(ctxDefault);
    assert.ok(argsDefault.includes('https://api.example.com'));
    assert.ok(argsDefault.includes('--report-json-path'));
    assert.ok(argsDefault.includes('C:\\test\\st_report.json'));
    assert.ok(!argsDefault.includes('--include-method'));
  });

  test('exit code 1 is treated as successful fuzzing completion', () => {
    assert.strictEqual(adapter.isSuccessExitCode!(0), true);
    assert.strictEqual(adapter.isSuccessExitCode!(1), true);
    assert.strictEqual(adapter.isSuccessExitCode!(2), false);
  });

  test('parses 5xx crashes as high severity and schema mismatches as low severity', () => {
    const mockReport = {
      events: [
        {
          status: 'failure',
          method: 'POST',
          path: '/api/v1/checkout',
          message: 'Server returned HTTP 500 Internal Server Error',
          checks: [
            { name: 'not_a_server_error', status: 'failure' }
          ]
        },
        {
          status: 'failure',
          method: 'GET',
          path: '/api/v1/users',
          message: 'Response status 418 not documented in OpenAPI schema',
          checks: [
            { name: 'status_code_conformance', status: 'failure' }
          ]
        }
      ]
    };

    const tempJson = path.join(os.tmpdir(), `test_st_${Date.now()}.json`);
    fs.writeFileSync(tempJson, JSON.stringify(mockReport));

    const ctx: any = {
      targetUrl: 'https://api.example.com',
      jsonFile: tempJson
    };

    const findings = adapter.parseFindings(ctx);
    try { fs.unlinkSync(tempJson); } catch { /* ignore */ }

    assert.strictEqual(findings.length, 2);

    const crashFinding = findings.find((f: any) => f.url.includes('/checkout'));
    assert.ok(crashFinding);
    assert.strictEqual(crashFinding.severity, 'high');
    assert.ok(crashFinding.name.includes('Unhandled Server Error'));

    const schemaFinding = findings.find((f: any) => f.url.includes('/users'));
    assert.ok(schemaFinding);
    assert.strictEqual(schemaFinding.severity, 'low');
    assert.ok(schemaFinding.name.includes('API Quality: Schema Conformity Failure'));
  });
});

describe('Gate Phase 6: Desktop Packaged Paths & Non-Admin Resilience', () => {
  test('ToolManager resolveToolPath checks process.resourcesPath when present', () => {
    const mgr = new ToolManager();
    const tempResources = path.join(os.tmpdir(), `test_resources_${Date.now()}`);
    const binDir = path.join(tempResources, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const mockExe = path.join(binDir, 'nuclei.exe');
    fs.writeFileSync(mockExe, 'dummy packaged nuclei binary');

    const origDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
    try {
      Object.defineProperty(process, 'resourcesPath', {
        value: tempResources,
        configurable: true,
        writable: true
      });
      const resolved = mgr.resolveToolPath('nuclei');
      assert.strictEqual(resolved, mockExe, 'Should resolve binary from packaged resources path');
    } finally {
      if (origDescriptor) {
        Object.defineProperty(process, 'resourcesPath', origDescriptor);
      } else {
        delete (process as any).resourcesPath;
      }
      try { fs.rmSync(tempResources, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  test('AppData directory path handles paths with spaces and Unicode cleanly', () => {
    const unicodeDir = path.join(os.tmpdir(), `test_spacé and spåces_${Date.now()}`);
    fs.mkdirSync(unicodeDir, { recursive: true });

    const dummyFile = path.join(unicodeDir, 'sample.txt');
    fs.writeFileSync(dummyFile, 'unicode path content', 'utf-8');

    assert.ok(fs.existsSync(dummyFile), 'File in path with spaces/unicode must exist');
    const read = fs.readFileSync(dummyFile, 'utf-8');
    assert.strictEqual(read, 'unicode path content');

    try { fs.rmSync(unicodeDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });
});

describe('Gate Phase 6: Scan Results Deletion & Clear All Engine', () => {
  test('deleteScan permanently removes scan from DB and deletes artifact directory', () => {
    const scanDir = storage.createScanDirectory('deltest.local');
    const actualScanId = scanDir.scanId;

    dbService.insertScan(actualScanId, 'http://deltest.local', 'COMPLETED', new Date().toISOString(), {});
    dbService.insertFindings(actualScanId, 'nuclei', [
      { id: 'f1', name: 'Test Finding', severity: 'low', scanner: 'nuclei', url: 'http://deltest.local' }
    ]);

    // Verify it exists in DB
    const scanBefore = dbService.getScanById(actualScanId);
    assert.ok(scanBefore, 'Scan must exist in database before deletion');
    assert.ok(fs.existsSync(scanDir.scanDir), 'Scan directory must exist before deletion');

    // Delete single scan
    const success = storage.deleteScan(actualScanId);
    assert.strictEqual(success, true);

    // Verify removed from DB and filesystem
    const scanAfter = dbService.getScanById(actualScanId);
    assert.strictEqual(scanAfter, null, 'Scan record must be deleted from database');
    assert.ok(!fs.existsSync(scanDir.scanDir), 'Scan artifact directory must be deleted from filesystem');
  });

  test('clearAllScans wipes all scan records and purges all artifact folders', () => {
    // Create two dummy scans
    const scan1 = storage.createScanDirectory('batch1.local');
    const scan2 = storage.createScanDirectory('batch2.local');

    dbService.insertScan(scan1.scanId, 'http://batch1.local', 'COMPLETED', new Date().toISOString(), {});
    dbService.insertScan(scan2.scanId, 'http://batch2.local', 'COMPLETED', new Date().toISOString(), {});

    assert.ok(dbService.getHistory().length >= 2, 'At least 2 scans exist before clearAll');

    // Run clear all
    const success = storage.clearAllScans();
    assert.strictEqual(success, true);

    // Verify database is completely empty
    const historyAfter = dbService.getHistory();
    assert.strictEqual(historyAfter.length, 0, 'Scan history must be completely empty after clearAllScans');
    assert.ok(!fs.existsSync(scan1.scanDir), 'Scan 1 folder must be removed');
    assert.ok(!fs.existsSync(scan2.scanDir), 'Scan 2 folder must be removed');
  });
});
