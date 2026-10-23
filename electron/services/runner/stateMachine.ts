import { logger } from '../logger';

export type ScanState =
  | 'QUEUED'
  | 'VALIDATING'
  | 'RUNNING'
  | 'PARSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'STOPPED'
  | 'INTERRUPTED'
  | 'SKIPPED';

export const TERMINAL_STATES: ReadonlySet<ScanState> = new Set<ScanState>([
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
  'STOPPED',
  'INTERRUPTED',
  'SKIPPED'
]);

export const LEGAL_TRANSITIONS: Record<ScanState, readonly ScanState[]> = {
  QUEUED: ['VALIDATING', 'CANCELLING', 'CANCELLED', 'STOPPED', 'INTERRUPTED'],
  VALIDATING: ['RUNNING', 'FAILED', 'CANCELLING', 'CANCELLED', 'STOPPED', 'INTERRUPTED', 'SKIPPED'],
  RUNNING: ['PARSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLING', 'CANCELLED', 'STOPPED', 'INTERRUPTED'],
  PARSING: ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLING', 'CANCELLED', 'STOPPED', 'INTERRUPTED'],
  CANCELLING: ['CANCELLED', 'STOPPED', 'INTERRUPTED'],
  COMPLETED: [],
  PARTIAL: [],
  FAILED: [],
  CANCELLED: [],
  STOPPED: [],
  INTERRUPTED: [],
  SKIPPED: []
};

export class ScanStateMachine {
  /** Validate whether transitioning from currentState to nextState is legally permitted */
  static isValidTransition(current: ScanState, next: ScanState): boolean {
    if (current === next) return true; // Idempotent same-state is allowed
    const allowed = LEGAL_TRANSITIONS[current];
    return allowed ? allowed.includes(next) : false;
  }

  /** Check if a state is terminal */
  static isTerminal(state: ScanState): boolean {
    return TERMINAL_STATES.has(state);
  }

  /**
   * Compute aggregate scan state from individual engine states.
   * Engine-level DEGRADED/PARTIAL/SKIPPED are terminal but mean coverage was reduced,
   * so the aggregate becomes PARTIAL rather than a misleading COMPLETED.
   */
  static computeAggregateState(
    currentScanState: ScanState,
    toolStates: Record<string, string>,
    tools: string[]
  ): ScanState {
    if (currentScanState === 'STOPPED' || currentScanState === 'CANCELLED' || currentScanState === 'INTERRUPTED') {
      return currentScanState;
    }

    if (!tools || tools.length === 0) {
      return 'FAILED';
    }

    const terminalEngineStates = new Set(['COMPLETED', 'DEGRADED', 'PARTIAL', 'SKIPPED', 'FAILED', 'STOPPED', 'CANCELLED', 'INTERRUPTED']);
    let allTerminal = true;
    let anyCompleted = false;
    let anyRanPartially = false;
    let anyFailed = false;
    let anyStopped = false;
    let anySkipped = false;
    let allSkipped = true;

    for (const tool of tools) {
      const state = String(toolStates[tool] || 'RUNNING').toUpperCase();
      if (!terminalEngineStates.has(state)) {
        allTerminal = false;
      }
      if (state !== 'SKIPPED') {
        allSkipped = false;
      }
      if (state === 'SKIPPED') {
        anySkipped = true;
      }
      if (state === 'COMPLETED') {
        anyCompleted = true;
      }
      if (state === 'DEGRADED' || state === 'PARTIAL') {
        anyRanPartially = true;
      }
      if (state === 'FAILED') {
        anyFailed = true;
      }
      if (state === 'STOPPED' || state === 'CANCELLED') {
        anyStopped = true;
      }
    }

    if (!allTerminal) {
      return 'RUNNING';
    }

    if (allSkipped) {
      return 'SKIPPED';
    }

    if (anyCompleted && !anyRanPartially && !anyFailed && !anyStopped && !anySkipped) {
      return 'COMPLETED';
    }

    if (!anyCompleted && anyStopped && !anyFailed && !anyRanPartially) {
      return 'CANCELLED';
    }

    if (!anyCompleted && !anyRanPartially && anyFailed) {
      return 'FAILED';
    }

    if (!anyCompleted && !anyRanPartially && !anyFailed && !anyStopped) {
      // Only malformed/non-terminal states remain; conservatively treat as failure.
      return 'FAILED';
    }

    return 'PARTIAL';
  }

  /**
   * Reconcile interrupted scans left behind after app crash or abrupt shutdown.
   * Finds any scan in non-terminal state and marks it INTERRUPTED.
   */
  static recoverDanglingScans(db: {
    getDanglingScans: () => { scanId: string; status: string }[];
    updateScanStatus: (scanId: string, status: string, endTime?: string) => void;
  }): number {
    const dangling = db.getDanglingScans();
    if (dangling.length === 0) return 0;

    logger.warn(`Found ${dangling.length} dangling scan(s) from previous session. Recovering...`);
    const now = new Date().toISOString();

    for (const scan of dangling) {
      logger.info(`Reconciling dangling scan ${scan.scanId} (${scan.status} -> INTERRUPTED)`);
      db.updateScanStatus(scan.scanId, 'INTERRUPTED', now);
    }

    return dangling.length;
  }
}
