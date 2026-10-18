# Prompt pengembangan untuk Antigravity

Salin seluruh isi di bawah garis ini ke Antigravity, atau minta Antigravity membaca file ini dan menjalankannya sebagai instruksi pengembangan.

---

Anda bertindak sebagai principal engineer untuk mengembangkan **SecOps Recon App** di `D:\Projects\recon-app` menjadi platform security assessment desktop yang andal dan siap digunakan dalam lingkungan enterprise.

Saya menginginkan implementasi bertahap yang nyata: engine yang benar, hasil yang dapat dipercaya, workflow produktif, UI profesional, keamanan, pengujian, deployment, dan penambahan kemampuan yang belum tersedia. Kerjakan kode dan verifikasi, bukan hanya membuat rencana atau mempercantik dashboard.

## A. Konteks pekerjaan aktif dan aturan pelaksanaan

Anda mungkin sedang mengerjakan perbaikan pada repository yang sama. **Pertahankan pekerjaan tersebut.** Review eksternal dibuat ketika file sedang berubah dan menggunakan snapshot, sehingga jangan langsung menerapkan semua temuan sebagai bug terkini.

1. Baca instruksi repository, skill yang relevan, `package.json`, seluruh modul inti, dan `docs/reviews/2026-10-15/REVIEW.md` beserta evidence yang diperlukan.
2. Periksa working tree sebelum menulis. Jangan reset, clean, checkout paksa, atau menimpa perubahan lokal. Jika perlu isolasi, pastikan perubahan lokal yang menjadi basis pekerjaan tetap terbawa secara aman; jangan diam-diam bekerja dari HEAD lama.
3. Buat `docs/enterprise/reconciliation.md`: setiap R01–R22 diberi status **masih ada / sudah diperbaiki dan terverifikasi / berbeda pada versi sekarang / belum dapat diuji**, dengan bukti file/test. Nomor baris review dapat bergeser; cari simbol dan alur aktual.
4. Jangan mengulang perbaikan yang sudah selesai. Jadikan review sebagai daftar gap dan skenario regresi.
5. Pertahankan Electron + React + TypeScript + Vite, kecuali ada bukti kuat bahwa perubahan stack diperlukan. Refactor secara bertahap dengan migration path; jangan membuat implementasi kedua yang tidak digunakan UI.
6. Gunakan asumsi awal **Windows desktop, data lokal, single workstation, beberapa project/engagement**. Jadikan team/server mode tahap terpisah. Jangan menyebut aplikasi multiuser enterprise bila otorisasi hanya disimpan di renderer.
7. Kerjakan fase berurutan dengan acceptance gate. Setelah satu fase lolos, lanjut ke fase berikutnya tanpa meminta persetujuan untuk refactor rutin. Bila sesi terbatas, simpan checkpoint rinci dan next actions; jangan mengklaim semua fase selesai.
8. Tidak ada placeholder yang ditampilkan seolah berfungsi, fake telemetry, fake success, demo findings bercampur data nyata, atau test di-skip agar CI hijau.
9. Pengujian otomatis memakai fixture, fake process dan local test server/lab milik sendiri. Target nyata harus berada dalam scope yang diberikan pengguna. Jangan memindai domain yang kebetulan menjadi default aplikasi.
10. Jangan install/update semua scanner atau mengirim log ke provider cloud saat menjalankan test. Gunakan tool yang tersedia, fixture dan capability checks; catat keterbatasan environment secara tepat.

## B. Definisi enterprise grade untuk proyek ini

Produk harus memenuhi atribut berikut:

- **Trustworthy:** scanner error, parser error, incomplete coverage, dan clean result selalu dapat dibedakan.
- **Reproducible:** setiap run menyimpan scope, konfigurasi tersanitasi, versi executable/template/parser, waktu, exit reason, dan artifact yang dapat ditelusuri.
- **Recoverable:** cancel, app crash, network outage, restart, migration dan backup tidak merusak sejarah assessment.
- **Controlled:** scope, request budget, concurrency, credential access, dan update policy enforced di backend.
- **Operable:** health berarti capability nyata; error actionable; logging dan support bundle tidak membocorkan secret.
- **Productive:** analyst dapat menemukan asset, menilai finding, assign tindak lanjut, retest dan menyiapkan report tanpa membaca seluruh raw console.

