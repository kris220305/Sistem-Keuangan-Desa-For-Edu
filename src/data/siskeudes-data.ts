// Master data from SISKEUDES Parameter PDFs

export interface BidangKegiatan {
  kode: string;
  nama: string;
  level: 'bidang' | 'sub_bidang' | 'kegiatan';
}

export const bidangKegiatanData: BidangKegiatan[] = [
  { kode: "01", nama: "BIDANG PENYELENGGARAN PEMERINTAHAN DESA", level: "bidang" },
  { kode: "01.01", nama: "Penyelenggaran Belanja Siltap, Tunjangan dan Operasional Pemerintahan Desa", level: "sub_bidang" },
  { kode: "01.01.01", nama: "Penyediaan Penghasilan Tetap dan Tunjangan Kepala Desa", level: "kegiatan" },
  { kode: "01.01.02", nama: "Penyediaan Penghasilan Tetap dan Tunjangan Perangkat Desa", level: "kegiatan" },
  { kode: "01.01.03", nama: "Penyediaan Jaminan Sosial bagi Kepala Desa dan Perangkat Desa", level: "kegiatan" },
  { kode: "01.01.04", nama: "Penyediaan Operasional Pemerintah Desa (ATK, Honor PKPKD dan PPKD dll)", level: "kegiatan" },
  { kode: "01.01.05", nama: "Penyediaan Tunjangan BPD", level: "kegiatan" },
  { kode: "01.01.06", nama: "Penyediaan Operasional BPD (rapat, ATK, Makan Minum, Pakaian Seragam, Listrik dll)", level: "kegiatan" },
  { kode: "01.01.07", nama: "Penyediaan Insentif/Operasional RT/RW", level: "kegiatan" },
  { kode: "01.01.08", nama: "Penyediaan Operasional Pemerintah Desa yang bersumber dari Dana Desa", level: "kegiatan" },
  { kode: "01.02", nama: "Penyediaan Sarana Prasarana Pemerintahan Desa", level: "sub_bidang" },
  { kode: "01.02.01", nama: "Penyediaan Sarana (Aset Tetap) Perkantoran/Pemerintahan", level: "kegiatan" },
  { kode: "01.02.02", nama: "Pemeliharaan Gedung/Prasarana Kantor Desa", level: "kegiatan" },
  { kode: "01.02.03", nama: "Pembangunan/Rehabilitasi/Peningkatan Gedung/Prasarana Kantor Desa", level: "kegiatan" },
  { kode: "01.03", nama: "Pengelolaan Administrasi Kependudukan, Pencatatan Sipil, Statistik dan Kearsipan", level: "sub_bidang" },
  { kode: "01.03.01", nama: "Pelayanan Administrasi Umum dan Kependudukan", level: "kegiatan" },
  { kode: "01.03.02", nama: "Penyusunan, Pendataan, dan Pemutakhiran Profil Desa", level: "kegiatan" },
  { kode: "01.03.03", nama: "Pengelolaan Adminstrasi dan Kearsipan Pemerintahan Desa", level: "kegiatan" },
  { kode: "01.04", nama: "Penyelenggaraan Tata Praja Pemerintahan, Perencanaan, Keuangan dan Pelaporan", level: "sub_bidang" },
  { kode: "01.04.01", nama: "Penyelenggaraan Musyawarah Perencanaan Desa/Pembahasan APBDes (Reguler)", level: "kegiatan" },
  { kode: "01.04.02", nama: "Penyelenggaraan Musyawaran Desa Lainnya (Musdus, rembug desa Non Reguler)", level: "kegiatan" },
  { kode: "01.04.03", nama: "Penyusunan Dokumen Perencanaan Desa (RPJMDesa/RKPDesa dll)", level: "kegiatan" },
  { kode: "01.04.04", nama: "Penyusunan Dokumen Keuangan Desa (APBDes, APBDes Perubahan, LPJ dll)", level: "kegiatan" },
  { kode: "01.05", nama: "Sub Bidang Pertanahan", level: "sub_bidang" },
  { kode: "01.05.01", nama: "Sertifikasi Tanah Kas Desa", level: "kegiatan" },
  { kode: "01.05.02", nama: "Administrasi Pertanahan (Pendaftaran Tanah dan Pemberian Registrasi Agenda Pertanahan)", level: "kegiatan" },

  { kode: "02", nama: "BIDANG PELAKSANAAN PEMBANGUNAN DESA", level: "bidang" },
  { kode: "02.01", nama: "Sub Bidang Pendidikan", level: "sub_bidang" },
  { kode: "02.01.01", nama: "Penyelenggaran PAUD/TK/TPA/TKA/TPQ/Madrasah NonFormal Milik Desa", level: "kegiatan" },
  { kode: "02.01.02", nama: "Dukungan Penyelenggaran PAUD (APE, Sarana PAUD dst)", level: "kegiatan" },
  { kode: "02.01.03", nama: "Penyuluhan dan Pelatihan Pendidikan Bagi Masyarakat", level: "kegiatan" },
  { kode: "02.02", nama: "Sub Bidang Kesehatan", level: "sub_bidang" },
  { kode: "02.02.01", nama: "Penyelenggaraan Pos Kesehatan Desa/Polindes Milik Desa", level: "kegiatan" },
  { kode: "02.02.02", nama: "Penyelenggaraan Posyandu (Mkn Tambahan, Kls Bumil, Lamsia, Insentif)", level: "kegiatan" },
  { kode: "02.03", nama: "Sub Bidang Pekerjaan Umum dan Penataan Ruang", level: "sub_bidang" },
  { kode: "02.03.01", nama: "Pemeliharaan Jalan Desa", level: "kegiatan" },
  { kode: "02.03.10", nama: "Pembangunan/Rehabilitasi/Peningkatan/Pengerasan Jalan Desa", level: "kegiatan" },
  { kode: "02.04", nama: "Sub Bidang Kawasan Pemukiman", level: "sub_bidang" },
  { kode: "02.04.01", nama: "Dukungan Pelaksanaan Program Pembangunan/Rehab Rumah Tidak Layak Huni GAKIN", level: "kegiatan" },

  { kode: "03", nama: "BIDANG PEMBINAAN KEMASYARAKATAN", level: "bidang" },
  { kode: "03.01", nama: "Sub Bidang Ketenteraman, Ketertiban Umum dan Perlindungan Masyarakat", level: "sub_bidang" },
  { kode: "03.01.01", nama: "Pengadaan/Penyelenggaran Pos Keamanan Desa", level: "kegiatan" },
  { kode: "03.02", nama: "Sub Bidang Kebudayaan dan Keagamaan", level: "sub_bidang" },
  { kode: "03.02.01", nama: "Pembinaan Group Kesenian dan Kebudayaan Tingkat Desa", level: "kegiatan" },
  { kode: "03.03", nama: "Sub Bidang Kepemudaan dan Olahraga", level: "sub_bidang" },
  { kode: "03.03.01", nama: "Pengiriman Kontingen Kepemudaan & Olahraga Sebagai Wakil Desa", level: "kegiatan" },
  { kode: "03.04", nama: "Sub Bidang Kelembagaan Masyarakat", level: "sub_bidang" },
  { kode: "03.04.01", nama: "Pembinaan Lembaga Adat", level: "kegiatan" },
  { kode: "03.04.03", nama: "Pembinaan PKK", level: "kegiatan" },

  { kode: "04", nama: "BIDANG PEMBERDAYAAN MASYARAKAT", level: "bidang" },
  { kode: "04.01", nama: "Sub Bidang Kelautan dan Perikanan", level: "sub_bidang" },
  { kode: "04.01.01", nama: "Pemeliharaan Karamba/Kolam Perikanan Darat Milik Desa", level: "kegiatan" },
  { kode: "04.02", nama: "Sub Bidang Pertanian dan Peternakan", level: "sub_bidang" },
  { kode: "04.02.01", nama: "Peningkatan Produksi Tanaman Pangan", level: "kegiatan" },
  { kode: "04.03", nama: "Sub Bidang Peningkatan Kapasitas Aparatur Desa", level: "sub_bidang" },
  { kode: "04.03.01", nama: "Peningkatan Kapasitas Kepala Desa", level: "kegiatan" },
  { kode: "04.05", nama: "Sub Bidang Koperasi, Usaha Micro Kecil dan Menengah (UMKM)", level: "sub_bidang" },
  { kode: "04.05.01", nama: "Pelatihan Manajemen Koperasi/KUD/UMKM", level: "kegiatan" },

  { kode: "05", nama: "BIDANG PENANGGULANGAN BENCANA, DARURAT DAN MENDESAK DESA", level: "bidang" },
  { kode: "05.01", nama: "Sub Bidang Penanggulangan Bencana", level: "sub_bidang" },
  { kode: "05.01.00", nama: "Kegiatan Penanggulangan Bencana", level: "kegiatan" },
  { kode: "05.02", nama: "Sub Bidang Keadaan Darurat", level: "sub_bidang" },
  { kode: "05.02.00", nama: "Penanganan Keadaan Darurat", level: "kegiatan" },
  { kode: "05.03", nama: "Sub Bidang Keadaan Mendesak", level: "sub_bidang" },
  { kode: "05.03.00", nama: "Penanganan Keadaan Mendesak", level: "kegiatan" },
];

