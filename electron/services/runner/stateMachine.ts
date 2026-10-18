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
   * Compute aggregate scan state from individual tool states.
   * If any tool is running or validating, aggregate is RUNNING.
   * If scan was STOPPED or CANCELLED, aggregate remains STOPPED/CANCELLED.
   * If all tools finished:
   *   - all succeeded => COMPLETED
   *   - some succeeded, some failed => PARTIAL
   *   - all failed => FAILED
   */
  static computeAggregateState(
    currentScanState: ScanState,
    toolStates: Record<string, string>,
    tools: string[]
  ): ScanState {
    if (currentScanState === 'STOPPED' || currentScanState === 'CANCELLED') {
      return currentScanState;
    }

    if (tools.length === 0) return 'COMPLETED';

    let allTerminal = true;
    let anySuccess = false;
    let anyFailed = false;

    for (const tool of tools) {
      const state = (toolStates[tool] || 'RUNNING') as ScanState;
      if (!this.isTerminal(state)) {
        allTerminal = false;
      }
      if (state === 'COMPLETED') {
        anySuccess = true;
      }
      if (state === 'FAILED') {
        anyFailed = true;
      }
    }

    if (!allTerminal) {
      return 'RUNNING';
    }

    if (anySuccess && anyFailed) {
      return 'PARTIAL';
    }
    if (anyFailed && !anySuccess) {
      return 'FAILED';
    }
    return 'COMPLETED';
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