Fase desktop tidak harus langsung mempunyai SaaS multi-tenant. Desain interface agar coordinator/remote worker dapat ditambahkan kemudian, tetapi jangan menyelesaikan masalah kecil dengan distributed system yang belum diperlukan.

## C. Fase 0 — baseline, integritas hasil, dan stabilitas

Rekonsiliasi dan perbaiki masalah berikut jika masih ada:

1. Nuclei `-je` versus parser JSONL. Pilih output contract yang eksplisit dan compatible dengan versi yang didukung. Tangani JSON array dan JSONL sesuai contract; malformed output harus menghasilkan diagnostic, bukan diam-diam dianggap hasil kosong.
2. Unknown scan ID harus not-found error. Report tidak boleh membuat fallback `COMPLETED` atau security grade A ketika tidak ada bukti scan berhasil. Scan gagal/partial harus tetap dapat diekspor dengan status dan coverage yang jelas.
3. Pastikan `CANCELLED`/`STOPPED` tidak tertimpa event exit belakangan. Bedakan application state dari exit code scanner.
4. Perbaiki import/runtime crash terminal, resize error, incompatible xterm/addon, dan penggunaan private `_core`. Gunakan API publik serta lifecycle yang benar; jangan sekadar menelan exception.
5. Sertakan Electron main, preload, services dan shared contracts pada typecheck. Aktifkan strict typing bertahap dengan error nyata diselesaikan, bukan pervasive `any`, cast, `@ts-ignore`, atau lint disable.
6. Tolak tool list kosong, duplikat, unknown ID dan payload salah. Cegah double-start selama VALIDATING/QUEUED/STARTING/RUNNING/CANCELLING. Gunakan UUID run/job dan idempotency key.
7. Await create metadata, handle persistence failure, dan pastikan start response konsisten dengan state tersimpan.
8. Pisahkan observation dari vulnerability; open port saja tidak otomatis medium/low vulnerability.

Gate fase 0:

- Fixture temuan Nuclei high tetap high beserta ID dan URL, termasuk pretty JSON array/JSONL sesuai dukungan.
- Missing/malformed output terlihat sebagai failure/partial, tidak menghasilkan klaim clean.
- Unknown scan gagal diekspor; failed scan kosong tidak mendapat penilaian aman.
- Cancel dengan late exit/error tetap cancel; double start tidak membuat dua job.
- Typecheck renderer, preload dan main lolos; lint sumber lolos; aplikasi dapat dibuka tanpa unhandled exception.

## D. Fase 1 — execution engine dan catalog yang konsisten

Bangun satu **tool catalog** sebagai source of truth untuk UI, health, installer, runner, parser dan documentation matrix.

Minimal manifest: ID, display name, category, capabilities, accepted target types, output types, runtime requirements, supported OS/architecture, tested tool version range, execution mode, license/source URL, install/update strategy, parser version, exit-code semantics, configurable limits, dan support status. Pisahkan `native`, `python-venv`, `ruby`, `docker`, `remote-api`, `import-only`; jangan mengasumsikan semua tool adalah `.exe`.

Adapter harus mendukung preflight, argument building, execution/cancellation, output parsing, normalization dan health diagnosis. Tambahkan fail-closed unknown-adapter behavior. Hindari object registry besar yang terus membesar; satu modul per adapter dengan contract test.

Job runner:

