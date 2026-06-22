import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Increase max listeners to prevent MaxListenersExceededWarning when rendering many TerminalPanes
ipcRenderer.setMaxListeners(50);
// Expose secure API to renderer
contextBridge.exposeInMainWorld('api', {
  // Scanners
  startScan: (targetUrl: string, config: Record<string, unknown>) => ipcRenderer.invoke('scan:start', targetUrl, config),
  stopScan: (scanId: string) => ipcRenderer.invoke('scan:stop', scanId),
  
  // Real-time events — use addListener/removeListener pattern (not removeAllListeners)
  onScanOutput: (callback: (event: IpcRendererEvent, data: { scanId: string, scanner: string, type: string, message: string }) => void) => {
    ipcRenderer.on('scan:output', callback);
    return () => { ipcRenderer.removeListener('scan:output', callback); };
  },
  onScanStatus: (callback: (event: IpcRendererEvent, data: { scanId: string, status: string, scanner: string }) => void) => {
    ipcRenderer.on('scan:status', callback);
    return () => { ipcRenderer.removeListener('scan:status', callback); };
  },
  onScanFindings: (callback: (event: IpcRendererEvent, data: { scanId: string, scanner: string, findings: Record<string, unknown>[] }) => void) => {
    ipcRenderer.on('scan:findings', callback);
    return () => { ipcRenderer.removeListener('scan:findings', callback); };
  },
  onScanStats: (callback: (event: IpcRendererEvent, data: { scanId: string, stats: { nuclei: unknown, wapiti: unknown } }) => void) => {
    ipcRenderer.on('scan:stats', callback);
    return () => { ipcRenderer.removeListener('scan:stats', callback); };
  },
  
  // Storage & History
  getHistory: () => ipcRenderer.invoke('storage:getHistory'),
  getFindingsPaginated: (scanId: string, options: Record<string, unknown>) => ipcRenderer.invoke('storage:getFindingsPaginated', scanId, options),
  openReportFolder: (scanId: string) => ipcRenderer.invoke('storage:openFolder', scanId),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // AI Service
  analyzeLogs: (logs: string, prompt: string) => ipcRenderer.invoke('ai:analyzeLogs', logs, prompt),
  onAiProgress: (callback: (event: IpcRendererEvent, msg: string) => void) => {
    ipcRenderer.on('ai:progress', callback);
    return () => { ipcRenderer.removeListener('ai:progress', callback); };
  },

  // Dependencies
  checkDependencies: () => ipcRenderer.invoke('dependency:check'),
  installDependencies: () => ipcRenderer.invoke('dependency:installAll'),
  onInstallProgress: (callback: (event: IpcRendererEvent, msg: string) => void) => {
    ipcRenderer.on('dependency:installProgress', callback);
    return () => { ipcRenderer.removeListener('dependency:installProgress', callback); };
  },

  // Updater
  updateTools: () => ipcRenderer.invoke('tools:update'),
  onUpdateOutput: (callback: (event: IpcRendererEvent, msg: string) => void) => {
    ipcRenderer.on('update:output', callback);
    return () => { ipcRenderer.removeListener('update:output', callback); };
  },
  onUpdateStatus: (callback: (event: IpcRendererEvent, status: string) => void) => {
    ipcRenderer.on('update:status', callback);
    return () => { ipcRenderer.removeListener('update:status', callback); };
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});

// Declare global type for TS
declare global {
  interface Window {
    api: {
      startScan: (targetUrl: string, config: Record<string, unknown>) => Promise<unknown>;
      stopScan: (scanId: string) => Promise<unknown>;
      onScanOutput: (callback: (event: IpcRendererEvent, data: { scanId: string, scanner: 'nuclei' | 'wapiti' | 'subfinder' | 'httpx' | 'nmap', type: 'stdout' | 'stderr', message: string }) => void) => () => void;
      onScanStatus: (callback: (event: IpcRendererEvent, data: { scanId: string, status: string, scanner: string }) => void) => () => void;
      onScanFindings: (callback: (event: IpcRendererEvent, data: { scanId: string, scanner: string, findings: Record<string, unknown>[] }) => void) => () => void;
      onScanStats: (callback: (event: IpcRendererEvent, data: { scanId: string, stats: { nuclei: unknown, wapiti: unknown } }) => void) => () => void;
      getHistory: () => Promise<unknown[]>;
      getFindingsPaginated: (scanId: string, options: Record<string, unknown>) => Promise<{ findings: Record<string, unknown>[], total: number, page: number, limit: number }>;
      openReportFolder: (scanId: string) => Promise<void>;
      getSettings: () => Promise<Record<string, unknown>>;
      saveSettings: (settings: Record<string, unknown>) => Promise<void>;
      checkDependencies: () => Promise<{name: string, isInstalled: boolean, requiresManual: boolean}[]>;
      installDependencies: () => Promise<{success: boolean, error?: string}>;
      onInstallProgress: (callback: (event: IpcRendererEvent, msg: string) => void) => () => void;
      updateTools: () => Promise<void>;
      onUpdateOutput: (callback: (event: IpcRendererEvent, msg: string) => void) => () => void;
      onUpdateStatus: (callback: (event: IpcRendererEvent, status: string) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
    }
  }
}
