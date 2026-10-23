import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { format } from 'date-fns';
let electronShell: { showItemInFolder: (path: string) => void } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron');
  electronShell = electron.shell || null;
} catch {
  // Running outside electron (e.g. tests)
}
import { dbService } from './database';
import crypto from 'crypto';
import { ScanStateMachine, type ScanState } from './runner/stateMachine';

class Mutex {
  private queue: Promise<unknown> = Promise.resolve();
  async run<T>(task: () => Promise<T>): Promise<T> {
    const p = this.queue.then(task, task);
    this.queue = p.catch(() => {});
    return p;
  }
}

export class StorageService {
  private baseDir: string;
  private reportsDir: string;
  private locks: Map<string, Mutex> = new Map();

  private getLock(scanId: string) {
    if (!this.locks.has(scanId)) this.locks.set(scanId, new Mutex());
    return this.locks.get(scanId)!;
  }

  constructor() {
    this.baseDir = path.join(os.homedir(), 'Documents', 'SecOpsScans');
    this.reportsDir = path.join(this.baseDir, 'reports');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
    this.migrateOldData();
  }

  private migrateOldData() {
    if (!fs.existsSync(this.reportsDir)) return;
    
    // Check if migration has already been run (by checking if any data exists in DB)
    const history = dbService.getHistory();
    if (history.length > 0) return;

    logger.info('Migrating old JSON scan history to SQLite...');
    const scans = fs.readdirSync(this.reportsDir);
    
    for (const scanId of scans) {
      const metaPath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          dbService.insertScan(
            meta.scanId || scanId, 
            meta.target || '', 
            meta.status || 'UNKNOWN', 
            meta.startTime || new Date().toISOString(), 
            meta.config || {}
          );
          
          if (meta.endTime) {
            dbService.updateScanStatus(meta.scanId || scanId, meta.status, meta.endTime);
          }

          // Insert scanner statuses
          for (const key of Object.keys(meta)) {
            if (key.endsWith('Status')) {
              const scanner = key.replace('Status', '');
              if (scanner) {
                dbService.updateScannerStatus(meta.scanId || scanId, scanner, meta[key]);
              }
            }
          }
        } catch (e) {
          logger.error(`Failed to migrate metadata for ${scanId}`, e);
        }
      }
    }
    logger.info('Migration complete.');
  }

  createScanDirectory(domain: string): { scanId: string, scanDir: string, nucleiDir: string, wapitiDir: string } {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const rand = crypto.randomUUID().slice(0, 8);
    const safeDomain = domain.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const scanId = `${safeDomain}_${timestamp}_${rand}`;
    
    const scanDir = path.join(this.reportsDir, scanId);
    const nucleiDir = path.join(scanDir, 'nuclei');
    const wapitiDir = path.join(scanDir, 'wapiti');
    const logsDir = path.join(scanDir, 'logs');

    fs.mkdirSync(nucleiDir, { recursive: true });
    fs.mkdirSync(wapitiDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    logger.info(`Created scan directory for ${scanId}`);
    
    return { scanId, scanDir, nucleiDir, wapitiDir };
  }

  getScanDir(scanId: string): string {
    return path.join(this.reportsDir, scanId);
  }

  getReportsDir(): string {
    return this.reportsDir;
  }

  async saveMetadata(scanId: string, data: Record<string, unknown>) {
    // Save to SQLite
    dbService.insertScan(scanId, (data.target as string) || '', (data.status as string) || 'RUNNING', (data.startTime as string) || new Date().toISOString(), (data.config as Record<string, unknown>) || {});

    // Save to JSON for backwards compatibility or output folder completeness
    const filePath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
    return this.getLock(scanId).run(async () => {
      await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
    });
  }

  getHistory(): Record<string, unknown>[] {
    return dbService.getHistory();
  }

  openFolder(scanId: string) {
    if (!scanId || typeof scanId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(scanId)) {
      logger.warn(`openFolder rejected invalid scanId: ${scanId}`);
      return;
    }
    const resolved = path.resolve(this.reportsDir, scanId);
    if (!resolved.startsWith(path.resolve(this.reportsDir))) {
      logger.warn(`openFolder path traversal attempt blocked: ${scanId}`);
      return;
    }
    if (fs.existsSync(resolved) && electronShell) {
      electronShell.showItemInFolder(resolved);
    }
  }

  /** Update the status in the persisted metadata file and SQLite.
   *  If `scanner` is provided, sets e.g. nucleiStatus / wapitiStatus plus the
   *  outcome details (reason, exit code, artifact, result count, duration).
   *  Always re-evaluates the overall `status` field without overwriting terminal STOPPED state. */
  async updateStatus(
    scanId: string,
    scanner: string | null,
    status: string,
    details: {
      reason?: string;
      exitCode?: number | null;
      artifactPath?: string;
      resultCount?: number;
      durationMs?: number;
    } = {}
  ) {
    // 1. Update SQLite
    if (scanner) {
      dbService.updateScannerStatus(scanId, scanner, status, details);
    } else {
      dbService.updateScanStatus(scanId, status, ScanStateMachine.isTerminal(status as ScanState) ? new Date().toISOString() : undefined);
    }
    
    // Update overall status in SQLite
    const scan = dbService.getScanById(scanId);
    if (scan) {
      const tools: string[] = (scan.config as { tools?: string[] })?.tools || [];
      const toolStates: Record<string, string> = {};
      for (const t of tools) {
        toolStates[t] = ((scan as Record<string, unknown>)[`${t}Status`] as string) || 'RUNNING';
      }

      const aggregate = ScanStateMachine.computeAggregateState(
        (scan.status as ScanState) || 'RUNNING',
        toolStates,
        tools
      );
      const isTerminal = ScanStateMachine.isTerminal(aggregate);
      dbService.updateScanStatus(scanId, aggregate, isTerminal ? new Date().toISOString() : undefined);
    }

    // 2. Update JSON for output folder completeness
    const metaPath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
    if (!fs.existsSync(metaPath)) return;

    return this.getLock(scanId).run(async () => {
      try {
        const meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));

        if (scanner) {
          meta[`${scanner}Status`] = status;
          meta.engineStatuses = {
            ...(meta.engineStatuses && typeof meta.engineStatuses === 'object' ? meta.engineStatuses : {}),
            [scanner]: {
              status,
              ...details,
              updatedAt: new Date().toISOString()
            }
          };
        } else {
          meta.status = status;
          if (ScanStateMachine.isTerminal(status as ScanState)) {
            meta.endTime = meta.endTime || new Date().toISOString();
            for (const key of Object.keys(meta)) {
              if (key.endsWith('Status') && meta[key] === 'RUNNING') {
                meta[key] = status;
              }
            }
          }
        }

        const tools: string[] = meta.config?.tools || [];
        const toolStates: Record<string, string> = {};
        for (const t of tools) {
          toolStates[t] = (meta[`${t}Status`] as string) || 'RUNNING';
        }

        const aggregate = ScanStateMachine.computeAggregateState(
          (meta.status as ScanState) || 'RUNNING',
          toolStates,
          tools
        );
        meta.status = aggregate;
        if (ScanStateMachine.isTerminal(aggregate)) {
          meta.endTime = meta.endTime || new Date().toISOString();
        }

        await fsPromises.writeFile(metaPath, JSON.stringify(meta, null, 2));

        if (ScanStateMachine.isTerminal(aggregate)) {
          this.locks.delete(scanId);
        }
      } catch (err) {
        logger.error(`Failed to update status for ${scanId}`, err);
      }
    });
  }

  deleteScan(scanId: string): boolean {
    if (!scanId || typeof scanId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(scanId)) {
      throw new Error('Invalid scanId: path traversal or invalid characters detected');
    }
    const scan = dbService.getScanById(scanId);
    if (scan) {
      const activeStates = ['RUNNING', 'VALIDATING', 'PARSING', 'QUEUED'];
      if (activeStates.includes(String(scan.status || '').toUpperCase())) {
        throw new Error(`Cannot delete active scan ${scanId} (status: ${scan.status}). Stop or cancel the scan first.`);
      }
    }

    const scanDir = path.join(this.reportsDir, scanId);
    if (fs.existsSync(scanDir)) {
      try {
        fs.rmSync(scanDir, { recursive: true, force: true });
        logger.info(`Deleted scan artifact directory: ${scanDir}`);
      } catch (err) {
        logger.error(`Failed to delete scan directory ${scanDir}: ${err}`);
      }
    }
    this.locks.delete(scanId);
    dbService.deleteScan(scanId);
    return true;
  }

  clearAllScans(): boolean {
    const history = dbService.getHistory();
    const activeStates = ['RUNNING', 'VALIDATING', 'PARSING', 'QUEUED'];
    const activeScan = history.find(s => activeStates.includes(String(s.status || '').toUpperCase()));
    if (activeScan) {
      throw new Error(`Cannot clear all scans: scan ${activeScan.scanId} is currently active (${activeScan.status}). Stop active scans first.`);
    }

    if (fs.existsSync(this.reportsDir)) {
      try {
        const entries = fs.readdirSync(this.reportsDir);
        for (const entry of entries) {
          const fullPath = path.join(this.reportsDir, entry);
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
        logger.info('Cleared all scan artifact directories');
      } catch (err) {
        logger.error(`Failed to clear report directories: ${err}`);
      }
    }
    this.locks.clear();
    dbService.clearAllScans();
    return true;
  }
}

export const storage = new StorageService();
