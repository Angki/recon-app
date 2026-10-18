export class ProcessLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessLockError';
  }
}

export class ProcessLockManager {
  // Maps toolName -> scanId holding the lock
  private toolLocks = new Map<string, string>();
  // Maps scanId -> Set of tools
  private scanTools = new Map<string, Set<string>>();

  acquireLocks(scanId: string, tools: string[]): { success: boolean; conflictedTool?: string } {
    for (const tool of tools) {
      const currentHolder = this.toolLocks.get(tool);
      if (currentHolder && currentHolder !== scanId) {
        return { success: false, conflictedTool: tool };
      }
    }

    if (!this.scanTools.has(scanId)) {
      this.scanTools.set(scanId, new Set());
    }
    const set = this.scanTools.get(scanId)!;

    for (const tool of tools) {
      this.toolLocks.set(tool, scanId);
      set.add(tool);
    }

    return { success: true };
  }

  releaseLocks(scanId: string) {
    const tools = this.scanTools.get(scanId);
    if (tools) {
      for (const tool of tools) {
        if (this.toolLocks.get(tool) === scanId) {
          this.toolLocks.delete(tool);
        }
      }
      this.scanTools.delete(scanId);
    }
  }

  isToolLocked(toolName: string): { locked: boolean; activeScanId?: string } {
    const activeScanId = this.toolLocks.get(toolName);
    return {
      locked: Boolean(activeScanId),
      activeScanId
    };
  }

  assertToolNotLocked(toolName: string) {
    const status = this.isToolLocked(toolName);
    if (status.locked) {
      throw new ProcessLockError(
        `Cannot update, replace, or uninstall tool '${toolName}': active scan '${status.activeScanId}' is currently executing this binary.`
      );
    }
  }

  clearAll() {
    this.toolLocks.clear();
    this.scanTools.clear();
  }
}

export const processLock = new ProcessLockManager();
