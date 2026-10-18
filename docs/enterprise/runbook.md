# Enterprise Operations & Administration Runbook

**Application:** ReconApp Enterprise Security Workstation  
**Platform:** Windows 10/11 x64 (Native Electron + Portable Binaries)  
**Standard Storage Path:** `%USERPROFILE%\Documents\SecOpsScans`  
**Application State & Cache:** `%APPDATA%\ReconApp`  

---

## 1. Clean Installation & Setup

### 1.1 Prerequisites
- **Node.js:** v20.x or v22.x LTS (with npm)
- **Python:** v3.11+ (ensure `python` and `pip` are on user PATH)
- **Git:** v2.40+ (for source repository tools)
- **Go (Optional for development compiling):** v1.21+

### 1.2 Fresh Installation Steps
1. Clone the repository into workspace:
   ```bash
   git clone <repo-url> recon-app
   cd recon-app
   ```
2. Install application dependencies:
   ```bash
   npm install
   ```
3. Verify integrity test suite:
   ```bash
   npm test
   ```
   *Expected outcome: 96 / 96 passing tests across all 5 test suites.*
4. Launch developer mode:
   ```bash
   npm run dev
   ```

### 1.3 Offline & Air-Gapped Bundles
For air-gapped security networks (Red Teams / SCADA security audits):
1. Place pre-compiled binaries into the application bundle resources directory:
   `<install-root>\resources\bin\`
2. ReconApp will automatically resolve packaged binaries before attempting any network download (verified by `tests/phase6-gates.test.ts`).
3. Set Ollama / local LLM host to `http://127.0.0.1:11434` with `local-only` policy in Settings. No outbound telemetry or external API calls will be performed.

---

## 2. Database Backup & Disaster Recovery

### 2.1 Online Automated Backup
ReconApp features a native SQLite Online Backup engine (`electron/services/db/backup.ts`) using transactional locks that guarantee consistency without stopping running scans.

- **Trigger via UI:** Navigate to **Settings** > **Database Administration** > click **Create Backup**.
- **Automated Backup Path:** `%USERPROFILE%\Documents\SecOpsScans\backups\backup_<timestamp>.sqlite`
- **Validation:** Every backup created is cryptographically verified to possess the standard `SQLite format 3` header signature.

### 2.2 Restoring from Backup
If data corruption occurs or migration rollback is needed:
1. Ensure ReconApp is completely closed:
   ```powershell
   Get-Process electron, ReconApp -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
2. Navigate to `%USERPROFILE%\Documents\SecOpsScans`:
   ```powershell
   cd "$env:USERPROFILE\Documents\SecOpsScans"
   ```
3. Archive the damaged database:
   ```powershell
   Move-Item recon_app.sqlite "recon_app.sqlite.corrupt.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
   Remove-Item recon_app.sqlite-wal, recon_app.sqlite-shm -ErrorAction SilentlyContinue
   ```
4. Copy the verified backup file:
   ```powershell
   Copy-Item "backups\backup_20261015_xxxxxx.sqlite" "recon_app.sqlite"
   ```
5. Relaunch ReconApp. The startup schema migration manager (`MigrationManager.runMigrations()`) will verify schema integrity and recover any dangling jobs.

---

## 3. Storage Retention & Scan Deletion Management

### 3.1 Retention Policies
ReconApp enforces automated storage boundaries to prevent disk exhaustion:
- **Default Database Backup Retention:** 30 Days max age, 500 MB max aggregate size. Older or surplus backups are automatically pruned in FIFO order.
- **Log File Rotation:** `%USERPROFILE%\Documents\SecOpsScans\logs\secops.log` rotates automatically upon reaching 5 MB, retaining up to 3 compressed/rotated backups.

### 3.2 Manual & Bulk Scan Deletion
Operators can permanently purge scan artifacts and database records:
1. **Single Scan Purge:**
   - Go to **History** page.
   - Click the **Delete** button on any individual assessment record.
   - Confirm target domain and Scan ID in the confirmation dialog.
   - The scan record, finding relationships, and corresponding artifact folder in `reports/<scanId>` are completely destroyed from disk and database.
2. **Clear All Scans (Factory Clean):**
   - Go to **History** page.
   - Click the red **Clear All Results** button in the header toolbar.
   - Confirm destructive intent.
   - All scan records, findings, observations, and artifact folders in `Documents/SecOpsScans/reports` are wiped in an atomic database transaction.
3. **Reset Dashboard Live View:**
   - On the **Dashboard**, click **Clear View** (`RotateCcw` icon).
   - Resets active finding counts, active scanner progress bars, and clears raw terminal logs from memory without deleting historical records.

---

## 4. Diagnostics & Troubleshooting

### 4.1 Common Error Scenarios
| Symptom | Probable Cause | Remediation |
|---|---|---|
| `Unable to move the cache: Access is denied` in terminal | Multiple Electron instances restarting quickly while holding Chromium GPU cache locks | Harmless Electron hot-reload warning; will resolve automatically when process stabilizes or after restarting terminal. |
| `Process closed with code 2` (Dalfox / GAU) | CLI argument mismatch with installed tool version | Resolved in latest codebase: Dalfox v3 flags (`--format json -o ...`) and GAU flag (`--o`) are normalized. |
| `Scan not found` on Export Report | Scan record or JSON output file was removed from disk | Ensure scan is completed before exporting; use SARIF / HTML export from History table. |

### 4.2 Diagnostic Bundle Generation
To collect operational telemetry for enterprise support:
- Navigate to `%USERPROFILE%\Documents\SecOpsScans\logs\`.
- Collect `secops.log` and `operations.jsonl`.
- Sensitive tokens (Bearer, Basic, API keys, passwords) are automatically redacted in flight by `LoggerService.redactSensitive()`.
