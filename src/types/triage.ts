export type TriageStatus = 'open' | 'false_positive' | 'accepted_risk' | 'fixed';

export interface TriageDecision {
  fingerprint: string;
  status: TriageStatus;
  reason?: string;
  actor?: string;
  timestamp: string;
  expiresAt?: string | null;
}

export interface TriageInput {
  fingerprint: string;
  status: TriageStatus;
  reason?: string;
  actor?: string;
  expiresAt?: string;
}

export interface BaselineFinding {
  id: number;
  scanId: string;
  scanner: string;
  type: string;
  name: string;
  severity: string;
  url: string;
  fingerprint: string | null;
}

export interface BaselineComparison {
  currentScanId: string;
  baselineScanId: string;
  canDetermineResolved: boolean;
  resolutionCaveat?: string;
  newFindings: BaselineFinding[];
  persistentFindings: BaselineFinding[];
  resolvedFindings: BaselineFinding[];
  reopenedFindings: BaselineFinding[];
  notReassessedFindings: BaselineFinding[];
  summary: {
    newCount: number;
    persistentCount: number;
    resolvedCount: number;
    reopenedCount: number;
    notReassessedCount: number;
  };
}
