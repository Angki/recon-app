import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { scannerService } from './ipc';

// Prepend tool binary directories to process.env.PATH on app startup
const binDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'bin');
const goBin = path.join(os.homedir(), 'go', 'bin');
const extraToolDirs = [
  binDir,
  goBin,
  path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python314', 'Scripts'),
  path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts'),
  'C:\\Python314\\Scripts',
  'C:\\Program Files (x86)\\Nmap',
  'C:\\Program Files\\Nmap',
  'C:\\Program Files\\ZAP\\Zed Attack Proxy',
];

const existingDirs = extraToolDirs.filter(d => fs.existsSync(d));
if (existingDirs.length > 0) {
  process.env.PATH = existingDirs.join(path.delimiter) + path.delimiter + (process.env.PATH || '');
}
process.env.PYTHONIOENCODING = 'utf-8';

// Disable Chromium network service sandbox on Windows only for local dev servers.
// Production builds keep the Chromium sandbox enabled.
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
if (isDev && process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox');
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: !isDev,
    },
    titleBarStyle: 'hidden', // Sleek dashboard look
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc',
    }
  });

  // Load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Deny opening new secondary browser windows, route allowed http(s) links externally
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // ignore invalid URLs
    }
    return { action: 'deny' };
  });

  // Handle window navigation: prevent rogue navigation and allowlist external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isAllowedInternal = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!isAllowedInternal) {
      event.preventDefault();
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url);
        }
      } catch {
        // ignore invalid URLs
      }
    }
  });
}

// Enforce single-instance lock in production to prevent duplicate desktop apps.
// In development, Vite manages lifecycle and HMR, so bypass to avoid file lock collisions (Error code 32).
if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      createWindow();

      app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    });
  }
} else {
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Kill all child processes before the app quits to prevent orphans
app.on('before-quit', () => {
  try {
    scannerService.killAll();
  } catch {
    // ignore
  }
});
