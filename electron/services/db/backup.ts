import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
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
   * Flushes WAL checkpoint and uses db.backup() for online transactional consistency.
   */
  async createBackup(db?: Database.Database, customFilename?: string): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = customFilename || `recon_app_backup_${timestamp}.sqlite`;
    const targetPath = path.join(this.backupDir, filename);

    if (db) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (err) {
        logger.warn(`wal_checkpoint notice before backup: ${err}`);
      }
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
   * Validate SQLite header, file structure, and PRAGMA integrity_check before restore.
   */
  validateBackupFile(filePath: string): { valid: boolean; reason?: string } {
    if (!fs.existsSync(filePath)) {
      return { valid: false, reason: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size < 100) {
      return { valid: false, reason: 'File size too small for SQLite database' };
    }

    // 1. Check first 16 bytes for standard SQLite header: "SQLite format 3\0"
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf-8');
    if (!header.startsWith('SQLite format 3')) {
      return { valid: false, reason: 'Invalid SQLite file header' };
    }

    // 2. Perform deep PRAGMA integrity_check
    try {
      const probeDb = new Database(filePath, { readonly: true, fileMustExist: true });
      try {
        const rows = probeDb.pragma('integrity_check') as { integrity_check?: string }[];
        const first = rows[0]?.integrity_check || (rows[0] as unknown as string);
        if (first !== 'ok') {
          return { valid: false, reason: `SQLite integrity check failed: ${first}` };
        }
      } finally {
        probeDb.close();
      }
    } catch (err) {
      return { valid: false, reason: `Unable to open SQLite database: ${err instanceof Error ? err.message : String(err)}` };
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
   * Enforce retention policy:
   * 1. Remove expired backups older than maxDays, but NEVER delete the single latest backup.
   * 2. If remaining total bytes exceed quota, prune oldest backups first until within quota.
   */
  enforceRetention(maxDays: number = 30, maxTotalBytes: number = 2 * 1024 * 1024 * 1024): RetentionResult {
    let deletedFiles = 0;
    let reclaimedBytes = 0;
    const now = Date.now();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    const allBackups = this.listBackups(); // Sorted newest first
    if (allBackups.length <= 1) {
      return { deletedFiles: 0, reclaimedBytes: 0 };
    }

    const newestBackup = allBackups[0]; // Guaranteed protected restore point
    const candidates = allBackups.slice(1); // Backups that may be pruned

    const survivors = [newestBackup];
    let totalBytes = newestBackup.sizeBytes;

    // Phase 1: Prune expired backups (excluding newestBackup)
    for (const backup of candidates) {
      const ageMs = now - backup.createdAt.getTime();
      if (ageMs > maxAgeMs) {
        try {
          fs.unlinkSync(backup.path);
          deletedFiles++;
          reclaimedBytes += backup.sizeBytes;
          logger.info(`Retention pruned expired backup: ${backup.filename} (${backup.sizeBytes} bytes)`);
        } catch (err) {
          logger.error(`Failed to prune expired backup ${backup.filename}: ${err}`);
        }
      } else {
        survivors.push(backup);
        totalBytes += backup.sizeBytes;
      }
    }

    // Phase 2: If totalBytes exceeds maxTotalBytes, prune OLDEST survivors first
    if (totalBytes > maxTotalBytes && survivors.length > 1) {
      // Sort survivors oldest-first for quota pruning
      const quotaCandidates = survivors.slice(1).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      for (const backup of quotaCandidates) {
        if (totalBytes <= maxTotalBytes) break;
        try {
          fs.unlinkSync(backup.path);
          deletedFiles++;
          reclaimedBytes += backup.sizeBytes;
          totalBytes -= backup.sizeBytes;
          logger.info(`Retention pruned excess quota backup: ${backup.filename} (${backup.sizeBytes} bytes)`);
        } catch (err) {
          logger.error(`Failed to prune excess backup ${backup.filename}: ${err}`);
        }
      }
    }

    return { deletedFiles, reclaimedBytes };
  }
}
