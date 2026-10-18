import type Database from 'better-sqlite3';

export interface FindingRecord {
  id: number;
  scanId: string;
  scanner: string;
  type: string;
  name: string;
  severity: string;
  url: string;
  fingerprint: string;
}

export interface BaselineComparisonResult {
  currentScanId: string;
  baselineScanId: string;
  canDetermineResolved: boolean;
  resolutionCaveat?: string;
  newFindings: FindingRecord[];
  persistentFindings: FindingRecord[];
  resolvedFindings: FindingRecord[];
  reopenedFindings: FindingRecord[];
  notReassessedFindings: FindingRecord[];
  summary: {
    newCount: number;
    persistentCount: number;
    resolvedCount: number;
    reopenedCount: number;
    notReassessedCount: number;
  };
}

export class BaselineComparator {
  static compare(currentScanId: string, baselineScanId: string, db: Database.Database): BaselineComparisonResult {
    // 1. Fetch scan metadata to check terminal status and engine coverage
    const currentScan = db.prepare('SELECT * FROM scans WHERE scanId = ?').get(currentScanId) as Record<string, unknown> | undefined;
    const baselineScan = db.prepare('SELECT * FROM scans WHERE scanId = ?').get(baselineScanId) as Record<string, unknown> | undefined;

    if (!currentScan) throw new Error(`Current scan ${currentScanId} not found`);
    if (!baselineScan) throw new Error(`Baseline scan ${baselineScanId} not found`);

    const currentStatus = String(currentScan.status || 'UNKNOWN').toUpperCase();
    const baselineStatus = String(baselineScan.status || 'UNKNOWN').toUpperCase();

    // Safety rule: Failed or interrupted scans cannot assert findings were resolved
    const currentIsPartialOrFailed = ['FAILED', 'INTERRUPTED', 'STOPPED', 'CANCELLED'].includes(currentStatus);
    const canDetermineResolved = !currentIsPartialOrFailed && baselineStatus === 'COMPLETED';

    // Extract executed tools from current scan config
    let evaluatedScanners: Set<string> | null = null;
    if (currentScan.config) {
      try {
        const conf = typeof currentScan.config === 'string' ? JSON.parse(currentScan.config) : currentScan.config;
        if (conf && Array.isArray(conf.tools) && conf.tools.length > 0) {
          evaluatedScanners = new Set(conf.tools.map((t: string) => String(t).toLowerCase()));
        }
      } catch {
        // Fallback if config parsing fails
      }
    }

    // 2. Fetch findings for both scans
    const currentFindings = db.prepare('SELECT id, scanId, scanner, type, name, severity, url, fingerprint FROM findings WHERE scanId = ?').all(currentScanId) as FindingRecord[];
    const baselineFindings = db.prepare('SELECT id, scanId, scanner, type, name, severity, url, fingerprint FROM findings WHERE scanId = ?').all(baselineScanId) as FindingRecord[];

    const currentByFp = new Map<string, FindingRecord>();
    for (const f of currentFindings) {
      if (f.fingerprint) currentByFp.set(f.fingerprint, f);
    }

    const baselineByFp = new Map<string, FindingRecord>();
    for (const f of baselineFindings) {
      if (f.fingerprint) baselineByFp.set(f.fingerprint, f);
    }

    // 3. Fetch latest active triage decisions per fingerprint
    const triageRows = db.prepare('SELECT fingerprint, status, expiresAt, timestamp FROM triage_decisions ORDER BY timestamp ASC').all() as {
      fingerprint: string;
      status: string;
      expiresAt?: string;
      timestamp?: string;
    }[];

    const latestTriageByFp = new Map<string, { status: string; expiresAt?: string }>();
    for (const row of triageRows) {
      if (row.fingerprint) {
        latestTriageByFp.set(row.fingerprint, { status: row.status, expiresAt: row.expiresAt });
      }
    }

    const resolvedTriageFps = new Set<string>();
    const now = Date.now();
    for (const [fp, decision] of latestTriageByFp.entries()) {
      if (decision.expiresAt && new Date(decision.expiresAt).getTime() <= now) {
        // Triage decision expired
        continue;
      }
      if (decision.status === 'fixed' || decision.status === 'resolved') {
        resolvedTriageFps.add(fp);
      }
    }

    const newFindings: FindingRecord[] = [];
    const persistentFindings: FindingRecord[] = [];
    const reopenedFindings: FindingRecord[] = [];
    const resolvedFindings: FindingRecord[] = [];
    const notReassessedFindings: FindingRecord[] = [];

    // Analyze current findings vs baseline
    for (const curr of currentFindings) {
      const fp = curr.fingerprint;
      if (!fp) {
        newFindings.push(curr);
        continue;
      }

      if (resolvedTriageFps.has(fp)) {
        reopenedFindings.push(curr);
      } else if (baselineByFp.has(fp)) {
        persistentFindings.push(curr);
      } else {
        newFindings.push(curr);
      }
    }

    // Analyze missing findings from baseline
    for (const base of baselineFindings) {
      const fp = base.fingerprint;
      if (!fp || currentByFp.has(fp)) continue;

      if (!canDetermineResolved) {
        // Run incomplete or failed: cannot assert resolved
        notReassessedFindings.push(base);
        continue;
      }

      // Check whether the scanner that produced this finding was executed and completed in current scan
      const baseScanner = (base.scanner || '').toLowerCase();
      if (evaluatedScanners !== null) {
        const scannerEvaluated = evaluatedScanners.has(baseScanner);
        const scannerStatus = String(currentScan[`${baseScanner}Status`] || '').toUpperCase();
        const scannerFailed = scannerStatus === 'FAILED' || scannerStatus === 'STOPPED';

        if (!scannerEvaluated || scannerFailed) {
          notReassessedFindings.push(base);
          continue;
        }
      }

      resolvedFindings.push(base);
    }

    return {
      currentScanId,
      baselineScanId,
      canDetermineResolved,
      resolutionCaveat: canDetermineResolved
        ? undefined
        : `Current scan status is '${currentStatus}'. Missing findings are categorized as not reassessed to prevent false assurance.`,
      newFindings,
      persistentFindings,
      resolvedFindings,
      reopenedFindings,
      notReassessedFindings,
      summary: {
        newCount: newFindings.length,
        persistentCount: persistentFindings.length,
        resolvedCount: resolvedFindings.length,
        reopenedCount: reopenedFindings.length,
        notReassessedCount: notReassessedFindings.length
      }
    };
  }
}
