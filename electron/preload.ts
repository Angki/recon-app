import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// Increase max listeners to prevent MaxListenersExceededWarning
ipcRenderer.setMaxListeners(50);

// Expose secure, validated API to renderer
contextBridge.exposeInMainWorld('api', {
  // Scanners
  startScan: (targetUrl: string, config: Record<string, unknown>) => ipcRenderer.invoke('scan:start', targetUrl, config),
  stopScan: (scanId: string) => ipcRenderer.invoke('scan:stop', scanId),
  
  // Real-time events — safe event wrapping (strips internal Electron event object)
  onScanOutput: (callback: (event: unknown, data: { scanId: string, scanner: string, type: string, message: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { scanId: string, scanner: string, type: string, message: string }) => callback(null, data);
    ipcRenderer.on('scan:output', handler);
    return () => { ipcRenderer.removeListener('scan:output', handler); };
  },
  onScanStatus: (callback: (event: unknown, data: { scanId: string, status: string, scanner: string, reason?: string, code?: number | null, resultCount?: number }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { scanId: string, status: string, scanner: string, reason?: string, code?: number | null, resultCount?: number }) => callback(null, data);
    ipcRenderer.on('scan:status', handler);
    return () => { ipcRenderer.removeListener('scan:status', handler); };
  },
  onScanFindings: (callback: (event: unknown, data: { scanId: string, scanner: string, findings: Record<string, unknown>[] }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { scanId: string, scanner: string, findings: Record<string, unknown>[] }) => callback(null, data);
    ipcRenderer.on('scan:findings', handler);
    return () => { ipcRenderer.removeListener('scan:findings', handler); };
  },
  onScanStats: (callback: (event: unknown, data: { scanId: string, stats: { nuclei: unknown, wapiti: unknown } }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { scanId: string, stats: { nuclei: unknown, wapiti: unknown } }) => callback(null, data);
    ipcRenderer.on('scan:stats', handler);
    return () => { ipcRenderer.removeListener('scan:stats', handler); };
  },
  onScanEndpointsDiscovered: (callback: (event: unknown, data: { scanId: string, scanner: string, count: number, endpoints: import('../src/types/workflow').EndpointRecord[], jwtTokens?: string[] }) => void) => {
    const handler = (_event: IpcRendererEvent, data: any) => callback(null, data);
    ipcRenderer.on('scan:endpoints-discovered', handler);
    return () => { ipcRenderer.removeListener('scan:endpoints-discovered', handler); };
  },
  
  // Storage & History
  getEndpoints: (scanId: string, options: {page?:number;search?:string}) => ipcRenderer.invoke('inventory:list',scanId,options),
  prepareTestingWorkflow: (reference: import('../src/types/workflow').WorkflowRef, tool?: string) => ipcRenderer.invoke('inventory:prepare',reference,tool),
  getWorkflowRuns: (scanId: string) => ipcRenderer.invoke('inventory:runs',scanId),
  getHistory: () => ipcRenderer.invoke('storage:getHistory'),
  getFindingsPaginated: (scanId: string, options: Record<string, unknown>) => ipcRenderer.invoke('storage:getFindingsPaginated', scanId, options),
  setTriageDecision: (input: import('../src/types/triage').TriageInput) => ipcRenderer.invoke('triage:set', input),
  getTriageDecisions: (scanId?: string) => ipcRenderer.invoke('triage:list', scanId),
  compareBaseline: (currentScanId: string, baselineScanId: string) => ipcRenderer.invoke('baseline:compare', currentScanId, baselineScanId),
  openReportFolder: (scanId: string) => ipcRenderer.invoke('storage:openFolder', scanId),
  deleteScan: (scanId: string) => ipcRenderer.invoke('storage:deleteScan', scanId),
  clearAllScans: () => ipcRenderer.invoke('storage:clearAllScans'),
  exportReport: (scanId: string, format: 'html' | 'md' | 'json' | 'sarif' | 'pdf') => ipcRenderer.invoke('report:export', scanId, format),
  getReportStats: (scanId: string) => ipcRenderer.invoke('report:getStats', scanId),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // AI Service
  analyzeLogs: (logs: string, prompt: string) => ipcRenderer.invoke('ai:analyzeLogs', logs, prompt),
  getOllamaModels: (customBaseUrl?: string) => ipcRenderer.invoke('ai:getOllamaModels', customBaseUrl),
  testAiConnection: (provider?: string, customBaseUrl?: string) => ipcRenderer.invoke('ai:testConnection', provider, customBaseUrl),
  analyzeScan: (scanId: string, preset: string, customPrompt?: string) => ipcRenderer.invoke('ai:analyzeScan', scanId, preset, customPrompt),
  chatCopilot: (scanId: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, message: string) => ipcRenderer.invoke('ai:chatCopilot', scanId, history, message),
  getAiAnalyses: (scanId: string) => ipcRenderer.invoke('ai:getAnalyses', scanId),
  getLatestAiAnalysis: (scanId: string, preset?: string) => ipcRenderer.invoke('ai:getLatestAnalysis', scanId, preset),
  onAiProgress: (callback: (event: unknown, msg: string) => void) => {
    const handler = (_event: IpcRendererEvent, msg: string) => callback(null, msg);
    ipcRenderer.on('ai:progress', handler);
    return () => { ipcRenderer.removeListener('ai:progress', handler); };
  },


  // Tool Engine & Health Matrix
  getToolsHealth: () => ipcRenderer.invoke('tools:get-health'),
  updateTool: (toolName: string) => ipcRenderer.invoke('tools:update-single', toolName),
  updateAllTools: () => ipcRenderer.invoke('tools:update-all'),
  preflightSmoke: (toolId: string) => ipcRenderer.invoke('tools:preflight-smoke', toolId),
  rollbackTool: (toolName: string) => ipcRenderer.invoke('tools:rollback', toolName),
  uninstallTool: (toolName: string) => ipcRenderer.invoke('tools:uninstall', toolName),
  isToolLocked: (toolName: string) => ipcRenderer.invoke('tools:is-locked', toolName),
  onToolUpdateProgress: (callback: (event: unknown, data: { tool: string, message: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { tool: string, message: string }) => callback(null, data);
    ipcRenderer.on('tools:update-progress', handler);
    return () => { ipcRenderer.removeListener('tools:update-progress', handler); };
  },
  onToolUpdateStatus: (callback: (event: unknown, status: string) => void) => {
    const handler = (_event: IpcRendererEvent, status: string) => callback(null, status);
    ipcRenderer.on('tools:update-status', handler);
    return () => { ipcRenderer.removeListener('tools:update-status', handler); };
  },

  // Dependencies (Legacy compatibility)
  checkDependencies: () => ipcRenderer.invoke('dependency:check'),
  installDependencies: () => ipcRenderer.invoke('dependency:installAll'),
  onInstallProgress: (callback: (event: unknown, msg: string) => void) => {
    const handler = (_event: IpcRendererEvent, msg: string) => callback(null, msg);
    ipcRenderer.on('dependency:installProgress', handler);
    return () => { ipcRenderer.removeListener('dependency:installProgress', handler); };
  },

  // Updater (Legacy compatibility)
  updateTools: () => ipcRenderer.invoke('tools:update'),
  onUpdateOutput: (callback: (event: unknown, msg: string) => void) => {
    const handler = (_event: IpcRendererEvent, msg: string) => callback(null, msg);
    ipcRenderer.on('update:output', handler);
    return () => { ipcRenderer.removeListener('update:output', handler); };
  },
  onUpdateStatus: (callback: (event: unknown, status: string) => void) => {
    const handler = (_event: IpcRendererEvent, status: string) => callback(null, status);
    ipcRenderer.on('update:status', handler);
    return () => { ipcRenderer.removeListener('update:status', handler); };
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // System Diagnostics & Operational Logging
  getDiagnostics: () => ipcRenderer.invoke('system:getDiagnostics'),
  getRecentLogs: (maxLines?: number) => ipcRenderer.invoke('system:getRecentLogs', maxLines),

  // Database Backup & Retention
  createBackup: () => ipcRenderer.invoke('db:createBackup'),
  listBackups: () => ipcRenderer.invoke('db:listBackups'),
  enforceRetention: (maxDays?: number, maxTotalBytes?: number) => ipcRenderer.invoke('db:enforceRetention', maxDays, maxTotalBytes),

  // Request Workspace & Dataflow
  importRawHttp: (rawText: string, defaultHost?: string) => ipcRenderer.invoke('workspace:importRawHttp', rawText, defaultHost),
  importHar: (harContent: string) => ipcRenderer.invoke('workspace:importHar', harContent),
  importOpenApi: (specContent: string, defaultBaseUrl?: string) => ipcRenderer.invoke('workspace:importOpenApi', specContent, defaultBaseUrl),
  inspectParameters: (req: Record<string, unknown>) => ipcRenderer.invoke('workspace:inspectParameters', req),
  buildToolPreview: (tool: string, req: Record<string, unknown>, authHeader?: string) => ipcRenderer.invoke('workspace:buildToolPreview', tool, req, authHeader),

  // Auth Profiles & Vault
  createAuthProfile: (params: Record<string, unknown>) => ipcRenderer.invoke('auth:createProfile', params),
  validateAuthSession: (profileId: string) => ipcRenderer.invoke('auth:validateSession', profileId),

  // Engagement Scope
  evaluateScopeUrl: (url: string, scope: Record<string, unknown>) => ipcRenderer.invoke('scope:evaluateUrl', url, scope),

  // Docker Management
  getDockerStatus: () => ipcRenderer.invoke('docker:getStatus'),
  startDocker: () => ipcRenderer.invoke('docker:start'),

  // Application Version
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
});
