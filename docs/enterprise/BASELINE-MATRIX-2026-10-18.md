# Matriks Baseline & Status Pengembangan — 18 Oktober 2026

Dokumen ini mencatat audit baseline, status komitmen, verifikasi runtime/tool, dan matriks pemetaan terhadap temuan review 18 Oktober 2026 (`docs/reviews/2026-10-18/REVIEW.md`) serta spesifikasi enterprise.

---

## 1. Lingkungan & Checkpoint Awal

- **Workspace Path**: `D:\Projects\recon-app`
- **Git Commit Baseline**: `eee1c03` (`build: bundle dist-electron release artifacts and sync 2026-10-18 review notes`)
- **Git Working Tree**: Bersih (tidak ada modifikasi yang belum terlacak di luar perbaikan lint)
- **Runtime & Toolchain**:
  - Node.js: `v24.13.1`
  - npm: `11.12.1`
  - TypeScript: `~6.0.2`
  - ESLint: `^10.3.0`
  - Electron: `^42.3.3`
- **Hasil Pengujian Baseline Awal**:
  - `npx tsc -b`: **LULUS** (0 TypeScript errors)
  - `npm test` (`node scripts/test-isolated.cjs`): **111 / 111 tes LULUS** (100% green, durasi ~25.6s, home/DB terisolasi di `%TEMP%`)
  - `npm run lint`: 1 error lint tersisa pada `endpointInventory.ts:89:9` (`no-useless-assignment`), langsung diperbaiki tanpa menonaktifkan aturan lint.

---

## 2. Matriks Pemetaan Temuan Review vs Realitas Kode