- Jalankan pekerjaan berat di worker/utility process terpisah dari Electron main. Main menjadi broker dengan API sempit.
- State machine yang eksplisit: `QUEUED`, `VALIDATING`, `RUNNING`, `PARSING`, `COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLING`, `CANCELLED`, `INTERRUPTED`, `SKIPPED`. Definisikan legal transitions dan aggregate run state.
- Tentukan kapan exit nonzero berarti finding found, failure, atau not-applicable berdasarkan versi tool; jangan menyamakan scan aborted dengan scan clean.
- Finalizer tunggal dan idempotent: tunggu `close`, drain stdout/stderr, flush log, parse artifact, persist, emit terminal event, bersihkan map/timer/listener.
- Global/per-target/per-tool concurrency, deadline total, inactivity timeout bila sesuai, batas file/log/output, retry hanya operasi yang aman/idempotent.
- Cooperative cancellation diikuti escalation terbatas. Windows process tree harus dibersihkan; container milik job memakai identitas tersendiri; scan API remote dibatalkan lewat API vendor. Jangan menghentikan proses/container yang bukan milik aplikasi.
- Sediakan snapshot state + event sequence/replay agar UI mount/reconnect dan fast-exit tidak kehilangan status.
- Crash recovery: run yang tertinggal bukan tetap RUNNING selamanya. Rekonsiliasi ownership; mark interrupted dan simpan evidence parsial. Jangan mengulang active scan otomatis tanpa kebijakan.
- Log persisten per job dengan rotation dan bounded buffer di renderer. Gunakan carry-over decoder untuk UTF-8/JSONL terpotong antar-chunk.

Scope dan pipeline:

- Target bertipe URL, domain, IP, CIDR, repo/directory, container image, API specification, dan cloud account sesuai capability. Fase awal boleh mengaktifkan subset, lainnya tampil unsupported.
- Project/engagement memiliki inclusion/exclusion, scan window, allowed modes, limits, owner dan catatan otorisasi.
- Workflow contoh: `Subfinder → DNSX → HTTPX → Katana → Nuclei/ZAP`; cabang network: asset yang disetujui → Naabu/Nmap. AlterX candidate harus diverifikasi; GAU adalah historical data yang perlu validation.
- Setiap edge melakukan normalization, dedup dan scope validation. Domain baru/redirect bukan otomatis berizin. Private network tetap bisa di-scan jika memang termasuk engagement; jangan hardcode block seluruh RFC1918 yang merusak internal assessment.
- Scope tidak cukup hanya memvalidasi input awal. Gunakan batas crawler/redirect tool; bila tool tidak mampu membatasi scope, nyatakan limitation dan terapkan containment/policy yang sesuai.
- Profile `Passive Discovery`, `Safe Web Assessment`, `Authenticated Web/API`, `Infrastructure`, `Custom`; label passive tidak boleh menjalankan active probing diam-diam.
- Auth profile mendukung headers/cookies/bearer, session verification dan ZAP context; credentials disimpan sebagai reference, bukan config plaintext.

Gate: fake executable dapat menghasilkan clean output, finding, stderr-only, malformed output, timeout, spawn error, late exit dan output besar; tidak ada orphan, duplicate finalization, lost event, atau data loss diam-diam. Pipeline test membuktikan output tahap sebelumnya benar-benar menjadi input berikutnya dan out-of-scope tidak dieksekusi.

## E. Fase 2 — keamanan aplikasi, data, dan software supply chain

Electron/IPC:

- Pertahankan context isolation dan nodeIntegration false; verifikasi sandbox/preload kompatibel.
- Validasi trusted sender/frame pada privileged IPC. Gunakan schema runtime dan shared contracts untuk requests, responses serta events; batas panjang, ukuran, enum dan pagination.
- Preload mengirim hanya data yang diperlukan ke renderer, tidak meneruskan objek event Electron.
- Default deny navigation/new windows; parse URL dan allowlist HTTP(S) untuk external browsing. `file://` report harus lewat dedicated artifact API yang memvalidasi ownership, bukan arbitrary openExternal.
- Validasi ID dan resolved path containment, termasuk symlink/junction yang relevan. Gunakan app-managed IDs untuk artifact.
- Pisahkan CSP development/production. Hapus script unsafe-inline produksi setelah memastikan app bekerja; network renderer dibatasi sesuai kebutuhan.
- Gunakan spawn/execFile dengan executable terverifikasi dan argv. Windows batch membutuhkan shell mediation tersendiri; jangan menganggap argument array otomatis aman ketika ada `cmd /c` atau `shell:true`. Lebih baik panggil interpreter langsung untuk script Python/Ruby dan runner teruji untuk kebutuhan batch.

