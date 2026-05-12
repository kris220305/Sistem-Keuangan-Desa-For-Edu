import { loadState } from "@/data/app-state";
import FormPageHeader from "@/components/FormPageHeader";
import { generateBKPPajak, formatRupiah } from "@/lib/financial-engine";
import { exportToPDF, getTahunAnggaran } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";

export default function LaporanBKPPajak() {
  const state = loadState();
  const entries = generateBKPPajak(state);
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahun = getTahunAnggaran();

  const totalPemotongan = entries.reduce((s, e) => s + e.pemotongan, 0);
  const totalPenyetoran = entries.reduce((s, e) => s + e.penyetoran, 0);
  const lastSaldo = entries.length > 0 ? entries[entries.length - 1].saldo : 0;

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Buku Kas Pembantu Pajak" subtitle="BKP Pajak — Pemotongan dan Penyetoran">
        <Button size="sm" onClick={() => exportToPDF('bkp-pajak-content', `BKP_Pajak_${namaDesa}_${tahun}`)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div id="bkp-pajak-content" className="bg-white text-black p-10 max-w-4xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.4' }}>
          <div className="text-center mb-6">
            <p className="text-base font-bold tracking-wide">BUKU KAS PEMBANTU PAJAK</p>
            <p className="text-base font-bold">{namaDesa.toUpperCase()}</p>
            <p className="text-sm font-bold">TAHUN ANGGARAN {tahun}</p>
          </div>
          <p className="text-xs mb-3">Periode 01/01/{tahun} s.d 31/12/{tahun}</p>

          <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="py-2 px-2 text-center border border-gray-400 w-8">No.</th>
                <th className="py-2 px-2 text-left border border-gray-400 w-20">Tanggal</th>
                <th className="py-2 px-2 text-left border border-gray-400">Uraian</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-24">Pemotongan (Rp)</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-24">Penyetoran (Rp)</th>
                <th className="py-2 px-2 text-right border border-gray-400 w-24">Saldo (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-400 border border-gray-300">Belum ada data pajak</td></tr>
              ) : entries.map((e, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="py-1 px-2 text-center border border-gray-300">{e.no}</td>
                  <td className="py-1 px-2 border border-gray-300">{e.tanggal}</td>
                  <td className="py-1 px-2 border border-gray-300">
                    <span className="font-mono text-[8px]">{e.noBukti}</span><br/>
                    {e.uraian}<br/>
                    <span className="italic">{e.jenisPajak}</span>
                  </td>
                  <td className="py-1 px-2 text-right border border-gray-300">{e.pemotongan > 0 ? formatRupiah(e.pemotongan) : ''}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{e.penyetoran > 0 ? formatRupiah(e.penyetoran) : ''}</td>
                  <td className="py-1 px-2 text-right border border-gray-300">{formatRupiah(e.saldo)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-2 border border-gray-400" colSpan={3}>Jumlah</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(totalPemotongan)}</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(totalPenyetoran)}</td>
                <td className="py-2 px-2 text-right border border-gray-400">{formatRupiah(lastSaldo)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-16 flex justify-end" style={{ fontSize: '11px' }}>
            <div className="text-center">
              <p>{desaProfile.kecamatan || "___"}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="mt-1">Kaur Keuangan</p>
              <div className="h-20"></div>
              <p className="font-bold underline">{desaProfile.bendaharaNama || "___"}</p>
            </div>
          </div>
          <p className="mt-10 text-[8px] text-gray-400 text-center">Dicetak oleh Sistem Pengelolaan Keuangan Desa for Education</p>
        </div>
      </div>
    </div>
  );
}
