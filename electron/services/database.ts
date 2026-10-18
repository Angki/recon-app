import fs from 'fs';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { ScanStateMachine } from './runner/stateMachine';
import { MigrationManager } from './db/migrations';
import { computeFindingFingerprint } from './db/fingerprint';
import { BaselineComparator, type BaselineComparisonResult } from './db/baseline';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const baseDir = path.join(os.homedir(), 'Documents', 'SecOpsScans');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const dbPath = path.join(baseDir, 'recon_app.sqlite');
    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? (message?: unknown, ...args: unknown[]) => logger.debug(message, ...args) : undefined
    });
    this.initSchema();
  }

  private initSchema() {
    this.db.pragma('journal_mode = WAL');
    MigrationManager.runMigrations(this.db);
    this.initWorkspaceSchema();
    ScanStateMachine.recoverDanglingScans(this);
  }

  private initWorkspaceSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS engagements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        targetType TEXT NOT NULL,
        targetCanonical TEXT NOT NULL,
        scopeJson TEXT NOT NULL,
        budgetJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS requests_workspace (
        id TEXT PRIMARY KEY,
        engagementId TEXT,
        scanId TEXT,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        queryJson TEXT,
        headersJson TEXT,
        cookiesJson TEXT,
        contentType TEXT,
        body TEXT,
        authProfileId TEXT,
        testParametersJson TEXT,
        provenanceJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        authType TEXT NOT NULL,
        secretRef TEXT NOT NULL,
        headerName TEXT,
        expiresAt TEXT,
        sessionHealthJson TEXT,
        csrfConfigJson TEXT,
        refreshConfigJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  }

  getRawDatabase(): Database.Database {
    return this.db;
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

  getDanglingScans(): { scanId: string; status: string }[] {
    const stmt = this.db.prepare("SELECT scanId, status FROM scans WHERE status IN ('RUNNING', 'VALIDATING', 'PARSING', 'QUEUED')");
    return stmt.all() as { scanId: string; status: string }[];
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

  deleteScan(scanId: string) {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM findings WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM observations WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM endpoints WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM scan_status WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM scans WHERE scanId = ?').run(scanId);
    });
    tx();
  }

  clearAllScans() {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM findings').run();
      this.db.prepare('DELETE FROM observations').run();
      this.db.prepare('DELETE FROM endpoints').run();
      this.db.prepare('DELETE FROM scan_status').run();
      this.db.prepare('DELETE FROM scans').run();
    });
    tx();
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
      INSERT INTO findings (scanId, scanner, type, name, severity, url, description, rawJson, fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: Record<string, unknown>[]) => {
      for (const finding of items) {
        const type = String(finding.id || 'unknown');
        const name = String(finding.name || 'Unknown Finding');
        const severity = String(finding.severity || 'info');
        const url = String(finding.url || '');
        const description = String(finding.description || '');
        const fingerprint = computeFindingFingerprint({
          scanner,
          type,
          name,
          url,
          param: finding.param ? String(finding.param) : undefined,
          filePath: finding.filePath ? String(finding.filePath) : finding.file ? String(finding.file) : undefined,
          lineNumber: finding.lineNumber !== undefined ? Number(finding.lineNumber) : finding.line !== undefined ? Number(finding.line) : undefined,
          ruleId: finding.ruleId ? String(finding.ruleId) : finding.rule ? String(finding.rule) : undefined,
          packageName: finding.packageName ? String(finding.packageName) : finding.package ? String(finding.package) : undefined,
          packageVersion: finding.packageVersion ? String(finding.packageVersion) : finding.version ? String(finding.version) : undefined,
          cveId: finding.cveId ? String(finding.cveId) : undefined
        });
        finding.fingerprint = fingerprint;
        stmt.run(scanId, scanner, type, name, severity, url, description, JSON.stringify(finding), fingerprint);
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
        parsed.fingerprint = row.fingerprint;
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
      const parsed = JSON.parse(row.rawJson as string);
      parsed.fingerprint = row.fingerprint;
      return parsed;
    });
  }

  // Observations
  insertObservation(scanId: string, toolName: string, assetType: string, value: string, metadata: Record<string, unknown> = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO observations (scanId, toolName, assetType, value, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(scanId, toolName, assetType, value, JSON.stringify(metadata), new Date().toISOString());
  }

  getObservations(scanId: string) {
    return this.db.prepare('SELECT * FROM observations WHERE scanId = ? ORDER BY id ASC').all(scanId) as Record<string, unknown>[];
  }

  // Triage Decisions
  setTriageDecision(fingerprint: string, status: string, reason?: string, actor?: string, expiresAt?: string) {
    const stmt = this.db.prepare(`
      INSERT INTO triage_decisions (fingerprint, status, reason, actor, timestamp, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(fingerprint, status, reason || '', actor || 'operator', new Date().toISOString(), expiresAt || null);
  }

  getTriageDecisions(fingerprint?: string) {
    if (fingerprint) {
      return this.db.prepare('SELECT * FROM triage_decisions WHERE fingerprint = ? ORDER BY id DESC').all(fingerprint) as Record<string, unknown>[];
    }
    return this.db.prepare('SELECT * FROM triage_decisions ORDER BY id DESC').all() as Record<string, unknown>[];
  }

  // Baseline Comparison
  compareWithBaseline(currentScanId: string, baselineScanId: string): BaselineComparisonResult {
    return BaselineComparator.compare(currentScanId, baselineScanId, this.db);
  }
}

export const dbService = new DatabaseService();
