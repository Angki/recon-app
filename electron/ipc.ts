import { ipcMain } from 'electron';
import { ScannerService } from './services/scanner';
import { updaterService } from './services/updater';
import { storage } from './services/storage';
import { settingsStore } from './services/settings';
import { aiService } from './services/aiService';

import { dependencyService, DEPENDENCIES } from './services/dependencyManager';

export const scannerService = new ScannerService();

ipcMain.handle('tools:update', async (event) => {
  return await updaterService.updateTools(event.sender);
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
ipcMain.handle('storage:getHistory', async () => {
  return storage.getHistory();
});

ipcMain.handle('storage:getFindingsPaginated', async (event, scanId, options) => {
  const { dbService } = await import('./services/database');
  return dbService.getFindingsPaginated(scanId, options);
});

ipcMain.handle('storage:openFolder', async (event, scanId) => {
  storage.openFolder(scanId);
});

// Settings — now persisted to disk
ipcMain.handle('settings:get', async () => {
  return settingsStore.get();
});

ipcMain.handle('settings:save', async (event, settings) => {
  return settingsStore.save(settings);
});

// AI Service
ipcMain.handle('ai:analyzeLogs', async (event, logs, prompt) => {
  return await aiService.analyzeLogs(event.sender, logs, prompt);
});

// Shell
import { shell } from 'electron';
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
});