export interface SumberDana {
  kode: string;
  nama: string;
}

export const sumberDanaData: SumberDana[] = [
  { kode: "PAD", nama: "Pendapatan Asli Desa" },
  { kode: "ADD", nama: "Alokasi Dana Desa" },
  { kode: "DDS", nama: "Dana Desa (APBN)" },
  { kode: "PBH", nama: "Penerimaan Bagi Hasil Pajak Retribusi" },
  { kode: "PBK", nama: "Penerimaan Bantuan Kab/Kota" },
  { kode: "PBP", nama: "Penerimaan Bantuan Provinsi" },
  { kode: "SWD", nama: "Swadaya Masyarakat" },
  { kode: "DLL", nama: "Pendapatan Lain Lain" },
];

export interface OutputKegiatan {
  kodeKegiatan: string;
  kodeOutput: string;
  uraianOutput: string;
  satuanOutput: string;
}

export const outputKegiatanData: OutputKegiatan[] = [
  { kodeKegiatan: "01.01.01", kodeOutput: "110101", uraianOutput: "Penghasilan Tetap Kepala Desa", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.01", kodeOutput: "110102", uraianOutput: "Tunjangan Kepala Desa", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.02", kodeOutput: "110201", uraianOutput: "Penghasilan Tetap Perangkat Desa", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.02", kodeOutput: "110202", uraianOutput: "Tunjangan Perangkat Desa", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.03", kodeOutput: "110301", uraianOutput: "Jaminan Sosial Kepala Desa", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.03", kodeOutput: "110302", uraianOutput: "Jaminan Sosial Perangkat Desa", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.04", kodeOutput: "110401", uraianOutput: "Operasional Pemerintah Desa", satuanOutput: "Paket" },
  { kodeKegiatan: "01.01.05", kodeOutput: "110501", uraianOutput: "Tunjangan BPD", satuanOutput: "OB (Orang/Bulan)" },
  { kodeKegiatan: "01.01.06", kodeOutput: "110601", uraianOutput: "Operasional BPD", satuanOutput: "Paket" },
  { kodeKegiatan: "01.01.07", kodeOutput: "110701", uraianOutput: "Operasional RT/RW", satuanOutput: "Paket" },
  { kodeKegiatan: "01.02.01", kodeOutput: "120101", uraianOutput: "Kendaraan Roda 4", satuanOutput: "Unit" },
  { kodeKegiatan: "01.02.01", kodeOutput: "120102", uraianOutput: "Kendaraan Roda 3", satuanOutput: "Unit" },
  { kodeKegiatan: "01.02.01", kodeOutput: "120103", uraianOutput: "Kendaraan Roda 2", satuanOutput: "Unit" },
  { kodeKegiatan: "01.02.01", kodeOutput: "120104", uraianOutput: "Meubelair", satuanOutput: "Unit" },
];

