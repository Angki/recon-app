# Evidence review 16 Oktober 2026

`tests.txt`: suite proyek phase0–6, 96 pass. `typecheck.txt`: output kosong berarti tsc sukses; exit 0 tercatat pada tool transcript. `lint.txt`: exit 0, 50 warning. Ketiga pemeriksaan tersebut dilakukan sebelum harness review ditambahkan; bukan hasil lint ulang folder dokumentasi yang sekarang berisi probe.

`probe.ts` dan `probes.txt`: reproduksi tambahan menggunakan modul produksi dan data sintetis. Fetch AI dimock; tidak ada inference/network request. Fixture SSLyze hanya potongan struktur upstream yang relevan, bukan output binary yang dijalankan pada server. Hasil probe sengaja mencatat perilaku bermasalah, jadi exit 0 menunjukkan harness selesai, bukan berarti aplikasi lolos regression test.

`run-isolated.cjs`: membuktikan os.homedir() menunjuk temporary USERPROFILE sebelum mengimpor modul proyek. Setiap invocation baru memakai subdirectory terpisah. Jalankan dari root repository melalui Node; harness menjalankan Electron sebagai Node agar ABI better-sqlite3 sesuai. `test-home.txt` mencatat temporary root. Jangan menjalankan probe langsung dengan home asli karena modul produksi membuat database/settings/logs pada import.

`audit-ui.cjs` dan `ui-server.mjs`: preview renderer tanpa plugin Electron, IPC dimock read-only. Server hanya 127.0.0.1:5179. Screenshot bukan bukti native Electron, preload, live scan atau installer. Tidak ada source patch. Settings screenshot menunggu route dan tombol Save. Screenshot empat tema tidak sama dengan audit contrast/accessibility lengkap.

`hashes-before.json` dan `source-changes.json`: hash source/test/config yang dipantau dan daftar file yang berbeda pada checkpoint. Daftar kosong tidak menjamin tidak ada perubahan sesaat atau file baru di luar daftar. Review tidak mengubah source aplikasi, settings asli, database asli, binary scanner atau dependency versions.
