# Prompt pengembangan lanjutan untuk Antigravity

Anda melanjutkan pengembangan `D:\Projects\recon-app` menuju workstation assessment keamanan enterprise. Pelajari kode terbaru, instruksi repository dan `D:\Projects\recon-app\docs\reviews\2026-10-16\REVIEW.md` beserta evidence terlebih dahulu. Review 15 Oktober hanya referensi historis. Pertahankan semua perubahan yang sudah benar dan pekerjaan lokal pengguna. Jangan rewrite framework atau mengulang fitur yang sudah tersedia.

Tujuan: hasil assessment dapat dipercaya; tool benar-benar berfungsi dengan jenis target yang sesuai; workflow analyst lengkap; data sensitif terlindungi; job dapat dibatalkan/dipulihkan; UI nyaman; distribusi aplikasi dapat diuji. Jangan menyimpulkan enterprise-ready dari jumlah adapter, keberadaan helper, screenshot, atau suite test saja.

Baseline review 16 Oktober: 29 adapter, backend sudah masuk typecheck, 96 test lulus, lint 0 error/50 warning, renderer preview tiga ukuran dan empat tema tanpa page error. SSLyze, Gitleaks, Semgrep, Trivy dan Schemathesis sudah ada. Namun probe tambahan membuktikan bug yang tidak dicakup tes. Mulai dengan mereproduksi lalu memperbaiki, bukan mengubah acceptance criteria agar cocok dengan bug.

## Aturan pelaksanaan dan definisi selesai

- Buat rekonsiliasi terbaru dengan status `verified`, `partial`, `not wired`, `not verified` dan `deferred`, berikut bukti perilaku serta batasnya. Koreksi penutupan R06/R16/R18 yang tidak menjawab masalah asli. Jangan otomatis menyalin semua status menjadi verified.
- Kerjakan per fase dengan perubahan yang dapat direview, migration aman, test relevan dan ringkasan hasil. Jika selesai satu fase, lanjutkan fase independen berikutnya. Laporkan hambatan khusus, misalnya tidak ada scanner komersial atau signing certificate, tanpa mengarang keberhasilan.
- Semua test memakai temporary application data root yang diinjeksi **sebelum singleton diimpor**. Jangan menyentuh Documents/SecOpsScans pengguna. Ada test `clearAllScans()` dan settings save; `npm test` harus aman secara default. Terapkan guard fail-closed bila test data root tidak sementara.
- Pengujian scanner menggunakan fixture/fake executable/local lab yang diotorisasi. Jangan scan target organisasi default, install global package, mengirim evidence ke provider luar atau menjalankan arbitrary shell command sebagai efek samping test.
- Modul selesai hanya bila reachable melalui UI/API yang sesuai, memiliki persistence, error/empty/loading states, dan test dari entry point yang digunakan pengguna. Helper yang tidak dipanggil tidak dihitung sebagai feature complete.
- Pakai dependency dan command upstream versi yang dipin. Setiap dukungan tool mencantumkan OS/runtime/license, versi executable/parser dan level verifikasi: configured, fixture-tested, local-smoke-tested atau runtime-verified.

## Fase A — integritas hasil dan regresi penghalang rilis

