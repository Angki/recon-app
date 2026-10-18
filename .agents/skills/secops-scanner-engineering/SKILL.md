---
name: secops-scanner-engineering
description: "Core engineering patterns for security scanning tools in ReconApp: process sandboxing, cwd containment, exit code normalization, streaming log parsing, and UI scan state resilience."
---

# SecOps Scanner Engineering & Lifecycle Patterns

This skill codifies architectural guidelines and implementation rules for integrating security scanning tools (DAST, reconnaissance, network, fuzzing, SAST) into ReconApp.

## 1. Process Sandboxing & Directory Containment

### The Golden Rule: Never Run Scanners in Workspace Root
- **Anti-pattern**: Spawning a scanner process with `cwd: process.cwd()`.
- **Consequence**: Tools like `crlfsuite` (`resumable_data.crlfsuite`), `whatweb`, `ffuf`, or `wpscan` create lock/session/cache files in the application root, triggering Vite file watchers (`chokidar`), causing hot reloads that wipe frontend state during an active scan.
- **Mandatory Pattern**: Always set `cwd: context.outDir` (`%USERPROFILE%\Documents\SecOpsScans\reports\<scanId>`).
- Any temporary artifact, session file, or intermediate log produced by the binary is safely contained inside the scan's dedicated directory.

```typescript
// electron/services/scanner.ts
let cwd = outDir; // Always default to isolated scan report folder
if (isBat && process.platform === 'win32') {
  executable = process.env.comspec || 'cmd.exe';
  spawnArgs = ['/c', path.basename(bin), ...args];
  cwd = outDir; // Keep cwd inside outDir even for batch wrappers
}
```

## 2. Exit Code Normalization & Tool Semantics

CLI security scanners frequently deviate from POSIX 0 = success:

| Tool | Exit Codes | Semantic Meaning | Required Handling |
|---|---|---|---|
| **Nuclei** | 0 | Scan finished cleanly | Success |
| **Wapiti** | 0, 2 | 0 = clean, 2 = vulnerabilities identified | Treat 0 & 2 as `COMPLETED` |
| **WPScan** | 0, 1, 2, 3, 4 | 0 = clean, 1 = non-WordPress / redirect, 2/3 = vulns, 4 = aborted | Treat 0, 1, 2, 3, 4 as valid completion (non-fatal) |
| **WhatWeb** | 0, 1, 2 | Python/Ruby variants: parse stdout if exit 0 or 2 | Check stdout / outputFile |
| **Gitleaks** | 0, 1 | 0 = no leaks, 1 = leaks discovered | Treat 1 as `COMPLETED` (findings present) |
| **Schemathesis**| 0, 1 | 0 = 100% contract compliance, 1 = bugs/mismatches found | Treat 1 as `COMPLETED` |
| **Dalfox** | 0 | 0 = finished (results in json) | Do not pass `--no-spinner` (unsupported in v3) |
| **GAU** | 0 | Output URLs to file | Always use `--o`, not shorthand `-o` |

### Implementation Pattern in Adapter
```typescript
isSuccessExitCode(code: number | null): boolean {
  return code === 0 || code === 1 || code === 2;
}
```

## 3. UI State Resilience & Rehydration

### The Problem
During development or long-running scans, HMR or accidental browser refresh can reset in-memory Zustand stores to default (`IDLE`, `scanId: null`), making the operator think the scan vanished even though child processes are running.

### The Solution: Two-Layer Persistence
1. **Frontend Persistence**:
   - Wrap `useScanStore` with Zustand `persist` middleware storing `scanId`, `targetUrl`, `status`, and `selectedTools` in `localStorage`.
2. **Backend Reconciliation on Mount**:
   - In `Dashboard.tsx` `useEffect` on mount, if `status === 'RUNNING'` or `scanId` is present:
     - Query backend for active process status or latest findings from SQLite.
     - Resubscribe to live output stream.
3. **Vite Watcher Isolation**:
   - In `vite.config.ts`, ignore `reports`, `backups`, and SQLite database files from `server.watch.ignored`.
