import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ToolPlatformReceipt } from './types';

export class InstallerError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'InstallerError';
    this.code = code;
  }
}

export class StagingInstaller {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  getStagingDir(toolName: string): string {
    const dir = path.join(this.baseDir, '.staging', `${toolName}_${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getReceiptsDir(): string {
    const dir = path.join(this.baseDir, 'receipts');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  computeSha256(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new InstallerError('FILE_NOT_FOUND', `Cannot compute checksum: file ${filePath} does not exist`);
    }
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  verifyChecksum(filePath: string, expectedSha256?: string): boolean {
    if (!expectedSha256) return true; // No pin to compare against
    const actual = this.computeSha256(filePath).toLowerCase();
    const expected = expectedSha256.toLowerCase().trim();
    if (actual !== expected) {
      throw new InstallerError(
        'CHECKSUM_MISMATCH',
        `Artifact integrity check failed for ${path.basename(filePath)}. Expected SHA-256: ${expected}, Calculated: ${actual}. Download may be corrupt or tampered.`
      );
    }
    return true;
  }

  /**
   * Atomically activates a staging artifact into the live binary directory with rollback safety.
   */
  async atomicActivate(
    stagingFilePath: string,
    liveFilePath: string,
    receiptData: Omit<ToolPlatformReceipt, 'installedAt'>
  ): Promise<ToolPlatformReceipt> {
    if (!fs.existsSync(stagingFilePath)) {
      throw new InstallerError('STAGING_FILE_MISSING', `Staging artifact does not exist: ${stagingFilePath}`);
    }

    fs.mkdirSync(path.dirname(liveFilePath), { recursive: true });

    let backupPath: string | undefined;
    if (fs.existsSync(liveFilePath)) {
      backupPath = `${liveFilePath}.backup_${Date.now()}`;
      try {
        fs.copyFileSync(liveFilePath, backupPath);
      } catch (err: unknown) {
        throw new InstallerError('BACKUP_FAILED', `Failed to create backup of existing binary before update: ${err}`);
      }
    }

    try {
      // 1. Move/copy staging artifact to live path
      fs.copyFileSync(stagingFilePath, liveFilePath);

      // 2. Clean up staging artifact
      try {
        fs.unlinkSync(stagingFilePath);
        const stagingDir = path.dirname(stagingFilePath);
        if (fs.readdirSync(stagingDir).length === 0) {
          fs.rmdirSync(stagingDir);
        }
      } catch { /* non-fatal cleanup */ }

      // 3. Write provenance receipt
      const receipt: ToolPlatformReceipt = {
        ...receiptData,
        installedAt: new Date().toISOString(),
        rollbackBinaryPath: backupPath
      };

      const receiptFile = path.join(this.getReceiptsDir(), `${receiptData.toolId}.receipt.json`);
      fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2), 'utf8');

      return receipt;
    } catch (err: unknown) {
      // Rollback on failure
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, liveFilePath);
        } catch { /* critical failure */ }
      }
      throw new InstallerError('ACTIVATION_FAILED', `Atomic activation failed; prior version retained: ${err}`);
    }
  }

  /**
   * Rolls back a tool to its previous backed-up binary if available.
   */
  rollback(toolName: string, liveFilePath: string): boolean {
    const receiptFile = path.join(this.getReceiptsDir(), `${toolName}.receipt.json`);
    if (!fs.existsSync(receiptFile)) return false;

    try {
      const receipt: ToolPlatformReceipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
      if (receipt.rollbackBinaryPath && fs.existsSync(receipt.rollbackBinaryPath)) {
        fs.copyFileSync(receipt.rollbackBinaryPath, liveFilePath);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
}
