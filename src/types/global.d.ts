import type { Vulnerability } from './vulnerability';

export {};

declare global {
  interface Window {
    api: {
      startScan: (targetUrl: string, config: Record<string, unknown>) => Promise<{success?: boolean; scanId?: string; error?: string}>;
      stopScan: (scanId: string) => Promise<{success?: boolean}>;
      onScanOutput: (callback: (event: unknown, data: { scanId: string, scanner: string, type: 'stdout' | 'stderr', message: string }) => void) => () => void;
      onScanStatus: (callback: (event: unknown, data: { scanId: string, status: string, scanner: string }) => void) => () => void;
      onScanFindings: (callback: (event: unknown, data: { scanId: string, scanner: string, findings: Vulnerability[] }) => void) => () => void;
      onScanStats: (callback: (event: unknown, data: { scanId: string, stats: any }) => void) => () => void;
      getHistory: () => Promise<any>;
      getFindingsPaginated: (scanId: string, options: { page?: number, limit?: number, severity?: string, scanner?: string, search?: string }) => Promise<{ findings: Vulnerability[], total: number, page: number, limit: number }>;
      openReportFolder: (scanId: string) => Promise<unknown>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      analyzeLogs: (logs: string, prompt: string) => Promise<string>;
      onAiProgress: (callback: (event: unknown, msg: string) => void) => () => void;
      updateTools: () => Promise<void>;
      onUpdateOutput: (callback: (event: unknown, msg: string) => void) => () => void;
      onUpdateStatus: (callback: (event: unknown, status: string) => void) => () => void;
      checkDependencies: () => Promise<any[]>;
      installDependencies: () => Promise<void>;
      onInstallProgress: (callback: (event: unknown, msg: string) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
    }
  }
}
