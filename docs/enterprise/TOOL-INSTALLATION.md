# Instalasi tool — 18 Oktober 2026

Runtime dipasang pada komputer pengguna, terpisah dari installer aplikasi.

| Tool | Hasil |
|---|---|
| SQLmap | Checkout resmi terpisah di `%APPDATA%\ReconApp\tools\sqlmap-official`; versi `1.10.10.4#dev`, Python 3.12. Checkout lama pengguna tidak diubah. |
| Commix | `v4.2.dev229`, commit `287fb3dc99ff0c720cd1e5327ddb9819d8f5c5b8`, dipasang melalui installer aplikasi ke direktori `commix-managed-*`. Dependency Windows `pyreadline3==3.5.6` dipasang otomatis. |
| Nikto | Image resmi GHCR, versi runtime `2.5.0`, digest `sha256:0bb37022ebfadc38d6a9a2755c03bfd1f9e079e01e8946fe548153d9ba0c2012`. Docker Desktop harus berjalan. |
| WhatWeb | Tag resmi v0.6.4 di `%APPDATA%\ReconApp\tools\WhatWeb-official`, Ruby 3.3.12 di `C:\Ruby33-x64`, dependency Bundler terpasang. Wrapper `%APPDATA%\ReconApp\bin\whatweb.cmd`. |

SQLmap, Commix dan Nikto telah dikonfigurasi di settings lokal aplikasi (`Documents\SecOpsScans\settings.json`). Defender memblokir script Nikto native; tidak ada exclusion atau penonaktifan Defender. Nikto Docker menggunakan image yang dikunci ke digest, filesystem read-only, capability dibuang, serta batas memori/CPU/PID saat assessment. Folder output scan dipasang ke container agar laporan dapat dibaca aplikasi.

Tools Hub menyediakan Install/Reinstall otomatis untuk SQLmap, Commix, dan Nikto. Python/Git harus tersedia untuk checkout; Docker Desktop harus tersedia dan berjalan untuk Nikto. Installer source memakai revisi tetap, direktori baru, pemeriksaan HEAD dan versi, lalu menyimpan path runtime. Checkout pengguna tidak ditimpa. Instalasi yang gagal sebelum aktivasi mempertahankan konfigurasi lama; direktori percobaan dipertahankan untuk diagnosis. Pembaruan revisi upstream perlu pengujian parser dan perubahan pin aplikasi, bukan mengikuti branch terbaru secara diam-diam.

Commix mendukung parameter GET terpilih, results-based technique, jeda request, scope origin, evidence CWE-78, endpoint testing dan linked retest. Deadline dikelola runner aplikasi. Tidak ada shell interaktif atau input command bebas. Status upstream `completed` saja tidak cukup: parser memerlukan temuan terstruktur atau pesan negatif akhir yang dikenali; error, laporan terpotong, dan hasil kosong prematur menjadi FAILED.

WhatWeb sekarang meminta JSON secara eksplisit. Updater menolak jalur pip yang keliru dan memberikan petunjuk upstream; pembaruan otomatis WhatWeb belum didukung. Ruby dan dependency berhasil diperiksa secara lokal.

Sumber: [SQLmap](https://github.com/sqlmapproject/sqlmap), [Commix](https://github.com/commixproject/commix), [Nikto](https://github.com/sullo/nikto), [WhatWeb](https://github.com/urbanadventurer/WhatWeb).

## Prioritas pengembangan berikutnya

1. Profil autentikasi dengan penyimpanan secret OS, redaksi log, dan pemeriksaan sesi kedaluwarsa: memungkinkan assessment halaman internal tanpa menyalin cookie ke setiap tool.
2. Scope dan batas request terpusat untuk semua adapter: konfigurasi origin Active Testing saat ini belum menjadi pengendali jaringan seluruh engine.
3. Perbandingan dua assessment: temuan baru, tetap ada, diperbaiki, dan belum diuji; hasil timeout tidak boleh dianggap fixed.
4. Installer tool berbasis manifest dengan versi/checksum, rollback, serta status dependency yang terpisah dari status executable.

Penambahan engine berikutnya sebaiknya mengikuti kebutuhan yang belum tercakup dan disertai fixture parser serta pengujian lab. Katalog saat ini sudah memiliki banyak engine; kesiapan runtime dan keandalan hasil menjadi prioritas pada iterasi ini.

Checklist integrasi tool baru tersedia di [ADDING-A-TOOL.md](./ADDING-A-TOOL.md).