1. Buat assessment verdict terpusat untuk execution, collection, parsing, persistence dan coverage. `IDLE`, `RUNNING`, `PARTIAL`, `INTERRUPTED`, `STOPPED`, `CANCELLED`, unknown dan parse failure tidak boleh menghasilkan label Secure/A/A+. Bahkan completed dengan zero findings hanya berarti tidak ditemukan pada coverage yang diuji, bukan bukti aman menyeluruh.
2. Gunakan verdict yang sama di dashboard, detail run, HTML, Markdown, JSON, IPC stats dan SARIF. Teruskan status/coverage secara wajib; jangan optional parameter yang dapat terlupa. SARIF invocation tidak boleh successful untuk stopped/partial/interrupted. Samakan metrik; weighted count bukan CVSS. Hapus klaim CVSS distribution jika tidak ada data CVSS yang benar.
3. Parse/persist failure harus memengaruhi outcome. Missing output, invalid schema, malformed sebagian dan valid-empty berbeda. Pertahankan raw artifacts serta diagnostic count; jangan `catch => [] => COMPLETED`. Jangan broadcast hasil sebagai tersimpan ketika transaksi DB gagal. Escape dan validasi seluruh field eksternal, termasuk severity di report HTML.
4. Perbaiki baseline: hanya menentukan resolved ketika run selesai valid, target/engagement cocok, coverage tool/rule/scope/auth comparable. Partial/running/target berbeda harus unknown/not observed. Gunakan keputusan triage efektif terbaru beserta expiry; jangan “pernah fixed” berarti reopened selamanya.
5. Perbaiki fingerprint dengan model lokasi bertipe. Hostname boleh dinormalisasi lowercase; path yang case-sensitive tidak. Simpan source file/region/rule, package identity/version/asset dan web endpoint/parameter. Pisahkan stable finding identity dari occurrence. Migrasikan versi fingerprint dan backfill historical rows secara aman.

Gate: regression tests membuktikan PARTIAL/RUNNING/INTERRUPTED tidak diberi A, baseline tidak meresolve temuan yang belum diverifikasi, `/Admin` dan `/admin` tidak salah digabung, dua occurrence source berbeda tetap dapat dilacak, semua report/UI konsisten, malformed output dan DB failure tidak terlihat sebagai clean success.

## Fase B — engine dan target yang benar-benar dapat digunakan

1. Ganti parameter URL tunggal dengan discriminated union target: URL/domain/IP/CIDR, local directory/repository, container image, API schema + base URL, dan cloud account bila diaktifkan. Sediakan picker/validation UI dan validasi ulang backend. Jangan memaksa directory menjadi `https://...`.
2. Terapkan `acceptedTargetTypes`, OS/runtime dan readiness dari catalog sebelum spawn. Tool incompatible diberi alasan dan tidak dieksekusi. Dedup daftar tool, reject unknown/config invalid, idempotency start, admission lock dan UI STARTING/STOPPING guard.
3. Bentuk durable ScanRun/ToolJob dengan state machine tunggal. Finalizer idempotent menangani spawn error, close, timeout, cancel, parse dan persist failure. Await flush/persist sebelum terminal event. Cleanup setelah cancellation reason disimpan. DB, metadata JSON dan renderer harus membaca status yang sama.
4. Simpan event sequence dan snapshot. UI dapat subscribe sebelum start, replay event, reattach setelah reload dan menangani fast-exit tanpa status tertinggal. Jangan merekonstruksi status terpisah dari seluruh tool IDLE di renderer.
5. Tambahkan queue, global/per-target/tool concurrency, deadline, bounded output dan cancellation escalation. Windows taskkill harus menjaga ownership dan status reason; remote job dibatalkan lewat API dan hasil cancel dipersistkan. Jangan mengandalkan `ChildProcess.killed` untuk taskkill eksternal.
6. Bangun dataflow nyata: Subfinder -> DNSX -> HTTPX -> Katana -> assessment sesuai capability. Normalisasi, dedup, scope inclusion/exclusion dan provenance di setiap edge. Batasi redirect/crawler dan jelaskan limitation tool. Internal IP tetap sah jika engagement mengizinkannya.
7. Satukan profile UI/backend. Passive profile tidak menjalankan TLSX atau active probing. Profile authenticated wajib punya auth/session validation, bukan hanya nama. Pipeline stepper menampilkan dependency/job progress nyata.
8. Pindahkan parsing/DB berat dari main thread; stream artifacts, batasi ring buffer, pakai SQL aggregate dan pagination backend. Simpan stdout/stderr dengan batas/rotation dan redaksi yang sesuai. Tombol delete/clear tidak boleh merusak run aktif.

Gate: fake process tests untuk fast exit, error+close, zero/malformed/missing output, timeout, cancel race, restart, duplicated event dan disk/DB failure. Fixture pipeline membuktikan input tahap berikut berasal dari output sebelumnya dan out-of-scope tidak dieksekusi. Uji STOPPED konsisten di DB/JSON/UI serta partial aggregate tidak berubah menjadi COMPLETED.

