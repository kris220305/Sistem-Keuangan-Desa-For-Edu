import React from "react";
import { loadState } from "@/data/app-state";
import FormPageHeader from "@/components/FormPageHeader";
import { hitungRingkasan, formatRupiah, getEffectivePencairan } from "@/lib/financial-engine";
import { bidangKegiatanData } from "@/data/siskeudes-data";
import { rekeningData } from "@/data/rekening-data";
import { exportToPDF, getTahunAnggaran } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";

export default function LaporanLRAPerKegiatan() {
  const state = loadState();
  const data = hitungRingkasan(state);
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahun = getTahunAnggaran();

  const belanjaByKegiatan = new Map<string, typeof state.belanja>();
  state.belanja.forEach(b => {
    const key = b.kodeKegiatan;
    if (!belanjaByKegiatan.has(key)) belanjaByKegiatan.set(key, []);
    belanjaByKegiatan.get(key)!.push(b);
  });

  const bidangGroups = new Map<string, string[]>();
  state.belanja.forEach(b => {
    if (!bidangGroups.has(b.kodeBidang)) bidangGroups.set(b.kodeBidang, []);
    const kegiatans = bidangGroups.get(b.kodeBidang)!;
    if (!kegiatans.includes(b.kodeKegiatan)) kegiatans.push(b.kodeKegiatan);
  });

  const realisasiPerRekening = new Map<string, number>();
  getEffectivePencairan(state).forEach(pc => {
    const spp = state.spp.find(s => s.id === pc.sppId);
    if (!spp) return;
    spp.rincian.forEach(r => {
      realisasiPerRekening.set(r.kodeRekening, (realisasiPerRekening.get(r.kodeRekening) || 0) + r.nilai);
    });
  });

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="LRA Desa per Kegiatan" subtitle="Realisasi per Bidang, Kegiatan, dan Rekening">
        <Button size="sm" onClick={() => exportToPDF('lra-kegiatan-content', `LRA_PerKegiatan_${namaDesa}_${tahun}`)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div id="lra-kegiatan-content" className="bg-white text-black p-10 max-w-5xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.4' }}>
          <div className="text-center mb-8">
            <p className="text-base font-bold tracking-wide">LAPORAN REALISASI PELAKSANAAN</p>
            <p className="text-base font-bold">ANGGARAN PENDAPATAN DAN BELANJA DESA</p>
            <p className="text-base font-bold">{namaDesa.toUpperCase()}</p>
            <p className="text-sm font-bold">TAHUN ANGGARAN {tahun}</p>
            <p className="text-xs mt-2">Realisasi s.d 31/12/{tahun}</p>
          </div>

          <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="py-2 px-2 text-left border border-gray-400 w-28">KODE REK</th>
                <th className="py-2 px-2 text-left border border-gray-400">URAIAN</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-24">ANGGARAN (Rp)</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-24">REALISASI (Rp)</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-24">LEBIH/(KURANG)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400">4</td>
                <td className="py-1.5 px-2 border border-gray-400">PENDAPATAN</td>
                <td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td>
              </tr>
              {data.realisasiPendapatan.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-2 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-2 border border-gray-300">{r.namaRekening}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>JUMLAH PENDAPATAN</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranPendapatan)}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalRealisasiPendapatan)}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranPendapatan - data.totalRealisasiPendapatan)}</td>
              </tr>

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400">5</td>
                <td className="py-1.5 px-2 border border-gray-400">BELANJA</td>
                <td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td>
              </tr>
              
              {Array.from(bidangGroups.entries()).map(([bidangKode, kegiatanList]) => {
                const bidang = bidangKegiatanData.find(b => b.kode === bidangKode);
                const bidangBelanja = state.belanja.filter(b => b.kodeBidang === bidangKode);
                const totalBidangAnggaran = bidangBelanja.reduce((s, b) => s + (b.anggaran || 0) + (b.perubahanAnggaran || 0), 0);
                const totalBidangRealisasi = bidangBelanja.reduce((s, b) => s + (realisasiPerRekening.get(b.kodeRekening) || 0), 0);
                
                return (
                  <React.Fragment key={bidangKode}>
                    <tr className="font-semibold bg-gray-50">
                      <td className="py-1 px-2 border border-gray-300">{bidangKode}</td>
                      <td className="py-1 px-2 border border-gray-300">{bidang?.nama}</td>
                      <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(totalBidangAnggaran)}</td>
                      <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(totalBidangRealisasi)}</td>
                      <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(totalBidangAnggaran - totalBidangRealisasi)}</td>
                    </tr>
                    {kegiatanList.map(kegKode => {
                      const kegiatan = bidangKegiatanData.find(k => k.kode === kegKode);
                      const items = belanjaByKegiatan.get(kegKode) || [];
                      return (
                        <React.Fragment key={kegKode}>
                          <tr className="font-medium">
                            <td className="py-1 px-2 border border-gray-300 pl-6">{kegKode}</td>
                            <td className="py-1 px-2 border border-gray-300">{kegiatan?.nama}</td>
                            <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(items.reduce((s, b) => s + (b.anggaran || 0) + (b.perubahanAnggaran || 0), 0))}</td>
                            <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(items.reduce((s, b) => s + (realisasiPerRekening.get(b.kodeRekening) || 0), 0))}</td>
                            <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(items.reduce((s, b) => s + (b.anggaran || 0) + (b.perubahanAnggaran || 0) - (realisasiPerRekening.get(b.kodeRekening) || 0), 0))}</td>
                          </tr>
                          {items.map(b => {
                            const real = realisasiPerRekening.get(b.kodeRekening) || 0;
                            return (
                              <tr key={b.id}>
                                <td className="py-1 px-2 border border-gray-300 pl-10">{kegKode} {b.kodeRekening}</td>
                                <td className="py-1 px-2 border border-gray-300 pl-4">{b.namaRekening}</td>
                                <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah((b.anggaran || 0) + (b.perubahanAnggaran || 0))}</td>
                                <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(real)}</td>
                                <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah((b.anggaran || 0) + (b.perubahanAnggaran || 0) - real)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>JUMLAH BELANJA</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranBelanja)}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalRealisasiBelanja)}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.totalAnggaranBelanja - data.totalRealisasiBelanja)}</td>
              </tr>

              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-2 border border-gray-400" colSpan={2}>SURPLUS / (DEFISIT)</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(data.surplusDefisitAnggaran)}</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(data.surplusDefisitRealisasi)}</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(data.surplusDefisitAnggaran - data.surplusDefisitRealisasi)}</td>
              </tr>

              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400">6</td>
                <td className="py-1.5 px-2 border border-gray-400">PEMBIAYAAN</td>
                <td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td>
              </tr>
              {data.realisasiPembiayaan.penerimaan.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-2 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-2 border border-gray-300">{r.namaRekening}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}
              {data.realisasiPembiayaan.pengeluaran.map(r => (
                <tr key={r.kodeRekening}>
                  <td className="py-1 px-2 border border-gray-300 pl-6">{r.kodeRekening}</td>
                  <td className="py-1 px-2 border border-gray-300">{r.namaRekening}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.anggaran)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.realisasi)}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(r.selisih)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="py-1.5 px-2 border border-gray-400" colSpan={2}>PEMBIAYAAN NETTO</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.pembiayaanNettoAnggaran)}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.pembiayaanNettoRealisasi)}</td>
                <td className="py-1.5 px-2 text-right border border-gray-400">{formatRupiah(data.pembiayaanNettoAnggaran - data.pembiayaanNettoRealisasi)}</td>
              </tr>
              <tr className="font-bold bg-gray-700 text-white">
                <td className="py-2 px-2 border border-gray-400" colSpan={2}>SILPA/SiLPA TAHUN BERJALAN</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(data.silpaAnggaran)}</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(data.silpaRealisasi)}</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(data.silpaAnggaran - data.silpaRealisasi)}</td>
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
