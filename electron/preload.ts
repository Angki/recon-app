import { contextBridge, ipcRenderer } from 'electron';

// Increase max listeners to prevent MaxListenersExceededWarning when rendering many TerminalPanes
ipcRenderer.setMaxListeners(50);
// Expose secure API to renderer
contextBridge.exposeInMainWorld('api', {
  // Scanners
  startScan: (targetUrl: string, config: any) => ipcRenderer.invoke('scan:start', targetUrl, config),
  stopScan: (scanId: string) => ipcRenderer.invoke('scan:stop', scanId),
  
  // Real-time events — use addListener/removeListener pattern (not removeAllListeners)
  onScanOutput: (callback: (event: any, data: { scanId: string, scanner: string, type: string, message: string }) => void) => {
    ipcRenderer.on('scan:output', callback);
    return () => { ipcRenderer.removeListener('scan:output', callback); };
  },
  onScanStatus: (callback: (event: any, data: { scanId: string, status: string, scanner: string }) => void) => {
    ipcRenderer.on('scan:status', callback);
    return () => { ipcRenderer.removeListener('scan:status', callback); };
  },
  onScanFindings: (callback: (event: any, data: { scanId: string, scanner: string, findings: any[] }) => void) => {
    ipcRenderer.on('scan:findings', callback);
    return () => { ipcRenderer.removeListener('scan:findings', callback); };
  },
  onScanStats: (callback: (event: any, data: { scanId: string, stats: { nuclei: any, wapiti: any } }) => void) => {
    ipcRenderer.on('scan:stats', callback);
    return () => { ipcRenderer.removeListener('scan:stats', callback); };
  },
  
  // Storage & History
  getHistory: () => ipcRenderer.invoke('storage:getHistory'),
  openReportFolder: (scanId: string) => ipcRenderer.invoke('storage:openFolder', scanId),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

  // AI Service
  analyzeLogs: (logs: string, prompt: string) => ipcRenderer.invoke('ai:analyzeLogs', logs, prompt),
  onAiProgress: (callback: (event: any, msg: string) => void) => {
    ipcRenderer.on('ai:progress', callback);
    return () => { ipcRenderer.removeListener('ai:progress', callback); };
  },

  // Updater
  updateTools: () => ipcRenderer.invoke('tools:update'),
  onUpdateOutput: (callback: (event: any, msg: string) => void) => {
    ipcRenderer.on('update:output', callback);
    return () => { ipcRenderer.removeListener('update:output', callback); };
  },
  onUpdateStatus: (callback: (event: any, status: string) => void) => {
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
      startScan: (targetUrl: string, config: any) => Promise<any>;
      stopScan: (scanId: string) => Promise<any>;
      onScanOutput: (callback: (event: any, data: { scanId: string, scanner: 'nuclei' | 'wapiti' | 'subfinder' | 'httpx' | 'nmap', type: 'stdout' | 'stderr', message: string }) => void) => () => void;
      onScanStatus: (callback: (event: any, data: { scanId: string, status: string, scanner: string }) => void) => () => void;
      onScanFindings: (callback: (event: any, data: { scanId: string, scanner: string, findings: any[] }) => void) => () => void;
      onScanStats: (callback: (event: any, data: { scanId: string, stats: { nuclei: any, wapiti: any } }) => void) => () => void;
      getHistory: () => Promise<any>;
      openReportFolder: (scanId: string) => Promise<any>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      updateTools: () => Promise<void>;
      onUpdateOutput: (callback: (event: any, msg: string) => void) => () => void;
      onUpdateStatus: (callback: (event: any, status: string) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
    }
  }
}