Secrets/AI:

- Vault dengan encrypted format version dan credential reference. `getSettings` hanya metadata/masked values. UI dapat mengganti/menghapus secret tanpa membaca kembali nilai penuh.
- Secure storage tidak tersedia: fail closed atau sesi sementara yang jelas; jangan fallback silently ke plaintext. Migrasi plaintext lama dengan backup dan rollback yang aman.
- Secret fields masked; hindari argv bila tool mendukung credential file/stdin/env khusus. Jangan mewariskan seluruh environment bila hanya beberapa variable diperlukan.
- Redact log, exception, report, support bundle dan AI input. Evidence sensitif memiliki kebijakan retensi dan akses.
- Pisahkan `provider`, `baseUrl`, `model`, `credentialRef`, data policy dan timeout. Jangan memakai field API key sebagai string `url,model`.
- Local-only policy menolak model cloud/remote routing; jangan klaim “local” hanya dari localhost. Cloud harus dipilih secara eksplisit dengan tujuan data terlihat.
- AI hanya memberi saran yang merujuk finding/evidence ID, tidak mengubah severity final, menutup issue, atau menjalankan command secara otomatis. Output target diperlakukan sebagai data tidak tepercaya. Persist model/config/input evidence references dan analysis version.
- Tambahkan cancel/deadline, response limits, chunk decoder benar, truncation disclosure dan schema validation. Jangan kehilangan finding awal hanya karena memakai tail raw log.

Tool installer/updater:

- Manifest source/runtime harus sesuai upstream. Koreksi WhatWeb; jangan install paket homonim dari registry lain tanpa verifikasi identitas.
- Pin versi executable, container digest, templates/rules dan parser; simpan provenance dalam run manifest.
- Download ke staging directory, batasi ukuran/redirect, verifikasi checksum dan signature bila tersedia dengan trust root yang jelas, cek executable/version, lalu atomic activate. Checksum dari sumber yang sama bukan bukti independen terhadap compromise upstream; jangan berlebihan dalam klaim.
- Lock install/update per tool; jangan menimpa binary yang sedang dipakai run. Sediakan rollback dan post-update self-test.
- Python memakai venv aplikasi; Git tools memakai commit terpilih. Hindari global pip upgrade dan menyalin seluruh executable Python/Go ke bin aplikasi.
- Support OS/architecture eksplisit, enterprise proxy/CA, offline approved bundle dan version pin policy. Bedakan unavailable, untested, manual-install-required dan healthy.
- `Update All` mengembalikan hasil per tool dan partial failure; manual guidance bukan success install. Hilangkan tiga implementasi installer/updater yang saling divergen.

Acunetix/commercial:

- Hapus fallback credential dan container ID spesifik developer.
- Remote API harus bekerja tanpa Docker lokal. TLS verification aktif; custom CA trust configurable, insecure override tidak default dan harus jelas/auditable.
- Persist remote job ID, pagination sesuai API versi didukung, deadlines dan remote cancellation. Gagal fetch findings tidak boleh berubah menjadi `[]` yang dianggap clean.
- Hormati lisensi vendor; bila tidak ada akses runtime, sediakan import-only/unsupported dengan fixture dan limitation, bukan full-support claim.

Gate: invalid sender/payload/protocol/path ditolak; secret tidak muncul di settings read/log/export; vault unavailable tidak menulis plaintext; bad digest menolak update; update rollback bekerja; malicious output tidak mengeksekusi script dan tidak dianggap instruksi AI.

## F. Fase 3 — model data dan workflow assessment

Pisahkan minimal:

- `Project`, `Engagement`, `Target`, `Asset`, `Service`, `Endpoint`, `Observation`.
- `ScanRun`, `ToolJob`, `RunEvent`, `Artifact`, `Evidence`.
- `Finding` dan `FindingOccurrence`, `TriageDecision`, `Retest`, `Analysis`, `AuditEvent`.

