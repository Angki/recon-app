# Review ulang Recon App — 16 Oktober 2026

Pemeriksaan dimulai sesuai jadwal 11.30 WITA. Repository: `D:\Projects\recon-app`; HEAD `6cc2b26`, dengan perubahan lokal Antigravity. Review ini menilai working tree terbaru, bukan hanya commit tersebut. Source aplikasi tidak diubah. Berkas review dan harness bukti ditambahkan di folder ini.

**Penilaian:** aplikasi meningkat nyata pada build, parser Nuclei, default pilihan tool, dan stabilitas renderer. Namun belum layak disebut enterprise-ready. Risiko utama sekarang adalah hasil yang terlihat berhasil walaupun assessment tidak valid, integrasi tool baru yang belum sesuai kontrak upstream, dan modul enterprise yang tersedia sebagai helper tetapi belum menjadi workflow pengguna.

Dokumen `docs/enterprise/reconciliation.md` menyebut seluruh R01–R22 sudah terverifikasi. Sejumlah alasan penutupan tidak menyelesaikan masalah aslinya: R06 membahas catalog padahal masalahnya kehilangan event; R16 ditutup dengan daftar profile padahal belum ada aliran data antar-tool; R18 menyebut bounded logs padahal store masih melakukan append tanpa batas. Ini perlu diperbaiki agar roadmap berikutnya bertumpu pada bukti perilaku.

## Bukti dan keterbatasan

| Pemeriksaan | Hasil |
|---|---|
| `tsc -b --pretty false` | Lulus, kini backend Electron masuk project references. Backend belum mengaktifkan `strict`; pemeriksaan unused dimatikan. |
| `eslint .` sebelum penambahan harness review | Exit 0, **0 error dan 50 warning**. Sejumlah aturan diturunkan menjadi warning; bukan berarti semua masalah lama diperbaiki. |
| Tujuh berkas test fase 0–6 | **96 pass, 0 fail**. Dijalankan dengan Electron sebagai Node, USERPROFILE sementara yang diverifikasi terlebih dahulu. |
| Probe tambahan | Membuktikan celah grade, baseline, agregasi STOPPED, DB/JSON berbeda, collision fingerprint, Semgrep, SSLyze, retention, kebijakan AI dan streaming. |
| Renderer Playwright, Edge headless | 1366×768, 1400×900, 1920×1080; empat tema pada 1400×900; **0 page error**, satu xterm saat awal. IPC read-only dimock. Tidak ada diagnostic patch pada source. |
| Integrasi scanner sebenarnya | Tidak menjalankan scan target, instalasi, updater, model AI atau API komersial. Adapter baru belum dinyatakan runtime-verified. |
| Packaging/scale | Installer bersih, signing, native ABI pada mesin lain, restore lengkap dan benchmark besar belum dijalankan. |

Hasil ada di [tests.txt](D:/Projects/recon-app/docs/reviews/2026-10-16/evidence/tests.txt), [probes.txt](D:/Projects/recon-app/docs/reviews/2026-10-16/evidence/probes.txt), [typecheck.txt](D:/Projects/recon-app/docs/reviews/2026-10-16/evidence/typecheck.txt), [lint.txt](D:/Projects/recon-app/docs/reviews/2026-10-16/evidence/lint.txt), dan [ui-results.json](D:/Projects/recon-app/docs/reviews/2026-10-16/evidence/ui-results.json). Hash source/test/config dicatat sebelum dan dibandingkan sesudah pemeriksaan; pada checkpoint tidak terdeteksi perubahan pada file yang dipantau. Ini tidak menjamin filesystem snapshot atomik atau mendeteksi file baru di luar daftar.

**Temuan tambahan penting:** tes proyek mengimpor singleton database/settings dan test phase6 memanggil `clearAllScans()`. Menjalankan `npm test` biasa dapat menyentuh data asli di Documents/SecOpsScans. Karena itu semua tes review menggunakan home sementara. Isolasi wajib menjadi bagian test runner resmi, bukan prosedur manual reviewer.

## Yang sudah membaik dan perlu dipertahankan

