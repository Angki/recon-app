# Review pengembangan Recon App — 18 Oktober 2026

## Ruang lingkup dan batas bukti

Pemeriksaan kode lokal, dokumen review 15–17 Oktober, dokumentasi enterprise, rancangan AI terbaru, tes terisolasi, dan referensi resmi kandidat tool. Tidak mengubah source aplikasi, menginstal tool, menjalankan scan target nyata, atau membangun EXE pada pemeriksaan ini. UI dinilai dari implementasi, bukan sesi visual/E2E baru. Ini rekomendasi pengembangan, bukan sertifikasi enterprise atau hasil pentest aplikasi.

Repository berubah aktif selama pemeriksaan, sekitar 19.14–19.18 WITA. HEAD awal `d6edf35`, kemudian `49d2f8e` (`feat(ai): add model discovery, connection diagnostic, and structured findings synthesizer`). Perubahan terlihat pada AI service/tests, IPC/preload, settings dan halaman Settings; `dist-electron` juga berubah. Karena bukan snapshot atomik, nomor baris dan temuan harus dicocokkan ulang sebelum implementasi. Tidak menganggap perubahan tersebut sebagai kesalahan atau membatalkannya.

## Verifikasi pada checkpoint

- Suite awal: **108/110 lulus**, dua kegagalan AI terkait metode yang saat itu belum tersedia. Hasil ini adalah checkpoint historis, **bukan dua bug aktif** setelah pembaruan berikutnya.
- Setelah metode ditambahkan: `node scripts/test-isolated.cjs tests/ai-service.test.ts` menghasilkan **4/4 lulus**, memakai home/database sementara. Ini bukan rerun seluruh suite terbaru.
- Scoped lint terbaru: `npx eslint electron/services/aiService.ts tests/ai-service.test.ts --quiet` gagal pada `aiService.ts:272` (`preserve-caught-error`) dan `ai-service.test.ts:38` (`no-require-imports`). Jangan menonaktifkan rule untuk menyembunyikan kegagalan.
- Typecheck sempat dijalankan dalam pemeriksaan, tetapi kode terus berubah; jangan menggunakan checkpoint itu sebagai jaminan build final terbaru.
- Tes koneksi AI saat ini hanya menguji bentuk hasil dan menghubungi localhost; kelulusan tidak membuktikan model tersedia atau inferensi berhasil. Mock transport diperlukan untuk unit test deterministik.
- `package.json` saat dibaca sudah versi **1.0.0**. Artefak lama versi 0.0.0 bukan bukti hasil build kode terbaru.

## Yang sudah ada atau membaik — pertahankan

1. SQLmap, Commix, Nikto dan alur active testing/retest telah tersedia. Jangan mengajukan penambahan ketiganya dari nol.
2. Installer active tools menggunakan revisi source yang dipin, direktori managed, receipt, serta digest Docker Nikto. Ini landasan baik, tetapi belum identik dengan verifikasi seluruh dependency supply chain.
3. Updater WhatWeb tidak lagi memakai instalasi pip yang salah. Pertahankan jalur runtime Ruby/manual yang sesuai.
4. Runner sudah melakukan deduplikasi tool, menolak scanner tak dikenal, memvalidasi konfigurasi active testing, dan memperlakukan kegagalan parse/persist tertentu sebagai kegagalan. Jangan mengulang klaim bahwa semua kasus itu masih belum ditangani.
5. Schemathesis memakai `--report json --report-json-path`; masalah flag lama sudah diperbaiki secara kode. Parser versi aktual tetap perlu fixture.
6. Context isolation Electron dan pemisahan Node dari renderer sudah ada. Jangan menyarankan memulai isolasi dari nol.
7. Model discovery, connection diagnostic, structured findings context dan empat preset AI sudah diimplementasikan saat checkpoint terakhir. Sesuaikan dengan spec/plan AI yang sedang dikerjakan.

## Temuan dan peluang prioritas

### P0 — Kejujuran hasil, status, dan data

