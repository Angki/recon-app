# Prompt pengembangan Recon App untuk Antigravity

Anda bekerja pada `D:\Projects\recon-app`. Kembangkan aplikasi ini menjadi workbench security assessment yang andal untuk penggunaan profesional: hasil dapat dipercaya, pengujian dapat direproduksi, tool mudah dikelola, dan UI membantu analis mengambil keputusan. Implementasikan perubahan nyata secara bertahap; jangan berhenti pada rencana atau mock UI.

## Konteks wajib

Baca instruksi repository, `docs/reviews/2026-10-18/REVIEW.md`, review 15–17 Oktober, `docs/enterprise/QA-2026-10-18.md`, dokumentasi instalasi/active testing, serta spec dan plan AI di `docs/superpowers` bertanggal 18 Oktober. Review 18 Oktober dilakukan ketika source sedang berubah: HEAD beralih dari `d6edf35` ke `49d2f8e`. **Periksa ulang setiap temuan terhadap kode saat ini.** Simpan perubahan pengguna, jangan reset/overwrite pekerjaan berjalan, jangan mengulang integrasi yang sudah tersedia. Gunakan fungsi/nama file sebagai acuan karena nomor baris dapat bergeser.

SQLmap, Commix, Nikto, Dalfox dan sejumlah tool recon/DAST/source sudah ada. Installer source pinned, Nikto digest, endpoint/retest, model discovery, structured AI context dan empat preset AI juga sudah tersedia pada checkpoint review. Perluas dan konsolidasikan implementasi ini. Tujuan enterprise tidak berarti langsung menambahkan server multi-tenant atau microservices; stabilkan aplikasi desktop terlebih dahulu.

Di awal, catat commit, dirty files, versi runtime/tool dan hasil baseline tests/typecheck/lint. Buat matriks `sudah diperbaiki / terkonfirmasi tersisa / fitur baru / belum diverifikasi`. Temuan review yang sudah terselesaikan diberi bukti lalu ditutup, bukan diimplementasikan ulang. Lanjutkan per fase berikut dengan perubahan kecil yang dapat ditinjau. Jika dependency eksternal menghalangi, lanjutkan bagian independen dan catat batasannya secara spesifik.

## Fase 0 — Baseline yang dapat dipercaya

- Selesaikan inkonsistensi implementasi AI yang sedang berjalan terhadap spec yang sudah ada.
- Review terakhir mendapat 4/4 tes AI lulus, tetapi scoped lint gagal pada error cause dan penggunaan require. Suite awal 108/110 bukan status suite terbaru: dua kegagalan saat itu sudah usang setelah metode ditambahkan.
- Jalankan seluruh suite dengan home/DB terisolasi, typecheck dan lint. Unit test harus mock jaringan/provider; tes yang hanya memeriksa bentuk return bukan bukti koneksi/inferensi berhasil.
- Jangan menghapus tes, melemahkan assertion, atau mematikan lint untuk memperoleh hasil hijau.

**Acceptance:** hasil aktual tercatat beserta commit/checkpoint dan perintah; tidak ada mutasi database/history pengguna; kegagalan baseline dibedakan dari regresi baru; tidak mengklaim build terbaru lolos berdasarkan EXE lama.

## Fase 1 — Hasil scan, persistence dan recovery

