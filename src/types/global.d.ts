import type { Vulnerability } from './vulnerability';

export {};

declare global {
  interface Window {
    api: {
      startScan: (targetUrl: string, config: any) => Promise<any>;
      stopScan: (scanId: string) => Promise<any>;
      onScanOutput: (callback: (event: any, data: { scanId: string, scanner: string, type: 'stdout' | 'stderr', message: string }) => void) => () => void;
      onScanStatus: (callback: (event: any, data: { scanId: string, status: string, scanner: string }) => void) => () => void;
      onScanFindings: (callback: (event: any, data: { scanId: string, scanner: string, findings: Vulnerability[] }) => void) => () => void;
      onScanStats: (callback: (event: any, data: { scanId: string, stats: { nuclei: any, wapiti: any } }) => void) => () => void;
      getHistory: () => Promise<any>;
      openReportFolder: (scanId: string) => Promise<any>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      analyzeLogs: (logs: string, prompt: string) => Promise<string>;
      onAiProgress: (callback: (event: any, msg: string) => void) => () => void;
      updateTools: () => Promise<void>;
      onUpdateOutput: (callback: (event: any, msg: string) => void) => () => void;
      onUpdateStatus: (callback: (event: any, status: string) => void) => () => void;
      checkDependencies: () => Promise<any[]>;
      installDependencies: () => Promise<void>;
      onInstallProgress: (callback: (event: any, msg: string) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
    }
  }
}
