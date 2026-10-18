import type { Vulnerability } from './vulnerability';

export interface ToolHealthInfo {
  name: string;
  displayName: string;
  category: 'recon' | 'dast' | 'fuzz' | 'network' | 'tls' | 'secrets' | 'sast' | 'sca';
  installed: boolean;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  resolvedPath: string;
  requiresManual?: boolean;
}

export {};

declare global {
  interface Window {
    api: {
      getEndpoints: (scanId: string, options?: {page?:number;search?:string}) => Promise<{items:import('./workflow').EndpointRecord[];total:number;page:number}>;
      prepareTestingWorkflow: (reference: import('./workflow').WorkflowRef, tool?: string) => Promise<import('./workflow').TestingDraft>;
      getWorkflowRuns: (scanId: string) => Promise<import('./workflow').WorkflowRun[]>;
      startScan: (targetUrl: string, config: Record<string, unknown>) => Promise<{success?: boolean; scanId?: string; error?: string}>;
      stopScan: (scanId: string) => Promise<{success?: boolean}>;
      onScanOutput: (callback: (event: unknown, data: { scanId: string, scanner: string, type: 'stdout' | 'stderr', message: string }) => void) => () => void;
      onScanStatus: (callback: (event: unknown, data: { scanId: string, status: string, scanner: string }) => void) => () => void;
      onScanFindings: (callback: (event: unknown, data: { scanId: string, scanner: string, findings: Vulnerability[] }) => void) => () => void;
      onScanStats: (callback: (event: unknown, data: { scanId: string, stats: any }) => void) => () => void;
      getHistory: () => Promise<any>;
      getFindingsPaginated: (scanId: string, options: { page?: number, limit?: number, severity?: string, scanner?: string, search?: string }) => Promise<{ findings: Vulnerability[], total: number, page: number, limit: number }>;
      openReportFolder: (scanId: string) => Promise<unknown>;
      deleteScan: (scanId: string) => Promise<boolean>;
      clearAllScans: () => Promise<boolean>;
      exportReport: (scanId: string, format: 'html' | 'md' | 'json' | 'sarif') => Promise<{ success: boolean; filePath: string }>;
      getReportStats: (scanId: string) => Promise<any>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      analyzeLogs: (logs: string, prompt: string) => Promise<string>;
      onAiProgress: (callback: (event: unknown, msg: string) => void) => () => void;
      
      // Tool Manager & Health Matrix
      getToolsHealth: () => Promise<ToolHealthInfo[]>;
      updateTool: (toolName: string) => Promise<boolean>;
      updateAllTools: () => Promise<void>;
      onToolUpdateProgress: (callback: (event: unknown, data: { tool: string, message: string }) => void) => () => void;
      onToolUpdateStatus: (callback: (event: unknown, status: string) => void) => () => void;

      // Legacy updater
      updateTools: () => Promise<void>;
      onUpdateOutput: (callback: (event: unknown, msg: string) => void) => () => void;
      onUpdateStatus: (callback: (event: unknown, status: string) => void) => () => void;
      checkDependencies: () => Promise<any[]>;
      installDependencies: () => Promise<void>;
      onInstallProgress: (callback: (event: unknown, msg: string) => void) => () => void;
      openExternal: (url: string) => Promise<void>;

      // System Diagnostics & Operational Logging
      getDiagnostics: () => Promise<Record<string, unknown>>;
      getRecentLogs: (maxLines?: number) => Promise<string[]>;

      // Database Backup & Retention
      createBackup: () => Promise<{ backupPath: string; timestamp: string; sizeBytes: number }>;
      listBackups: () => Promise<{ filename: string; path: string; sizeBytes: number; createdAt: string }[]>;
      enforceRetention: (maxDays?: number, maxTotalBytes?: number) => Promise<{ deletedFiles: number; reclaimedBytes: number }>;

      // Application Version
      getAppVersion: () => Promise<string>;
    }
  }
}
