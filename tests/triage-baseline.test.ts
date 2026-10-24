import test from 'node:test';
import assert from 'node:assert/strict';
import { dbService } from '../electron/services/database';
import { computeFindingFingerprint } from '../electron/services/db/fingerprint';

const PREFIX = 'triage_baseline';
const scanIds: string[] = [];
const fingerprints: string[] = [];

function createScan(scanId: string, target: string, status = 'COMPLETED') {
  scanIds.push(scanId);
  dbService.insertScan(scanId, target, status, new Date().toISOString(), { tools: ['nuclei'] });
}

function createFinding(scanId: string, scanner: string, type: string, name: string, severity: string, url: string) {
  const fingerprint = computeFindingFingerprint({ scanner, type, name, url });
  fingerprints.push(fingerprint);
  dbService.getRawDatabase()
    .prepare('INSERT INTO findings (scanId, scanner, type, name, severity, url, fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(scanId, scanner, type, name, severity, url, fingerprint);
  return fingerprint;
}

test('Triage decisions and baseline differential', async (t) => {
  const db = dbService.getRawDatabase();

  try {
    await t.test('keeps the latest decision per fingerprint for a scan', () => {
      const scanId = `${PREFIX}_latest`;
      createScan(scanId, 'https://triage-baseline-latest.example');
      const fingerprint = createFinding(scanId, 'nuclei', 'cve-triage-latest', 'Triaged Flaw', 'high', 'https://triage-baseline-latest.example/a');

      dbService.setTriageDecision(fingerprint, 'false_positive', 'manually verified as not real', 'analyst', new Date(Date.now() + 86_400_000).toISOString());
      dbService.setTriageDecision(fingerprint, 'fixed', 'patched by vendor', 'analyst');

      const rows = dbService.getTriageDecisionsForScan(scanId) as Array<Record<string, unknown>>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].fingerprint, fingerprint);
      assert.equal(rows[0].status, 'fixed');
      assert.equal(rows[0].reason, 'patched by vendor');
      assert.equal(rows[0].actor, 'analyst');
    });

    await t.test('hides expired decisions from the scan triage view', () => {
      const scanId = `${PREFIX}_expired`;
      createScan(scanId, 'https://triage-baseline-expired.example');
      const fingerprint = createFinding(scanId, 'nuclei', 'cve-triage-expired', 'Expired Triage', 'medium', 'https://triage-baseline-expired.example/b');

      dbService.setTriageDecision(fingerprint, 'accepted_risk', 'temporary acceptance', 'analyst', new Date(Date.now() - 86_400_000).toISOString());

      assert.equal(dbService.getTriageDecisionsForScan(scanId).length, 0);
    });

    await t.test('flags a triaged fixed finding that reappears as reopened', () => {
      const baselineId = `${PREFIX}_baseline`;
      const currentId = `${PREFIX}_current`;
      createScan(baselineId, 'https://triage-baseline-reopen.example');
      createScan(currentId, 'https://triage-baseline-reopen.example');
      const fingerprint = createFinding(baselineId, 'nuclei', 'cve-reopened', 'Reopened Flaw', 'critical', 'https://triage-baseline-reopen.example/c');
      createFinding(currentId, 'nuclei', 'cve-reopened', 'Reopened Flaw', 'critical', 'https://triage-baseline-reopen.example/c');

      dbService.setTriageDecision(fingerprint, 'fixed', 'vendor patch deployed', 'analyst');

      const comparison = dbService.compareWithBaseline(currentId, baselineId);
      assert.equal(comparison.summary.reopenedCount, 1);
      assert.equal(comparison.reopenedFindings[0].fingerprint, fingerprint);
      assert.equal(comparison.summary.persistentCount, 0);
    });

    await t.test('expired fixed decisions no longer mark a finding as reopened', () => {
      const baselineId = `${PREFIX}_baseline_expired`;
      const currentId = `${PREFIX}_current_expired`;
      createScan(baselineId, 'https://triage-baseline-expired-baseline.example');
      createScan(currentId, 'https://triage-baseline-expired-baseline.example');
      const fingerprint = createFinding(baselineId, 'nuclei', 'cve-expired-triage', 'Still Present Flaw', 'high', 'https://triage-baseline-expired-baseline.example/d');
      createFinding(currentId, 'nuclei', 'cve-expired-triage', 'Still Present Flaw', 'high', 'https://triage-baseline-expired-baseline.example/d');

      dbService.setTriageDecision(fingerprint, 'fixed', 'claimed patched', 'analyst', new Date(Date.now() - 86_400_000).toISOString());

      const comparison = dbService.compareWithBaseline(currentId, baselineId);
      assert.equal(comparison.summary.reopenedCount, 0);
      assert.equal(comparison.summary.persistentCount, 1);
    });

    await t.test('does not resolve findings when the current scan is incomplete', () => {
      const baselineId = `${PREFIX}_baseline_partial`;
      const currentId = `${PREFIX}_current_partial`;
      createScan(baselineId, 'https://triage-baseline-partial.example');
      createScan(currentId, 'https://triage-baseline-partial.example', 'FAILED');
      createFinding(baselineId, 'nuclei', 'cve-partial', 'Unverified Flaw', 'medium', 'https://triage-baseline-partial.example/e');

      const comparison = dbService.compareWithBaseline(currentId, baselineId);
      assert.equal(comparison.canDetermineResolved, false);
      assert.equal(comparison.summary.resolvedCount, 0);
      assert.equal(comparison.summary.notReassessedCount, 1);
    });
  } finally {
    for (const scanId of scanIds) {
      dbService.deleteScan(scanId);
    }
    for (const fingerprint of fingerprints) {
      db.prepare('DELETE FROM triage_decisions WHERE fingerprint = ?').run(fingerprint);
    }
  }
});