## Fase C — selesaikan kontrak 29 adapter dan tool management

Prioritaskan lima adapter baru sebelum menambah engine:

- **Semgrep:** tolak URL sebagai source target. Jangan scan folder output sebagai pengganti source code. Exit 2 failure sesuai upstream. Notice incompatibility adalah validation message, bukan finding. Ruleset lokal/pinned dan telemetry policy harus eksplisit; `--config auto` dapat mengambil rule lewat jaringan.
- **SSLyze:** sesuaikan dengan JSON versi terpilih, termasuk `scan_result`, wrapper `result`, status/error tiap command, port dan SNI. Fixture current upstream dengan positive TLS issue harus menghasilkan finding yang benar. Jangan menganggap semua nilai ROBOT selain NOT_VULNERABLE sebagai bukti rentan; tangani enum inconclusive/error.
- **Schemathesis:** verifikasi CLI version, pisahkan report format/path, gunakan schema output asli. UI menyediakan schema, base URL, auth, method policy, budget dan max runtime. Default conservative; state-changing requests hanya bila profile mengizinkan. Kegagalan schema/5xx adalah quality/availability observation sampai ada dasar klasifikasi security yang lebih kuat.
- **Gitleaks:** bedakan directory scan dan git history secara eksplisit, repository scope/commit, redaction dan suppression audit. Jangan menganggap semua path yang ada sebagai mode directory bila operator memilih history.
- **Trivy:** pilih filesystem/image/repo/SBOM mode, pertahankan affected asset, package, installed/fixed version, advisory sebagai reference, dan vulnerability database provenance. Jangan pakai advisory URL sebagai satu-satunya affected location.
- **ZAP:** hubungkan Automation Framework, OpenAPI, authenticated context dan session verification ke composer/UI; validasi plan dan report path. Parser multi-site yang sudah ada dipertahankan.
- **Acunetix:** mode local/remote eksplisit, parse hostname, custom CA, durable remote IDs, overall deadlines, cancellation endpoint dan status remote sebenarnya. Fetch error bukan empty findings. Jangan mengklaim integration verified tanpa akses vendor runtime.

Refactor installer/updater menjadi dispatcher `installStrategy` yang sama dengan catalog. Hapus mapping pip WhatWeb yang masih aktif; runtime Ruby dan source upstream harus konsisten pada semua jalur. Tambahkan dispatch pip untuk tool baru tanpa fallback repo kosong. Manual action bukan success update; git failure harus diteruskan. Health membedakan present, executable, version-compatible, parser-tested dan manual-required.

Installer menggunakan isolated runtime/venv, verified release sources, pin versions, digest/signature policy, bounded download, staging, activation lock, self-test dan rollback. Simpan binary/ruleset provenance per run. Hindari global pip upgrades dan shell freeform; invocation interpreter/argv harus diuji khusus Windows path spasi/Unicode.

Gate: manifest/installer/UI/runner parity, fake downloader failure dan bad digest, rollback, manual-state, updater WhatWeb memakai upstream yang benar. Fixture parsers seluruh adapter + smoke lokal versi yang tersedia. Test tidak cukup hanya menegaskan args yang sama dengan implementasi; bandingkan dengan help/schema upstream terpin.

## Fase D — keamanan, AI dan ketahanan data

IPC: trusted sender/frame checks dan schemas untuk seluruh privileged methods, bounds string/list/pagination, enum status/format/tool, ID ownership dan path containment. Preload tetap data-only. Navigation default-deny ke dokumen aplikasi tepat; kebijakan dev/prod terpisah dan CSP produksi diketatkan. Uji malformed sender/payload serta batch invocation Windows tanpa mengeksekusi payload berbahaya.

Secrets: encrypted envelope versioned, fail-closed/session-only yang terlihat pengguna, replace/clear credentials tanpa membaca ulang secret, input password dan error save nyata. Cache tidak boleh membuat disk-write failure terlihat sukses. Redact operational logs, raw scanner streams yang ditampilkan/dikirim, support bundle, report dan AI payload sesuai kebutuhan evidence. Tangani ciphertext rusak sebagai error, bukan credential plaintext.