**R1. Nilai keamanan belum konsisten dengan kelengkapan scan.** `electron/services/reportService.ts`, fungsi `calculateStats` sekitar baris 70, hanya mengecualikan beberapa status gagal; pemanggilan Markdown sekitar 267 dan JSON sekitar 319 tidak meneruskan status. `electron/ipc.ts` handler statistik juga perlu disamakan. `src/components/FindingsSummary.tsx` memberi A+/Secure ketika hitungan temuan kosong. Scan parsial, berjalan, atau tool tanpa hasil valid tidak boleh disimpulkan aman. Pisahkan coverage, execution success, finding severity dan confidence.

**R2. Baseline dapat memberi kesan resolved tanpa pembuktian setara.** `electron/services/db/baseline.ts` belum memastikan kesetaraan target/scope/coverage/tool; pengecualian current status tidak mencakup semua scan yang belum lengkap. Histori triage perlu memakai keputusan efektif terbaru, bukan adanya status fixed/resolved di masa lalu. Ketidakhadiran temuan pada pengujian yang tidak sebanding harus menjadi `not reassessed`.

**R3. Identitas temuan dapat menggabungkan lokasi berbeda.** `electron/services/db/fingerprint.ts` melakukan lowercase seluruh URL dan membuang query/fragment; parameter memakai `param`, bukan semua variasi field adapter. Path case-sensitive dan lokasi source memerlukan representasi berbeda. Buat fingerprint bertipe dan berversi dengan migrasi tanpa kehilangan triage.

**R4. Lifecycle belum sepenuhnya konsisten.** `electron/services/scanner.ts`: beberapa `storage.updateStatus` tidak ditunggu sebelum event; event error/close mempunyai finalisasi terpisah. Sebagian parser legacy menerima output hilang/malformed sebagai array kosong. `electron/services/runner/stateMachine.ts` menghitung sukses/gagal berdasarkan COMPLETED/FAILED saja sehingga kombinasi terminal lain perlu tabel transisi lengkap. `storage.ts` jalur status global DB/metadata JSON perlu disatukan; penghapusan scan aktif dan kegagalan filesystem perlu penanganan eksplisit. Ini risiko dari pembacaan kode, belum direproduksi seluruhnya melalui E2E.

**R5. Log dan settings perlu jaminan data.** `scanner.ts:401,413` menulis stdout/stderr langsung, sehingga tidak otomatis mendapat redaksi logger. `settings.ts` pada checkpoint awal menggabungkan input bebas, memperbarui cache sebelum keberhasilan write, dan menangkap kegagalan write tanpa propagasi yang memadai; file ini sedang diedit, verifikasi ulang sebelum menetapkan bug aktif. Gunakan schema, atomic write dan rollback cache. Validasi sender/frame serta schema semua IPC secara terpusat.

**R6. Retention dan restore backup.** `electron/services/db/backup.ts` mengurutkan backup terbaru dahulu dan jalur quota retention perlu diperbaiki agar tidak membuang yang terbaru terlebih dahulu. Validasi header bukan SQLite integrity check. Jalur backup SQLite online sudah baik; fallback copy perlu memperhitungkan WAL. Lakukan restore drill database beserta referensi evidence, bukan sekadar file backup terbentuk.

### P1 — Engine, adapter, instalasi dan target yang sesuai

**R7. Tipe target belum cocok untuk seluruh katalog.** Runner berpusat pada HTTP(S). Semgrep pada `electron/services/scanners/registry.ts:1208–1215` memakai direktori output ketika diberi URL, sehingga bukan analisis source target yang dimaksud. Buat tipe web URL, repository/local directory, container image, dan API specification. Tool yang tidak kompatibel harus ditolak sebelum proses dibuat.

**R8. Validitas parser harus mengikuti versi tool.** SSLyze membaca `scan_commands_results` langsung sekitar baris 1062; cocokkan dengan struktur `scan_result` pada output versi yang dipin. Semgrep menerima exit 2; bedakan error operasional dari temuan. Parser Schemathesis perlu fixture output aktual, bukan asumsi struktur events/tasks. Jangan klaim kompatibilitas runtime tanpa executable/fixture versi terkait.

