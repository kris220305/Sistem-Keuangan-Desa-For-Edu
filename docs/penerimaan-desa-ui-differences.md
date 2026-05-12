# Dokumentasi Perbedaan UI/UX Penerimaan Desa

Dokumen ini menjelaskan perubahan desain agar tampilan **orisinal** dan tidak terlalu identik dengan referensi UI klasik.

## Perubahan Tema Visual (Warna)

### Header
- Sebelumnya: gradien hijau dominan (contoh: `#1c7f1c` → `#67b567` → `#d7f1d7`)
- Sekarang: gradien hijau modern (contoh: `#166534` → `#22c55e` → `#bbf7d0`)

### Latar & Card
- Sebelumnya: latar abu klasik (contoh: `#dcdcdc`, `#efefef`)
- Sekarang: latar hijau muda lembut (contoh: `#f3fbf4`) + card putih (`#ffffff`) dengan border hijau lembut (`#b7e4c7`)

### Sidebar
- Sebelumnya: gradasi kuning–hijau (contoh: `#f3d77f` → `#d8f0a5`)
- Sekarang: sidebar terang hijau-putih (contoh: `#d1fae5` → `#ecfdf5` → `#ffffff`) dengan aksen hijau (`#166534`)

## Perubahan Tata Letak & Pola Interaksi

### Navigasi
- Sebelumnya: tombol menu bergaya panel klasik, tanpa ikon.
- Sekarang: menu sidebar modern dengan ikon (`Layers`, `Banknote`, `Landmark`) dan tombol rounded.

### Sub-tab TBP vs Rincian
- Sebelumnya: tab vertikal dengan writing-mode (mirip UI desktop klasik).
- Sekarang: segmented control horizontal dengan tombol dan ikon (`List`, `Layers`).

### Tombol Aksi
- Sebelumnya: tombol kotak-kaku bernuansa panel.
- Sekarang: tombol modern dengan ikon (`Plus`, `Pencil`, `Trash2`, `Save`, `DoorOpen`) dan tinggi konsisten.

## Tipografi & Spacing

- Ukuran teks tabel: dari ~11px menjadi 12px (lebih terbaca).
- Spacing: dari `p-3`/panel rapat menjadi layout `p-4` dengan gap konsisten `gap-4`.
- Komponen input: tinggi dari ~28px menjadi ~36px (lebih ramah sentuh / mobile).

## Komponen Interaktif & Smart Form

- Terbilang otomatis: angka → terbilang rupiah.
- Auto-complete: nama/alamat/ttd, serta field bank (rekening/nama bank/kppn) berbasis histori.
- Validasi real-time: border merah + panel ringkas error (tanpa mengubah logika data).
- Rincian rekening: searchable combobox untuk kode rekening pendapatan.

## Catatan Kepatuhan Kemiripan

- Skema warna, bentuk komponen (rounded), struktur navigasi, dan gaya tombol sudah diganti sehingga tidak menyerupai UI referensi klasik secara visual.
- Struktur kerja (daftar transaksi → detail → rincian) tetap dipertahankan karena merupakan pola umum aplikasi akuntansi dan dibutuhkan untuk usability.
