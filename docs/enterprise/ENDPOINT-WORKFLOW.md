# Endpoint Inventory, pengujian endpoint, dan retest

Implementasi 17 Oktober 2026, melanjutkan integrasi SQLmap/Nikto. Perubahan aplikasi yang sudah ada dipertahankan; tidak ada scan jaringan atau instalasi upstream saat pengembangan.

## Alur penggunaan

1. Jalankan discovery **Katana, GAU, atau Arjun** dari Dashboard. Saat proses selesai, hasil diimpor ke Endpoint Inventory. Pada scan baru, observasi ketiga engine ini tidak lagi dimasukkan sebagai vulnerability. Raw artifact tetap tersedia di folder scan.
2. Buka **Endpoint Inventory** di sidebar. Pilih source scan, cari URL, dan lihat method, parameter, sumber penemuan, serta status origin. Data dipaginasi 50 endpoint per halaman.
3. Pilih **Test SQLi** atau **Test server**. Dashboard menyiapkan URL, engine, origin dan parameter, beserta tautan sumber. Ini menyiapkan draft; request baru dikirim sesudah **Start Scan**. Nikto menguji seluruh origin, bukan hanya path endpoint.
4. Untuk parameter tersembunyi hasil Arjun yang belum memiliki nilai, isi nilai contoh pada URL sebelum Start Scan. Parameter boleh dipilih/dibatasi melalui panel Active Testing. Nilai kosong untuk parameter yang dipilih ditolak pada workflow ini.
5. Buka Findings dari scan pengujian. Klik **Retest** pada temuan SQLmap/Nikto yang tersimpan. Engine, URL, serta parameter asli akan disiapkan; backend menolak penggantian identitas pengujian tersebut.
6. Di Endpoint Inventory, pilih scan sumber untuk melihat **Linked tests & retests**, lalu buka findings dari run yang ditautkan. Metadata lineage juga disertakan dalam report HTML, Markdown, dan JSON.

## Makna hasil retest

| Hasil | Makna |
|---|---|
| observed | Temuan terkait masih terlihat pada hasil retest yang selesai valid. |
| not-observed | Temuan terkait tidak terlihat dalam pengujian ini; bukan keputusan fixed atau bukti seluruh aplikasi aman. |
| inconclusive | Run gagal/dibatalkan/tidak valid, sumber tidak tersedia, atau metadata runtime berbeda/tidak tersedia. |
| running | Pengujian masih berlangsung. |

Retest tidak mengubah keputusan triage lama. Perbandingan memakai identitas scanner + URL + parameter SQLmap atau check ID Nikto. Hash script dan path interpreter juga dibandingkan. Ini belum mencakup hash seluruh dependency, binary interpreter, plugin, database signature, maupun konteks autentikasi; analis tetap harus menilai kesetaraan coverage.

## Penyimpanan dan pemeriksaan backend

- Migration v5 menambah tabel `endpoints`, tanpa menulis ulang migration lama atau menghapus findings lama.
- Identitas endpoint adalah source scan + method + URL. Fragment dibuang; casing path, query values, dan urutan query dipertahankan. Observasi identik menggabungkan sumber/parameter.
- Scope tahap ini adalah **origin persis source scan**: scheme, hostname, dan port. URL di luar origin tetap dapat ditinjau di inventory, tetapi tombol pengujiannya dinonaktifkan dan backend menolak peluncuran terkait. Ini bukan network sandbox atau engagement allowlist global.
- Pengujian endpoint/retest menjalankan satu engine per run. Backend memvalidasi kepemilikan endpoint/finding terhadap source scan; URL, engine, dan parameter tidak dipercaya hanya karena dikirim UI.
- URL berisi kredensial ditolak. Header autentikasi dari output Arjun tidak diimpor. Query values dan raw artifact tetap dapat mengandung data sensitif; kebijakan redaksi global belum termasuk sprint ini.
- Pembacaan artifact dibatasi 20 MB. Record rusak ditandai gagal/incomplete; record valid yang sempat dibaca dipertahankan di inventory. Output discovery yang hilang tidak dianggap hasil bersih.
- Penghapusan scan juga menghapus inventory miliknya. Child scan yang sudah dibuat tetap memiliki metadata sumber; sumber yang kemudian dihapus tidak boleh menghasilkan verdict retest yang pasti.

## Batas implementasi

- Inventory terkelompok per scan, belum per project/engagement.
- Artifact scan lama tidak otomatis diimpor. Untuk mengisi inventory jalankan discovery baru. Findings historis tetap utuh.
- GAU menunjukkan URL historis dan method GET yang diasumsikan, bukan bukti endpoint masih hidup.
- Method selain GET dapat disimpan untuk ditinjau, tetapi pengujian dari inventory saat ini hanya GET. Belum ada body POST/JSON, authenticated session, bulk dispatch, maupun chaining seluruh crawler ke seluruh scanner otomatis.
- Retest otomatis tersedia untuk SQLmap/Nikto; tombol tool lain dinonaktifkan dengan penjelasan. Parameter manual di luar workflow inventory tetap mengikuti konfigurasi Active Testing yang sudah ada.
- Draft tidak dipersist lintas restart, sedangkan inventory dan hubungan run yang sudah diluncurkan tersimpan di SQLite/metadata. Batas tampilan hubungan adalah 100 run terbaru per source scan.

## Verifikasi

- Suite regresi: **105 tes lulus** (termasuk 4 tes workflow baru dengan beberapa skenario masing-masing).
- Migrasi dari schema lama, deduplikasi, method/scope, parameter tersembunyi, seluruh URL GAU, penolakan referensi palsu, penghapusan inventory, dan parser malformed diuji.
- Fake-process integration membuktikan discovery → inventory → SQLmap → retest positif/negatif/gagal/runtime berubah, persistensi database serta metadata report. Tidak ada HTTP request dari fixture.
- Renderer Playwright pada 1366×768 menggunakan IPC mock menguji pemilihan endpoint, out-of-scope disabled, draft, Start Scan dan retest dari finding tersimpan; tidak ada page error.
- TypeScript dan lint file baru lulus. Bukti tersimpan di `endpoint-workflow-evidence/`.

Kontrak Arjun ditinjau dari [exporter upstream](https://github.com/s0md3v/Arjun/blob/master/arjun/core/exporter.py). Kompatibilitas terhadap binary discovery upstream sungguhan belum diuji pada lab dalam sprint ini.
