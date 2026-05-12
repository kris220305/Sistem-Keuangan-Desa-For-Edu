import React from "react";
import { loadState } from "@/data/app-state";
import FormPageHeader from "@/components/FormPageHeader";
import { formatRupiah, hitungRingkasan } from "@/lib/financial-engine";
import { bidangKegiatanData } from "@/data/siskeudes-data";
import { exportToPDF, getTahunAnggaran } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";

export default function LaporanPenjabaran() {
  const state = loadState();
  const data = hitungRingkasan(state);
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahun = getTahunAnggaran();

  const belanjaByBidang = new Map<string, typeof state.belanja>();
  state.belanja.forEach(b => {
    const key = b.kodeBidang;
    if (!belanjaByBidang.has(key)) belanjaByBidang.set(key, []);
    belanjaByBidang.get(key)!.push(b);
  });

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Penjabaran APBDes" subtitle="Rincian Anggaran per Bidang dan Kegiatan">
        <Button size="sm" onClick={() => exportToPDF('penjabaran-content', `Penjabaran_APBDes_${namaDesa}_${tahun}`)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div id="penjabaran-content" className="bg-white text-black p-10 max-w-5xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.4' }}>
          <div className="text-center mb-6">
            <p className="text-xs">Lampiran Peraturan Kepala Desa</p>
            <p className="text-base font-bold mt-2 tracking-wide">PENJABARAN ANGGARAN PENDAPATAN DAN BELANJA DESA</p>
            <p className="text-base font-bold">{namaDesa.toUpperCase()}</p>
            <p className="text-sm font-bold">TAHUN ANGGARAN {tahun}</p>
          </div>

          <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="py-2 px-2 text-left border border-gray-400 w-28">KODE REK</th>
                <th className="py-2 px-2 text-left border border-gray-400">URAIAN</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-32">ANGGARAN (Rp)</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-32">SETELAH PAK (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>1. PENDAPATAN</td>
                <td className="border border-gray-400"></td><td className="border border-gray-400"></td>
              </tr>
              {data.realisasiPendapatan.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-2 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-2 border border-gray-300">{r.namaRekening}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran - r.anggaranPAK)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>JUMLAH PENDAPATAN</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranPendapatan - data.realisasiPendapatan.reduce((s, r) => s + r.anggaranPAK, 0))}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranPendapatan)}</td>
              </tr>

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>2. BELANJA</td>
                <td className="border border-gray-400"></td><td className="border border-gray-400"></td>
              </tr>
              {Array.from(belanjaByBidang.entries()).map(([bidangKode, items]) => {
                const bidang = bidangKegiatanData.find(b => b.kode === bidangKode);
                const totalBidang = items.reduce((s, b) => s + (b.anggaran || 0) + (b.perubahanAnggaran || 0), 0);
                return (
                  <React.Fragment key={bidangKode}>
                    <tr className="font-semibold bg-gray-50">
                      <td className="py-1 px-2 border border-gray-300 pl-4">{bidangKode}</td>
                      <td className="py-1 px-2 border border-gray-300">{bidang?.nama || bidangKode}</td>
                      <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(items.reduce((s, b) => s + b.anggaran, 0))}</td>
                      <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(totalBidang)}</td>
                    </tr>
                    {items.map(b => (
                      <tr key={b.id}>
                        <td className="py-1 px-2 border border-gray-300 pl-8">{b.kodeRekening}</td>
                        <td className="py-1 px-2 border border-gray-300 pl-4">{b.uraian || b.namaRekening}</td>
                        <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(b.anggaran)}</td>
                        <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah((b.anggaran || 0) + (b.perubahanAnggaran || 0))}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>JUMLAH BELANJA</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(state.belanja.reduce((s, b) => s + b.anggaran, 0))}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranBelanja)}</td>
              </tr>

              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-2 border border-gray-400" colSpan={2}>SURPLUS / (DEFISIT)</td>
                <td className="py-2 px-2 text-right border border-gray-400" colSpan={2}>{formatRupiah(data.surplusDefisitAnggaran)}</td>
              </tr>

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>3. PEMBIAYAAN</td>
                <td className="border border-gray-400"></td><td className="border border-gray-400"></td>
              </tr>
              {data.realisasiPembiayaan.penerimaan.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-2 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-2 border border-gray-300">{r.namaRekening}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                </tr>
              ))}
              {data.realisasiPembiayaan.pengeluaran.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-2 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-2 border border-gray-300">{r.namaRekening}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                </tr>
              ))}

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>PEMBIAYAAN NETTO</td>
                <td className="py-1.5 px-2 text-right border border-gray-400" colSpan={2}>{formatRupiah(data.pembiayaanNettoAnggaran)}</td>
              </tr>
              <tr className="font-bold bg-gray-700 text-white">
                <td className="py-2 px-2 border border-gray-400" colSpan={2}>SISA LEBIH / (KURANG) PEMBIAYAAN ANGGARAN</td>
                <td className="py-2 px-2 text-right border border-gray-400" colSpan={2}>{formatRupiah(data.silpaAnggaran)}</td>
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
