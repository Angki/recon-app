import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import { logger } from './logger';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const baseDir = path.join(os.homedir(), 'Documents', 'SecOpsScans');
    const dbPath = path.join(baseDir, 'recon_app.sqlite');
    this.db = new Database(dbPath, { verbose: logger.debug });
    this.initSchema();
  }

  private initSchema() {
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scans (
        scanId TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        config TEXT
      );

      CREATE TABLE IF NOT EXISTS scan_status (
        scanId TEXT NOT NULL,
        scanner TEXT NOT NULL,
        status TEXT NOT NULL,
        PRIMARY KEY (scanId, scanner),
        FOREIGN KEY (scanId) REFERENCES scans(scanId) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scanId TEXT NOT NULL,
        scanner TEXT NOT NULL,
        type TEXT,
        name TEXT,
        severity TEXT,
        url TEXT,
        description TEXT,
        rawJson TEXT,
        FOREIGN KEY (scanId) REFERENCES scans(scanId) ON DELETE CASCADE
      );
    `);
  }

  // Scans
  insertScan(scanId: string, target: string, status: string, startTime: string, config: any) {
    const stmt = this.db.prepare('INSERT INTO scans (scanId, target, status, startTime, config) VALUES (?, ?, ?, ?, ?)');
    stmt.run(scanId, target, status, startTime, JSON.stringify(config));
  }

  updateScanStatus(scanId: string, status: string, endTime?: string) {
    if (endTime) {
      const stmt = this.db.prepare('UPDATE scans SET status = ?, endTime = ? WHERE scanId = ?');
      stmt.run(status, endTime, scanId);
    } else {
      const stmt = this.db.prepare('UPDATE scans SET status = ? WHERE scanId = ?');
      stmt.run(status, scanId);
    }
  }

  updateScannerStatus(scanId: string, scanner: string, status: string) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO scan_status (scanId, scanner, status) VALUES (?, ?, ?)');
    stmt.run(scanId, scanner, status);
  }

  getHistory() {
    const scans = this.db.prepare('SELECT * FROM scans ORDER BY startTime DESC').all();
    const scanStatuses = this.db.prepare('SELECT * FROM scan_status').all();

    // Map statuses back to scan metadata shape for backward compatibility
    return scans.map((scan: any) => {
      const parsedConfig = JSON.parse(scan.config || '{}');
      const statuses = scanStatuses.filter((s: any) => s.scanId === scan.scanId);
      const scannerStatuses = statuses.reduce((acc: any, curr: any) => {
        acc[`${curr.scanner}Status`] = curr.status;
        return acc;
      }, {});

      return {
        scanId: scan.scanId,
        target: scan.target,
        status: scan.status,
        startTime: scan.startTime,
        endTime: scan.endTime,
        config: parsedConfig,
        ...scannerStatuses
      };
    });
  }

  getScanById(scanId: string) {
    const scan = this.db.prepare('SELECT * FROM scans WHERE scanId = ?').get(scanId);
    if (!scan) return null;
    const scanStatuses = this.db.prepare('SELECT * FROM scan_status WHERE scanId = ?').all(scanId);
    const parsedConfig = JSON.parse((scan as any).config || '{}');
    const scannerStatuses = scanStatuses.reduce((acc: any, curr: any) => {
      acc[`${curr.scanner}Status`] = curr.status;
      return acc;
    }, {});
    
    return {
      scanId: (scan as any).scanId,
      target: (scan as any).target,
      status: (scan as any).status,
      startTime: (scan as any).startTime,
      endTime: (scan as any).endTime,
      config: parsedConfig,
      ...scannerStatuses
    };
  }

  // Findings
  insertFinding(scanId: string, scanner: string, finding: any) {
    const stmt = this.db.prepare(`
      INSERT INTO findings (scanId, scanner, type, name, severity, url, description, rawJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Normalize data slightly based on what tools output
    const type = finding.type || finding['template-id'] || finding.plugin || 'unknown';
    const name = finding.name || finding.info?.name || finding.alert || 'Unknown Finding';
    const severity = finding.severity || finding.info?.severity || finding.risk || 'info';
    const url = finding.url || finding['matched-at'] || finding.path || finding.url || '';
    const description = finding.description || finding.info?.description || finding.desc || '';
    
    stmt.run(scanId, scanner, type, name, severity, url, description, JSON.stringify(finding));
  }

  getFindings(scanId: string) {
    return this.db.prepare('SELECT * FROM findings WHERE scanId = ?').all(scanId).map((row: any) => JSON.parse(row.rawJson));
  }
}

export const dbService = new DatabaseService();
