# Cara membaca bukti review

Bukti di folder ini dikumpulkan pada 15 Oktober 2026 saat Antigravity sedang mengubah repository. Ini hasil snapshot, bukan verifikasi keadaan repository setelah seluruh perbaikan Antigravity selesai.

## Snapshot

- Base HEAD yang diamati: `6cc2b26`; working tree memiliki perubahan lokal.
- Backend disalin ke `%TEMP%\recon-app-review-20261015\electron` untuk menghindari perubahan selama probes.
- Renderer disalin ke folder yang sama, lalu disegarkan sekali karena salinan pertama menangkap JSX ketika sedang diedit.
- `snapshot-hashes.json` mencatat sumber setelah penyegaran renderer dan sebelum diagnostic import patch. Backend dan renderer bukan snapshot commit atomik.
- Hanya folder review/evidence yang ditambahkan ke repository oleh reviewer. Diagnostic import patch hanya ditulis di salinan TEMP.

## Typecheck dan lint

Perintah pada snapshot, menggunakan dependency yang sudah tersedia dari workspace:

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --types node --pretty false electron/main.ts electron/preload.ts
node node_modules/eslint/bin/eslint.js src electron --format json --output-file <evidence-dir>/eslint.json
```

TypeScript CLI berasal dari dependency proyek. Pemeriksaan backend kedua adalah pemeriksaan ad hoc karena konfigurasi proyek belum menyertakannya; bukan build production. Hasil disimpan di `typecheck-project.txt`, `typecheck-electron.txt`, `eslint.json`. Jumlah diagnostic dihitung dari baris `error TS` dan properti errorCount/warningCount ESLint.

`npm run build` / `npm run dist` tidak dijalankan terhadap working tree pengguna. Review tidak menimpa output `dist`/`dist-electron` milik pekerjaan aktif. Tidak ada clean-machine packaging validation atau dependency vulnerability audit penuh.

## Functional probes

```powershell
node D:/Projects/recon-app/docs/reviews/2026-10-15/evidence/reproduce.cjs <source-root>
```

Harness mentranspile service TypeScript lalu menjalankannya dengan mocked dependencies. Filesystem service, database dan Electron dimock; tidak ada scanner, command shell, network scan, provider AI atau credential pengguna yang digunakan. Hanya hasil probe ditulis ke `probe-results.json`.

Probe mengukur:

- Nuclei parser dengan JSON array compact, pretty array, dan JSONL sintetis.
- Metadata fallback untuk unknown scan dan grade terhadap empty findings.
- Secret persistence ketika secure storage tidak tersedia menggunakan secret sintetis.
- Aggregate status setelah STOPPED diikuti late FAILED.

Ini reproduksi behavior fungsi, bukan end-to-end dengan executable scanner nyata. Bila dijalankan lagi terhadap kode terbaru, hasil dapat berubah dan menimpa JSON evidence; salin terlebih dahulu bila ingin membandingkan.

## Renderer preview

Server Vite hanya memakai React dan Tailwind plugin, `configFile:false`, root salinan TEMP, host loopback port 5178. Plugin Electron tidak dijalankan. `audit-ui.cjs` memakai Playwright dengan Edge headless yang tersedia dan mock read-only `window.api`.

Snapshot asli crash pada `TerminalPane.tsx` karena `useLogStore` digunakan tanpa import. Agar layout dapat diperiksa, hanya salinan TEMP diberi import:

```ts
import { useLogStore } from '../stores/useLogStore';
```

Semua screenshot adalah **preview diagnostik setelah patch tersebut**, bukan UI asli tanpa perubahan atau bukti production readiness. Error `dimensions` masih muncul setelah patch, tercatat dalam `ui-results.json`. Tidak ada tombol Start/Install/Update/AI yang dijalankan. Server preview dihentikan setelah selesai.

Preview tidak menguji native window chrome, native IPC, SQLite ABI, scanner integration atau installer. Accessibility belum diuji dengan audit WCAG penuh. Angka terminal dan ukuran layout adalah pengukuran pada viewport yang dicatat, bukan benchmark throughput.
