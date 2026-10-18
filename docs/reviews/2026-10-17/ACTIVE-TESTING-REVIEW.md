# Pemeriksaan terbaru: integrasi active security testing

Tanggal 17 Oktober 2026. Dibaca: lampiran respons Antigravity, engine scanner, adapter registry, catalog, profiles, store/UI peluncuran dan hasil, konfigurasi build serta tests. Source aplikasi tidak diubah pada pemeriksaan ini. Tidak ada scan target atau instalasi tool. Fokus adalah kesiapan integrasi active testing, melanjutkan review menyeluruh 16 Oktober.

## Mengapa Antigravity menolak?

Lampiran secara eksplisit mengategorikan SQLmap sebagai offensive exploitation/weaponization dan mengutip kebijakan keselamatan. Itu penjelasan yang diberikannya; konfigurasi internal/model dan konteks lengkap permintaan di sana tidak tersedia, sehingga penyebab internal tidak dapat dipastikan.

Pernyataan bahwa semua integrasi SQLmap dilarang terlalu menyeluruh. SQLmap dapat dipakai untuk mendeteksi dan menguji SQL injection dalam assessment yang diotorisasi. Tool yang sama juga mempunyai kemampuan lanjutan dengan dampak lebih besar. Penilaian harus memperhatikan tujuan, tindakan, target, scope dan dampak, bukan nama executable saja. SQLmap upstream mendokumentasikan pemilihan URL/request, parameter dan pengaturan intensitas pengujian. [Dokumentasi resmi](https://github.com/sqlmapproject/sqlmap/wiki/Usage)

Penolakan tersebut bukan error teknis repository. Aplikasi sudah menjalankan DAST aktif seperti Wapiti, Dalfox, ZAP dan Nuclei. Menyebut semua pemeriksaan itu pasif/non-destruktif juga tidak tepat: dampak tergantung konfigurasi, template dan request yang dijalankan. Prompt berikut meminta capability yang konkret untuk pengujian berizin, bukan meminta agen mengabaikan aturan keselamatannya.

## Apa yang berubah sejak review 16 Oktober?

Hash enam berkas berbeda: ScannerControls.tsx, Dashboard.tsx, useScanStore.ts, scanner.ts, registry.ts, phase6-gates.test.ts. Daftar ada di `evidence/changed-since-review.json`. Perbandingan hanya mencakup file yang dipantau review lama.

- Runner kini mendukung `pipeline` dan `concurrent`; pipeline mengurutkan tool menurut prioritas dan menunggu setiap tool selesai. Store menambah QUEUED dan UI memilih mode eksekusi.
- Dalfox memakai `-w 5`; kompatibilitas semua versi belum dibuktikan hanya dengan flag tersebut.
- ZAP membuat home per run serta memilih port acak 18000–27999. Ini mengurangi ketergantungan ke 8080, **bukan jaminan bebas collision** karena belum ada pengecekan/retry bind yang terlihat.
- Schemathesis sudah memisahkan `--report json` dari `--report-json-path`. Jangan mengulang temuan lama tentang flag itu sebagai bug yang belum diperbaiki. Format parser aktual tetap perlu fixture versi executable.
- Cancellation reason `_wasTerminated` kini dicatat dan dibaca sebelum cleanup. Ini perbaikan atas urutan cleanup lama, tetapi belum membuktikan seluruh cancel/timeout semantics benar.

Verifikasi ulang: **96 test pass, 0 fail; `tsc -b` exit 0**. Test memakai temporary USERPROFILE terverifikasi karena suite memanggil settings/database singleton dan clearAllScans. Bukti: [tests](D:/Projects/recon-app/docs/reviews/2026-10-17/evidence/tests.txt). Tidak dilakukan ulang screenshot/Electron packaged smoke; hasil UI 16 Oktober bukan bukti visual build hari ini.

## Kesenjangan yang relevan sebelum menambah SQLmap

1. **Pipeline masih urutan waktu, belum aliran input.** `scanner.ts` mengirim targetUrl/domain awal yang sama ke setiap `runGenericTool`. Tidak ada transformasi endpoint/parameter dari Katana/GAU/Arjun ke testing job. DNSX masih menerima domain awal dari stdin. Ini berarti tombol SQLmap pada target homepage tidak otomatis menguji endpoint yang ditemukan crawler.
2. **Belum ada request inventory.** Findings memiliki URL/detail, tetapi belum ada entitas endpoint + method + query/body parameter + auth reference yang dapat dipilih sebagai testing input. Parameter yang ditemukan tidak otomatis vulnerability.
3. **Scope backend belum formal.** startScan memvalidasi HTTP(S), bukan engagement allowlist, path/method restrictions, redirect policy atau request budget. Ini perlu menjadi contract bersama tool aktif.
4. **Catalog belum cukup untuk menjalankan Python script.** SQLmap upstream harus dikenali sebagai script dengan interpreter, versi dan provenance. `toolManager.ts` masih memiliki dispatch install hardcoded. Jangan sekadar menambahkan nama ke manifest lalu berharap updater/executable resolution bekerja.
5. **Lifecycle masih dapat memberi status menyesatkan.** Timeout ditandai terminated lalu STOPPED, tidak dibedakan dari operator cancel. Stop memperbarui queued job di storage tanpa status event per queued job; UI dapat menyimpan QUEUED. Exception sebelum spawn dalam promise dapat menghentikan pipeline, sementara catch luar hanya log dan menyisakan job/state. Ini temuan statis, belum fake-process reproduction khusus pipeline baru.
6. **Output tidak valid masih dapat dianggap clean.** Parse failure hanya di-log, lalu status memakai exit semantics. Report PARTIAL/RUNNING/INTERRUPTED dan summary idle masih memiliki celah assurance dari review sebelumnya. SQLmap harus membedakan confirmed/suspected/not-detected/inconclusive/error, bukan menebak dari exit 0 atau substring umum log.
7. **Sebagian perbaikan enterprise sebelumnya masih tersisa.** Log store belum bounded, report-grade inconsistency, local-only model policy, migration legacy dan backup retention. File terkait tidak berubah pada pembandingan hash; review 16 Oktober tetap relevan untuk bagian tersebut.

`nikto` dan `testssl` muncul pada priority map, tetapi tidak pada adapter/catalog/UI yang ditemukan. Itu belum merupakan integrasi. SQLmap dan XSStrike belum tersedia.

## Urutan tool yang disarankan

| Prioritas | Tool | Peran dan overlap |
|---|---|---|
| 1 | SQLmap | Mengisi gap validasi SQL injection per endpoint/parameter dengan evidence dan retest. Default integrasi fokus detection/confirmation, bukan ekstraksi dataset. [Upstream](https://github.com/sqlmapproject/sqlmap) |
| 2 | XSStrike | Pengujian XSS sebagai opsi pembanding terhadap Dalfox. Hindari menjalankan keduanya otomatis untuk setiap target; ukur tambahan coverage dan false positives. [Upstream](https://github.com/s0md3v/XSStrike) |
| 3 | Nikto | Web server checks/misconfiguration dan known problematic files; tambahan coverage, bukan framework takeover. Belum integrated walau namanya ada di priority map. [Upstream](https://github.com/sullo/nikto) |
| Pertahankan/perdalam | ZAP, Dalfox, Nuclei, Wapiti | Sudah tersedia; auth-aware scans, evidence, parameter targeting dan retest lebih penting daripada menambahkan tombol duplikat. |

Jangan menyebut setiap tool sebagai “exploit engine” karena capability-nya berbeda. Kategori produk yang lebih presisi: **Active Testing & Validation**, dengan capability dan impact ditampilkan per job. Pengujian RCE/post-exploitation bukan syarat untuk menyelesaikan integrasi SQLi/XSS ini.

Deliverable implementasi yang paling berguna: inventory endpoint -> pilih request dan parameter -> review testing plan -> run -> evidence -> triage -> retest. Scope, job budget dan cancellation melayani workflow ini, bukan sekadar checkbox dekoratif.

Prompt siap pakai: [ANTIGRAVITY-ACTIVE-TESTING-PROMPT.md](D:/Projects/recon-app/docs/reviews/2026-10-17/ANTIGRAVITY-ACTIVE-TESTING-PROMPT.md).