1. Buat kontrak assessment bersama untuk UI/statistik/HTML/Markdown/JSON: status run, tool diminta/dijalankan/berhasil, kelengkapan output, hasil parsing, persistence, coverage dan severity temuan. Pisahkan `no findings in completed coverage` dari `not assessed`, `partial`, `failed`, `interrupted`.
2. Hilangkan A+/Secure/grade aman pada scan kosong yang belum lengkap. Jangan menyimpulkan target aman hanya karena nol temuan. Semua export harus memakai perhitungan yang sama dan menampilkan limitation.
3. Satukan lifecycle runner dengan finalisasi idempotent; tunggu persistence sebelum success event. Bedakan missing output, malformed output, valid empty result dan unsupported format. Batasi ukuran output. Tangani error+close, timeout, cancel, app crash dan restart tanpa status sukses palsu.
4. Lengkapi state-machine untuk semua kombinasi terminal/nonterminal. Nol tool bukan assessment sukses. Sinkronkan SQLite, metadata dan event; cegah penghapusan run aktif atau lakukan cancellation terkoordinasi sebelum delete.
5. Baseline harus comparable: project, target canonical, scope, tipe test, coverage dan versi parser/rule relevan. Temuan hilang dalam run tidak lengkap menjadi `not reassessed`, bukan resolved. Terapkan triage efektif terbaru dan pisahkan keputusan manual dari bukti retest.
6. Fingerprint berversi dengan lokasi bertipe: URL/path case-sensitive, parameter identity, source file+line/rule, package/version. Jangan simpan token/query secret dalam fingerprint. Buat migrasi yang mempertahankan history/triage dan melaporkan collision.
7. Redaksi secret di log/evidence/export sebelum persist atau kirim AI; sediakan evidence sensitif terpisah dengan kontrol akses/retensi yang jelas jika memang diperlukan. Terapkan schema IPC/settings, trusted sender/frame, atomic settings write dan rollback cache saat write gagal.
8. Perbaiki retention agar mempertahankan backup terbaru sesuai kebijakan; validasi SQLite integrity dan skema, dukung WAL dengan benar, serta restore drill termasuk evidence/artifact references.

**Acceptance:** fixture run kosong, parsial, running, failed, interrupted, malformed, missing output dan write failure tidak menghasilkan klaim aman; HTML/Markdown/JSON/UI konsisten; dua finalization event tidak menggandakan temuan; baseline tidak menandai resolved tanpa coverage sebanding; `/Admin` dan `/admin` tidak tergabung; settings write failure terlihat; restore menghasilkan jumlah scan/finding dan evidence hash yang sesuai.

## Fase 2 — Target, request dan autentikasi

- Tambahkan union target bertipe: web URL, API spec, local source/repository dan container image. Mapping tool-capability menentukan tool yang valid. Semgrep tidak boleh memindai folder output untuk target URL.
- Buat Request Workspace: method, URL, query, headers, cookies, body form/JSON, content type dan auth profile; import raw HTTP/HAR/OpenAPI secara terkontrol. Preview request dan lokasi parameter yang diuji; validasi input dan batas ukuran.
- Secret menggunakan referensi penyimpanan aman, bukan plaintext di preset, command preview atau export. Dukung expiry/session health, token refresh yang terdefinisi dan CSRF handling bertahap. Beri status eksplisit ketika session tidak valid; jangan melanjutkan sebagai scan authenticated yang seolah berhasil.
- Simpan engagement/project, allowlist domain/host/path dan exclusion. Validasi scope pada seed, URL hasil discovery, redirect dan retest. Konfigurasi request budget, timeout, rate limit dan concurrency per-host/global.
- Kembangkan pipeline bertahap menjadi dataflow nyata: discovery menghasilkan inventory; filter/dedupe/scope memilih request untuk tahap selanjutnya; simpan asal-usul setiap input. Hindari menjalankan setiap tool dengan satu URL tanpa memahami kebutuhan input.

**Acceptance:** URL ditolak untuk tool source-only; request GET/POST JSON/form menghasilkan argumen yang benar tanpa secret bocor; auth expired terlihat; redirect/discovery di luar scope tidak dijalankan; budget menghentikan job secara konsisten; provenance input dapat ditelusuri dari finding ke request dan tool.

## Fase 3 — Tool platform dan instalasi otomatis

- Satukan registry/catalog/UI/profile/installer pada manifest bertipe. Isi ID, capability, target type, OS/runtime, executable, versi kompatibel, pin upstream, lisensi, checksum/digest, installer, healthcheck, config schema, parser version dan risk/default budgets.
- Bedakan `not installed`, `installed`, `runtime missing`, `unsupported version`, `healthcheck failed`, `ready`. Preflight jangan hanya memanggil `--version`; lakukan fixture smoke test jika tersedia.
- Python tools memakai virtual environment per tool/versi. Temukan interpreter secara terstruktur, jangan bergantung path pribadi atau memasang dependency global lewat pip --user. Gunakan interpreter langsung untuk script; minimalkan shell wrappers.
- Download/build di staging, verifikasi artifact, aktifkan atomik, simpan receipt/provenance dan dukung rollback. Tangani proxy/offline, disk full, corrupt download, checksum mismatch, interrupted install dan missing runtime dengan pesan yang bisa ditindaklanjuti.
- Gunakan lock lintas proses; jangan update/hapus binary yang sedang digunakan run. Validasi hasil exit/download sebelum melaporkan berhasil. Tampilkan progress/cancel/retry/log yang sudah direduksi secret.
- Untuk container, simpan container ID dan pastikan cancel membersihkan container milik run tersebut. Membunuh Docker CLI saja harus diuji apakah menghentikan container; jangan mengasumsikannya.
- Audit parser SSLyze, Schemathesis, Semgrep dan legacy adapters terhadap output versi yang dipin. Exit code temuan bukan exit code error. Jangan swallow parser error menjadi hasil bersih.