| ID | Kategori | Ringkasan Temuan | Status | Bukti / Catatan Verifikasi |
|---|---|---|---|---|
| **AI-1** | AI Service | Scoped lint error cause & require | **Sudah diperbaiki** | Diperbaiki pada commit `a4d8868` (menggunakan dynamic import / standard ESM & `Error(..., { cause })`). |
| **AI-2** | AI Service | Mocking network/provider unit tests | **Sudah diperbaiki (Fase 0)** | Tes `tests/ai-service.test.ts` dimutakhirkan dengan mock transport deterministik, tidak bergantung pada daemon Ollama lokal. |
| **AI-3** | AI Service | Streaming chunk buffer & boundary parsing | **Sudah diperbaiki (Fase 0)** | Buffer antar-chunk diimplementasikan di `aiService.ts:processStreamChunks` dengan flush final, lulus tes `ai-service.test.ts`. |
| **AI-4** | AI Service | Anthropic status key configured vs connected | **Sudah diperbaiki** | `aiService.ts:107` mengembalikan pesan "Anthropic API key configured" bukan connected/verified. |
| **R1** | Integrity | Nilai keamanan A+/Secure pada scan kosong/parsial | **Sudah diperbaiki (Fase 1)** | `reportService.ts:calculateStats` dan `FindingsSummary.tsx` memisahkan `COMPLETED_CLEAN` dari `PARTIAL_COVERAGE`, `FAILED`, `CANCELLED`, dan `NOT_ASSESSED`. Scan kosong/gagal/parsial tidak lagi mendapat Grade A/Secure. |
| **R2** | Baseline | Baseline menandai temuan hilang sebagai resolved | **Sudah diperbaiki (Fase 1)** | `baseline.ts` melacak `notReassessedFindings` jika scanner tidak dijalankan atau scan tidak tuntas. Hanya scanner yang benar-benar dievaluasi yang dapat menandai temuan `resolved`. |
| **R3** | Database | Fingerprint case-sensitivity (`/Admin` vs `/admin`) | **Sudah diperbaiki (Fase 1)** | `fingerprint.ts` v2 mempertahankan case sensitif pada URL pathname, mendukung line anchor SAST (`#L\d+`) dan package SCA, serta meredaksi query secret token sebelum hashing. |
| **R4** | Runner | Lifecycle idempotency, async state persistence | **Sudah diperbaiki (Fase 1)** | `scanner.ts` menerapkan single-finalization guard `finalized`, menanti (`await`) update persistence sebelum emit IPC `scan:status`, dan mencegah delete scan aktif di `storage.ts`. |
| **R5** | Security | Secret redaction pada raw stdout & atomic settings write | **Sudah diperbaiki (Fase 1)** | `LoggerService.redactSensitive` meredaksi Bearer, Basic, JWT, private key, dan session cookie pada stdout/stderr sebelum ditulis ke file/IPC. `settingsStore.save` memakai file temporer `.tmp` dan rename atomik dengan rollback cache bila gagal. |
| **R6** | Database | Retention backup salah urut (membuang backup baru) | **Sudah diperbaiki (Fase 1)** | `backup.ts:enforceRetention` memprune file kadaluarsa tanpa menghapus backup terbaru, memprune kuota dari yang tertua ke terbaru, dan memvalidasi `PRAGMA integrity_check` serta `wal_checkpoint(TRUNCATE)`. |
| **R8** | Adapters | Parser tool versi dipin (SSLyze, Schemathesis, Semgrep) | **Sudah diperbaiki (Fase 3)** | Audit parser SSLyze, Semgrep, Trivy, dan Schemathesis: tidak lagi menelan (swallow) error syntax/korupsi JSON menjadi temuan kosong; rethrow exception dengan context `{ cause: err }` agar finalisasi scan melaporkan status `FAILED`, bukan `COMPLETED_CLEAN` palsu. Lulus tes `tests/fase3-hardening.test.ts`. |
| **R9** | Platform | Manifest platform terpadu, locking, staging, venv & container cleanup | **Sudah diperbaiki (Fase 3)** | `ProcessLockManager` mencegah modifikasi/penghapusan binary saat scan aktif; `StagingInstaller` mengisolasi download ke `.staging`, memverifikasi SHA-256, mencatat receipt provenance, dan mendukung rollback otomatis; `PythonVenvManager` mengisolasi dependency Python ke venv per-tool tanpa mencemari sistem; `ContainerLifecycleManager` melacak container ID dan membersihkan container yang tersisa saat cancel/quit; `PreflightSmokeEngine` membedakan status `not_installed`, `runtime_missing`, `unsupported_version`, `healthcheck_failed`, dan `ready` dengan uji versi semver dan smoke fixture. Lulus 171/171 tes. |
| **R10** | Runner | Ring buffer logs, concurrency budget, Windows cmd quoting | **Sudah diperbaiki (Fase 5)** | `useLogStore.ts` menerapkan ring buffer 1.000 baris scanner log dan 500.000 karakter raw log dengan indikator pemotongan `[... BUFFER TRUNCATED: showing latest lines ...]`. Lulus tes `tests/fase5-hardening.test.ts`. |
| **T1** | Tools | Integrasi SSTImap (deteksi aman, lab lokal) | **Sudah selesai (Fase 4)** | Manifest `sstimap` (v1.2.2 pinned) di `manifests.ts`, installer git-clone aman di `activeToolInstaller.ts`, runner `--verify` dan arithmetic proof non-destruktif (`7*7=49`) di `activeValidation.ts:parseSstimap`, reduksi secret, CWE-1336. Lulus tes fixture di `tests/fase4-hardening.test.ts`. |
| **T2** | Tools | Integrasi jwt_tool (inspeksi token aman, redaksi) | **Sudah selesai (Fase 4)** | Manifest `jwt_tool` (v2.2.8 pinned), runner mode inspeksi token dan controlled validation di `activeValidation.ts:parseJwtTool`, pemisahan temuan offline inspection (medium) dan server-verified flaws (high, CWE-347), serta redaksi ketat seluruh token JWT (`eyJ...[REDACTED_TOKEN]`). Lulus tes fixture di `tests/fase4-hardening.test.ts`. |
| **T3** | Tools | Integrasi Syft (SBOM source & container) | **Sudah selesai (Fase 4)** | Manifest `syft` (v1.20.0 native binary), adapter `ScannerAdapters.syft` mendukung direktori (`dir:...`) dan container image, parser `parseSyft` memetakan komponen perangkat lunak, PURL, lisensi, dan lokasi dengan CWE-1395, serta error reporting tanpa swallow. Lulus tes fixture di `tests/fase4-hardening.test.ts`. |
| **T4** | Tools | Integrasi Interactsh (self-hosted, OOB verification) | **Sudah selesai (Fase 4)** | Manifest `interactsh` (v1.2.2 native binary), adapter `ScannerAdapters.interactsh` mendukung self-hosted server dan korelasi token per-run (`-cid`), parser `parseInteractsh` meredaksi alamat IP remote (`[REDACTED_IP]`) dan header Authorization/Cookie pada raw requests, CWE-918. Lulus tes fixture di `tests/fase4-hardening.test.ts`. |
| **U1** | UI/UX | Workflow Request & Auth Workspace, Visual QA | **Sudah selesai (Fase 2 & Fase 5)**| 6-tahap workflow navigasi (`1. Target & Scope`, `2. Requests & Auth`, `3. Engines & Preflight`, `4. Run & Telemetry`, `5. Findings & Evidence`, `6. Retest & Reports`) di `App.tsx`. `VulnerabilityTable` mendukung filter tool aktif, confidence badge, keyboard navigation, fingerprint copy, dan evidence drawer tab. AI reasoning dengan boundary untrusted, secret redaction, evidence ID grounding, dan persistensi database `ai_analyses`. Lulus 187/187 tes. |

