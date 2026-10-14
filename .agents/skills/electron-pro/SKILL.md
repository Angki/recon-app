---
name: electron-pro
description: Production-grade Electron desktop application engineering patterns, security practices, IPC safety, and packaging.
---

# Electron Pro Engineering Patterns

## 1. Security Architecture & Process Isolation
- `nodeIntegration: false` and `contextIsolation: true` must be strictly enforced in all WebPreferences.
- Whitelist and sanitize all IPC channels via `contextBridge.exposeInMainWorld('api', {...})`. Never expose raw `ipcRenderer.send` or `ipcRenderer.on`.
- Never use `child_process.exec` with raw concatenated strings; always use `child_process.spawn` with strict string argument arrays to prevent command injection.

## 2. Process & Stream Performance
- Batch frequent IPC events (e.g. stdout streams from fast CLI tools) with micro-throttles (50-100ms) to prevent renderer UI freezing.
- Always clean up child process listeners on scan cancellation or window close.
- Wrap external binary calls in timeout guards and detect exit codes.

## 3. Packaging & Assets Management
- Store downloaded CLI dependencies in `%APPDATA%/ReconApp/bin` (or platform equivalent).
- Use `extraResources` in `package.json` for auxiliary runner scripts so they are properly bundled in packaged builds.
- Configure `electron-builder` with both NSIS installer and portable formats for flexibility.
