# Prompt: integrasi SQLmap dan active testing pada Recon App

Lanjutkan proyek `D:\Projects\recon-app`. Tambahkan workflow active security testing untuk assessment pada aset yang diotorisasi, dimulai dari SQLmap, kemudian XSStrike dan Nikto. Baca kode terbaru, instruksi repository, `docs/reviews/2026-10-17/ACTIVE-TESTING-REVIEW.md`, dan review 16 Oktober. Pertahankan perubahan pengguna dan perbaikan pipeline/Dalfox/ZAP/Schemathesis yang sudah ada.

Tujuan ini adalah mengintegrasikan tool pengujian ke workflow analyst yang dapat dikonfigurasi, diaudit dan diuji. SQLmap tidak perlu ditolak hanya berdasarkan nama tool; nilai capability yang diminta serta tujuan dan scope assessment. Jika suatu capability tertentu tidak dapat dikerjakan, jelaskan secara spesifik dan lanjutkan bagian yang dapat dikerjakan. Jangan mengakali kebijakan agen, menyamarkan tindakan, atau mengklaim kemampuan yang belum diimplementasikan.

## 1. Audit singkat dan rancangan sebelum perubahan

Petakan entry points: UI composer -> IPC scan:start -> ScannerService -> catalog/adapter -> output/parser -> DB -> findings/report. Verifikasi jenis runtime tool dan jalur installer sebenarnya. Mode pipeline sekarang hanya serial order; jangan menganggap sudah ada dataflow. SQLmap/XSStrike belum tersedia. Nikto hanya muncul pada priority map, bukan integrasi lengkap.

Buat daftar perubahan yang diperlukan per file dan acceptance criteria. Jangan mengubah framework. Ikuti pattern output/cwd per run dari skill repository, tetapi verifikasi klaim exit codes terhadap versi upstream; jangan menormalisasi aborted/error sebagai successful semata-mata agar badge hijau.

## 2. Request inventory dan scope

Bangun entitas endpoint/request dengan project/engagement, normalized URL, method, query parameters, body parameter names/content type, discovery source, first/last seen dan credential reference. Nilai sensitif ditampilkan masked. Simpan request material sensitif di lokasi yang sesuai kebijakan, bukan di log/UI plaintext.

Normalisasi dan dedup hasil Katana/GAU/Arjun ke inventory; bedakan historical candidate dari endpoint yang sudah diverifikasi. Jangan mengubah setiap discovery menjadi vulnerability.

Tambahkan scope enforcement backend: origin/domain/IP yang diizinkan, path exclusion, method policy, budget, scan window bila dikonfigurasi, serta validasi redirect/expansion. Allowlist private IP jika memang termasuk engagement. Jangan hanya memeriksa scope di frontend. Gunakan parser URL dan domain boundary yang benar, bukan substring.

UI menyediakan pilihan endpoint dan parameter yang akan diuji, termasuk request yang diimpor dengan validasi. Discovery tidak otomatis memicu pengujian seluruh endpoint. Operator menjalankan testing plan yang jelas: target, method, parameter, tool, auth profile, timeout/rate/concurrency dan jenis pemeriksaan.

## 3. Integrasi SQLmap yang selesai end-to-end

- Ambil distribusi dari upstream SQLmap resmi, pin versi/commit dan simpan provenance. Runtime Python/script harus eksplisit. Dukung konfigurasi interpreter dan script path; cek versi/preflight. Jika instalasi belum otomatis, beri status manual-required beserta petunjuk yang akurat.
- Implement manifest, adapter, runtime resolution, entry point UI, config schema, output collector, parser, persistence, report mapping dan retest. Jangan sekadar menambah label Tools Hub.
- Mulai URL dengan parameter terpilih dan request-file input yang tervalidasi. Request file milik job dibuat dalam directory run, secret direferensikan melalui vault/profile dan tidak dicetak ke command preview.
- Default profile adalah detection/confirmation terbatas: intensitas konservatif, single-target job, concurrency rendah, overall deadline dan request pacing. Konfigurasi harus dibangun dari typed fields menjadi argv/config terkontrol, bukan freeform shell.
- Default tidak melakukan dump tabel, pengambilan credential/data pengguna, modifikasi database, file write atau OS shell. Fitur-fitur tersebut tidak diperlukan untuk membuktikan keberadaan SQL injection dalam workflow awal ini. Jelaskan batas profile kepada operator dan jangan menyebut semua request bebas dampak.
- Gunakan mekanisme output terstruktur yang benar-benar didukung versi terpilih; periksa upstream CLI/API. Jangan mengarang flag JSON dan jangan membaca session SQLite SQLmap tanpa versioned contract. Bila memakai API lokal, bind loopback dengan lifecycle/akses terkontrol dan tidak mengekspos arbitrary command surface.
- Simpan execution outcome dan assessment verdict terpisah. “Parameter tidak injectable” hanya sah setelah tes selesai valid; missing output, timeout, parse error, koneksi gagal dan scope rejection bukan clean result.
- Finding memuat endpoint, method, parameter/place, technique/category yang dilaporkan, confidence, evidence references, tool/version, waktu, remediation dan retest lineage. Jangan otomatis memberi critical hanya karena kata SQL injection ditemukan di log. Redact sensitive request/response sebelum export atau AI.
- Stop/cancel menghentikan seluruh job milik aplikasi, mempersistkan partial results dan tidak memulai job antrian berikutnya. Isolasi session/output per run agar hasil lama tidak tampak sebagai hasil pengujian baru tanpa provenance.

