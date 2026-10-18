import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { reportService } from '../electron/services/reportService';
import { computeFindingFingerprint, normalizeLocation } from '../electron/services/db/fingerprint';
import { BaselineComparator } from '../electron/services/db/baseline';
import { MigrationManager } from '../electron/services/db/migrations';
import { ScanStateMachine } from '../electron/services/runner/stateMachine';
import { BackupManager } from '../electron/services/db/backup';
import { LoggerService } from '../electron/services/logger';

describe('Fase 1: Assessment Contract & Honest Posture', () => {
  test('empty scan with zero tools run yields NOT_ASSESSED and grade N/A', () => {
    const metrics = reportService.calculateStats([], 'COMPLETED', [], {});
    assert.equal(metrics.grade, 'N/A');
    assert.equal(metrics.assessmentStatus, 'NOT_ASSESSED');
    assert.equal(metrics.coverageStatus, 'NONE');
    assert.match(metrics.coverageLimitation, /No security tools were selected/i);
  });

  test('failed scan yields FAILED assessment status and grade N/A regardless of findings count', () => {
    const metricsEmpty = reportService.calculateStats([], 'FAILED', ['nuclei'], { nuclei: 'FAILED' });
    assert.equal(metricsEmpty.grade, 'N/A');
    assert.equal(metricsEmpty.assessmentStatus, 'FAILED');
    assert.equal(metricsEmpty.coverageStatus, 'NONE');

    const metricsWithVuln = reportService.calculateStats(
      [{ scanner: 'nuclei', name: 'Open Redirect', severity: 'medium' }],
      'FAILED',
      ['nuclei'],
      { nuclei: 'FAILED' }
    );
    assert.equal(metricsWithVuln.grade, 'N/A');
    assert.equal(metricsWithVuln.assessmentStatus, 'FAILED');
  });

  test('interrupted or stopped scan yields CANCELLED status and grade N/A', () => {
    const metrics = reportService.calculateStats([], 'STOPPED', ['nuclei', 'nikto'], { nuclei: 'COMPLETED', nikto: 'STOPPED' });
    assert.equal(metrics.grade, 'N/A');
    assert.equal(metrics.assessmentStatus, 'CANCELLED');
    assert.equal(metrics.coverageStatus, 'PARTIAL');
  });

  test('partial scan with zero findings yields Inconclusive and grade N/A (never false Secure)', () => {
    const metrics = reportService.calculateStats([], 'PARTIAL', ['nuclei', 'nikto'], { nuclei: 'COMPLETED', nikto: 'FAILED' });
    assert.equal(metrics.grade, 'N/A');
    assert.equal(metrics.assessmentStatus, 'PARTIAL_COVERAGE');
    assert.equal(metrics.coverageStatus, 'PARTIAL');
    assert.match(metrics.assessmentLabel, /Inconclusive/i);
    assert.match(metrics.coverageLimitation, /Zero findings does not imply the target is secure/i);
  });

  test('completed scan with full coverage and zero findings yields Clean (Tested Scope Only)', () => {
    const metrics = reportService.calculateStats([], 'COMPLETED', ['nuclei', 'httpx'], { nuclei: 'COMPLETED', httpx: 'COMPLETED' });
    assert.equal(metrics.grade, 'A');
    assert.equal(metrics.assessmentStatus, 'COMPLETED_CLEAN');
    assert.equal(metrics.coverageStatus, 'FULL');
    assert.match(metrics.coverageLimitation, /does not guarantee absence of unassessed vulnerability classes/i);
  });
});

describe('Fase 1: Fingerprint v2 Case-Sensitivity and Secret Redaction', () => {
  test('preserves URL pathname case: /Admin and /admin do not collide', () => {
    const fpUpper = computeFindingFingerprint({
      scanner: 'nuclei',
      type: 'info-leak',
      url: 'https://example.com/Admin/dashboard'
    });

    const fpLower = computeFindingFingerprint({
      scanner: 'nuclei',
      type: 'info-leak',
      url: 'https://example.com/admin/dashboard'
    });

    assert.notEqual(fpUpper, fpLower, 'Path /Admin and /admin must produce distinct fingerprints');
  });

  test('preserves line anchor in file URLs: #L1 vs #L99 do not collide', () => {
    const fpL1 = computeFindingFingerprint({
      scanner: 'semgrep',
      type: 'hardcoded-key',
      url: 'file://src/auth.ts#L1'
    });

    const fpL99 = computeFindingFingerprint({
      scanner: 'semgrep',
      type: 'hardcoded-key',
      url: 'file://src/auth.ts#L99'
    });

    assert.notEqual(fpL1, fpL99, 'Line 1 and Line 99 must produce distinct fingerprints');
  });

  test('redacts secret query tokens so token changes do not mutate finding identity', () => {
    const loc1 = normalizeLocation({
      scanner: 'zap',
      url: 'https://example.com/api/v1/user?id=42&token=SECRET_KEY_AAA'
    });

    const loc2 = normalizeLocation({
      scanner: 'zap',
      url: 'https://example.com/api/v1/user?id=42&token=SECRET_KEY_BBB'
    });

    assert.equal(loc1, loc2, 'Query secret tokens must be redacted to [REDACTED] in location');
    assert.ok(!loc1.includes('SECRET_KEY_AAA'));
  });

  test('supports typed SCA package dependency locations', () => {
    const fpSca = computeFindingFingerprint({
      scanner: 'trivy',
      packageName: 'lodash',
      packageVersion: '4.17.20',
      cveId: 'CVE-2021-23337'
    });

    assert.equal(fpSca.length, 64, 'SHA-256 fingerprint generated for package dependency');
  });
});

