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
| **R7** | Target | Target bertipe (URL, Source, Container, API) & Semgrep outDir guard | **Sudah diperbaiki (Fase 2)** | Union `ScanTarget` (`web_url`, `api_spec`, `local_source`, `container_image`) dengan `targetValidator.ts`. URL web ditolak untuk tool source-only (e.g. Semgrep). Semgrep adapter melempar error jika target adalah remote URL dan tidak lagi memindai folder output `outDir`. Request workspace (raw HTTP, HAR, OpenAPI) dan auth session health (vault, fail-closed expiry) diimplementasikan dan diverifikasi di `tests/fase2-hardening.test.ts`. |
| **R8** | Adapters | Parser tool versi dipin (SSLyze, Schemathesis, Semgrep) | **Terkonfirmasi tersisa (P1)** | Struktur output parser perlu divalidasi terhadap fixture versi aktual yang dipin. |
| **R9** | Platform | Manifest platform terpadu & preflight smoke tests | **Terkonfirmasi tersisa (P1)** | Manifest belum sepenuhnya menyatukan lock lintas proses, rollback, dan status ready yang kaya. |
| **R10** | Runner | Ring buffer logs, concurrency budget, Windows cmd quoting | **Terkonfirmasi tersisa (P1)** | Log store di memory perlu batasan buffer agar tidak membengkak pada long-running scans. |
| **T1** | Tools | Integrasi SSTImap (deteksi aman, lab lokal) | **Fitur baru (Fase 4)** | Belum tersedia di repositori. Akan diintegrasikan lengkap (manifest, runner, parser, tests). |
| **T2** | Tools | Integrasi jwt_tool (inspeksi token aman, redaksi) | **Fitur baru (Fase 4)** | Belum tersedia di repositori. Akan diintegrasikan lengkap (manifest, runner, parser, tests). |
| **T3** | Tools | Integrasi Syft (SBOM source & container) | **Fitur baru (Fase 4)** | Belum tersedia di repositori. Akan diintegrasikan lengkap (manifest, runner, parser, tests). |
| **T4** | Tools | Integrasi Interactsh (self-hosted, OOB verification) | **Fitur baru (Fase 4)** | Belum tersedia di repositori. Akan disediakan sebagai adapter OOB aman dengan boundary data transparan. |
| **U1** | UI/UX | Workflow Request & Auth Workspace, Visual QA | **Fitur baru (Fase 2 & 5)**| Tabs terstruktur (Projects/Targets -> Requests/Auth -> Tools -> Run -> Findings -> Reports). |

---

## 3. Rencana Eksekusi Bertahap

- **Fase 0 (Sedang Berjalan)**:
  - Menyelesaikan lint error dan mengunci baseline.
  - Memperbarui `tests/ai-service.test.ts` dengan mock transport fetch yang deterministik (tidak memerlukan Ollama daemon hidup).
  - Menyempurnakan streaming chunk buffer pada `aiService.ts` agar tahan terhadap pecahan chunk JSON di batas newline.
- **Fase 1**:
  - Kontrak assessment: `COMPLETED_CLEAN`, `COMPLETED_WITH_FINDINGS`, `PARTIAL`, `FAILED`, `INTERRUPTED`.
  - Hapus nilai A+/Secure palsu pada scan kosong/gagal di `reportService.ts` dan `FindingsSummary.tsx`.
  - Fix fingerprint case-sensitivity di `fingerprint.ts` (`/Admin` != `/admin`), sertakan parameter identity, hapus secret dari hash.
  - Fix baseline comparison di `baseline.ts` (unobserved menjadi `not reassessed`).
  - Idempotent runner lifecycle & atomic settings save dengan cache rollback.
  - Fix retention backup di `backup.ts` (pertahankan backup terbaru, prune tertua, integritas SQLite).
- **Fase 2**:
  - Target bertipe: `web_url`, `api_spec`, `local_source`, `container_image`.
  - Request Workspace (method, headers, cookies, body, auth profile).
  - Scope and rate limiting enforcement.
- **Fase 3**:
  - Manifest platform terpadu & preflight smoke tests.
  - Per-tool virtual environment isolation.
  - Container cleanup guarantees.
- **Fase 4**:
  - Integrasi SSTImap, jwt_tool, Syft, Interactsh dengan pengujian fixture terisolasi.
- **Fase 5**:
  - Streamlined UI workflow & virtualized/ring buffer logs.
  - Evidence-grounded AI copilot reasoning.
- **Fase 6**:
  - Comprehensive QA, verification tests, release build & documentation.