**R9. Installer belum satu kontrak end-to-end.** `activeToolInstaller.ts` sudah lebih ketat daripada sejumlah jalur legacy `toolManager.ts`. Jalur legacy perlu pemeriksaan exit status dan verifikasi artifact; jangan return sukses hanya karena proses download/copy sudah dicoba. Python discovery, dependency isolation, lock antarproses, rollback update dan operasi bersamaan scan/install masih perlu diperkuat. Status installed, executable, parser-compatible dan ready harus berbeda.

**R10. Orkestrasi dan performa.** Runner paralel belum mempunyai budget resource global/per-host yang jelas; mode fase belum otomatis berarti dependency/dataflow antarhasil. `src/stores/useLogStore.ts` menyimpan log secara bertambah tanpa batas yang terlihat. Tambahkan concurrency, backpressure, ring buffer, paginasi dan offload pekerjaan berat. Pembungkus `cmd /c` memerlukan pengujian quoting/metacharacter Windows; tidak ada klaim injeksi yang sudah dieksploitasi dalam review ini.

### P1/P2 — AI, pengalaman analis, dan fitur baru

**R11. AI baru masih membutuhkan hardening.** Pada `aiService.ts` terbaru, structured context sudah ada, tetapi tidak menyertakan coverage yang cukup untuk membedakan nihil temuan dari pengujian gagal. Pemotongan 50 temuan menyebut sisanya lower-severity tanpa pembuktian pengurutan di fungsi tersebut. Beri finding/evidence ID yang stabil dan aturan klaim berbasis bukti. `testConnection` Anthropic menyatakan sukses hanya karena API key terisi: tampilkan configured, bukan connected/verified.

Parsing stream Ollama memecah setiap chunk berdasarkan newline tanpa menyimpan fragmen antar-chunk; JSON dapat hilang secara diam-diam. Pull model otomatis belum memiliki lifecycle pembatalan/timeout setara. Policy local-only harus berlaku konsisten pada discovery, diagnostic, chat dan analyze; validasi redirect dan model yang memakai cloud, bukan hanya hostname awal. Terapkan redaksi sebelum seluruh provider dan persist provenance AI. Ini bukan alasan menghapus fitur AI yang sedang dikembangkan.

**R12. UX yang paling bernilai.** Satu workspace project/engagement, target bertipe, request editor dengan auth profile, preflight tool, coverage per tool, evidence viewer, baseline/retest, dan laporan konsisten lebih bermanfaat daripada menambah tombol tool sebanyak mungkin. Perlu QA visual aktual, keyboard, fokus, kontras, error states dan alur packaged app; belum diverifikasi pada turn ini.

## Kandidat tool baru

Rekomendasi berikut adalah penilaian kecocokan, bukan klaim ranking popularitas/dukungan Windows. Periksa ulang katalog, lisensi, dependency, release dan aktivitas upstream sebelum memilih versi.

- **[SSTImap](https://github.com/vladko312/SSTImap)**: melengkapi pengujian SSTI, setelah request/auth workspace siap. Mulai dari deteksi dan bukti minimal di lab; jangan menjadikan pengambilan shell atau pembacaan data sebagai preset default.
- **[jwt_tool](https://github.com/ticarpi/jwt_tool)**: analisis token dan validasi kontrol JWT untuk API. Token diperlakukan sebagai secret; awalnya inspeksi dan kasus negatif signature/claim terkontrol.
- **[Syft](https://github.com/anchore/syft)**: SBOM source/filesystem/container, melengkapi analisis dependency yang sudah ada. Bergantung pada target bertipe; bukan alat exploit.
- **[Interactsh](https://github.com/projectdiscovery/interactsh)**: korelasi callback OOB untuk blind findings; opsional setelah boundary data/scope matang. Prioritaskan self-hosted dengan callback expiry, korelasi run dan kebijakan retensi.

Jangan menambah duplikasi SQLi/XSS sebelum membuktikan kebutuhan yang belum ditangani SQLmap/Dalfox dan tool yang sudah terpasang. Setiap tool baru harus hadir lengkap: installer, preflight, typed config, runner, parser, evidence, UI, test dan dokumentasi.

Prompt implementasi: [ANTIGRAVITY-PROMPT.md](./ANTIGRAVITY-PROMPT.md).