- Nuclei menerima JSONL serta JSON array; fixture suite lolos.
- Unknown scan ditolak oleh report compiler. HTML failed/stopped mendapat N/A.
- Scan ID mendapat suffix acak, empty tool list ditolak, metadata awal di-await.
- Backend menggunakan `close`, menyediakan timeout, cleanup dan recovery RUNNING saat startup.
- Preload membuang objek event Electron; public settings mengembalikan secret yang dimasking dan save tidak lagi menulis secret plaintext jika secure storage tidak tersedia.
- Catalog, migration ledger, index SQL, fingerprint, backup online SQLite dan SARIF sudah ada sebagai fondasi.
- Default target kosong, pilihan awal HTTPX/Nuclei, lima adapter tambahan tersedia: SSLyze, Gitleaks, Semgrep, Trivy dan Schemathesis. Total **29 adapter**, bukan 24.
- ErrorBoundary, import terminal, layout dan mount terminal awal membaik. Jangan mengulang pekerjaan ini sebagai fitur yang belum ada.

## Temuan aktif berprioritas

P0 di sini berarti penghalang kepercayaan hasil/rilis; P1 perlu selesai sebelum rollout enterprise; P2 peningkatan UX/operasional. Ini bukan CVSS.

### N01 — P0: assurance masih tidak konsisten

[reportService.ts:67](D:/Projects/recon-app/electron/services/reportService.ts:67) hanya meniadakan grade untuk FAILED/STOPPED/CANCELLED. Probe `calculateStats([], status)` menghasilkan **A untuk PARTIAL, RUNNING dan INTERRUPTED**. Markdown, JSON dan IPC getStats bahkan tidak meneruskan status. SARIF menganggap semua status selain FAILED sebagai `executionSuccessful`.

[FindingsSummary.tsx:52](D:/Projects/recon-app/src/components/FindingsSummary.tsx:52) menampilkan **A+ Secure ketika belum ada temuan**, termasuk sebelum scan dijalankan. Ini terlihat langsung pada screenshot idle. Formula dashboard juga berbeda dari report. Memindahkan port terbuka menjadi severity info belum memisahkannya dari finding count.

Perbaikan: satu model assessment verdict dengan coverage, execution outcome, parse outcome dan persistence outcome. Empty valid result harus berbeda dari missing output, parsing gagal, belum scan atau scan parsial. Semua format report dan UI menggunakan model yang sama; ganti klaim keamanan keseluruhan dengan status assessment yang terukur.

### N02 — P0: baseline dan identitas finding dapat memberi kesimpulan keliru

[baseline.ts:41](D:/Projects/recon-app/electron/services/db/baseline.ts:41) tidak mengecualikan PARTIAL/RUNNING dan tidak membandingkan target, scope, tool, ruleset atau coverage. Probe dengan baseline berisi satu finding dan current scan tanpa finding pada target lain menghasilkan `resolvedCount: 1`, termasuk ketika current status RUNNING/PARTIAL. Ini helper yang belum terlihat terhubung ke UI, tetapi jangan diaktifkan sebelum diperbaiki.

[fingerprint.ts:27](D:/Projects/recon-app/electron/services/db/fingerprint.ts:27) melowercase seluruh URL dan membuang fragment. Probe `/Admin` dan `/admin` bertabrakan; dua finding Semgrep pada file sama di `#L1` dan `#L99` juga bertabrakan. Triage memakai semua keputusan fixed historis, bukan keputusan efektif terbaru. Identitas Trivy memakai URL advisory sebagai lokasi pada beberapa kasus, sehingga konteks package/asset berisiko hilang.

Perbaikan: resolusi hanya saat coverage comparable dan selesai valid; selain itu `not observed/unknown`. Fingerprint bertipe lokasi web/source/package dan memiliki namespace project, rule, parameter/source location; migrasikan versi. Jangan menggabungkan issue berbeda hanya karena hash inputnya terlalu sempit.

### N03 — P0: kontrak adapter baru belum benar