export interface DesaProfile {
  namaDesa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kepalaDesaNama: string;
  kepalaDesaNIP: string;
  sekretarisNama: string;
  sekretarisNIP: string;
  bendaharaNama: string;
  bendaharaNIP: string;
  npwpDesa: string;
  tahunAnggaran: string;
  alamatKantor: string;
  kodePos: string;
}

export const defaultDesaProfile: DesaProfile = {
  namaDesa: "",
  kecamatan: "",
  kabupaten: "PEMERINTAH KABUPATEN SIMULASI",
  provinsi: "PROVINSI SIMULASI",
  kepalaDesaNama: "",
  kepalaDesaNIP: "",
  sekretarisNama: "",
  sekretarisNIP: "",
  bendaharaNama: "",
  bendaharaNIP: "",
  npwpDesa: "",
  tahunAnggaran: "2024",
  alamatKantor: "",
  kodePos: "",
};

export interface KegiatanAnggaran {
  id: string;
  kodeBidang: string;
  kodeSubBidang: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  waktuPelaksanaan: string;
  namaPelaksana: string;
  jabatanPelaksana: string;
  keluaran: string;
  volumeKeluaran: string;
  sumberDana: string;
  paguAnggaran: number;
  outputItems: OutputItem[];
}

export interface OutputItem {
  id: string;
  namaPaket: string;
  nilai: number;
  targetOutput: string;
  satuan: string;
  sumberDana: string;
  keterangan: string;
}
