import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
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

  // Handle window routing internally
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Prevent default navigation
    if (!url.startsWith(process.env.VITE_DEV_SERVER_URL || 'file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Kill all child processes before the app quits to prevent orphans
app.on('before-quit', () => {
  try {
    const { scannerService } = require('./ipc');
    scannerService.killAll();
  } catch {
    // ipc module may not be loaded yet
  }
});

// Setup IPC handlers here
import './ipc';