AI: Settings harus mengekspos provider/base URL/model/policy. Local-only perlu memastikan inference lokal dan menolak cloud routing/model serta redirects yang melanggar policy; host loopback tidak cukup. Tampilkan data destination dan payload preview teredaksi. Jangan diam-diam pull model besar atau memakai cloud. Implement JSONL carry-over buffer, UTF-8 decoder, total deadline/cancel, response limit dan structured output yang menunjuk evidence IDs. Persist analysis/model/version/input references untuk report; analisis advisory tidak menjalankan command, menutup issue atau mengubah severity otomatis.

Data: perbaiki migrasi legacy per item dengan ledger/count dan import findings; jangan skip karena satu row ada. Backup sebelum migrasi, consistent online DB + evidence manifest/hash, restore drill dan integrity_check. Retention menghapus expired/oldest-first, menjaga minimum recovery point; validasi quota. Jangan mengandalkan copy DB tanpa WAL saat database aktif. Delete operation harus melaporkan artifact deletion failure dan menjaga audit/triage consistency.

Gate: unit + entry-point tests untuk secrets masked/session-only/write failure, cloud model ditolak local-only, response JSON terbelah antar-chunk tetap terbaca, restore DB+artifact utuh, backup terbaru tidak terhapus lebih dulu, legacy partial import bisa diulang tanpa duplikasi.

## Fase E — UI/UX dan workflow analyst

Pertahankan visual cyber yang sudah stabil. Fokus pada workflow, keterbacaan dan informasi yang benar.

1. Navigation: Overview, Projects/Engagements, Assets, Runs, Findings, Reports, Tools & Integrations, Settings. Boleh menggabungkan halaman untuk skala awal, tetapi semua workflow harus reachable.
2. Composer: jenis target -> engagement scope -> profile -> compatible/ready tools -> auth + budget -> execution preview. Expert mode ringkas. Target kosong aman, jangan preset domain organisasi nyata.
3. Overview idle menampilkan onboarding/last activity/readiness. Run detail menampilkan status/coverage/failure evidence dan elapsed time nyata. Console pane sekunder; jangan terminal kosong mendominasi default atau label operational statis.
4. Pisahkan Asset/Observation dari vulnerability Findings secara nyata pada ingestion, DB, count, table dan report. Open port/technology/subdomain bukan otomatis vulnerability.
5. Findings: detail drawer, evidence/remediation/CVE/CWE/confidence, saved filters, pagination, stable IDs, triage reason/actor/expiry, assignment yang sesuai desktop, baseline dan retest. Project tables tanpa relasi run dan UI belum dianggap selesai.
6. History membuka detail read-only lengkap. Clone/retest membawa konfigurasi, scope, rule/tool version dan auth reference asal kemudian review perubahan. Jangan hanya copy URL.
7. Tools Hub menunjukkan versi/path/runtime/provenance/support level, diagnosis dan progress job yang tetap tersimpan ketika modal ditutup. Kurangi tombol masuk duplikat. Settings dibagi ke AI/privacy, runtimes, network/proxy/CA, storage/backup, diagnostics.
8. Buat reusable dialog/form/toast. Gunakan radio/button semantik untuk export options, label input, accessible names, focus trap/return, Escape dan keyboard navigation. Tampilkan export/save/delete error di UI. Perjelas HTML print-to-PDF vs file PDF native.
9. Konsisten bahasa Indonesia/Inggris melalui locale, typography nyaman, contrast terukur pada empat tema, reduced motion dan zoom 125/150%. Hindari microtext berlebihan. Hilangkan ketergantungan private xterm `_core` melalui versi core/addon kompatibel dan lifecycle publik yang diuji.

Gate: user dapat membuat engagement, menjalankan fixture assessment, melihat assets/findings, triage, retest, membuka history dan export hanya dengan UI/keyboard. Screenshot 1366×768/1400×900/1920×1080 dan semua tema, plus interaction assertions; screenshot sendiri bukan bukti accessibility maupun engine.

