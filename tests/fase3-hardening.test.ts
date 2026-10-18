import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ProcessLockManager, ProcessLockError } from '../electron/services/platform/processLock';
import { StagingInstaller, InstallerError } from '../electron/services/platform/installer';
import { ContainerLifecycleManager } from '../electron/services/platform/containerLifecycle';
import { PreflightSmokeEngine } from '../electron/services/platform/preflightSmoke';
import { ScannerAdapters } from '../electron/services/scanners/registry';

test('Fase 3: Cross-Process Lock Safety (ProcessLockManager)', async (t) => {
  const lock = new ProcessLockManager();

  await t.test('acquires locks and reports locked state accurately', () => {
    const res = lock.acquireLocks('scan-101', ['nuclei', 'subfinder', 'httpx']);
    assert.equal(res.success, true);

    const nucleiStatus = lock.isToolLocked('nuclei');
    assert.equal(nucleiStatus.locked, true);
    assert.equal(nucleiStatus.activeScanId, 'scan-101');

    const wapitiStatus = lock.isToolLocked('wapiti');
    assert.equal(wapitiStatus.locked, false);
  });

  await t.test('rejects concurrent lock acquisition on tools in use by another scan', () => {
    const res = lock.acquireLocks('scan-102', ['wapiti', 'nuclei']);
    assert.equal(res.success, false);
    assert.equal(res.conflictedTool, 'nuclei');

    // Confirm wapiti was not partially locked
    assert.equal(lock.isToolLocked('wapiti').locked, false);
  });

  await t.test('assertToolNotLocked throws ProcessLockError for active binaries', () => {
    assert.throws(
      () => lock.assertToolNotLocked('nuclei'),
      (err: unknown) => {
        return err instanceof ProcessLockError && /Cannot update, replace, or uninstall tool 'nuclei'/i.test(err.message);
      }
    );

    // Unlocked tool does not throw
    assert.doesNotThrow(() => lock.assertToolNotLocked('wapiti'));
  });

  await t.test('releaseLocks frees tool locks for subsequent scans and updates', () => {
    lock.releaseLocks('scan-101');
    assert.equal(lock.isToolLocked('nuclei').locked, false);
    assert.equal(lock.isToolLocked('subfinder').locked, false);

    // Now scan-102 can acquire nuclei
    const res = lock.acquireLocks('scan-102', ['nuclei', 'wapiti']);
    assert.equal(res.success, true);
    assert.equal(lock.isToolLocked('nuclei').activeScanId, 'scan-102');

    lock.clearAll();
    assert.equal(lock.isToolLocked('nuclei').locked, false);
  });
});

