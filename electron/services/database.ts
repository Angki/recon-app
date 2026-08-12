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
  insertScan(scanId: string, target: string, status: string, startTime: string, config: Record<string, unknown>) {
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
    return scans.map((scanRaw: unknown) => {
      const scan = scanRaw as Record<string, unknown>;
      const parsedConfig = JSON.parse((scan.config as string) || '{}');
      const statuses = scanStatuses.filter((sRaw: unknown) => (sRaw as Record<string, unknown>).scanId === scan.scanId);
      const scannerStatuses = statuses.reduce((acc: Record<string, unknown>, currRaw: unknown) => {
        const curr = currRaw as Record<string, unknown>;
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
    const scanRecord = scan as Record<string, unknown>;
    const parsedConfig = JSON.parse((scanRecord.config as string) || '{}');
    const scannerStatuses = scanStatuses.reduce((acc: Record<string, unknown>, currRaw: unknown) => {
      const curr = currRaw as Record<string, unknown>;
      acc[`${curr.scanner}Status`] = curr.status;
      return acc;
    }, {});
    
    return {
      scanId: scanRecord.scanId,
      target: scanRecord.target,
      status: scanRecord.status,
      startTime: scanRecord.startTime,
      endTime: scanRecord.endTime,
      config: parsedConfig,
      ...scannerStatuses
    };
  }

  // Findings
  insertFinding(scanId: string, scanner: string, finding: Record<string, unknown>) {
    this.insertFindings(scanId, scanner, [finding]);
  }

  insertFindings(scanId: string, scanner: string, findings: Record<string, unknown>[]) {
    const stmt = this.db.prepare(`
      INSERT INTO findings (scanId, scanner, type, name, severity, url, description, rawJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: Record<string, unknown>[]) => {
      for (const finding of items) {
        const type = finding.id || 'unknown';
        const name = finding.name || 'Unknown Finding';
        const severity = finding.severity || 'info';
        const url = finding.url || '';
        const description = finding.description || '';
        stmt.run(scanId, scanner, type, name, severity, url, description, JSON.stringify(finding));
      }
    });

    insertMany(findings);
  }

  getFindingsPaginated(scanId: string, options: { page?: number, limit?: number, severity?: string, scanner?: string, search?: string }) {
    const page = options.page || 1;
    const limit = options.limit || 100;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM findings WHERE scanId = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM findings WHERE scanId = ?';
    const params: unknown[] = [scanId];

    if (options.severity && options.severity !== 'all') {
      query += ' AND severity = ?';
      countQuery += ' AND severity = ?';
      params.push(options.severity);
    }
    if (options.scanner && options.scanner !== 'all') {
      query += ' AND scanner = ?';
      countQuery += ' AND scanner = ?';
      params.push(options.scanner);
    }
    if (options.search) {
      query += ' AND (name LIKE ? OR url LIKE ? OR type LIKE ?)';
      countQuery += ' AND (name LIKE ? OR url LIKE ? OR type LIKE ?)';
      const searchParam = `%${options.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        WHEN 'info' THEN 5 
        ELSE 6 
      END, id DESC`;

    query += ' LIMIT ? OFFSET ?';
    
    const items = this.db.prepare(query).all(...params, limit, offset);
    const countRow = this.db.prepare(countQuery).get(...params) as Record<string, unknown>;

    return {
      findings: items.map((rowRaw: unknown) => {
        const row = rowRaw as Record<string, unknown>;
        const parsed = JSON.parse(row.rawJson as string);
        parsed._dbId = row.id;
        return parsed;
      }),
      total: countRow.total,
      page,
      limit
    };
  }

  getFindings(scanId: string) {
    return this.db.prepare('SELECT * FROM findings WHERE scanId = ?').all(scanId).map((rowRaw: unknown) => {
      const row = rowRaw as Record<string, unknown>;
      return JSON.parse(row.rawJson as string);
    });
  }
}

export const dbService = new DatabaseService();
