# SQLmap dan Nikto — integrasi 17 Oktober 2026

Pembaruan 18 Oktober: Commix dan instalasi otomatis SQLmap/Commix/Nikto telah ditambahkan. Rincian runtime dan batas terbaru ada di [TOOL-INSTALLATION.md](TOOL-INSTALLATION.md), dengan bukti QA pada [QA-2026-10-18.md](QA-2026-10-18.md). Bagian di bawah mendokumentasikan baseline awal 17 Oktober.

Integrasi ini menambahkan dua engine ke Dashboard, katalog, health matrix, runner, database Findings, dan alur laporan yang sudah tersedia. Ini pengembangan bertahap; bukan klaim bahwa seluruh aplikasi sudah enterprise grade.

## Penggunaan

1. Siapkan checkout resmi [SQLmap](https://github.com/sqlmapproject/sqlmap) beserta Python, atau [Nikto](https://github.com/sullo/nikto) beserta Perl dan dependensinya. Pertahankan seluruh direktori upstream, bukan hanya menyalin satu script. Instalasi/updater otomatis belum disediakan.
2. Dashboard → Customize → Active Testing → pilih SQLmap dan/atau Nikto. Keduanya tidak otomatis dipilih oleh OSS Full.
3. Isi target. SQLmap saat ini memerlukan URL dengan query parameter, misalnya `http://127.0.0.1:8080/item?id=1` pada lab Anda. Nikto menguji origin target, bukan hanya path URL tersebut.
4. Di panel Active Testing, masukkan origin assessment yang sama persis, pilih parameter SQLmap, deadline 1–30 menit, dan jeda 1–10 detik.
5. Buka Runtime setup. Isi path absolut interpreter (`python.exe` / `perl.exe` di Windows) dan script upstream (`sqlmap.py` / `program/nikto.pl`), lalu **Save runtime paths**. Tools Hub menjalankan pemeriksaan versi lokal untuk memeriksa konfigurasi. Pemeriksaan path saat Start Scan tidak membuktikan seluruh dependency upstream sudah lengkap.
6. Jalankan scan pada aset dalam cakupan assessment Anda. Lihat terminal per tool, Findings, History, dan Export Report. Tombol Stop membatalkan proses serta antrean.

## Perilaku yang diimplementasikan

- SQLmap: parameter GET eksplisit; level 1, risk 1, teknik boolean/error, satu thread, tanpa mengikuti redirect. Tidak ada input argumen CLI bebas pada panel ini. Hasil positif memuat parameter, teknik, judul bukti, CWE-89 dan confidence `tool-confirmed`; severity awal high tetap memerlukan penilaian dampak analis.
- Nikto: tuning 123b untuk file menarik, konfigurasi, pengungkapan informasi, identifikasi software; output JSON satu host. Tidak mengaktifkan follow-redirects dan tidak memeriksa update saat scan. Temuan awal info/needs-review agar setiap observasi tidak otomatis dianggap kerentanan high.
- Interpreter dijalankan langsung dengan array argumen dan `shell:false`; output memakai direktori scan. Config assessment dan SHA-256 script utama disimpan di metadata. Hash tersebut tidak mencakup interpreter, seluruh checkout, plugin, atau database tool.
- Output hilang/rusak, format tidak dikenali, error tool, atau timeout menyebabkan FAILED. Pembatalan pengguna menyebabkan STOPPED. Hasil kosong hanya diterima untuk format hasil negatif yang dikenali; bukan bukti aplikasi bebas kerentanan.
- Deadline adalah batas per tool; jeda request bukan pembatas request global untuk seluruh engine yang dijalankan bersamaan. Disarankan memakai mode Bertahap.
- `npm test` memakai home sementara dan Electron ABI yang sesuai dengan SQLite. Data pengujian tidak memakai Documents/SecOpsScans pengguna; direktori sementara dipertahankan untuk investigasi.

## Batas saat ini

Belum ada SQLmap POST/JSON/body/raw request, authenticated session, database dump, OS shell, atau XSStrike. Dalfox tetap menjadi engine XSS yang sudah ada. Output SQLmap diparsing dari teks sehingga perubahan format upstream akan gagal secara eksplisit dan perlu penyesuaian fixture. Tidak ada klaim dukungan semua versi SQLmap/Nikto.

Validasi origin adalah validasi input dan pembatas opsi adapter, bukan network sandbox: DNS, perilaku versi upstream, plugin, proxy/config upstream, dan perubahan source tool tetap perlu dikendalikan oleh operator. Scope panel hanya berlaku untuk SQLmap/Nikto; tidak mengubah cakupan engine lain yang ikut dipilih. URL query dan log dapat memuat data sensitif; kontrol redaksi/retensi enterprise global masih menjadi pekerjaan lanjutan.

Verifikasi implementasi menggunakan fixture parser dan executable lokal palsu tanpa HTTP request. Pengujian upstream sungguhan di lab, installer distribusi, dan dependency Python/Perl pengguna belum dilakukan. Pengujian UI menggunakan renderer dengan IPC mock, bukan interaksi desktop Electron produksi.

## Hasil verifikasi

- Suite regresi: **101/101 lulus**; mencakup 96 tes sebelumnya dan 5 tes baru dengan beberapa skenario tiap tes.
- Tes integrasi baru diulang setelah perubahan terakhir: **5/5 lulus**, termasuk SQLmap positif dan output tidak lengkap, Nikto JSON valid/rusak, konfigurasi wajib, runtime berubah setelah preflight, pembatalan antrean, penyimpanan database, serta data laporan.
- `npm run build` dan typecheck: lulus. Build masih mengeluarkan peringatan bundle renderer >500 kB dan konfigurasi npm `electron_mirror` yang sudah ada.
- ESLint untuk tiga file TypeScript baru: lulus. Bukan klaim lint seluruh repository bersih; diff terhadap HEAD juga masih mencakup whitespace/perubahan Antigravity yang sudah ada.
- UI smoke di 1366×768 dengan IPC mock: lulus, tanpa page error. Pengulangan sempat gagal saat perubahan file/build berlangsung; uji ulang setelah kondisi stabil lulus. [Screenshot](active-testing-evidence/active-testing-1366.png), [UI result](active-testing-evidence/ui.json), [suite](active-testing-evidence/tests-all.txt), [tes integrasi terakhir](active-testing-evidence/tests-active.txt), [build](active-testing-evidence/build.txt).
- Deadline timeout ditinjau pada implementasi, belum diuji dengan menunggu satu deadline penuh. Tidak ada scan target nyata atau pemasangan tool upstream selama implementasi.

### Sumber upstream

- [SQLmap Usage](https://github.com/sqlmapproject/sqlmap/wiki/Usage): opsi pemilihan parameter dan profil pengujian.
- [Nikto CLI](https://github.com/sullo/nikto/blob/master/program/plugins/nikto_core.plugin): flag, tuning, timeout.
- [Nikto JSON reporter](https://github.com/sullo/nikto/blob/master/program/plugins/nikto_report_json.plugin): struktur host dan vulnerabilities.

Penolakan Antigravity pada lampiran didasarkan pada pembatasan yang dinyatakan oleh agen tersebut. Integrasi tool pengujian keamanan tidak otomatis sama dengan penggunaan yang merugikan; implementasi ini mendukung assessment dengan cakupan dan konfigurasi yang eksplisit.