Finding memiliki stable ID, fingerprint, scanner rule/template ID, title, normalized dan original severity, confidence, CVE/CWE bila tersedia, affected location/parameter, evidence references, remediation, first/last seen dan lifecycle. Fingerprint harus versioned dan mempertimbangkan target, location, rule, parameter dan konteks; jangan dedup dengan title saja atau menggabungkan dua kelemahan berbeda.

Discovery observation tidak dihitung sebagai vulnerability. Multiple scanner evidence dapat dikaitkan ke finding yang sama dengan provenance tetap utuh. Pertahankan raw artifact; normalized finding bukan pengganti original evidence.

Triage mendukung open/confirmed/false-positive/accepted-risk/fixed/reopened dengan alasan, actor, timestamp dan expiry pengecualian bila relevan. UI local actor bukan pengganti identitas enterprise yang diverifikasi.

Tambahkan baseline comparison `new/persistent/resolved/reopened`. Finding yang tidak muncul dalam run gagal/coverage lebih kecil **tidak otomatis resolved**. Retest menyimpan scope dan parameter yang dapat direproduksi.

SQLite:

- Schema migration versioned, transaction, backup sebelum perubahan, ledger dan idempotency; impor metadata dan findings historis dengan reconciliation count.
- Jangan skip seluruh migrasi hanya karena satu row sudah ada. Partial failure harus bisa diulang tanpa duplikasi.
- DB menjadi source of truth; metadata JSON merupakan export/snapshot yang dibuat konsisten.
- Index berdasarkan query nyata; pagination tervalidasi, bounded results; aggregate count di SQL untuk UI dan laporan.
- Atomic artifact writes, hash manifest, retention, disk-full handling, backup/restore untuk DB+WAL+artifact secara konsisten. Uji restore, bukan hanya tombol backup.

Gate: run yang sama menampilkan jumlah konsisten di DB, dashboard, findings, history dan export; migration repeat tidak duplikat; crash recovery dan backup restore mempertahankan evidence serta status.

## G. Fase 4 — UX profesional dan laporan

Pertahankan identitas cyber yang ada dengan visual hierarchy yang lebih tenang. Jangan menghabiskan fase ini hanya untuk glow/gradient.

Navigation: Overview, Projects/Engagements, Assets, Scan Runs, Findings, Reports, Tools & Integrations, Settings. Boleh digabung untuk skala awal, tetapi workflow harus jelas.

Scan composer: target/scope → profile → tool readiness → auth/budgets → review execution plan → run. Expert mode tetap ringkas. Target URL/scope harus terbaca utuh pada 1366×768. Jangan default ke domain organisasi nyata dan 21 tool aktif; gunakan target kosong dan profile konservatif.

Runs: stage progress, elapsed time, queue, requests bila benar-benar tersedia, errors, skipped jobs dan cancel. Jangan menampilkan progress percent palsu. Terminal adalah pane pendukung dengan virtualized/replay buffer, tidak memerlukan semua terminal mounted terus-menerus.

Findings: saved filters, server-side pagination, severity/confidence/status/scanner/CVE/CWE/asset, detail drawer evidence, remediation, triage, assignment lokal bila sesuai, baseline dan retest. Gunakan stable DB identity untuk row; filter/search harus mencari field yang dijanjikan placeholder.

History harus membuka detail read-only run lama, log/evidence dan report di aplikasi. Re-run mengkloning konfigurasi asal lalu menampilkan review perubahan versi; jangan hanya menyalin URL.

Tools Hub menjadi halaman yang menampilkan version, path, runtime, compatibility, license, provenance, health diagnosis, update job dan last checked. Closing UI tidak boleh kehilangan update status.

Terapkan reusable components untuk button/input/select/table/dialog/toast/empty/loading/error states. Ganti blocking `alert`. Dialog mendukung Escape, focus trap/return focus; input terhubung label; keyboard navigation, reduced motion dan contrast dicek pada semua tema. Gunakan semantik aksesibel; jangan mengandalkan warna saja. Tambahkan ErrorBoundary dan recovery action.

Laporan:

- HTML, Markdown, JSON dipertahankan; tambah PDF print layout dan SARIF ketika mapping semantik benar. Jangan menjanjikan format yang belum bekerja.
- Executive summary, scope, assessment window, tools+versions, coverage/limitations, job failures, normalized findings, evidence, remediation dan retest status.
- Jangan menyebut weighted finding count sebagai CVSS atau overall security posture. Jika ada priority score, jelaskan formula, input, confidence dan missing data; CVSS, EPSS dan KEV adalah sinyal terpisah, bukan satu nilai yang dibuat-buat.
- Dukungan template/branding dan Bahasa Indonesia/Inggris dapat dimulai dari report. Seluruh klaim UI harus sesuai output aktual.
- AI summary opsional, persisted, berlabel AI-assisted dan mempunyai referensi evidence.
- Semua data eksternal di-escape/validate sesuai output context. Export besar harus bounded/streamed, dapat dibatalkan, dan menampilkan error kepada pengguna.

Gate: alur membuat engagement hingga report dapat dijalankan dengan keyboard; four-theme check dan 1366×768/1400×900/1920×1080 lolos tanpa kontrol utama terpotong; historical results dapat dibuka; report incomplete tidak menyiratkan clean assessment.

## H. Fase 5 — penambahan tool yang memang belum ada

Sudah ada 24 adapter: Nuclei, Wapiti, WPScan, Subfinder, AlterX, DNSX, Naabu, TLSX, HTTPX, Nmap, ZAP, Katana, FFUF, Dalfox, Wafw00f, WhatWeb, Arjun, Corsy, CMSeeK, GAU, CRLFsuite, AppScan, Netsparker/Invicti, Acunetix. Periksa daftar terbaru; jangan menambahkan ulang atau menghitung kategori `pdiscovery` sebagai scanner.

Urutan implementasi:

1. **Perdalam ZAP yang sudah ada:** Automation Framework, authenticated context/session verification, OpenAPI import, bounded scan plan dan report parser multi-site/multi-instance.
2. **SSLyze:** certificate/TLS audit, structured output dan policy findings; TLSX tetap untuk discovery.
3. **Gitleaks:** repo/directory target, secret redaction, history mode terkontrol dan suppression yang auditable.
4. **Semgrep:** repo target, ruleset provenance, structured findings dan source location; bedakan kemampuan engine/rules gratis dan berlisensi.
5. **Trivy:** image/filesystem, package vulnerabilities, IaC misconfiguration dan SBOM; hindari overlap noise dengan secret scanner.
6. **Schemathesis:** OpenAPI/GraphQL sesuai kemampuan versi yang diverifikasi, batas method/request/state-changing operation; klasifikasikan schema/property failure sebagai API quality issue sampai ada bukti security impact.
7. **Prowler opsional setelah scope cloud dibutuhkan:** least-privilege credentials, account scope dan credential isolation. Tidak menjadi bagian default web assessment.

Untuk setiap tool wajib ada:

- Dokumentasi upstream resmi, runtime/OS support, license review note dan distribusi terverifikasi.
- Manifest, preflight, install/manual/import-only path yang jujur, help/version checks.
- Dry-run argument preview yang meredaksi secret; tidak ada arbitrary freeform shell input.
- Contract parser dengan fixture valid/empty/malformed/version variation, bounded output dan raw evidence retention.
- Cancellation/timeout/exit-code handling dan local sandbox smoke test jika binary tersedia.
- Contoh workflow, asset/finding normalization, UI capability state dan report mapping.
- Tidak diberi badge “Verified” sebelum versi executable dan parser diuji bersama. Jika hanya fixture yang diuji, sebutkan fixture-tested.

Sumber awal: dokumentasi resmi Nuclei, ZAP, SSLyze, Gitleaks, Semgrep, Trivy, Schemathesis dan Prowler yang ditautkan dalam review. Verifikasi ulang saat implementasi, jangan memakai tutorial acak untuk menentukan command flags atau package identity.

## I. Fase 6 — operasi enterprise dan jalur team mode

Untuk desktop release:

- Windows clean-machine install smoke test, native module ABI, resource path `app.isPackaged`, path dengan spasi, Unicode username dan non-admin account.
- Version tunggal dari package metadata; README/runbook akurat; `build` dan `dist` dijelaskan berbeda.
- Pipeline lint/typecheck/unit+integration/renderer+Electron smoke/build/package. Simpan artifact dan test report tanpa secret.
- Dependency inventory/SBOM, reproducible lockfile, signing integration dan release provenance. Signing key/certificate harus berasal dari operator; unsigned local build diberi label, tidak dipalsukan sebagai signed.
- Signed update feed bila app auto-update diimplementasikan, rollback, staged rollout, offline bundle dan pinned tool catalog.
- Structured operational log: runId/jobId/toolVersion/errorCode/duration; rotation, redaction, opt-in diagnostics. Support bundle membatasi data sesuai consent/policy.
- Backup/restore runbook, storage quota/retention, migration rollback, proxy/CA troubleshooting dan license notices.

Connector berikutnya: import/export findings ke vulnerability management/ticketing yang dipilih pengguna, dengan dry-run preview, credential scope minimal, idempotency, retry/backoff dan audit trail. Jangan otomatis mengirim data organisasi ke layanan eksternal.

Untuk team mode, buat ADR tersendiri sebelum implementasi: coordinator API, server-side RBAC, OIDC/SSO, project isolation, worker registration/identity, central audit, server DB/object storage, leases dan job ownership. Local SQLite bukan shared network database. Audit lokal/hash tidak boleh disebut tamper-proof terhadap administrator host. Aktifkan fase server setelah requirement deployment dan identity jelas; desktop enterprise hardening tetap diselesaikan lebih dahulu.

## J. Pengujian dan ukuran keberhasilan

Tambahkan tests yang memeriksa perilaku nyata, bukan snapshot/copy implementasi saja:

- Parser round-trip/fixtures seluruh adapter; salah format/version harus actionable.
- Synthetic malicious scanner text/URL/path untuk memastikan input tidak menjadi command, navigation berbahaya, HTML aktif atau instruksi AI.
- Job lifecycle: fast exit sebelum UI subscribe, spawn failure, deadline, cancel race, app restart, remote cancel failure dan partial results.
- Migration dataset lama, repeated migration, disk-full/write-failure dan restore consistency.
- Cross-scan isolation, duplicated events, dedup fingerprint collision cases, different endpoint/parameter tetap terpisah.
- Local-only AI policy, redaction dan provider stream chunk boundary.
- Renderer/Electron end-to-end menggunakan fixture backend dan local lab; screenshot sebagai tambahan, bukan satu-satunya verifikasi.

Budget performa berikut adalah **target awal yang harus diukur**, bukan klaim hasil saat ini: dataset sintetis 100.000 findings, pagination 50–100 item, p95 query/filter di bawah 500 ms pada mesin benchmark yang dicatat; UI tetap responsif selama log stream; renderer buffer memiliki batas eksplisit dan tidak tumbuh mengikuti seluruh durasi scan. Catat hardware, dataset, mode build, pengukuran, dan trade-off bila target direvisi. Jangan memakai benchmark kecil untuk mengklaim skala enterprise.

## K. Deliverable dan definisi selesai

Sediakan:

1. `docs/enterprise/reconciliation.md` untuk review vs kode terbaru.
2. ADR arsitektur, trust-boundary diagram, schema/contract, migration dan tool support matrix.
3. Implementasi yang benar-benar terhubung ke UI/workflow, bukan service yang tidak pernah dipanggil.
4. Regression tests, fixture, hasil benchmark dan packaged smoke evidence.
5. Runbook install/update/backup/restore/proxy/offline, changelog dan known limitations.
6. Ringkasan per fase: masalah yang diselesaikan, file utama, cara verifikasi, hasil, risiko tersisa dan next step.

Mulai dari rekonsiliasi dan Fase 0 sekarang. Prioritaskan perbaikan yang membuat hasil assessment dapat dipercaya, kemudian execution/data/security, UX, dan coverage tambahan. Jangan mengklaim “enterprise-ready” sebelum gate terkait memiliki bukti; jika scanner komersial atau certificate tidak tersedia, laporkan batasnya secara spesifik sambil menyelesaikan pekerjaan lain yang tidak tergantung padanya.