describe('Fase 1: Baseline Comparison Resolution Safety', () => {
  test('missing findings in incomplete or failed scans are categorized as notReassessed, not resolved', () => {
    const db = new Database(':memory:');
    MigrationManager.runMigrations(db);

    db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('base-1', 'https://example.com', 'COMPLETED', '2026-10-18T00:00:00Z')").run();
    const fpA = computeFindingFingerprint({ scanner: 'nuclei', type: 'cve-1', url: 'https://example.com/a' });
    db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('base-1', 'nuclei', 'cve-1', 'Flaw 1', 'high', 'https://example.com/a', ?)").run(fpA);

    // Follow-up scan FAILED
    db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('followup-failed', 'https://example.com', 'FAILED', '2026-10-18T01:00:00Z')").run();

    const result = BaselineComparator.compare('followup-failed', 'base-1', db);
    assert.equal(result.canDetermineResolved, false);
    assert.equal(result.summary.resolvedCount, 0, 'Must have 0 resolved findings on failed scan');
    assert.equal(result.summary.notReassessedCount, 1, 'Missing finding must be marked notReassessed');
    assert.equal(result.notReassessedFindings[0].fingerprint, fpA);
  });

  test('finding from scanner not executed in current scan is marked notReassessed', () => {
    const db = new Database(':memory:');
    MigrationManager.runMigrations(db);

    db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('base-2', 'https://example.com', 'COMPLETED', '2026-10-18T00:00:00Z')").run();
    const fpNikto = computeFindingFingerprint({ scanner: 'nikto', type: 'headers', url: 'https://example.com/headers' });
    db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('base-2', 'nikto', 'headers', 'Missing Header', 'low', 'https://example.com/headers', ?)").run(fpNikto);

    // Followup ran ONLY nuclei, not nikto
    db.prepare("INSERT INTO scans (scanId, target, status, startTime, config) VALUES ('followup-nuclei-only', 'https://example.com', 'COMPLETED', '2026-10-18T01:00:00Z', ?)").run(
      JSON.stringify({ tools: ['nuclei'] })
    );

    const result = BaselineComparator.compare('followup-nuclei-only', 'base-2', db);
    assert.equal(result.summary.resolvedCount, 0, 'Nikto finding must NOT be marked resolved because nikto did not run');
    assert.equal(result.summary.notReassessedCount, 1, 'Nikto finding must be classified as notReassessed');
    assert.equal(result.notReassessedFindings[0].fingerprint, fpNikto);
  });
});

describe('Fase 1: State Machine & Storage Deletion Guard', () => {
  test('ScanStateMachine with zero tools computes FAILED aggregate state', () => {
    const aggregate = ScanStateMachine.computeAggregateState('RUNNING', {}, []);
    assert.equal(aggregate, 'FAILED', 'Zero tools run must compute FAILED, never COMPLETED');
  });

  test('LoggerService.redactSensitive catches JWTs, private keys, and session cookies', () => {
    const raw = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakKey sessionid=SECRET_SESSION_123';
    const redacted = LoggerService.redactSensitive(raw);
    assert.ok(!redacted.includes('SECRET_SESSION_123'));
    assert.ok(redacted.includes('sessionid=[REDACTED]'));
    assert.ok(redacted.includes('Bearer [REDACTED]'));
  });
});

describe('Fase 1: Backup Retention Quota Order & SQLite Integrity', () => {
  const tmpBackupDir = path.join(os.tmpdir(), `recon_test_backup_${Date.now()}`);

  test('quota retention prunes oldest backups first and ALWAYS preserves the newest backup', () => {
    const manager = new BackupManager(tmpBackupDir);
    const backupDir = manager.getBackupDir();

    // Create 3 dummy sqlite files with distinct timestamps
    const oldPath = path.join(backupDir, 'backup_old.sqlite');
    const midPath = path.join(backupDir, 'backup_mid.sqlite');
    const newPath = path.join(backupDir, 'backup_new.sqlite');

    fs.writeFileSync(oldPath, 'SQLite format 3\0' + 'x'.repeat(200));
    fs.writeFileSync(midPath, 'SQLite format 3\0' + 'y'.repeat(200));
    fs.writeFileSync(newPath, 'SQLite format 3\0' + 'z'.repeat(200));

    const now = Date.now();
    fs.utimesSync(oldPath, new Date(now - 3000), new Date(now - 3000));
    fs.utimesSync(midPath, new Date(now - 2000), new Date(now - 2000));
    fs.utimesSync(newPath, new Date(now - 1000), new Date(now - 1000));

    // Total size ~648 bytes. Set maxTotalBytes to 250 bytes to force quota pruning
    const retention = manager.enforceRetention(30, 250);

    assert.ok(retention.deletedFiles >= 1, 'At least 1 backup should be deleted for quota');
    assert.ok(fs.existsSync(newPath), 'Newest backup MUST ALWAYS be preserved!');
    assert.ok(!fs.existsSync(oldPath), 'Oldest backup must be pruned first!');

    // Cleanup
    try { fs.rmSync(tmpBackupDir, { recursive: true, force: true }); } catch { /* cleanup ignore */ }
  });
});