Rujukan: https://github.com/sqlmapproject/sqlmap dan https://github.com/sqlmapproject/sqlmap/wiki/Usage. Validasi terhadap versi yang diinstal, bukan asumsi universal semua versi.

## 4. XSStrike dan Nikto

**XSStrike:** integrasikan sebagai pilihan pengujian XSS per request/parameter untuk target yang diotorisasi. Capability dan output harus diverifikasi terhadap upstream. Dalfox sudah ada; jangan menjalankan dua tool otomatis tanpa pilihan profile. Pertahankan provenance masing-masing bila findings berkorelasi. Tidak perlu mekanisme exfiltration/browser-session theft untuk validasi XSS di lab. Source: https://github.com/s0md3v/XSStrike.

**Nikto:** lengkapi manifest/runtime Perl atau container yang dipilih, installer/manual configuration, adapter, parser, health, UI dan reports. Bedakan server observation dari vulnerability terkonfirmasi, dukung timeout/cancel dan pin database/plugin version. Source: https://github.com/sullo/nikto.

Untuk kedua tool, bila format output tidak terstruktur stabil, buat versioned parser fixtures dan error coverage yang jujur. Nama pada priority map tidak cukup untuk badge Supported/Verified. Mulai installer manual bila lebih andal daripada wrapper otomatis yang belum diuji.

## 5. Lifecycle, dataflow dan UI

Perbaiki finalizer bersama agar spawn error, exception sebelum spawn, error+close, timeout, cancellation dan persistence failure hanya difinalisasi sekali. Bedakan timeout dari stop pengguna. QUEUED/RUNNING/STOPPED/PARTIAL/FAILED/COMPLETED berasal dari backend snapshot/event; jangan hitung ulang secara berbeda di renderer. Subscribe/replay harus menangani fast-exit.

Hubungkan discovery artifact ke request inventory, lalu ke job yang dipilih. Log dataflow menyimpan input artifact IDs dan transformasi. Jangan mengklaim chained pipeline bila semuanya masih menerima target awal.

Tambahkan tab/page **Active Testing & Validation** dengan endpoint picker, parameter table, compatible tools, auth profile, testing-plan preview, job queue, live status dan evidence drawer. Tampilkan impact/rate/timeout ringkas. Secret inputs masked. Integrasikan findings ke history/report dan tombol retest yang membawa konfigurasi relevan.

Tool SQLmap/XSStrike/Nikto tidak otomatis masuk default “OSS Full”/“Passive Recon”. Pilihan scan aktif harus eksplisit dan profile passive tidak memuat TLS probing. Semua capability dan profile berasal dari satu catalog agar UI/installer/runner tidak drift.

## 6. Quality gates wajib

1. Tests selalu memakai app-data root sementara sebelum import singleton; jangan menyentuh Documents/SecOpsScans pengguna. Test suite saat ini memanggil clearAllScans, jadi buat runner resmi yang aman.
2. Unit tests untuk scope normalization, lookalike domain, excluded path/method, unsupported target, request import/secret masking, argument generation tanpa shell interpolation, malformed output, valid empty dan inconclusive.
3. Fixture parsers berasal dari output versi tool yang diverifikasi: positive/negative/error/partial. Jangan hanya membuat fixture yang mengikuti asumsi parser sendiri.
4. Fake executable lifecycle tests: fast exit, spawn error, setup exception, timeout, cancel during queue, duplicated events, output besar dan disk/DB failure. UI dan DB harus konsisten.
5. Local lab smoke dengan target rentan dan kontrol tidak rentan yang memang dibuat untuk test. Simpan versi tool, fixture app, command/config teredaksi dan hasil. Jangan menggunakan domain publik sebagai test target hanya karena bernama example.
6. UI E2E: discovery fixture -> pilih parameter -> plan -> run fake/local job -> evidence -> report -> retest. Keyboard/focus/error states bekerja; screenshots hanya bukti tambahan.
7. Typecheck dan tests lulus. Report tidak memberi A/Secure pada idle/failed/partial/inconclusive. Confirmed finding membutuhkan evidence, bukan exit 0.

## 7. Deliverable

Implementasi bertahap: fondasi request/scope dan lifecycle -> SQLmap lengkap -> XSStrike/Nikto -> hardening dan dokumentasi. Hasilkan tool support matrix, installation/runtime instructions, schema/output contract, test evidence, limitations dan changelog. Laporkan bagian yang fixture-tested dan yang runtime-tested secara terpisah. Jangan mengklaim semua selesai karena 96 tes lama masih lulus.

Mulai dari membaca kode terbaru dan menyelesaikan fase SQLmap beserta workflow minimal yang usable, lalu lanjut tool tambahan. Pertahankan review sebelumnya sebagai backlog enterprise; jangan mengabaikan integritas hasil untuk mengejar jumlah tool.
