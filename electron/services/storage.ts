import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { format } from 'date-fns';
import { shell } from 'electron';
import { dbService } from './database';

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
    const safeDomain = domain.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const scanId = `${safeDomain}_${timestamp}`;
    
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
    const folderPath = path.join(this.reportsDir, scanId);
    if (fs.existsSync(folderPath)) {
      shell.showItemInFolder(folderPath);
    }
  }

  /** Update the status in the persisted metadata file and SQLite.
   *  If `scanner` is provided, sets e.g. nucleiStatus / wapitiStatus.
   *  Always re-evaluates the overall `status` field. */
  async updateStatus(scanId: string, scanner: string | null, status: string) {
    // 1. Update SQLite
    if (scanner) {
      dbService.updateScannerStatus(scanId, scanner, status);
    } else {
      dbService.updateScanStatus(scanId, status, status === 'STOPPED' || status === 'COMPLETED' || status === 'FAILED' ? new Date().toISOString() : undefined);
    }
    
    // Update overall status in SQLite
    const scan = dbService.getScanById(scanId);
    if (scan) {
      const tools: string[] = scan.config?.tools || [];
      const terminal = ['COMPLETED', 'FAILED', 'STOPPED'];
      let allTerminal = true;
      let anyFailed = false;

      for (const t of tools) {
        const tStatus = (scan as Record<string, unknown>)[`${t}Status`] as string || 'RUNNING';
        if (!terminal.includes(tStatus)) allTerminal = false;
        if (tStatus === 'FAILED') anyFailed = true;
      }

      if (status === 'STOPPED') {
        dbService.updateScanStatus(scanId, 'STOPPED', new Date().toISOString());
      } else if (allTerminal && tools.length > 0) {
        dbService.updateScanStatus(scanId, anyFailed ? 'FAILED' : 'COMPLETED', new Date().toISOString());
      }
    }

    // 2. Update JSON for output folder completeness
    const metaPath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
    if (!fs.existsSync(metaPath)) return;

    return this.getLock(scanId).run(async () => {
      try {
        const meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));

        if (scanner) {
          meta[`${scanner}Status`] = status;
        }

        const tools: string[] = meta.config?.tools || [];
        const terminal = ['COMPLETED', 'FAILED', 'STOPPED'];
        let allTerminal = true;
        let anyFailed = false;

        for (const t of tools) {
          const tStatus = meta[`${t}Status`] || 'RUNNING';
          if (!terminal.includes(tStatus)) allTerminal = false;
          if (tStatus === 'FAILED') anyFailed = true;
        }

        if (status === 'STOPPED') {
          meta.status = 'STOPPED';
          meta.endTime = new Date().toISOString();
        } else if (allTerminal && tools.length > 0) {
          meta.status = anyFailed ? 'FAILED' : 'COMPLETED';
          meta.endTime = new Date().toISOString();
        }

        await fsPromises.writeFile(metaPath, JSON.stringify(meta, null, 2));
      } catch (err) {
        logger.error(`Failed to update status for ${scanId}`, err);
      }
    });
  }
}

export const storage = new StorageService();
