import { ipcMain, shell } from 'electron';
import { scannerService } from './services/scanner';
export { scannerService };
import { storage } from './services/storage';
import { settingsStore } from './services/settings';
import { aiService } from './services/aiService';
import { dependencyService, DEPENDENCIES } from './services/dependencyManager';
import { toolManager } from './services/toolManager';
import { endpointInventory } from './services/endpointInventory';
import { RequestWorkspace, type RequestDefinition } from './services/workspace/requestWorkspace';
import { authService } from './services/workspace/authService';
import { ScopeEnforcer, type EngagementScope } from './services/workspace/scopeEnforcement';

import { preflightSmoke } from './services/platform/preflightSmoke';
import { processLock } from './services/platform/processLock';

export function validateExternalUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL must be a non-empty string');
  }
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid protocol '${parsed.protocol}'. Only http: and https: protocols are permitted.`);
  }
  return parsed.toString();
}

export function registerIpcHandlers() {
  if (!ipcMain || typeof ipcMain.handle !== 'function') return;

  // Unified Tool Engine Handlers
  ipcMain.handle('tools:get-health', async () => {
    return await toolManager.getHealthMatrix();
  });

  ipcMain.handle('tools:update-single', async (event, toolName: string) => {
    return await toolManager.updateTool(toolName, event.sender);
  });

  ipcMain.handle('tools:update-all', async (event) => {
    return await toolManager.updateAll(event.sender);
  });

  // Legacy Tools Update
  ipcMain.handle('tools:update', async (event) => {
    return await toolManager.updateAll(event.sender);
  });

  ipcMain.handle('tools:preflight-smoke', async (_event, toolId: string) => {
    return await preflightSmoke.evaluateStatus(toolId);
  });

  ipcMain.handle('tools:rollback', (_event, toolName: string) => {
    return toolManager.rollbackTool(toolName);
  });

  ipcMain.handle('tools:uninstall', (event, toolName: string) => {
    return toolManager.uninstallTool(toolName, event.sender);
  });

  ipcMain.handle('tools:is-locked', (_event, toolName: string) => {
    return processLock.isToolLocked(toolName);
  });

  ipcMain.handle('dependency:check', async () => {
    return DEPENDENCIES.map(tool => ({
      name: tool.name,
      isInstalled: dependencyService.isInstalled(tool.name),
      requiresManual: !!tool.requiresManual
    }));
  });

  ipcMain.handle('dependency:installAll', async (event) => {
    await dependencyService.checkAndInstallAll(event.sender);
    return { success: true };
  });

  ipcMain.handle('scan:start', async (event, targetUrl, config) => {
    return await scannerService.startScan(event.sender, targetUrl, config);
  });

  ipcMain.handle('scan:stop', async (event, scanId) => {
    return await scannerService.stopScan(scanId);
  });

  // Storage and History
  ipcMain.handle('inventory:list', (_event, scanId, options) => endpointInventory.list(scanId,options));
  ipcMain.handle('inventory:prepare', (_event, reference, tool) => endpointInventory.draft(reference,tool));
  ipcMain.handle('inventory:runs', (_event, scanId) => endpointInventory.runs(scanId));
  ipcMain.handle('storage:getHistory', async () => {
    return storage.getHistory();
  });

  ipcMain.handle('storage:getFindingsPaginated', async (event, scanId, options) => {
    const { dbService } = await import('./services/database');
    return dbService.getFindingsPaginated(scanId, options);
  });

  ipcMain.handle('storage:openFolder', async (event, scanId: string) => {
    if (!scanId || typeof scanId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(scanId)) {
      throw new Error(`Invalid scanId: path traversal or invalid characters detected`);
    }
    storage.openFolder(scanId);
  });

  ipcMain.handle('storage:deleteScan', async (event, scanId: string) => {
    return storage.deleteScan(scanId);
  });

  ipcMain.handle('storage:clearAllScans', async () => {
    return storage.clearAllScans();
  });

  // Report Exports
  ipcMain.handle('report:export', async (event, scanId: string, format: 'html' | 'md' | 'json' | 'sarif') => {
    if (!scanId || typeof scanId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(scanId)) {
      throw new Error(`Invalid scanId`);
    }
    const { reportService } = await import('./services/reportService');
    let filePath: string;
    if (format === 'html') {
      filePath = await reportService.generateHtmlReport(scanId);
    } else if (format === 'md') {
      filePath = await reportService.generateMarkdownReport(scanId);
    } else if (format === 'sarif') {
      filePath = await reportService.exportSarifReport(scanId);
    } else {
      filePath = await reportService.exportJsonReport(scanId);
    }
    return { success: true, filePath };
  });

  ipcMain.handle('report:getStats', async (event, scanId: string) => {
    if (!scanId || typeof scanId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(scanId)) {
      throw new Error(`Invalid scanId`);
    }
    const { reportService } = await import('./services/reportService');
    const data = await reportService.compileReportData(scanId);
    const metrics = reportService.calculateStats(data.findings, data.status, data.toolsUsed, data.toolStatuses);
    return {
      ...data,
      metrics
    };
  });

  // Settings — masked for renderer safety
  ipcMain.handle('settings:get', async () => {
    return settingsStore.getPublic();
  });

  ipcMain.handle('settings:save', async (event, settings) => {
    return settingsStore.save(settings);
  });

  // AI Service
  ipcMain.handle('ai:analyzeLogs', async (event, logs, prompt) => {
    return await aiService.analyzeLogs(event.sender, logs, prompt);
  });

  ipcMain.handle('ai:getOllamaModels', async (event, customBaseUrl?: string) => {
    return await aiService.getLocalOllamaModels(customBaseUrl);
  });

  ipcMain.handle('ai:testConnection', async (event, provider?: string, customBaseUrl?: string) => {
    return await aiService.testConnection(provider, customBaseUrl);
  });

  ipcMain.handle('ai:analyzeScan', async (event, scanId: string, preset: string, customPrompt?: string) => {
    return await aiService.analyzeScan(event.sender, scanId, preset, customPrompt);
  });

  ipcMain.handle('ai:chatCopilot', async (event, scanId: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, message: string) => {
    return await aiService.chatCopilot(event.sender, scanId, history, message);
  });

  ipcMain.handle('ai:getAnalyses', async (event, scanId: string) => {
    const { dbService } = await import('./services/database');
    return dbService.getAiAnalyses(scanId);
  });

  ipcMain.handle('ai:getLatestAnalysis', async (event, scanId: string, preset?: string) => {
    const { dbService } = await import('./services/database');
    return dbService.getLatestAiAnalysis(scanId, preset);
  });


  // System Diagnostics & Operational Logging
  ipcMain.handle('system:getDiagnostics', async () => {
    const { logger } = await import('./services/logger');
    return logger.getDiagnosticsSummary();
  });

  ipcMain.handle('system:getRecentLogs', async (event, maxLines?: number) => {
    const { logger } = await import('./services/logger');
    return logger.getRecentLogs(maxLines || 200);
  });

  // Database Backup & Retention
  ipcMain.handle('db:createBackup', async () => {
    const { BackupManager } = await import('./services/db/backup');
    const { dbService } = await import('./services/database');
    const backupManager = new BackupManager();
    const dbInstance = dbService.getRawDatabase();
    return await backupManager.createBackup(dbInstance);
  });

  ipcMain.handle('db:listBackups', async () => {
    const { BackupManager } = await import('./services/db/backup');
    const backupManager = new BackupManager();
    return backupManager.listBackups();
  });

  ipcMain.handle('db:enforceRetention', async (event, maxDays?: number, maxTotalBytes?: number) => {
    const { BackupManager } = await import('./services/db/backup');
    const backupManager = new BackupManager();
    return backupManager.enforceRetention(maxDays, maxTotalBytes);
  });

  // Shell — restricted strictly to validated http/https URLs
  ipcMain.handle('shell:openExternal', async (event, url: string) => {
    const safeUrl = validateExternalUrl(url);
    await shell.openExternal(safeUrl);
  });

  // Request Workspace & Dataflow IPC
  ipcMain.handle('workspace:importRawHttp', (event, rawText: string, defaultHost?: string) => {
    return RequestWorkspace.importRawHttp(rawText, defaultHost);
  });

  ipcMain.handle('workspace:importHar', (event, harContent: string) => {
    return RequestWorkspace.importHar(harContent);
  });

  ipcMain.handle('workspace:importOpenApi', (event, specContent: string, defaultBaseUrl?: string) => {
    return RequestWorkspace.importOpenApi(specContent, defaultBaseUrl);
  });

  ipcMain.handle('workspace:inspectParameters', (event, req: RequestDefinition) => {
    return RequestWorkspace.inspectParameters(req);
  });

  ipcMain.handle('workspace:buildToolPreview', (event, tool: string, req: RequestDefinition, authHeader?: string) => {
    return RequestWorkspace.buildSafePreview(tool, req, authHeader);
  });

  // Auth Profile & Vault IPC
  ipcMain.handle('auth:createProfile', (event, params: Parameters<typeof authService.createProfile>[0]) => {
    const profile = authService.createProfile(params);
    return authService.getPublicProfile(profile);
  });

  ipcMain.handle('auth:validateSession', async (event, profileId: string) => {
    const profile = authService.getProfile(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);
    return await authService.validateSessionForLaunch(profile);
  });

  // Scope Enforcement IPC
  ipcMain.handle('scope:evaluateUrl', (event, url: string, scope: EngagementScope) => {
    return ScopeEnforcer.isUrlInScope(url, scope);
  });

  // App Version
  ipcMain.handle('app:getVersion', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron');
      return app?.getVersion ? app.getVersion() : '1.0.0';
    } catch {
      return '1.0.0';
    }
  });
}

// Auto-register when running in main process
if (ipcMain && typeof ipcMain.handle === 'function') {
  registerIpcHandlers();
}
