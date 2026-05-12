// Demo seed data based on "KK Penatausahaan Keuangan Desa" Excel soal
// Desa Arfai - Tahun Anggaran 2024
import { type AppState } from "./app-state";

export function getDemoSeedData(): AppState {
  return {
    // ============ SALDO AWAL ============
    // Soal #1: Saldo kas desa tahun lalu Rp42.000.000 (di bank)
    saldoAwal: [
      {
        id: "demo-sa-001",
        kodeRekening: "1.1.1.02",
        namaRekening: "Bank",
        debet: 42000000,
        kredit: 0,
      },
    ],

    // ============ PENDAPATAN ============
    // Soal #2: Bagi Hasil BUMDes Seroja Rp15.000.000
    // Soal #5: Dana Desa Tahap I Rp380.000.000
    // Soal #14: Dana Desa Tahap II Rp380.000.000
    pendapatan: [
      {
        id: "demo-pd-001",
        kodeRekening: "4.1.4",
        namaRekening: "Bagi Hasil Usaha Desa/BUMDes",
        uraian: "Bagi Hasil BUMDes Seroja",
        anggaran: 15000000,
        perubahanAnggaran: 0,
        sumberDana: "PAD",
        jumlahSatuan: "1",
        hargaSatuan: 15000000,
      },
      {
        id: "demo-pd-002",
        kodeRekening: "4.2.1",
        namaRekening: "Dana Desa",
        uraian: "Dana Desa Tahap I",
        anggaran: 380000000,
        perubahanAnggaran: 0,
        sumberDana: "DDS",
        jumlahSatuan: "1",
        hargaSatuan: 380000000,
      },
      {
        id: "demo-pd-003",
        kodeRekening: "4.2.1",
        namaRekening: "Dana Desa",
        uraian: "Dana Desa Tahap II",
        anggaran: 380000000,
        perubahanAnggaran: 0,
        sumberDana: "DDS",
        jumlahSatuan: "1",
        hargaSatuan: 380000000,
      },
    ],

    // ============ BELANJA ============
    // Soal #6: Gaji Kepala Desa Rp10.000.000
    // Soal #9-11: Belanja Gedung PAUD (material) total Rp29.776.000
    belanja: [
      {
        id: "demo-bl-001",
        kodeBidang: "01",
        kodeKegiatan: "01.01.01",
        namaKegiatan: "Penyelenggaraan Belanja Siltap",
        kodeRekening: "5.1.1",
        namaRekening: "Belanja Pegawai - Penghasilan Tetap",
        nomorUrut: "1",
        uraian: "Gaji Kepala Desa",
        anggaran: 10000000,
        perubahanAnggaran: 0,
        jumlahSatuan: "1",
        hargaSatuan: 10000000,
        sumberDana: "DDS",
      },
      {
        id: "demo-bl-002",
        kodeBidang: "02",
        kodeKegiatan: "02.01.06",
        namaKegiatan: "Pembangunan Gedung PAUD Dusun Mawar",
        kodeRekening: "5.3.1",
        namaRekening: "Belanja Modal - Gedung dan Bangunan",
        nomorUrut: "1",
        uraian: "Pembelian besi cor 10mm, 12mm, 6mm, kayu usuk, papan sirap, paku usuk, kawat bendrat",
        anggaran: 13351000,
        perubahanAnggaran: 0,
        jumlahSatuan: "1",
        hargaSatuan: 13351000,
        sumberDana: "DDS",
      },
      {
        id: "demo-bl-003",
        kodeBidang: "02",
        kodeKegiatan: "02.01.06",
        namaKegiatan: "Pembangunan Gedung PAUD Dusun Mawar",
        kodeRekening: "5.3.1",
        namaRekening: "Belanja Modal - Gedung dan Bangunan",
        nomorUrut: "2",
        uraian: "Pembelian 20 m3 pasir dan 4 pick up koral",
        anggaran: 8800000,
        perubahanAnggaran: 0,
        jumlahSatuan: "1",
        hargaSatuan: 8800000,
        sumberDana: "DDS",
      },
      {
        id: "demo-bl-004",
        kodeBidang: "02",
        kodeKegiatan: "02.01.06",
        namaKegiatan: "Pembangunan Gedung PAUD Dusun Mawar",
        kodeRekening: "5.3.1",
        namaRekening: "Belanja Modal - Gedung dan Bangunan",
        nomorUrut: "3",
        uraian: "Pembelian 85 zak semen dan 8 pick up bata",
        anggaran: 7625000,
        perubahanAnggaran: 0,
        jumlahSatuan: "1",
        hargaSatuan: 7625000,
        sumberDana: "DDS",
      },
    ],

    // ============ PEMBIAYAAN ============
    // Soal #15-16: Penyertaan Modal BUM Desa Mina Martani Rp40.000.000
    pembiayaan: [
      {
        id: "demo-pb-001",
        jenis: "pengeluaran",
        kodeRekening: "6.2.1",
        namaRekening: "Penyertaan Modal Desa pada BUM Desa",
        uraian: "Penyertaan Modal BUM Desa Mina Martani",
        anggaran: 40000000,
        perubahanAnggaran: 0,
        jumlahSatuan: "1",
        hargaSatuan: 40000000,
        sumberDana: "DDS",
      },
    ],

    // ============ PENERIMAAN ============
    // Soal #2: Bagi Hasil BUMDes tunai Rp15.000.000
    // Soal #5: Dana Desa Tahap I Rp380.000.000 (bank)
    // Soal #14: Dana Desa Tahap II Rp380.000.000 (bank)
    penerimaan: [
      {
        id: "demo-pn-001",
        jenis: "tunai",
        tanggal: "2024-01-06",
        noBukti: "0001/TBP/05.2001/2024",
        uraian: "Penerimaan Bagi Hasil BUMDes Seroja",
        jumlah: 15000000,
        kodeRekening: "4.1.4",
        namaRekening: "Bagi Hasil Usaha Desa/BUMDes",
        penyetor: "BUMDes Seroja",
        nama: "Nazah",
        alamat: "Desa Arfai",
        ttd: "Nazah",
        rincian: [
          {
            id: "demo-pnr-001",
            kodeRekening: "4.1.4",
            namaRekening: "Bagi Hasil Usaha Desa/BUMDes",
            sumberDana: "PAD",
            nilai: 15000000,
          },
        ],
        isProses: true,
      },
      {
        id: "demo-pn-002",
        jenis: "bank",
        tanggal: "2024-03-13",
        noBukti: "0002/TBP/05.2001/2024",
        uraian: "Penerimaan Dana Desa Tahap I",
        jumlah: 380000000,
        kodeRekening: "4.2.1",
        namaRekening: "Dana Desa",
        penyetor: "KPPN",
        nama: "Yunduma",
        alamat: "KPPN",
        ttd: "Yunduma",
        rekening: "Rek Desa Arfai",
        namaBank: "Bank Papua",
        rincian: [
          {
            id: "demo-pnr-002",
            kodeRekening: "4.2.1",
            namaRekening: "Dana Desa",
            sumberDana: "DDS",
            nilai: 380000000,
          },
        ],
        isProses: true,
      },
      {
        id: "demo-pn-003",
        jenis: "bank",
        tanggal: "2024-05-26",
        noBukti: "0003/TBP/05.2001/2024",
        uraian: "Penerimaan Dana Desa Tahap II",
        jumlah: 380000000,
        kodeRekening: "4.2.1",
        namaRekening: "Dana Desa",
        penyetor: "KPPN",
        nama: "KPPN",
        alamat: "KPPN",
        ttd: "KPPN",
        rekening: "Rek Desa Arfai",
        namaBank: "Bank Papua",
        rincian: [
          {
            id: "demo-pnr-003",
            kodeRekening: "4.2.1",
            namaRekening: "Dana Desa",
            sumberDana: "DDS",
            nilai: 380000000,
          },
        ],
        isProses: true,
      },
    ],

    // ============ SPP ============
    // Soal #6: SPP Definitif - Gaji Kepala Desa Rp10.000.000
    // Soal #7: SPP Panjar - Pembangunan Gedung PAUD Rp30.776.000
    // Soal #16: SPP Pembiayaan - Penyertaan Modal BUM Desa Rp40.000.000
    spp: [
      {
        id: "demo-spp-001",
        jenis: "definitif",
        tanggalSPP: "2024-03-23",
        nomorSPP: "0001/SPP/05.2001/2024",
        uraian: "Membayar gaji Kepala Desa",
        jumlah: 10000000,
        isFinal: true,
        rincian: [
          {
            id: "demo-sppr-001",
            kodeRekening: "5.1.1",
            namaRekening: "Belanja Pegawai - Penghasilan Tetap",
            nilai: 10000000,
          },
        ],
        buktiTransaksi: [
          {
            id: "demo-bt-001",
            tanggal: "2024-03-23",
            noBukti: "0001/KW/05.2001/2024",
            keterangan: "Pembayaran gaji Kepala Desa",
            jumlah: 10000000,
            penerima: "Kepala Desa",
            nama: "Kepala Desa Arfai",
            alamat: "Desa Arfai",
            potonganPajak: [],
          },
        ],
      },
      {
        id: "demo-spp-002",
        jenis: "panjar",
        tanggalSPP: "2024-03-27",
        nomorSPP: "0002/SPP/05.2001/2024",
        uraian: "Panjar Kegiatan Pembangunan Gedung PAUD Dusun Mawar",
        jumlah: 30776000,
        isFinal: true,
        rincian: [
          {
            id: "demo-sppr-002",
            kodeRekening: "5.3.1",
            namaRekening: "Belanja Modal - Gedung dan Bangunan",
            nilai: 30776000,
          },
        ],
        buktiTransaksi: [
          {
            id: "demo-bt-002",
            tanggal: "2024-03-27",
            noBukti: "0002/KW/05.2001/2024",
            keterangan: "Pembelian besi cor, kayu usuk, papan sirap, paku, kawat bendrat",
            jumlah: 13351000,
            penerima: "Toko Material",
            nama: "Toko Material",
            alamat: "Desa Arfai",
            potonganPajak: [
              { kodeRekening: "7.1.1", namaRekening: "PPN Pusat", nilai: 100000 },
              { kodeRekening: "7.1.2", namaRekening: "PPh Pasal 22", nilai: 25000 },
            ],
          },
          {
            id: "demo-bt-003",
            tanggal: "2024-03-27",
            noBukti: "0003/KW/05.2001/2024",
            keterangan: "Pembelian 20 m3 pasir dan 4 pick up koral",
            jumlah: 8800000,
            penerima: "Supplier Pasir",
            nama: "Supplier Pasir",
            alamat: "Desa Arfai",
            potonganPajak: [],
          },
          {
            id: "demo-bt-004",
            tanggal: "2024-03-27",
            noBukti: "0004/KW/05.2001/2024",
            keterangan: "Pembelian 85 zak semen dan 8 pick up bata",
            jumlah: 7625000,
            penerima: "Supplier Semen",
            nama: "Supplier Semen",
            alamat: "Desa Arfai",
            potonganPajak: [],
          },
        ],
      },
      {
        id: "demo-spp-003",
        jenis: "pembiayaan",
        tanggalSPP: "2024-05-28",
        nomorSPP: "0003/SPP/05.2001/2024",
        uraian: "Penyertaan Modal BUM Desa Mina Martani",
        jumlah: 40000000,
        isFinal: true,
        rincian: [
          {
            id: "demo-sppr-003",
            kodeRekening: "6.2.1",
            namaRekening: "Penyertaan Modal Desa pada BUM Desa",
            nilai: 40000000,
          },
        ],
        buktiTransaksi: [
          {
            id: "demo-bt-005",
            tanggal: "2024-05-28",
            noBukti: "0005/KW/05.2001/2024",
            keterangan: "Penyerahan dana Penyertaan Modal ke BUM Desa Mina Martani",
            jumlah: 40000000,
            penerima: "BUM Desa Mina Martani",
            nama: "BUM Desa Mina Martani",
            alamat: "Desa Mina Martani",
            potonganPajak: [],
          },
        ],
      },
    ],

    // ============ PENCAIRAN SPP ============
    pencairan: [
      {
        id: "demo-cair-001",
        sppId: "demo-spp-001",
        nomorPencairan: "0001/CAIR/05.2001/2024",
        tanggal: "2024-03-23",
        noCek: "-",
        pembayaran: "bank",
        jumlah: 10000000,
        potongan: 0,
        netto: 10000000,
      },
      {
        id: "demo-cair-002",
        sppId: "demo-spp-002",
        nomorPencairan: "0002/CAIR/05.2001/2024",
        tanggal: "2024-03-27",
        noCek: "-",
        pembayaran: "bank",
        jumlah: 30776000,
        potongan: 125000,
        netto: 30651000,
      },
      {
        id: "demo-cair-003",
        sppId: "demo-spp-003",
        nomorPencairan: "0003/CAIR/05.2001/2024",
        tanggal: "2024-05-28",
        noCek: "-",
        pembayaran: "bank",
        jumlah: 40000000,
        potongan: 0,
        netto: 40000000,
      },
    ],

    // ============ PENYETORAN PAJAK ============
    // Soal #13: PPN Rp100.000 dan PPh 22 Rp25.000
    // Soal #18: Penyetoran PPN Rp100.000
    penyetoranPajak: [
      {
        id: "demo-pajak-001",
        tanggal: "2024-06-30",
        noBukti: "0001/SSP/05.2001/2024",
        kodeRekening: "7.1.1",
        kodeMAP: "411211",
        keterangan: "Penyetoran PPN",
        jumlah: 100000,
        ntpn: "NTPN-DEMO-001",
        jenis: "bank",
        rincianBuktiPotong: [
          { noBukti: "0002/KW/05.2001/2024", kodeRekening: "7.1.1", namaRekening: "PPN Pusat", nilai: 100000 },
        ],
      },
      {
        id: "demo-pajak-002",
        tanggal: "2024-06-30",
        noBukti: "0002/SSP/05.2001/2024",
        kodeRekening: "7.1.2",
        kodeMAP: "411124",
        keterangan: "Penyetoran PPh Pasal 22",
        jumlah: 25000,
        ntpn: "NTPN-DEMO-002",
        jenis: "bank",
        rincianBuktiPotong: [
          { noBukti: "0002/KW/05.2001/2024", kodeRekening: "7.1.2", namaRekening: "PPh Pasal 22", nilai: 25000 },
        ],
      },
    ],

    // ============ SPJ PANJAR ============
    // Soal #12: Sisa panjar Rp1.000.000 disetor kembali
    spjPanjar: [
      {
        id: "demo-spj-001",
        sppId: "demo-spp-002",
        tanggalSPJ: "2024-03-27",
        nomorSPJ: "0001/SPJ/05.2001/2024",
        nomorSPP: "0002/SPP/05.2001/2024",
        jumlahCair: 30776000,
        jumlahSPJ: 29776000,
        sisa: 1000000,
        keterangan: "SPJ Panjar Pembangunan Gedung PAUD - sisa Rp1.000.000 disetor ke rekening desa",
      },
    ],

    // ============ JURNAL UMUM ============
    jurnalUmum: [],

    // ============ SILPA ============
    silpa: [],

    // ============ KEGIATAN ANGGARAN ============
    kegiatanAnggaran: [
      {
        id: "demo-ka-001",
        kodeBidang: "01",
        kodeSubBidang: "01.01",
        kodeKegiatan: "01.01.01",
        namaKegiatan: "Penyelenggaraan Belanja Siltap, Tunjangan, dan Operasional Pemerintahan Desa",
        waktuPelaksanaan: "Januari - Desember 2024",
        namaPelaksana: "Kepala Desa",
        jabatanPelaksana: "Kepala Desa",
        keluaran: "Gaji Kepala Desa",
        volumeKeluaran: "12 Bulan",
        sumberDana: "DDS",
        paguAnggaran: 120000000,
        outputItems: [],
      },
      {
        id: "demo-ka-002",
        kodeBidang: "02",
        kodeSubBidang: "02.01",
        kodeKegiatan: "02.01.06",
        namaKegiatan: "Pembangunan/Rehabilitasi/Peningkatan Sarana Prasarana PAUD",
        waktuPelaksanaan: "Maret - Juni 2024",
        namaPelaksana: "TPK",
        jabatanPelaksana: "Ketua TPK",
        keluaran: "Gedung PAUD Dusun Mawar",
        volumeKeluaran: "1 Unit",
        sumberDana: "DDS",
        paguAnggaran: 50000000,
        outputItems: [
          {
            id: "demo-out-001",
            namaPaket: "Pembangunan Gedung PAUD",
            nilai: 50000000,
            targetOutput: "1",
            satuan: "Unit",
            sumberDana: "DDS",
            keterangan: "Pembangunan gedung PAUD baru di Dusun Mawar",
          },
        ],
      },
    ],
  };
}