- **Semgrep:** [registry.ts:1149](D:/Projects/recon-app/electron/services/scanners/registry.ts:1149) mengalihkan target URL ke direktori output scan, lalu menganggap exit 2 sukses. Probe membuktikan keduanya. Dokumentasi upstream menyebut exit 2 sebagai failure. Notice “local source only” ditambahkan sebagai finding info, bukan menolak request yang tidak sesuai. [Semgrep CLI](https://docs.semgrep.dev/cli-reference)
- **SSLyze:** parser membaca `scan_commands_results` dengan field langsung, sementara model upstream memakai `scan_result` dan wrapper `result` per command. Probe sintetis sesuai struktur upstream dengan Heartbleed true menghasilkan **0 finding**. Ini bukti mismatch struktur, bukan hasil scan server sungguhan. Pin versi dan gunakan fixture output binary versi tersebut. [Model JSON SSLyze](https://github.com/nabla-c0d3/sslyze/blob/release/sslyze/json/json_output.py)
- **Schemathesis:** `--report` menerima path file dalam adapter. Dokumentasi sekarang menjelaskan argumen tersebut sebagai format dan menyediakan `--report-json-path` untuk lokasi output. Test hanya memastikan array argumen yang dibuat sendiri. Schema `events/tasks` parser belum dibuktikan cocok dengan output versi terpilih. 5xx tidak otomatis membuktikan kerentanan high. [Schemathesis CLI](https://schemathesis.readthedocs.io/en/stable/reference/cli/)
- **Gitleaks/Trivy:** engine hanya menerima HTTP(S), padahal kedua workflow ini memerlukan target repository/directory atau image sesuai mode. Trivy selalu menjalankan `fs`, belum punya pemilih image/SBOM. Keberadaan tombol tidak membuktikan pengguna dapat menyelesaikan workflow.

Perbaikan: typed target dan compatibility preflight, error yang jelas sebelum spawn, fixtures nyata terikat versi, exit semantics berdasarkan mode, dan hasil parse terstruktur yang membedakan empty/invalid/partial. Uji setiap adapter terhadap versi executable dan local fixture lab sebelum badge verified.

### N04 — P1: lifecycle belum menjadi satu state machine end-to-end

[scanner.ts](D:/Projects/recon-app/electron/services/scanner.ts) tetap menangani `error` dan `close` terpisah, tidak mengembalikan parse/persist failure sebagai job outcome, dan mengirim findings walau insert DB gagal. Output hilang tetap bisa berakhir COMPLETED jika exit sukses. Ini bisa membuat UI dan report berbeda.

Probe agregasi satu tool STOPPED dengan aggregate RUNNING menghasilkan COMPLETED. `storage.updateStatus(scanId, null, 'STOPPED')` menghasilkan **DB STOPPED tetapi metadata JSON RUNNING**; JSON tidak mengaplikasikan status global yang diminta. Dashboard menghitung status sendiri dan tidak mendukung PARTIAL. Cleanup stoppedScans dilakukan sebelum membaca cancellation pada final close; Windows taskkill tidak otomatis menetapkan properti `proc.killed` pada objek ChildProcess.

Finalisasi perlu idempotent, await persist+flush, dan alasan terminal eksplisit (`completed`, `timeout`, `cancelled`, `parse_failed`, `persist_failed`). Jadikan DB sumber status; renderer dan JSON membaca snapshot yang sama. Larang delete/clear terhadap run aktif agar writer tidak kehilangan direktori dan DB saat proses masih berjalan.

### N05 — P1: event race, start race dan pipeline masih ada

[Dashboard.tsx:95](D:/Projects/recon-app/src/pages/Dashboard.tsx:95) memasang listener berbasis scanId yang baru tersedia setelah startScan kembali. Rehydrate hanya memuat 1.000 findings, tidak merekonsiliasi status/log/event sequence. Start masih bergantung penguncian RUNNING; dedup tool, request idempotency dan admission control backend belum terlihat.

Semua tool dalam loop startScan tetap berjalan dengan target awal, tanpa concurrency budget atau input output berantai. File `pipeline/profiles.ts` mendefinisikan daftar, bukan scheduler/dataflow. UI membuat daftar profile sendiri. **Passive Recon berisi DNSX/TLSX**, sedangkan TLS probing jelas berinteraksi dengan target. Label “Zero-touch” tidak sesuai.

Perbaikan: shared contract, subscribe sebelum launch ditambah durable snapshot/replay; typed edges, scope checks pada setiap expansion/redirect, queue dan budget; profile passive hanya menggunakan sumber pasif. Jangan klaim pipeline hanya karena ada stepper.

### N06 — P1: catalog belum menjadi sumber keputusan installer tunggal

[toolManager.ts:284](D:/Projects/recon-app/electron/services/toolManager.ts:284) masih memetakan **WhatWeb ke pip whatweb**, meskipun manifest sudah menyebut Ruby/upstream yang benar. Tool baru Python tidak masuk dispatch pip yang hardcoded sehingga dapat masuk fallback release dengan repo kosong. Git branch update mengabaikan boolean failure, manual install return true.

Staging download sudah ada, tetapi aktivasi belum memiliki checksum/signature policy, pinning, lock pemakaian binary, rollback teruji atau provenance run. Satu manifest harus menentukan install/update/runtime/health/target/exit/parser compatibility. Uji jalur tombol update hingga hasil sebenarnya dengan fake downloader, bukan hanya memeriksa manifest.

### N07 — P1: boundary Electron dan data sensitif belum lengkap

[ipc.ts:21](D:/Projects/recon-app/electron/ipc.ts:21) belum memvalidasi trusted sender/frame atau schema runtime pada seluruh privileged handlers. Settings menerima arbitrary keys; pagination menerima limit/page tanpa batas. [main.ts](D:/Projects/recon-app/electron/main.ts) masih mengizinkan prefix `file://` untuk navigation. CSP memberi unsafe-inline script dan koneksi luas. Tidak dilakukan eksploitasi; ini temuan statis defense-in-depth. [Panduan Electron](https://www.electronjs.org/docs/latest/tutorial/security)

Settings save masih menelan error write dan mengembalikan sukses melalui cache; UI key baru memakai InputField text. Masking read tidak menggantikan perlindungan saat mengetik. Ciphertext belum versioned; decrypt gagal mengembalikan string input sebagai secret. Log scanner yang ditulis langsung lewat appendFileSync tidak melewati redaction logger. Severity report HTML masih diinterpolasi tanpa escape/enum validation.

Perbaikan: validasi request dan response, error persistence nyata, exact navigation policy, encrypted envelope, credential references dan data minimization; redaksi semua sink, termasuk raw artifact sesuai kebijakan retensi dan kebutuhan evidence.

### N08 — P1: AI policy/streaming/UI tidak sinkron

[aiService.ts:23](D:/Projects/recon-app/electron/services/aiService.ts:23) memeriksa provider dan host, tidak memeriksa model cloud. Mock fetch menunjukkan `example:cloud` tetap dikirim saat policy local-only; tidak ada network AI sungguhan. Loopback saja tidak membuktikan inference lokal; Ollama memiliki pengaturan disable-cloud. [Ollama FAQ](https://docs.ollama.com/faq)

Response JSON yang terpotong menjadi dua chunk hilang dan menghasilkan “No response generated”. TextDecoder stream memperbaiki UTF-8, bukan framing JSONL. Raw logs belum di-redact sebelum request. Settings tidak mengekspos aiBaseUrl/aiModel/aiPolicy, sehingga memilih cloud provider dari UI tetap berbenturan dengan default local-only. Analisis tidak dipersistkan ke `ai_analysis.txt` yang dicari report.

Perbaikan: policy eksplisit yang dapat dikonfigurasi, verifikasi deployment/model lokal, preview payload teredaksi, batas/cancel, carry-over JSONL, structured evidence references dan persistence analysis. Model pull otomatis harus mengikuti kebijakan jaringan dan ukuran download.

### N09 — P1: Acunetix membaik tetapi job remote belum dikelola aman

Hardcoded credential/container fallback telah dihapus dan TLS default aktif. Namun polling scan/report masih tanpa deadline end-to-end di runner; remote failed/aborted dapat dilanjutkan ke export lalu exit 0. Fetch findings yang gagal ditulis menjadi `[]`. Stop process lokal tidak membatalkan remote job; remote ID belum menjadi record durable. Heuristik local endpoint menggunakan substring, bukan hostname terparse.

Perbaikan: explicit remote/local mode, CA configuration, durable job ID, vendor API cancellation, exit sesuai remote status, pagination versi API, dan laporan partial saat collection gagal. Bukti runtime menunggu akses scanner berlisensi; fixture contract bisa dikerjakan sekarang.

### N10 — P1: data safety dan backup belum cukup

`storage.migrateOldData()` masih skip bila ada row history dan hanya mengimpor metadata/status, bukan findings. Migration ledger baru tidak memperbaiki migrasi legacy tersebut; fingerprint lama juga belum di-backfill.

[backup.ts](D:/Projects/recon-app/electron/services/db/backup.ts) menghapus backup dari daftar newest-first ketika quota terlampaui. Probe dua file membuktikan **backup terbaru terhapus, yang lama tersisa**. Validasi hanya header, belum integrity_check. Backup melalui IPC memakai online SQLite dengan benar, tetapi belum menyertakan artifact/evidence atau restore workflow; fallback copy DB tanpa WAL tidak aman untuk database aktif.

Tambahkan snapshot DB+artifacts manifest, oldest-first pruning dengan minimum recovery point, restore drill, migration backup, reconciliation count dan transaksi penghapusan yang melaporkan kegagalan disk.

### N11 — P2: skala dan observability belum mengikuti label enterprise

`useLogStore.ts` tetap menyambung rawLogs dan scannerLogs tanpa batas; allFindings terus bertambah. Parser membaca file sinkron dan DB berada di main process. History membaca semua row/status, bukan pagination. `insertObservation`, triage, baseline dan `logger.logOperation` belum mempunyai pemanggil produksi yang ditemukan di alur utama. Backup IPC ada, tetapi UI management belum tersedia.

Gunakan worker untuk parsing/DB berat, bounded ring buffer dan persistent log pagination, SQL aggregates, backpressure, struktur run/job metrics, storage quota dan cancellation. Benchmark 100.000 finding dan stream panjang harus mengukur p95, memory growth dan responsiveness; jumlah test bukan ukuran throughput.

## Review UI/UX dan fitur produk

Preview [dashboard 1366](D:/Projects/recon-app/docs/reviews/2026-10-16/evidence/dashboard-dark-1366.png) menunjukkan kontrol utama muat dan terminal tidak crash. Pertahankan identitas visual saat ini. Namun terminal idle mendominasi layar, label berukuran sangat kecil, terdapat beberapa pintu Tools Hub, bahasa Indonesia/Inggris bercampur, dan status sidebar “Operational” tidak berasal dari health check. Screenshot light menunjukkan teks cyan/abu pada background terang yang perlu pengukuran contrast; belum dilakukan audit WCAG lengkap.

Prioritas UX:

1. **Composer berbasis jenis target.** Web/domain/IP, source directory/repo, image, API schema dan cloud account punya input, capability dan auth masing-masing. Tool incompatible dinonaktifkan dengan alasan. Preview scope, risiko aktif/pasif, jumlah job dan budget sebelum run.
2. **Run detail sebagai pusat kerja.** Status backend, coverage, skipped/failed reasons, evidence dan activity timeline. Terminal sekunder yang bisa dibuka; jangan menampilkan posture aman ketika idle.
3. **Findings dan Assets dipisah.** Drawer evidence/remediation, confidence, CVE/CWE, saved filters, triage reason/expiry, baseline dan retest. Semua operasi harus reachable melalui UI dan IPC.
4. **History benar-benar dapat dibuka.** Saat ini re-scan hanya menyalin target. Tambahkan read-only historical detail dan clone konfigurasi asli dengan review perubahan versi. Error delete/export ditampilkan, bukan hanya console log.
5. **Settings sesuai backend.** AI endpoint/model/policy, network proxy/CA, runtime inventory, backup/restore, retention, diagnostics dan privacy. Input secret masked dengan replace/clear actions. Jangan minta pengguna mengedit JSON untuk fungsi utama.
6. **Aksesibilitas.** Export modal memakai clickable div, belum role dialog/focus trap/return focus yang jelas. Pakai radio/button semantik, Escape, accessible name, focus visible, reduced motion dan ukuran teks nyaman. Uji zoom 125/150% dan keyboard, bukan hanya screenshot.

## Rekonsiliasi R01–R22

| Temuan lama | Status review ulang |
|---|---|
| R01 Nuclei | Perbaikan inti terverifikasi fixture; malformed/partial harus tetap punya parse outcome. |
| R02 report | Parsial: unknown scan/HTML failed membaik; N01 masih terbukti. |
| R03 cancel | Parsial: DB mempertahankan STOPPED; JSON/UI/agregasi belum konsisten. |
| R04 lifecycle | Parsial: close/timeout/cleanup ada, finalizer dan persistence outcome belum lengkap. |
| R05 launch | Parsial: suffix/empty/await membaik; dedup/idempotency/STARTING guard tersisa. |
| R06 event race | Masih ada; catalog bukan solusi event race. |
| R07 IPC | Parsial: event stripped; sender/schema validation belum menyeluruh. |
| R08 URL/path | Parsial: external HTTP(S), popup deny dan ID regex membaik; navigation/CSP/ownership tersisa. |
| R09 secrets | Parsial: masking/session-only teruji; envelope/save error/input/redaction tersisa. |
| R10 local AI | Parsial: default lokal; policy model cloud dan Settings belum lengkap. |
| R11 Acunetix | Parsial: credential/TLS/remote Docker membaik; cancellation/status/collection tersisa. |
| R12 supply chain | Parsial: staging; provenance/pinning/lock/rollback belum terbukti. |
| R13 WhatWeb | Manifest diperbaiki, updater pip salah masih aktif. |
| R14 catalog | Parsial: backend daftar terpusat; installer/UI/profile masih drift. |
| R15 discovery | Severity info membaik; belum benar-benar masuk observations workflow. |
| R16 pipeline | Belum selesai: profile list dan stepper tidak menjalankan dataflow. |
| R17 durability | Migration ledger/index/recovery ada; legacy import/backup/baseline masih bermasalah. |
| R18 performance | Belum selesai: buffer tidak bounded, main sync, history full load. |
| R19 terminal | Crash lama tidak terulang pada preview; private `_core` dan compatibility masih utang teknis. |
| R20 AI evidence | Advisory/truncation ada; stream/persistence/redaction/evidence references tersisa. |
| R21 report semantics | Sorting/label weighted membaik; CVSS claim modal, grade, escaping dan SARIF tersisa. |
| R22 quality gates | Backend typecheck dan tests tersedia; warning, test isolation, CI/package evidence belum selesai. |

## Arsitektur enterprise yang disarankan

```text
Operator -> React renderer
                 | batas IPC: sender, schema, operation authorization
                 v
          Electron main / coordinator lokal
           | vault refs        | queue + durable run/job events
           v                   v
        OS vault          worker + adapter -> proses tool -> target scoped
                               |                 | output tidak tepercaya
                               v                 v
                         parser tervalidasi -> DB + evidence store
                               |
                    report / AI gateway (redaction + policy)
                               |
                    provider luar / file export: batas pelepasan data
Updater -> registry upstream -> staging/verifikasi -> runtime terpin
```

Diagram ini memisahkan alur sekarang dari rekomendasi worker/queue yang belum lengkap. Atribut bisnis yang harus teruji: hasil dapat dipercaya, pemulihan data, kerahasiaan evidence, operasi dapat diaudit, UI responsif dan eksekusi reproducible.

STRIDE pada boundary: spoofing/tampering renderer ditangani sender+schema; output tool tak tepercaya ditangani parser dan escaping; information disclosure ditangani vault/redaction/policy; denial of service ditangani quota/deadline/worker; repudiation ditangani event dengan actor dan provenance. Untuk AI, prompt injection adalah alasan menjaga output advisory dan tidak memberi hak eksekusi otomatis. Audit log lokal tidak tamper-proof terhadap admin host. Trade-off: worker, durable queue dan versioned schemas menambah kompleksitas, tetapi memberi recovery dan kontrol resource yang belum tersedia dari loop spawn sederhana.

Team mode dengan coordinator server, OIDC/SSO, RBAC, project isolation dan worker identity merupakan fase terpisah setelah kebutuhan multi-user ditetapkan. SQLite lokal jangan dibagi lewat network drive. Revisit desain ketika menambah remote worker, cloud credentials, multi-tenant access atau distribusi evidence lintas organisasi.

## Tool dan kemampuan tambahan

**Jangan menambah ulang SSLyze/Gitleaks/Semgrep/Trivy/Schemathesis.** Selesaikan kontrak dan UX lima tool tersebut. Perdalam ZAP authenticated context, session verification, API import dan automation plan; dukungan argumen saja belum menghasilkan workflow. [ZAP Automation Framework](https://www.zaproxy.org/docs/automate/automation-framework/)

Setelah itu, usulan tambahan yang belum tampak di catalog:

| Usulan | Nilai dan syarat |
|---|---|
| Prowler | Cloud posture untuk account yang diotorisasi; phase opsional setelah account scope dan credential isolation. Mulai import hasil bila runtime belum siap. [Upstream](https://github.com/prowler-cloud/prowler) |
| Syft | Inventory/SBOM terstruktur dari image/filesystem; prioritaskan bila dibutuhkan workflow inventory lintas waktu. Hindari menduplikasi capability SBOM Trivy tanpa kebutuhan jelas. [Upstream](https://github.com/anchore/syft) |
| Import SARIF/SBOM | Adapter import-only untuk hasil CI yang sudah ada, dengan schema validation, limits, provenance dan dedup. Lebih berguna daripada semua engine wajib terpasang di desktop. |
| Vulnerability/ticket connector | Pilih satu sistem yang dipakai organisasi, dengan preview, idempotency dan audit pengiriman. Jangan membuat banyak connector kosong. |

Urutan investasi: integritas hasil → target/runner/adapters → security/update/data recovery → workflow analyst/UX → coverage tambahan → release/team operations. Prompt implementasi lengkap tersedia pada [ANTIGRAVITY-PROMPT.md](D:/Projects/recon-app/docs/reviews/2026-10-16/ANTIGRAVITY-PROMPT.md).