## Fase F — kemampuan tambahan setelah fondasi stabil

Tidak perlu menambah scanner yang sudah ada. Prioritas tambahan:

- Import SARIF/SBOM dari CI dengan schema validation, size limits, provenance dan idempotent import.
- Prowler untuk cloud posture bila cloud account scope dibutuhkan; sediakan least-privilege credential profile, resource/account boundary dan import-only sebagai tahap awal. Tidak dimasukkan ke web profile.
- Syft untuk inventory/SBOM bila kebutuhan inventory lintas waktu belum dipenuhi mode Trivy; implementasi harus menghasilkan artifact dan asset/package data yang bisa digunakan, bukan hanya tombol baru.
- Satu connector vulnerability management/ticketing yang benar-benar dibutuhkan organisasi, dengan preview sebelum pengiriman, retry/idempotency, credential scope minimal dan audit trail. Jangan mengirim data otomatis tanpa konfigurasi eksplisit.

Setiap penambahan wajib memenuhi target types, install/runtime provenance, contract parser fixtures, local smoke bila tersedia, timeout/cancel, UI workflow, data mapping dan report acceptance. Prioritaskan kedalaman integrasi dibanding jumlah nama tool.

## Fase G — release dan operasi enterprise

Tambahkan CI lint/typecheck/tests/parser fixtures/renderer+Electron smoke/build/package. Aktifkan strict backend bertahap dengan boundary lebih dahulu; jangan menurunkan rule agar build hijau. Singkirkan warning relevan dengan perbaikan nyata.

Satu versi aplikasi dari package metadata; saat ini package 0.0.0, sidebar v1.1 dan SARIF 2.0.0 tidak konsisten. Gunakan identity/provenance nyata, bukan URL organisasi contoh. Uji packaged Windows non-admin, path spasi/Unicode, native ABI, resource path, clean install, upgrade dan rollback. Siapkan signing integration, SBOM, offline approved bundle, proxy/CA dan runbook recovery. Certificate harus berasal dari operator; unsigned build diberi label jujur.

Hubungkan structured operational logging ke lifecycle produksi, bukan hanya dipanggil test. Catat run/job/toolVersion/errorCode/duration dengan redaction, rotation dan diagnostics opt-in. Ukur workload 100.000 findings, pagination 50–100, target awal p95 query <500 ms pada hardware tercatat, bounded memory pada log stream panjang dan UI tetap responsif. Angka ini target pengembangan, bukan klaim hasil saat ini.

Team mode memerlukan ADR terpisah: coordinator API, OIDC/SSO, RBAC server-side, project isolation, worker identity/leases, DB server dan object storage. Jangan memaksakan local SQLite menjadi shared multi-user database. Selesaikan desktop enterprise hardening terlebih dahulu; tambahkan server saat requirement deployment jelas.

Deliverable akhir: rekonsiliasi yang akurat, implementasi per fase yang benar-benar terhubung, regression tests, tool support/version matrix, schema/migration docs, threat-boundary diagram, benchmark, packaged smoke evidence, runbook dan known limitations. Mulai Fase A sekarang, kemudian lanjut secara berurutan dengan bukti gate dan perubahan yang dapat direview.

## Sumber teknis untuk verifikasi implementasi

Gunakan versi upstream yang dipin; sumber berikut diperiksa saat review, bukan pengganti validasi versi runtime:

- [Semgrep CLI dan exit codes](https://docs.semgrep.dev/cli-reference)
- [SSLyze JSON model](https://github.com/nabla-c0d3/sslyze/blob/release/sslyze/json/json_output.py)
- [Schemathesis CLI](https://schemathesis.readthedocs.io/en/stable/reference/cli/)
- [Ollama local-only configuration](https://docs.ollama.com/faq)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [ZAP Automation Framework](https://www.zaproxy.org/docs/automate/automation-framework/)
- [Prowler](https://github.com/prowler-cloud/prowler)
- [Syft](https://github.com/anchore/syft)
