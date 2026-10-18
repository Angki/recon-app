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
  summary: {
    newCount: number;
    persistentCount: number;
    resolvedCount: number;
    reopenedCount: number;
  };
}

export class BaselineComparator {
  static compare(currentScanId: string, baselineScanId: string, db: Database.Database): BaselineComparisonResult {
    // 1. Fetch scan metadata to check terminal status
    const currentScan = db.prepare('SELECT scanId, status FROM scans WHERE scanId = ?').get(currentScanId) as { scanId: string; status: string } | undefined;
    const baselineScan = db.prepare('SELECT scanId, status FROM scans WHERE scanId = ?').get(baselineScanId) as { scanId: string; status: string } | undefined;

    if (!currentScan) throw new Error(`Current scan ${currentScanId} not found`);
    if (!baselineScan) throw new Error(`Baseline scan ${baselineScanId} not found`);

    // Safety rule: Failed or interrupted scans cannot assert findings were resolved
    const currentIsPartialOrFailed = ['FAILED', 'INTERRUPTED', 'STOPPED', 'CANCELLED'].includes(currentScan.status);
    const canDetermineResolved = !currentIsPartialOrFailed && baselineScan.status === 'COMPLETED';

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

    // 3. Fetch triage history for reopened checks
    const triageRows = db.prepare('SELECT fingerprint, status FROM triage_decisions').all() as { fingerprint: string; status: string }[];
    const resolvedTriageFps = new Set(
      triageRows.filter(t => t.status === 'fixed' || t.status === 'resolved').map(t => t.fingerprint)
    );

    const newFindings: FindingRecord[] = [];
    const persistentFindings: FindingRecord[] = [];
    const reopenedFindings: FindingRecord[] = [];
    const resolvedFindings: FindingRecord[] = [];

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

    // Analyze missing findings from baseline (only if current run finished reliably)
    if (canDetermineResolved) {
      for (const base of baselineFindings) {
        const fp = base.fingerprint;
        if (fp && !currentByFp.has(fp)) {
          resolvedFindings.push(base);
        }
      }
    }

    return {
      currentScanId,
      baselineScanId,
      canDetermineResolved,
      resolutionCaveat: canDetermineResolved
        ? undefined
        : `Current scan status is '${currentScan.status}'. Missing findings are not classified as resolved to avoid false negative assurance.`,
      newFindings,
      persistentFindings,
      resolvedFindings,
      reopenedFindings,
      summary: {
        newCount: newFindings.length,
        persistentCount: persistentFindings.length,
        resolvedCount: resolvedFindings.length,
        reopenedCount: reopenedFindings.length
      }
    };
  }
}