**Acceptance:** instalasi dapat diuji pada Windows bersih/non-admin sesuai dukungan tool; install gagal tidak merusak versi sebelumnya; update bersamaan scan diblokir/diantrekan; cancel tidak meninggalkan proses/container run; fixture output valid/invalid/empty dan versi tak didukung menghasilkan status benar; tidak ada duplikasi definisi tool yang mudah berbeda antarhalaman.

## Fase 4 — Tambahan tool yang mengisi kebutuhan nyata

Riset ulang upstream resmi berikut dan pastikan belum tersedia sebelum menambahkannya. Catat versi/revisi yang dipilih, lisensi redistribusi, dukungan Windows/native/container, dependency, output machine-readable dan maintenance. Jangan hanya mengisi katalog atau tombol install: integrasi selesai mencakup runner, parser, evidence, UI, instalasi dan test.

1. **SSTImap — https://github.com/vladko312/SSTImap**: prioritas validasi SSTI untuk parameter request. Mulai dari deteksi dan bukti minimal yang tidak merusak pada lab lokal; hasil harus menyatakan engine/confidence/evidence. Jangan memasukkan shell, persistence atau pengambilan data sebagai default workflow.
2. **jwt_tool — https://github.com/ticarpi/jwt_tool**: workspace analisis JWT untuk API. Mulai dari inspection dan validasi terkontrol terhadap signature/claim pada fixture positif-negatif. Redaksi token; jangan menjadikan cracking/bruteforce sebagai default. Bedakan hasil analisis token offline dan kelemahan server yang benar-benar terverifikasi.
3. **Syft — https://github.com/anchore/syft**: SBOM source/container setelah typed target tersedia. Hubungkan komponen ke findings dependency yang sudah ada; export format standar yang didukung versi terpilih dan simpan provenance.
4. **Interactsh — https://github.com/projectdiscovery/interactsh**: fase opsional untuk blind/OOB verification. Utamakan layanan self-hosted yang dikonfigurasi eksplisit, correlation ID per-run, expiry, retensi dan pemisahan callback asing. UI menyatakan external data flow sebelum dipakai. Jangan memerlukan callback publik untuk penggunaan normal.

Fokus active testing juga berarti memperbaiki SQLmap/Commix/Dalfox/Nikto yang sudah ada: request/auth support, parameter selection, evidence, budget, cancel dan retest. Jangan menambah alternatif SQLi/XSS dengan fungsi hampir sama tanpa demonstrasi gap. Hindari auto-chaining menjadi tindakan eksploitasi lanjutan; rekomendasi AI tidak otomatis dijalankan.

**Acceptance per tool:** installer/pin nyata, supported target, konfigurasi bertipe, preflight, fixture positive/negative/malformed, version check, cancel, redacted evidence dan pemetaan finding tersedia. Jalankan hanya lab lokal/fixture pada pengembangan ini. Dokumentasikan kemampuan yang belum didukung; jangan menampilkan readiness palsu.

## Fase 5 — UI analis dan AI berbasis bukti

