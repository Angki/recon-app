import fs from 'fs';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logger } from './logger';
import { ScanStateMachine } from './runner/stateMachine';
import { MigrationManager } from './db/migrations';
import { computeFindingFingerprint, normalizeLocation, type FingerprintSource } from './db/fingerprint';
import { BaselineComparator, type BaselineComparisonResult } from './db/baseline';

export interface EngineStatusDetail {
  status: string;
  reason?: string;
  exitCode?: number | null;
  artifactPath?: string;
  resultCount?: number;
  durationMs?: number;
  updatedAt?: string;
}

const INVENTORY_SCANNERS = new Set([
  'subfinder', 'alterx', 'dnsx', 'httpx', 'tlsx', 'naabu', 'katana', 'gau',
  'ffuf', 'arjun', 'whatweb', 'wafw00f', 'nmap', 'cmseek'
]);

const FLAW_SIGNATURES: Array<[RegExp, string]> = [
  [/cross[- ]site scripting|\bxss\b|script injection/i, 'xss'],
  [/sql injection|\bsqli\b|sql-injection/i, 'sqli'],
  [/path traversal|directory traversal|local file inclusion|\blfi\b/i, 'path-traversal'],
  [/remote code execution|command injection|command execution|os command|\brce\b/i, 'rce'],
  [/open redirect|url redirection/i, 'open-redirect'],
  [/cross[- ]site request forgery|\bcsrf\b/i, 'csrf'],
  [/server[- ]side request forgery|\bssrf\b/i, 'ssrf'],
  [/xml external entit|\bxxe\b/i, 'xxe'],
  [/insecure direct object|\bidor\b/i, 'idor'],
  [/security header|content[- ]security[- ]policy|strict[- ]transport[- ]security|\bhsts\b|x[- ]frame[- ]options|referrer[- ]policy|permissions[- ]policy/i, 'security-headers'],
  [/cookie.*(secure|httponly|samesite)|session cookie/i, 'cookie-flags'],
  [/information disclosure|version disclosure|server banner/i, 'info-disclosure'],
];

