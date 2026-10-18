import fs from 'fs';
import path from 'path';
import os from 'os';
import type Database from 'better-sqlite3';
import { logger } from '../logger';

export interface BackupResult {
  backupPath: string;
  timestamp: string;
  sizeBytes: number;
}

export interface RetentionResult {
  deletedFiles: number;
  reclaimedBytes: number;
}

export class BackupManager {
  private baseDir: string;
  private backupDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(os.homedir(), 'Documents', 'SecOpsScans');
    this.backupDir = path.join(this.baseDir, 'backups');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  getBackupDir(): string {
    return this.backupDir;
  }

  /**
   * Safely create a timestamped database backup.
   * If a live better-sqlite3 instance is provided, use db.backup() for online transactional consistency.
   */
  async createBackup(db?: Database.Database, customFilename?: string): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = customFilename || `recon_app_backup_${timestamp}.sqlite`;
    const targetPath = path.join(this.backupDir, filename);

    if (db) {
      // Use SQLite online backup API
      await db.backup(targetPath);
    } else {
      // File-level snapshot fallback
      const sourceDbPath = path.join(this.baseDir, 'recon_app.sqlite');
      if (!fs.existsSync(sourceDbPath)) {
        throw new Error(`Source database does not exist: ${sourceDbPath}`);
      }
      fs.copyFileSync(sourceDbPath, targetPath);
    }

    const stat = fs.statSync(targetPath);
    logger.info(`Database backup created: ${targetPath} (${stat.size} bytes)`);

    return {
      backupPath: targetPath,
      timestamp,
      sizeBytes: stat.size
    };
  }

  /**
   * Validate SQLite header and file integrity before restore.
   */
  validateBackupFile(filePath: string): { valid: boolean; reason?: string } {
    if (!fs.existsSync(filePath)) {
      return { valid: false, reason: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size < 100) {
      return { valid: false, reason: 'File size too small for SQLite database' };
    }

    // Check first 16 bytes for standard SQLite header: "SQLite format 3\0"
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf-8');
    if (!header.startsWith('SQLite format 3')) {
      return { valid: false, reason: 'Invalid SQLite file header' };
    }

    return { valid: true };
  }

  /**
   * List all existing backups sorted newest first.
   */
  listBackups(): { filename: string; path: string; sizeBytes: number; createdAt: Date }[] {
    if (!fs.existsSync(this.backupDir)) return [];
    const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.sqlite'));
    return files.map(file => {
      const fullPath = path.join(this.backupDir, file);
      const stat = fs.statSync(fullPath);
      return {
        filename: file,
        path: fullPath,
        sizeBytes: stat.size,
        createdAt: stat.mtime
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Enforce retention policy: remove backups older than maxDays, or when total size exceeds quota.
   */
  enforceRetention(maxDays: number = 30, maxTotalBytes: number = 2 * 1024 * 1024 * 1024): RetentionResult {
    let deletedFiles = 0;
    let reclaimedBytes = 0;
    const now = Date.now();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    const backups = this.listBackups(); // already sorted newest first

    let totalBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

    for (const backup of backups) {
      const ageMs = now - backup.createdAt.getTime();
      const isExpired = ageMs > maxAgeMs;
      const exceedsQuota = totalBytes > maxTotalBytes;

      if (isExpired || exceedsQuota) {
        try {
          fs.unlinkSync(backup.path);
          deletedFiles++;
          reclaimedBytes += backup.sizeBytes;
          totalBytes -= backup.sizeBytes;
          logger.info(`Retention pruned backup: ${backup.filename} (${backup.sizeBytes} bytes)`);
        } catch (err) {
          logger.error(`Failed to prune backup ${backup.filename}: ${err}`);
        }
      }
    }

    return { deletedFiles, reclaimedBytes };
  }
}