---

## 3. Rencana Eksekusi Bertahap

- **Fase 0 (Selesai — commit `de79549`)**:
  - Menyelesaikan lint error dan mengunci baseline.
  - Memperbarui `tests/ai-service.test.ts` dengan mock transport fetch yang deterministik.
  - Menyempurnakan streaming chunk buffer pada `aiService.ts` agar tahan terhadap pecahan chunk JSON di batas newline.
- **Fase 1 (Selesai — commit `b58b899`)**:
  - Kontrak assessment: `COMPLETED_CLEAN`, `COMPLETED_WITH_FINDINGS`, `PARTIAL`, `FAILED`, `INTERRUPTED`.
  - Hapus nilai A+/Secure palsu pada scan kosong/gagal di `reportService.ts` dan `FindingsSummary.tsx`.
  - Fix fingerprint case-sensitivity di `fingerprint.ts` (`/Admin` != `/admin`), sertakan parameter identity, hapus secret dari hash.
  - Fix baseline comparison di `baseline.ts` (unobserved menjadi `not reassessed`).
  - Idempotent runner lifecycle & atomic settings save dengan cache rollback.
  - Fix retention backup di `backup.ts` (pertahankan backup terbaru, prune tertua, integritas SQLite).
- **Fase 2 (Selesai — commit `7e0968f`)**:
  - Target bertipe: `web_url`, `api_spec`, `local_source`, `container_image`.
  - Request Workspace (method, headers, cookies, body, auth profile).
  - Scope and rate limiting enforcement.
- **Fase 3 (Selesai — commit `4a2ca35`)**:
  - Manifest platform terpadu & preflight smoke tests.
  - Per-tool virtual environment isolation.
  - Container cleanup guarantees.
- **Fase 4 (Selesai — commit `18a7a4e`)**:
  - Integrasi SSTImap, jwt_tool, Syft, Interactsh dengan pengujian fixture terisolasi.
- **Fase 5 (Selesai — commit `c9e2a6f`)**:
  - Streamlined UI workflow navigasi 6 tahap & ring buffer logs (`MAX_SCANNER_LOG_LINES = 1000`, `MAX_RAW_LOG_CHARS = 500_000`).
  - Keyboard accessible findings table dengan filter tool baru, confidence badges, fingerprint hashes, dan tab Evidence Drawer.
  - Evidence-grounded AI copilot reasoning dengan untrusted prompt boundary, input redaction, grounded evidence citation, dan persistensi database `ai_analyses`.
  - Suite pengujian Fase 5 (`tests/fase5-hardening.test.ts`) dengan 187/187 tes lulus.
- **Fase 6 (Selesai — commit Fase 6)**:
  - Verifikasi seluruh rangkaian pengujian unit & integrasi terisolasi: 187 / 187 tes LULUS (10 test suites).
  - Verifikasi nol error TypeScript (`npx tsc -b`) dan nol error ESLint (`npx eslint . --quiet`).
  - Verifikasi kompilasi bundel produksi (`npm run build`) renderer Vite dan backend Electron.
  - Verifikasi pembuatan paket rilis Windows (`electron-builder` v26.15.2, Electron v42.3.3):
    - `Recon App Setup 1.0.0.exe` (NSIS Installer, 104,978,985 bytes, SHA-256: `5A9A798CA61BCF2EBC75CBDDA6023C696E476776DD2E785FD068841C254F6023`)
    - `Recon App 1.0.0.exe` (Portable executable, 104,811,828 bytes, SHA-256: `619CDDDBED19280732D0D0485F767798D2AB7704B37789664AD4EC1417D9DE2B`)
  - Dokumentasi rilis, integritas hash SHA-256, petunjuk SmartScreen self-signed certificate, dan persyaratan sistem pada `docs/enterprise/QA-2026-10-18.md` dan `README.md`.