function flawSignature(finding: Record<string, unknown>): string {
  const cve = finding.cveId || finding.cve || finding.cve_id;
  if (cve) return `cve:${String(cve).toLowerCase().trim()}`;
  const id = String(finding.id || '').toLowerCase().trim();
  // Posture checks and advisory correlations have stable, unique IDs; collapsing
  // them through the heuristic signatures would silently drop valid findings.
  if (/^(posture|advisory)-/.test(id)) return id;
  const haystack = `${String(finding.id || '')} ${String(finding.name || '')}`;
  for (const [pattern, signature] of FLAW_SIGNATURES) {
    if (pattern.test(haystack)) return signature;
  }
  return haystack.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isInventoryFinding(scanner: string, finding: Record<string, unknown>): boolean {
  const severity = String(finding.severity || 'info').toLowerCase();
  if (severity !== 'info') return false;
  const id = String(finding.id || '').toLowerCase();
  if (id.includes('open-ports') || id.includes('directory') || id.includes('endpoint') || id.includes('tech')) return true;
  return INVENTORY_SCANNERS.has(scanner.toLowerCase());
}

function normalizeEvidence(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildFingerprintSource(scanner: string, finding: Record<string, unknown>): FingerprintSource {
  return {
    scanner,
    type: String(finding.id || finding.type || 'unknown'),
    name: String(finding.name || 'Unknown Finding'),
    url: String(finding.url || ''),
    param: finding.param ? String(finding.param) : finding.parameter ? String(finding.parameter) : undefined,
    filePath: finding.filePath ? String(finding.filePath) : finding.file ? String(finding.file) : undefined,
    lineNumber: finding.lineNumber !== undefined ? Number(finding.lineNumber) : finding.line !== undefined ? Number(finding.line) : undefined,
    ruleId: finding.ruleId ? String(finding.ruleId) : finding.rule ? String(finding.rule) : undefined,
    packageName: finding.packageName ? String(finding.packageName) : finding.package ? String(finding.package) : undefined,
    packageVersion: finding.packageVersion ? String(finding.packageVersion) : finding.version ? String(finding.version) : undefined,
    cveId: finding.cveId ? String(finding.cveId) : undefined
  };
}

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
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id TEXT PRIMARY KEY,
        scanId TEXT NOT NULL,
        preset TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        analysisText TEXT NOT NULL,
        contextVersion TEXT,
        evidenceIdsJson TEXT,
        createdAt TEXT NOT NULL
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

  updateScannerStatus(scanId: string, scanner: string, status: string, details: Partial<Omit<EngineStatusDetail, 'status'>> = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO scan_status (scanId, scanner, status, reason, exitCode, artifactPath, resultCount, durationMs, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scanId, scanner) DO UPDATE SET
        status = excluded.status,
        reason = COALESCE(excluded.reason, scan_status.reason),
        exitCode = COALESCE(excluded.exitCode, scan_status.exitCode),
        artifactPath = COALESCE(excluded.artifactPath, scan_status.artifactPath),
        resultCount = COALESCE(excluded.resultCount, scan_status.resultCount),
        durationMs = COALESCE(excluded.durationMs, scan_status.durationMs),
        updatedAt = excluded.updatedAt
    `);
    stmt.run(
      scanId,
      scanner,
      status,
      details.reason ?? null,
      details.exitCode === undefined ? null : details.exitCode,
      details.artifactPath ?? null,
      details.resultCount === undefined ? null : details.resultCount,
      details.durationMs === undefined ? null : details.durationMs,
      new Date().toISOString()
    );
  }

  private decodeEngineStatuses(rows: unknown[]): { compat: Record<string, string>; details: Record<string, EngineStatusDetail> } {
    const compat: Record<string, string> = {};
    const details: Record<string, EngineStatusDetail> = {};
    for (const entry of rows) {
      const row = entry as Record<string, unknown>;
      const scanner = String(row.scanner);
      compat[`${scanner}Status`] = String(row.status);
      details[scanner] = {
        status: String(row.status),
        reason: row.reason ? String(row.reason) : undefined,
        exitCode: row.exitCode === null || row.exitCode === undefined ? undefined : Number(row.exitCode),
        artifactPath: row.artifactPath ? String(row.artifactPath) : undefined,
        resultCount: row.resultCount === null || row.resultCount === undefined ? undefined : Number(row.resultCount),
        durationMs: row.durationMs === null || row.durationMs === undefined ? undefined : Number(row.durationMs),
        updatedAt: row.updatedAt ? String(row.updatedAt) : undefined
      };
    }
    return { compat, details };
  }

  getHistory() {
    const scans = this.db.prepare('SELECT * FROM scans ORDER BY startTime DESC').all();
    const scanStatuses = this.db.prepare('SELECT * FROM scan_status').all();

    // Map statuses back to scan metadata shape for backward compatibility
    return scans.map((scanRaw: unknown) => {
      const scan = scanRaw as Record<string, unknown>;
      const parsedConfig = JSON.parse((scan.config as string) || '{}');
      const statuses = scanStatuses.filter((sRaw: unknown) => (sRaw as Record<string, unknown>).scanId === scan.scanId);
      const { compat, details } = this.decodeEngineStatuses(statuses);

      return {
        scanId: scan.scanId,
        target: scan.target,
        status: scan.status,
        startTime: scan.startTime,
        endTime: scan.endTime,
        config: parsedConfig,
        engineStatuses: details,
        ...compat
      };
    });
  }

  deleteScan(scanId: string) {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM findings WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM observations WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM endpoints WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM scan_status WHERE scanId = ?').run(scanId);
      this.db.prepare('DELETE FROM ai_analyses WHERE scanId = ?').run(scanId);
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
      this.db.prepare('DELETE FROM ai_analyses').run();
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
    const { compat, details } = this.decodeEngineStatuses(scanStatuses);

    return {
      scanId: scanRecord.scanId,
      target: scanRecord.target,
      status: scanRecord.status,
      startTime: scanRecord.startTime,
      endTime: scanRecord.endTime,
      config: parsedConfig,
      engineStatuses: details,
      ...compat
    };
  }

  // Findings
  insertFinding(scanId: string, scanner: string, finding: Record<string, unknown>) {
    this.insertFindings(scanId, scanner, [finding]);
  }

  insertFindings(
    scanId: string,
    scanner: string,
    findings: Record<string, unknown>[]
  ): { insertedFindings: Record<string, unknown>[]; observationCount: number; duplicateCount: number } {
    const stmt = this.db.prepare(`
      INSERT INTO findings (scanId, scanner, type, name, severity, url, description, rawJson, fingerprint, canonicalKey, evidenceJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const existingKeys = new Set<string>(
      (this.db.prepare('SELECT canonicalKey FROM findings WHERE scanId = ? AND canonicalKey IS NOT NULL').all(scanId) as { canonicalKey: string }[])
        .map(row => row.canonicalKey)
    );

    const insertedFindings: Record<string, unknown>[] = [];
    let observationCount = 0;
    let duplicateCount = 0;

    const insertMany = this.db.transaction((items: Record<string, unknown>[]) => {
      for (const finding of items) {
        const severity = String(finding.severity || 'info').toLowerCase();

        if (isInventoryFinding(scanner, finding)) {
          const assetType = String(finding.id || 'inventory');
          const value = String(finding.url || finding.name || 'inventory');
          if (this.insertObservation(scanId, scanner, assetType, value, finding)) observationCount++;
          continue;
        }

        const source = buildFingerprintSource(scanner, finding);
        const fingerprint = computeFindingFingerprint(source);

        let canonicalKey: string | null = null;
        if (severity !== 'info') {
          const signature = flawSignature(finding);
          const location = normalizeLocation(source);
          const param = (source.param || '').toLowerCase();
          const rawKey = `dedupe:v1:${signature}:${location}:${param}`;
          canonicalKey = crypto.createHash('sha256').update(rawKey).digest('hex');
        }

        if (canonicalKey && existingKeys.has(canonicalKey)) {
          duplicateCount++;
          this.insertObservation(scanId, scanner, 'duplicate-finding', canonicalKey, {
            scanner,
            duplicateName: finding.name,
            duplicateUrl: finding.url,
            keptOnce: true
          });
          continue;
        }

        finding.fingerprint = fingerprint;
        if (canonicalKey) finding.canonicalKey = canonicalKey;
        const evidencePayload = finding.evidence ?? (
          finding.httpRequest || finding.httpResponse
            ? {
                httpRequest: finding.httpRequest || undefined,
                httpResponse: finding.httpResponse || undefined,
                curlCommand: finding.curlCommand || undefined
              }
            : null
        );
        if (evidencePayload !== null && evidencePayload !== undefined) {
          finding.evidence = normalizeEvidence(evidencePayload);
        }
        const evidenceJson = normalizeEvidence(evidencePayload) || null;

        stmt.run(
          scanId,
          scanner,
          source.type,
          source.name,
          severity,
          String(finding.url || ''),
          String(finding.description || ''),
          JSON.stringify(finding),
          fingerprint,
          canonicalKey,
          evidenceJson
        );
        if (canonicalKey) existingKeys.add(canonicalKey);
        insertedFindings.push(finding);
      }
    });

    insertMany(findings);

    return { insertedFindings, observationCount, duplicateCount };
  }

  private decodeFindingRow(row: Record<string, unknown>): Record<string, unknown> {
    const parsed = JSON.parse(String(row.rawJson || '{}')) as Record<string, unknown>;
    parsed._dbId = row.id;
    parsed.fingerprint = row.fingerprint;
    if (row.canonicalKey) parsed.canonicalKey = row.canonicalKey;
    if (row.evidenceJson) {
      try {
        const evidence = JSON.parse(String(row.evidenceJson));
        parsed.evidence = typeof evidence === 'string' ? evidence : normalizeEvidence(evidence);
      } catch {
        parsed.evidence = String(row.evidenceJson);
      }
    } else if (parsed.evidence && typeof parsed.evidence === 'object') {
      parsed.evidence = normalizeEvidence(parsed.evidence);
    }
    return parsed;
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
      findings: items.map((rowRaw: unknown) => this.decodeFindingRow(rowRaw as Record<string, unknown>)),
      total: countRow.total,
      page,
      limit
    };
  }

  getFindings(scanId: string) {
    return this.db.prepare('SELECT * FROM findings WHERE scanId = ?').all(scanId)
      .map((rowRaw: unknown) => this.decodeFindingRow(rowRaw as Record<string, unknown>));
  }

  // Observations
  insertObservation(scanId: string, toolName: string, assetType: string, value: string, metadata: Record<string, unknown> = {}): boolean {
    const existing = this.db.prepare(
      'SELECT id FROM observations WHERE scanId = ? AND toolName = ? AND assetType = ? AND value = ? LIMIT 1'
    ).get(scanId, toolName, assetType, value);
    if (existing) return false;
    const stmt = this.db.prepare(`
      INSERT INTO observations (scanId, toolName, assetType, value, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(scanId, toolName, assetType, value, JSON.stringify(metadata), new Date().toISOString());
    return true;
  }

  getObservations(scanId: string) {
    return this.db.prepare('SELECT * FROM observations WHERE scanId = ? ORDER BY id ASC').all(scanId) as Record<string, unknown>[];
  }

  getObservationCount(scanId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM observations WHERE scanId = ?').get(scanId) as { total: number } | undefined;
    return row ? Number(row.total) : 0;
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

  /**
   * Latest non-expired triage decision for every fingerprinted finding in a scan.
   */
  getTriageDecisionsForScan(scanId: string) {
    return this.db.prepare(`
      SELECT f.fingerprint AS fingerprint, td.status AS status, td.reason AS reason,
             td.actor AS actor, td.timestamp AS timestamp, td.expiresAt AS expiresAt
      FROM (SELECT DISTINCT fingerprint FROM findings WHERE scanId = ? AND fingerprint IS NOT NULL) f
      JOIN triage_decisions td ON td.id = (
        SELECT latest.id FROM triage_decisions latest
        WHERE latest.fingerprint = f.fingerprint
        ORDER BY latest.timestamp DESC, latest.id DESC
        LIMIT 1
      )
      WHERE td.expiresAt IS NULL OR td.expiresAt > ?
      ORDER BY td.timestamp DESC
    `).all(scanId, new Date().toISOString()) as Record<string, unknown>[];
  }

  // Baseline Comparison
  compareWithBaseline(currentScanId: string, baselineScanId: string): BaselineComparisonResult {
    return BaselineComparator.compare(currentScanId, baselineScanId, this.db);
  }

  // AI Analysis Persistence
  insertAiAnalysis(analysis: {
    id: string;
    scanId: string;
    preset: string;
    provider: string;
    model: string;
    analysisText: string;
    contextVersion?: string;
    evidenceIds?: string[];
    createdAt?: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO ai_analyses (id, scanId, preset, provider, model, analysisText, contextVersion, evidenceIdsJson, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      analysis.id,
      analysis.scanId,
      analysis.preset,
      analysis.provider,
      analysis.model,
      analysis.analysisText,
      analysis.contextVersion || 'v1',
      JSON.stringify(analysis.evidenceIds || []),
      analysis.createdAt || new Date().toISOString()
    );
  }

  getAiAnalyses(scanId: string): Array<Record<string, unknown>> {
    return this.db.prepare('SELECT * FROM ai_analyses WHERE scanId = ? ORDER BY createdAt DESC, id DESC').all(scanId) as Array<Record<string, unknown>>;
  }

  getLatestAiAnalysis(scanId: string, preset?: string): Record<string, unknown> | null {
    if (preset) {
      const row = this.db.prepare('SELECT * FROM ai_analyses WHERE scanId = ? AND preset = ? ORDER BY createdAt DESC, id DESC LIMIT 1').get(scanId, preset);
      return (row as Record<string, unknown>) || null;
    }
    const row = this.db.prepare('SELECT * FROM ai_analyses WHERE scanId = ? ORDER BY createdAt DESC, id DESC LIMIT 1').get(scanId);
    return (row as Record<string, unknown>) || null;
  }
}

export const dbService = new DatabaseService();
