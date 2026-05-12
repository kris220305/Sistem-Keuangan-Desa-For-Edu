# BKU v2 — BKU Utama, BKU Tunai, BKU Bank

Dokumen ini menjelaskan perubahan format laporan **Laporan Keuangan → BKU** agar mendukung 3 jenis BKU: **Utama**, **Tunai**, dan **Bank**.

## 1) Struktur Tabel (Kolom Wajib)

Semua jenis BKU memakai template tabel yang sama, dengan kolom wajib:
- Tanggal
- Kode Rekening
- Uraian
- Penerimaan
- Pengeluaran
- Saldo

Kolom tambahan (tetap ditampilkan):
- No Bukti

## 2) Definisi Jenis BKU

### A. BKU Utama (Reguler/Utama)
- Memuat seluruh transaksi kas **tunai + bank** dalam satu buku.
- Mutasi internal **tunai ↔ bank** dicatat sebagai:
  - Penerimaan = jumlah
  - Pengeluaran = jumlah
  - Tidak mengubah saldo (netto 0)

### B. BKU Tunai
- Hanya memuat transaksi yang berdampak ke kas tunai.
- Mutasi internal:
  - Setor Tunai → Bank = Pengeluaran (mengurangi saldo tunai)
  - Ambil Bank → Tunai = Penerimaan (menambah saldo tunai)

### C. BKU Bank
- Hanya memuat transaksi yang berdampak ke kas bank.
- Mutasi internal:
  - Setor Tunai → Bank = Penerimaan (menambah saldo bank)
  - Ambil Bank → Tunai = Pengeluaran (mengurangi saldo bank)

## 3) Sumber Transaksi yang Ditampilkan

### Penerimaan (TBP)
- Masuk ke BKU Utama.
- Masuk ke BKU Tunai jika `jenis = "tunai"`.
- Masuk ke BKU Bank jika `jenis = "bank"`.

### Pengeluaran (Pencairan SPP)
- Masuk ke BKU Utama.
- Masuk ke BKU Tunai jika `pembayaran = "tunai"`.
- Masuk ke BKU Bank jika `pembayaran = "bank"`.

### Potongan Pajak (dari Bukti Transaksi SPP)
- Dicatat sebagai penerimaan pada jenis buku yang sama dengan `pembayaran` pencairan SPP.

### Mutasi Kas (Tunai ↔ Bank)
- `jenis = "setor" | "ambil"`: selalu masuk, sesuai aturan di atas.
- `jenis = "masuk" | "keluar"`:
  - Masuk ke BKU Utama & BKU Tunai saja (bukan BKU Bank),
  - Tidak ditampilkan jika item mutasi mereferensikan `sumberPenerimaanIds` (untuk mencegah duplikasi terhadap TBP).

## 4) Perhitungan Saldo Per Baris

- Setiap sheet selalu memiliki baris pertama: **Saldo Sebelumnya** pada tanggal awal periode.
- Saldo berjalan dihitung otomatis per baris:
  - `saldo(i) = saldo(i-1) + penerimaan(i) - pengeluaran(i)`

## 5) Filter

### Periode
- Jika periode kosong, sistem memakai default **01/01 s.d 31/12** tahun anggaran.
- Saldo awal periode dihitung dari saldo awal + transaksi sebelum tanggal awal periode (untuk jenis buku terkait).

### Unit Kerja
- Saat ini unit kerja bersifat **label** untuk keperluan tampilan dan penamaan file.
- Filter unit kerja belum memecah transaksi karena struktur data transaksi belum memiliki field unit organisasi yang konsisten.

## 6) Validasi & Pengecualian

### Saldo Minus
- Jika saldo menjadi minus, baris diberi flag dan ditandai warna merah pada tampilan.

### Transaksi “Belakang Tanggal” (Backdated)
- Transaksi dengan tanggal < awal tahun anggaran diabaikan dan muncul sebagai peringatan.
- Tanggal tidak valid (bukan format `YYYY-MM-DD`) diabaikan dan muncul sebagai peringatan.
- Nilai negatif diabaikan dan muncul sebagai peringatan.

## 7) Export

### PDF
- Export menggunakan snapshot area sheet (per jenis).
- Nama file: `BKU_<JENIS>_<UNIT>_<PERIODE>.pdf`

### Excel (.xlsx)
- Export 1 sheet per jenis yang aktif.
- Nama file: `BKU_<JENIS>_<UNIT>_<PERIODE>.xlsx`

## 8) Release Notes (Untuk User Akhir)

1. BKU sekarang memiliki 3 pilihan: **Utama**, **Tunai**, dan **Bank**.
2. Saldo dihitung otomatis per baris untuk tiap jenis buku.
3. Mutasi tunai ↔ bank tidak lagi “membingungkan”:
   - BKU Utama mencatat mutasi sebagai penerimaan & pengeluaran yang sama (saldo tidak berubah).
   - BKU Tunai/Bank mencatat mutasi sebagai perubahan saldo sesuai buku masing-masing.
4. Ada peringatan untuk transaksi tanggal tidak valid, backdated sebelum tahun anggaran, dan nilai negatif.
5. Bisa export PDF & Excel dengan nama file otomatis sesuai jenis/unit/periode.

## 9) Merge Deterministik (Mode Kelompok)

Saat mode kelompok, state gabungan memakai metadata per-entitas `__meta` berisi `{ v, t, by }`.

- Bandingkan `v` (version). Nilai lebih besar menang.
- Jika `v` sama, bandingkan `t` (Lamport clock). Nilai lebih besar menang.
- Jika `v` dan `t` sama, bandingkan `by` (sessionId) dengan `localeCompare()` supaya hasilnya konsisten di semua node.