test('Fase 3: Staging Installer, Integrity Checksum & Atomic Rollback', async (t) => {
  const testBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-staging-test-'));
  const installer = new StagingInstaller(testBaseDir);

  t.after(() => {
    try {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  await t.test('computes SHA-256 correctly and rejects corrupted checksums', () => {
    const sampleFile = path.join(testBaseDir, 'test-bin.exe');
    const content = Buffer.from('TEST_BINARY_PAYLOAD_ABC_123');
    fs.writeFileSync(sampleFile, content);

    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    assert.equal(installer.computeSha256(sampleFile), actualHash);

    // Valid check passes
    assert.equal(installer.verifyChecksum(sampleFile, actualHash), true);

    // Mismatched check throws CHECKSUM_MISMATCH InstallerError
    assert.throws(
      () => installer.verifyChecksum(sampleFile, 'deadbeef00000000000000000000000000000000000000000000000000000000'),
      (err: unknown) => {
        return err instanceof InstallerError && err.code === 'CHECKSUM_MISMATCH' && /Artifact integrity check failed/i.test(err.message);
      }
    );
  });

  await t.test('atomically activates staging artifact, writes provenance receipt, and backs up prior binary', async () => {
    const stagingDir = installer.getStagingDir('nuclei');
    const stagingFile = path.join(stagingDir, 'nuclei.exe');
    fs.writeFileSync(stagingFile, 'NUCLEI_V3_CONTENT');

    const liveFile = path.join(testBaseDir, 'nuclei.exe');
    // Seed v2 binary
    fs.writeFileSync(liveFile, 'NUCLEI_V2_CONTENT');

    const receipt = await installer.atomicActivate(stagingFile, liveFile, {
      toolId: 'nuclei',
      version: 'v3.3.0',
      sourceUrl: 'https://github.com/projectdiscovery/nuclei/releases/v3.3.0',
      installType: 'github-release',
      binaryPath: liveFile
    });

    // Verify live file updated
    assert.equal(fs.readFileSync(liveFile, 'utf-8'), 'NUCLEI_V3_CONTENT');

    // Verify staging file removed
    assert.equal(fs.existsSync(stagingFile), false);

    // Verify receipt persisted
    const receiptPath = path.join(installer.getReceiptsDir(), 'nuclei.receipt.json');
    assert.equal(fs.existsSync(receiptPath), true);
    const parsedReceipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
    assert.equal(parsedReceipt.toolId, 'nuclei');
    assert.equal(parsedReceipt.version, 'v3.3.0');
    assert.ok(parsedReceipt.rollbackBinaryPath && fs.existsSync(parsedReceipt.rollbackBinaryPath));
    assert.equal(fs.readFileSync(parsedReceipt.rollbackBinaryPath, 'utf-8'), 'NUCLEI_V2_CONTENT');

    // Rollback test: roll back to V2
    const rollbackSuccess = installer.rollback('nuclei', liveFile);
    assert.equal(rollbackSuccess, true);
    assert.equal(fs.readFileSync(liveFile, 'utf-8'), 'NUCLEI_V2_CONTENT');
  });
});

test('Fase 3: Container Lifecycle Tracking & Cleanup', async (t) => {
  const containerMgr = new ContainerLifecycleManager();

  await t.test('registers, lists, and unregisters active containers per scan', () => {
    containerMgr.registerContainer('scan-201', 'wpscan_scan-201_test');
    containerMgr.registerContainer('scan-201', 'container_extra_123');

    const containers = containerMgr.getContainersForScan('scan-201');
    assert.equal(containers.length, 2);
    assert.ok(containers.includes('wpscan_scan-201_test'));
    assert.ok(containers.includes('container_extra_123'));

    containerMgr.unregisterContainer('scan-201', 'container_extra_123');
    assert.equal(containerMgr.getContainersForScan('scan-201').length, 1);
  });

  await t.test('cleanupContainers safely removes registered containers without throwing', async () => {
    // Non-existent or test container ID handles exit gracefully without throwing unhandled rejection
    const cleaned = await containerMgr.cleanupContainers('scan-201');
    assert.equal(containerMgr.getContainersForScan('scan-201').length, 0);
  });
});

test('Fase 3: Preflight Smoke Engine Status Discrimination', async (t) => {
  const smoke = new PreflightSmokeEngine();

  await t.test('distinguishes not_installed from unknown catalog items', async () => {
    const res = await smoke.evaluateStatus('non-existent-tool-xyz');
    assert.equal(res.passed, false);
    assert.equal(res.status, 'not_installed');
    assert.match(res.details, /Unknown tool.*not in catalog/i);
  });

  await t.test('detects version compatibility and flags unsupported_version', () => {
    assert.equal(smoke.isVersionLower('1.2.0', '1.3.0'), true);
    assert.equal(smoke.isVersionLower('1.3.0', '1.2.0'), false);
    assert.equal(smoke.isVersionLower('2.0.0', '1.9.9'), false);
    assert.equal(smoke.isVersionLower('3.1.5', '3.1.5'), false);
    assert.equal(smoke.isVersionLower('0.9.1', '1.0.0'), true);
  });
});

test('Fase 3: Parser Safety & Exit Code Semantics (No Swallowing Corrupted Output)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-parser-audit-'));

  t.after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  await t.test('SSLyze throws on corrupted JSON output instead of returning empty findings', () => {
    const corruptFile = path.join(tmpDir, 'sslyze_corrupt.json');
    fs.writeFileSync(corruptFile, '{ "server_scan_results": [ INVALID_TRUNCATED_JSON');

    const ctx: any = { jsonFile: corruptFile, domain: 'example.com' };
    assert.throws(
      () => ScannerAdapters.sslyze.parseFindings(ctx),
      /Failed to parse SSLyze output/
    );
  });

  await t.test('Semgrep throws on malformed JSON output instead of returning empty findings', () => {
    const corruptFile = path.join(tmpDir, 'semgrep_corrupt.json');
    fs.writeFileSync(corruptFile, 'MALFORMED_NON_JSON_DATA_CRASH');

    const ctx: any = { jsonFile: corruptFile, targetUrl: tmpDir };
    assert.throws(
      () => ScannerAdapters.semgrep.parseFindings(ctx),
      /Failed to parse Semgrep output/
    );
  });

  await t.test('Trivy throws on malformed JSON output instead of returning empty findings', () => {
    const corruptFile = path.join(tmpDir, 'trivy_corrupt.json');
    fs.writeFileSync(corruptFile, '{ "Results": TRUNCATED');

    const ctx: any = { jsonFile: corruptFile, targetUrl: tmpDir };
    assert.throws(
      () => ScannerAdapters.trivy.parseFindings(ctx),
      /Failed to parse Trivy output/
    );
  });

  await t.test('Schemathesis throws on malformed JSON output instead of returning empty findings', () => {
    const corruptFile = path.join(tmpDir, 'schemathesis_corrupt.json');
    fs.writeFileSync(corruptFile, '{ "events": [ { "status": ');

    const ctx: any = { jsonFile: corruptFile, targetUrl: 'https://api.example.com' };
    assert.throws(
      () => ScannerAdapters.schemathesis.parseFindings(ctx),
      /Failed to parse Schemathesis output/
    );
  });
});
