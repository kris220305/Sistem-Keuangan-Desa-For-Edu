import FormPageHeader from "@/components/FormPageHeader";
import { loadState } from "@/data/app-state";
import { hitungRingkasan, formatRupiah } from "@/lib/financial-engine";
import { exportToPDF, getTahunAnggaran } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";

export default function LaporanLRA() {
  const state = loadState();
  const data = hitungRingkasan(state);
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahun = getTahunAnggaran();

  const thStyle = "py-2 px-3 border border-gray-400";

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Laporan Realisasi Pelaksanaan APBDes" subtitle="LRA — Anggaran vs Realisasi">
        <Button size="sm" onClick={() => exportToPDF('lra-content', `LRA_${namaDesa}_${tahun}`)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div id="lra-content" className="bg-white text-black p-10 max-w-4xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.5' }}>
          <div className="text-center mb-8">
            <p className="text-base font-bold tracking-wide">LAPORAN REALISASI PELAKSANAAN</p>
            <p className="text-base font-bold">ANGGARAN PENDAPATAN DAN BELANJA DESA</p>
            <p className="text-base font-bold">{namaDesa.toUpperCase()}</p>
            <p className="text-sm font-bold">TAHUN ANGGARAN {tahun}</p>
            <p className="text-xs mt-2">Realisasi s.d 31/12/{tahun}</p>
          </div>

          <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className={`${thStyle} text-left w-20`}>KODE REK</th>
                <th className={`${thStyle} text-left`}>URAIAN</th>
                <th className={`${thStyle} text-right w-28`}>ANGGARAN (Rp)</th>
                <th className={`${thStyle} text-right w-28`}>REALISASI (Rp)</th>
                <th className={`${thStyle} text-right w-28`}>LEBIH/(KURANG)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-3 border border-gray-400">4</td>
                <td className="py-1.5 px-3 border border-gray-400">PENDAPATAN</td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
              </tr>
              {data.realisasiPendapatan.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-3 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-3 border border-gray-300 pl-6">{r.namaRekening}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400">JUMLAH PENDAPATAN</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.totalAnggaranPendapatan)}</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.totalRealisasiPendapatan)}</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.totalAnggaranPendapatan - data.totalRealisasiPendapatan)}</td>
              </tr>

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-3 border border-gray-400">5</td>
                <td className="py-1.5 px-3 border border-gray-400">BELANJA</td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
              </tr>
              {data.realisasiBelanja.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-3 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-3 border border-gray-300 pl-6">{r.namaRekening}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400">JUMLAH BELANJA</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.totalAnggaranBelanja)}</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.totalRealisasiBelanja)}</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.totalAnggaranBelanja - data.totalRealisasiBelanja)}</td>
              </tr>

              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-3 border border-gray-400"></td>
                <td className="py-2 px-3 border border-gray-400">SURPLUS / (DEFISIT)</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(data.surplusDefisitAnggaran)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(data.surplusDefisitRealisasi)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(data.surplusDefisitAnggaran - data.surplusDefisitRealisasi)}</td>
              </tr>

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-3 border border-gray-400">6</td>
                <td className="py-1.5 px-3 border border-gray-400">PEMBIAYAAN</td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400"></td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1 px-3 border border-gray-300">6.1</td>
                <td className="py-1 px-3 border border-gray-300">Penerimaan Pembiayaan</td>
                <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(data.totalAnggaranPenerimaanPembiayaan)}</td>
                <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(data.totalRealisasiPenerimaanPembiayaan)}</td>
                <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(data.totalAnggaranPenerimaanPembiayaan - data.totalRealisasiPenerimaanPembiayaan)}</td>
              </tr>
              {data.realisasiPembiayaan.penerimaan.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-3 border border-gray-300 pl-8">{r.kodeRekening}</td>
                  <td className="py-1 px-3 border border-gray-300 pl-8">{r.namaRekening}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1 px-3 border border-gray-300">6.2</td>
                <td className="py-1 px-3 border border-gray-300">Pengeluaran Pembiayaan</td>
                <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(data.totalAnggaranPengeluaranPembiayaan)}</td>
                <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(data.totalRealisasiPengeluaranPembiayaan)}</td>
                <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(data.totalAnggaranPengeluaranPembiayaan - data.totalRealisasiPengeluaranPembiayaan)}</td>
              </tr>
              {data.realisasiPembiayaan.pengeluaran.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-3 border border-gray-300 pl-8">{r.kodeRekening}</td>
                  <td className="py-1 px-3 border border-gray-300 pl-8">{r.namaRekening}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-3 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-3 border border-gray-400"></td>
                <td className="py-1.5 px-3 border border-gray-400">PEMBIAYAAN NETTO</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.pembiayaanNettoAnggaran)}</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.pembiayaanNettoRealisasi)}</td>
                <td className="py-1.5 px-3 text-right border border-gray-400">{formatRupiah(data.pembiayaanNettoAnggaran - data.pembiayaanNettoRealisasi)}</td>
              </tr>

              <tr className="font-bold bg-gray-700 text-white">
                <td className="py-2 px-3 border border-gray-400"></td>
                <td className="py-2 px-3 border border-gray-400">SISA LEBIH PEMBIAYAAN ANGGARAN</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(data.silpaAnggaran)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(data.silpaRealisasi)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(data.silpaAnggaran - data.silpaRealisasi)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-16 flex justify-end" style={{ fontSize: '11px' }}>
            <div className="text-center">
              <p>{desaProfile.kecamatan || "___"}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="mt-1">Kepala Desa</p>
              <div className="h-20"></div>
              <p className="font-bold underline">{desaProfile.kepalaDesaNama || "___"}</p>
            </div>
          </div>
          <p className="mt-10 text-[8px] text-gray-400 text-center">Dicetak oleh Sistem Pengelolaan Keuangan Desa for Education</p>
        </div>
      </div>
    </div>
  );
}
