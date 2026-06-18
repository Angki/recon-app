import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { format } from 'date-fns';
import { shell } from 'electron';

class Mutex {
  private queue: Promise<any> = Promise.resolve();
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

  async saveMetadata(scanId: string, data: any) {
    const filePath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
    return this.getLock(scanId).run(async () => {
      await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
    });
  }

  getHistory(): any[] {
    if (!fs.existsSync(this.reportsDir)) return [];
    
    const scans = fs.readdirSync(this.reportsDir);
    const history: any[] = [];
    
    for (const scanId of scans) {
      const metaPath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          history.push(meta);
        } catch (e) {
          logger.error(`Failed to parse metadata for ${scanId}`, e);
        }
      }
    }
    
    return history.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  openFolder(scanId: string) {
    const folderPath = path.join(this.reportsDir, scanId);
    if (fs.existsSync(folderPath)) {
      shell.showItemInFolder(folderPath);
    }
  }

  /** Update the status in the persisted metadata file.
   *  If `scanner` is provided, sets e.g. nucleiStatus / wapitiStatus.
   *  Always re-evaluates the overall `status` field. */
  async updateStatus(scanId: string, scanner: string | null, status: string) {
    const metaPath = path.join(this.reportsDir, scanId, 'scan_metadata.json');
    if (!fs.existsSync(metaPath)) return;

    return this.getLock(scanId).run(async () => {
      try {
        const meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));

        if (scanner) {
          meta[`${scanner}Status`] = status;
        }

        // Derive overall status from individual scanner statuses dynamically
        const tools: string[] = meta.config?.tools || [];
        const terminal = ['COMPLETED', 'FAILED', 'STOPPED'];
        let allTerminal = true;
        let anyFailed = false;

        for (const t of tools) {
          const tStatus = meta[`${t}Status`] || 'RUNNING';
          if (!terminal.includes(tStatus)) {
            allTerminal = false;
          }
          if (tStatus === 'FAILED') {
            anyFailed = true;
          }
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
