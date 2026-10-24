# Menambah tool scanner

Dokumen ini adalah checklist integrasi tool baru. Penambahan tool **bukan** fitur runtime dan tidak dilakukan lewat tombol “Add Tool”. Katalog bersifat fail-closed: tool yang tidak punya manifest, adapter, dan registrasi UI akan ditolak oleh runner.

## Prinsip

1. Tool hanya boleh dijalankan jika ada manifest di katalog dan adapter di registry.
2. Jangan memakai shell string. Semua argumen harus berupa array dan target tetap diperlakukan sebagai data.
3. Parser tidak boleh mengubah output kosong, terpotong, atau malformed menjadi “clean”. Jika hasil tidak konklusif, lempar error agar scan berstatus `FAILED`/inconclusive.
4. Jangan menambahkan tool hanya untuk memperbanyak pilihan. Utamakan tool yang menutup celah coverage dan sudah diuji di lab.
5. Versi, sumber, dan checksum harus dapat diaudit. Jangan mengikuti branch upstream secara diam-diam.

## File yang harus diubah

### 1. Manifest katalog

`electron/services/catalog/manifests.ts`

Tambahkan entri ke `TOOL_MANIFESTS` dengan `id` yang sama di semua lapisan. Field penting:

- `displayName`, `category`, `description`
- `capabilities` dan `acceptedTargetTypes` — menentukan validasi target.
- `outputTypes`, `runtime`, `executionMode`
- `versionFlag`, `supportedOs`
- `installStrategy` — `github-release`, `pip`, `git-clone`, `docker`, `system-manual`, atau `built-in`.
- `exitCodeSemantics` — kode sukses dan kode “findings found”.
- `defaultTimeoutMs`
- `sourceUrl`, `pinnedVersion`, `checksumSha256` bila tersedia.
- `smokeArgs` / `smokeExpectedExitCode` untuk preflight.
- `requiresExplicitSelection` untuk tool aktif/destruktif.

Jika tool membutuhkan path atau setting khusus, tambahkan field di `electron/services/settings.ts` beserta default dan masking bila nilainya sensitif.

### 2. Adapter scanner

`electron/services/scanners/registry.ts` — tambahkan ke `ScannerAdapters`.
Untuk tool active validation, implementasi dapat ditaruh di `electron/services/scanners/activeValidation.ts` lalu otomatis di-spread ke registry.

Adapter minimal mengimplementasikan:

```ts
interface IScannerAdapter {
  getCommandArgs(ctx: ScannerContext): string[];
  getEnv?(ctx: ScannerContext, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  getProcessOptions?(ctx: ScannerContext, opts: ProcessOptions): ProcessOptions;
  handleStdin?(ctx: ScannerContext, proc: ChildProcess): void;
  processStdout?(ctx: ScannerContext, msg: string, stats: Stats): void;
  parseFindings?(ctx: ScannerContext): Record<string, unknown>[];
  isSuccessExitCode?(code: number | null, ctx?: ScannerContext): boolean;
}
```

Aturan implementasi:

- Gunakan `ctx.outputFile`, `ctx.jsonFile`, atau `ctx.xmlFile` sesuai output tool; jangan menulis ke path arbitrer.
- Hormati `ctx.config` dan scope/parameter yang sudah divalidasi runner.
- Jangan pernah menambahkan flag interaktif, shell, atau eksekusi perintah bebas.
- Redaksi secret di log dan evidence.
- `parseFindings` harus memvalidasi skema output dan melempar error yang jelas bila output tidak lengkap.
- Pastikan `isSuccessExitCode` konsisten dengan `exitCodeSemantics` di manifest.

### 3. Validasi runner

Biasanya tidak perlu perubahan. `electron/services/scanner.ts` sudah:

- menolak tool yang tidak ada di katalog,
- menolak tool tanpa adapter (`hasAdapter`),
- memvalidasi target dan konfigurasi active testing.

Ubah hanya jika tool memerlukan aturan target/parameter baru. Jangan melemahkan validasi yang ada.

### 4. Registrasi frontend

Tool harus muncul dan bisa dipilih:

- `src/stores/useScanStore.ts`
  - tambahkan id ke union `ScannerType`,
  - tambahkan ke `allTools`,
  - tambahkan ke `initialScannerStatus`.
- `src/pages/Dashboard.tsx`
  - tambahkan ke array `tabs`,
  - masukkan ke kategori yang sesuai di `toolCategories`.
- `src/components/ToolSelection.tsx`
  - tambahkan ke `TOOL_CATEGORIES`,
  - tambahkan ke profil scan yang relevan di `SCAN_PROFILES` bila aman sebagai default.

Jangan menambahkan tool aktif/berisiko ke profil default. Ikuti pola `requiresExplicitSelection`.

### 5. Instalasi dan preflight

Installer dan dependency manager membaca manifest, jadi tidak ada daftar tool terpisah yang perlu diedit. Namun pastikan:

- `installStrategy` benar untuk OS target,
- `versionFlag` dapat dijalankan tanpa interaksi,
- `smokeArgs` aman dan tidak memindai target nyata,
- path hasil instalasi dapat diselesaikan oleh `ToolManager`,
- kegagalan instalasi tidak menimpa instalasi lama.

### 6. Test dan fixture

Tambahkan test yang minimal mencakup:

- manifest valid dan id konsisten,
- adapter terdaftar (`hasAdapter`),
- pembentukan argumen tanpa shell,
- output sukses dengan findings,
- output sukses tanpa findings (negatif),
- output kosong/terpotong/malformed harus gagal,
- exit code semantics,
- redaksi secret,
- penolakan target di luar scope atau tipe target yang salah.

Simpan fixture output asli yang sudah disanitasi di `tests/` atau lokasi fixture yang sudah dipakai proyek. Jangan memakai output palsu yang tidak mewakili bentuk upstream.

### 7. Dokumentasi

- Perbarui `docs/enterprise/TOOL-INSTALLATION.md` dengan hasil instalasi/versi.
- Tambahkan catatan di `CHANGELOG.md`.
- Jelaskan batasan tool dan bukti yang dihasilkan.
- Jika tool menghasilkan finding, pastikan CWE, severity, evidence, dan remediation konsisten dengan tool lain.

## Verifikasi wajib

```powershell
npx tsc -b
npx eslint . --quiet
npm test
npm run build
```

Semua harus lulus. Untuk perubahan runtime, lakukan juga smoke test pada build packaged dengan sandbox aktif dan uji preflight di mesin bersih bila memungkinkan.

## Yang perlu diputuskan sebelum implementasi

Sebutkan:

1. Nama tool dan URL upstream resmi.
2. Tipe target: URL, domain, IP/CIDR, direktori source, repository, container image, atau API.
3. Tujuan coverage: apa yang belum dicakup tool yang sudah ada?
4. Mode: pasif, aktif dengan pemilihan eksplisit, atau manual.
5. Strategi instalasi dan lisensi.
6. Bentuk output dan apakah parser-nya deterministik.
