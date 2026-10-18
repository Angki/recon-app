import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { MigrationManager } from '../electron/services/db/migrations';
import { computeFindingFingerprint } from '../electron/services/db/fingerprint';
import { BaselineComparator } from '../electron/services/db/baseline';

test('Gate Phase 3: Versioned Schema Migrations & Ledger Idempotency', async (t) => {
  const db = new Database(':memory:');

  await t.test('applies all pending migrations on fresh database', () => {
    const result = MigrationManager.runMigrations(db);
    assert.equal(result.appliedCount >= 4, true, 'At least 4 migrations must be applied');
    assert.equal(result.currentVersion >= 4, true, 'Current version must reach at least 4');

    // Verify ledger table
    const rows = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version ASC').all() as { version: number; name: string }[];
    assert.equal(rows.length, result.appliedCount);
    assert.equal(rows[0].name, '001_initial_schema');
    assert.equal(rows[1].name, '002_query_indexes');
    assert.equal(rows[2].name, '003_enterprise_domains');
    assert.equal(rows[3].name, '004_finding_fingerprints');
  });

  await t.test('migration execution is strictly idempotent', () => {
    // Second run must apply 0 migrations and retain version
    const secondResult = MigrationManager.runMigrations(db);
    assert.equal(secondResult.appliedCount, 0, 'No migrations should be re-applied');
    assert.equal(secondResult.currentVersion >= 4, true);
  });
});

test('Gate Phase 3: Deterministic Versioned Finding Fingerprints', async (t) => {
  await t.test('generates identical fingerprint for same flaw and location', () => {
    const fp1 = computeFindingFingerprint({
      scanner: 'nuclei',
      type: 'cve-2023-1234',
      url: 'https://example.com/admin/login.php',
      param: 'redirect'
    });

    const fp2 = computeFindingFingerprint({
      scanner: 'NUCLEI', // case-insensitive scanner
      type: 'cve-2023-1234',
      url: 'https://example.com/admin/login.php?session=xyz#top', // normalized URL
      param: 'redirect'
    });

    assert.equal(fp1, fp2, 'Identical flaws at same target must share fingerprint');
    assert.equal(fp1.length, 64, 'Fingerprint must be SHA-256 (64 hex chars)');
  });

  await t.test('generates distinct fingerprints for different endpoints or parameters', () => {
    const fpA = computeFindingFingerprint({
      scanner: 'nuclei',
      type: 'sqli',
      url: 'https://example.com/api/users',
      param: 'id'
    });

    const fpB = computeFindingFingerprint({
      scanner: 'nuclei',
      type: 'sqli',
      url: 'https://example.com/api/products',
      param: 'id'
    });

    const fpC = computeFindingFingerprint({
      scanner: 'nuclei',
      type: 'sqli',
      url: 'https://example.com/api/users',
      param: 'order'
    });

    assert.notEqual(fpA, fpB, 'Different URLs must not collide');
    assert.notEqual(fpA, fpC, 'Different params on same URL must not collide');
  });
});

test('Gate Phase 3: Baseline Comparison Engine & Resolution Safety', async (t) => {
  const db = new Database(':memory:');
  MigrationManager.runMigrations(db);

  // Setup Scan A (baseline)
  db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('scan-baseline', 'https://example.com', 'COMPLETED', '2026-10-15T00:00:00Z')").run();
  const fpPersist = computeFindingFingerprint({ scanner: 'nuclei', type: 'cve-persist', url: 'https://example.com/a' });
  const fpFixed = computeFindingFingerprint({ scanner: 'nuclei', type: 'cve-fixed', url: 'https://example.com/b' });

  db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('scan-baseline', 'nuclei', 'cve-persist', 'Persist Flaw', 'high', 'https://example.com/a', ?)").run(fpPersist);
  db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('scan-baseline', 'nuclei', 'cve-fixed', 'Fixed Flaw', 'medium', 'https://example.com/b', ?)").run(fpFixed);

  // Setup Scan B (completed follow-up)
  db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('scan-followup', 'https://example.com', 'COMPLETED', '2026-10-15T01:00:00Z')").run();
  const fpNew = computeFindingFingerprint({ scanner: 'nuclei', type: 'cve-new', url: 'https://example.com/c' });

  db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('scan-followup', 'nuclei', 'cve-persist', 'Persist Flaw', 'high', 'https://example.com/a', ?)").run(fpPersist);
  db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('scan-followup', 'nuclei', 'cve-new', 'New Flaw', 'low', 'https://example.com/c', ?)").run(fpNew);

  await t.test('detects new, persistent, and resolved findings accurately on completed run', () => {
    const comparison = BaselineComparator.compare('scan-followup', 'scan-baseline', db);
    assert.equal(comparison.canDetermineResolved, true);
    assert.equal(comparison.summary.persistentCount, 1);
    assert.equal(comparison.summary.newCount, 1);
    assert.equal(comparison.summary.resolvedCount, 1);
    assert.equal(comparison.resolvedFindings[0].fingerprint, fpFixed);
  });

  await t.test('failsafe: incomplete or failed scan NEVER marks missing findings as resolved', () => {
    // Setup Scan C (failed run)
    db.prepare("INSERT INTO scans (scanId, target, status, startTime) VALUES ('scan-failed', 'https://example.com', 'FAILED', '2026-10-15T02:00:00Z')").run();
    db.prepare("INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES ('scan-failed', 'nuclei', 'cve-persist', 'Persist Flaw', 'high', 'https://example.com/a', ?)").run(fpPersist);

    const comparison = BaselineComparator.compare('scan-failed', 'scan-baseline', db);
    assert.equal(comparison.canDetermineResolved, false);
    assert.equal(comparison.summary.resolvedCount, 0, 'Failed scan must have 0 resolved findings');
    assert.match(comparison.resolutionCaveat || '', /Current scan status is 'FAILED'/);
  });

  await t.test('identifies reopened findings previously resolved in triage', () => {
    // Mark fpPersist as fixed in triage
    db.prepare("INSERT INTO triage_decisions (fingerprint, status, reason, actor, timestamp) VALUES (?, 'fixed', 'patched by dev', 'secops', '2026-10-15T00:30:00Z')").run(fpPersist);

    const comparison = BaselineComparator.compare('scan-followup', 'scan-baseline', db);
    assert.equal(comparison.summary.reopenedCount, 1);
    assert.equal(comparison.reopenedFindings[0].fingerprint, fpPersist);
  });
});