- Susun navigasi mengikuti pekerjaan: Projects/Targets → Requests & Auth → Tools/Preflight → Run → Findings/Evidence → Retest/Reports. Gunakan komponen/desain yang sudah ada, bukan rewrite UI tanpa manfaat.
- Halaman run menampilkan status per-tool, alasan skip/fail, waktu, coverage, resource budget dan aksi retry yang mempertahankan konfigurasi. Bedakan proses selesai dari assessment lengkap.
- Findings mendukung search/filter, severity/confidence, grouping, owner, triage, evidence preview, manual note, baseline dan retest link. Empty/loading/error/partial states harus berbeda. Tambahkan keyboard navigation, fokus dialog, label aksesibel dan kontras yang teruji.
- Log UI memakai ring buffer/virtualization; full log tersedia melalui penyimpanan yang dikelola. Pagination/worker untuk data besar agar renderer dan main process tetap responsif.
- Ikuti spec AI yang sudah ada. Satu policy guard untuk discovery, diagnostics, chat dan analysis. Local-only membatasi endpoint/redirect/model cloud; semua provider mendapat redaksi yang sama. Kunci API tersimpan bukan bukti koneksi berhasil.
- Structured context berisi coverage/status, finding/evidence ID, severity/confidence dan provenance. Urutkan prioritas secara eksplisit sebelum truncation, tampilkan omission dan token budget. Isi target/log/temuan dianggap data tak tepercaya, bukan instruksi.
- AI membedakan fakta, hipotesis, langkah verifikasi dan kekurangan bukti. Jangan membuat business impact/CVSS/attack chain seolah terkonfirmasi. Setiap klaim harus merujuk evidence yang tersedia; output AI tidak otomatis menutup finding atau menjalankan command.
- Perbaiki parser stream dengan buffer antar-chunk dan flush final; dukung timeout/cancel/retry, batas histori dan request correlation. Pisahkan pull model dari inferensi dengan progress/cancel dan status download yang benar. Persist analisis beserta model/provider, waktu, context version dan ID evidence agar masuk laporan secara konsisten.

**Acceptance:** stream JSON terbelah pada byte/newline/UTF-8 tetap menghasilkan output lengkap; provider error/cancel tidak bocor secret; local-only tidak mengirim ke endpoint luar; prompt injection fixture tidak menjadi instruksi aplikasi; AI tidak menyebut scan gagal sebagai aman; setiap klaim finding mengacu ID valid; QA visual pada resolusi umum Windows, keyboard, empty/error/partial states dan history besar didokumentasikan.

## Fase 6 — QA/QC dan release yang dapat diulang

- Jalankan unit, contract/parser fixture, integration DB/IPC/installer dan E2E Electron packaged app. Sertakan migrasi data lama, disk-full/write denied, corrupted output, crash/restart, backup/restore, uninstall/reinstall dan rollback update.
- Gunakan lab lokal terisolasi dengan vulnerable dan patched fixtures untuk membuktikan true-positive/negative/retest; jangan scan target nyata. Tool yang tidak tersedia atau tidak bisa diuji diberi status belum diverifikasi.
- Uji injection/quoting Windows untuk spasi, Unicode dan metacharacter pada input yang diizinkan. Pastikan tidak ada proses sampingan tak diinginkan. Uji auth redaction di log, laporan dan payload provider.
- Tetapkan benchmark hardware/dataset. Target awal yang diusulkan: history 10.000 findings dapat dipaginasi tanpa UI freeze yang terlihat; streaming log tidak tumbuh tak terbatas di memori; cancel lokal tercermin di UI dalam 2 detik dan proses berhenti dalam grace period terkonfigurasi. Catat pengukuran; revisi target dengan alasan jika tidak realistis, jangan mengaku sudah tercapai tanpa data.
- Build installer/portable dari source final, catat commit, versi, SHA-256 dan hasil smoke test install-launch-scan fixture-report-reopen. Verifikasi dependency/native module pada mesin bersih. Jika sertifikat signing tidak tersedia, tulis unsigned secara jelas; jangan mengaku signed atau enterprise-ready.
- Sertakan dependency/license inventory dan SBOM aplikasi, changelog, upgrade/backup/rollback guide serta daftar risiko tersisa. Jangan memasukkan secret/test database pengguna ke artefak.

## Deliverable akhir

Berikan kode yang diimplementasikan, matriks penyelesaian tiap fase, file penting, perintah dan hasil tes aktual, screenshot QA UI, versi tool yang diuji, artifact release bila build berhasil, serta batas verifikasi. Bedakan implemented, tested, packaged dan belum selesai. Jika pekerjaan melampaui satu sesi, simpan checkpoint yang menjelaskan hasil nyata dan next step spesifik. Jangan menyatakan seluruh roadmap selesai hanya karena tes unit hijau.
