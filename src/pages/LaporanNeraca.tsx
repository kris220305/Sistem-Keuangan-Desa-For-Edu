import { loadState } from "@/data/app-state";
import FormPageHeader from "@/components/FormPageHeader";
import { generateNeraca, formatRupiah } from "@/lib/financial-engine";
import { exportToPDF, getTahunAnggaran, getTahunLalu } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";

export default function LaporanNeraca() {
  const state = loadState();
  const neracaItems = generateNeraca(state);
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahun = getTahunAnggaran();
  const tahunLalu = getTahunLalu();

  const asetItems = neracaItems.filter(n => n.kode.startsWith('1'));
  const kewajibanItems = neracaItems.filter(n => n.kode.startsWith('2'));
  const ekuitasItems = neracaItems.filter(n => n.kode.startsWith('3'));

  const totalAset = asetItems.filter(n => n.level === 1).reduce((s, n) => s + n.nilaiTahunIni, 0);
  const totalAsetLalu = asetItems.filter(n => n.level === 1).reduce((s, n) => s + n.nilaiTahunLalu, 0);
  const totalKewajiban = kewajibanItems.filter(n => n.level === 1).reduce((s, n) => s + n.nilaiTahunIni, 0);
  const totalKewajibanLalu = kewajibanItems.filter(n => n.level === 1).reduce((s, n) => s + n.nilaiTahunLalu, 0);
  const totalEkuitas = ekuitasItems.filter(n => n.level === 1).reduce((s, n) => s + n.nilaiTahunIni, 0);
  const totalEkuitasLalu = ekuitasItems.filter(n => n.level === 1).reduce((s, n) => s + n.nilaiTahunLalu, 0);

  const renderSection = (items: typeof neracaItems) => (
    <>
      {items.map(item => (
        <tr key={item.kode} className={item.level === 0 ? 'font-bold bg-gray-50' : item.level === 1 ? 'font-semibold' : ''}>
          <td className={`py-1 px-3 border border-gray-400 ${item.level === 3 ? 'pl-10' : item.level === 2 ? 'pl-6' : item.level === 1 ? 'pl-4' : ''}`}>
            {item.kode}
          </td>
          <td className={`py-1 px-3 border border-gray-400 ${item.level === 3 ? 'pl-8' : item.level === 2 ? 'pl-4' : ''}`}>
            {item.uraian}
          </td>
          <td className="py-1 px-3 text-right border border-gray-400">
            {item.level <= 1 ? '' : formatRupiah(item.nilaiTahunIni)}
          </td>
          <td className="py-1 px-3 text-right border border-gray-400">
            {item.level <= 1 ? '' : formatRupiah(item.nilaiTahunLalu)}
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Laporan Kekayaan Milik Desa" subtitle="Neraca — Aset, Kewajiban, Ekuitas">
        <Button size="sm" onClick={() => exportToPDF('neraca-content', `Neraca_${namaDesa}_${tahun}`)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div id="neraca-content" className="bg-white text-black p-10 max-w-4xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.5' }}>
          <div className="text-center mb-8">
            <p className="text-base font-bold tracking-wide">{namaDesa.toUpperCase()}</p>
            <p className="text-base font-bold">LAPORAN KEKAYAAN MILIK DESA</p>
            <p className="text-sm font-bold">SAMPAI DENGAN 31 DESEMBER {tahun}</p>
          </div>

          <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="py-2 px-3 text-left border border-gray-400 w-24">KODE</th>
                <th className="py-2 px-3 text-left border border-gray-400">URAIAN</th>
                <th className="py-2 px-3 text-right border border-gray-400 w-32">TAHUN {tahun} (Rp)</th>
                <th className="py-2 px-3 text-right border border-gray-400 w-32">TAHUN {tahunLalu} (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {renderSection(asetItems)}
              
              {asetItems.filter(a => a.level === 1).map(a => (
                <tr key={`jml-${a.kode}`} className="font-semibold bg-gray-100">
                  <td className="py-1 px-3 border border-gray-400" colSpan={2}>Jumlah {a.uraian}</td>
                  <td className="py-1 px-3 text-right border border-gray-400">{formatRupiah(a.nilaiTahunIni)}</td>
                  <td className="py-1 px-3 text-right border border-gray-400">{formatRupiah(a.nilaiTahunLalu)}</td>
                </tr>
              ))}
              
              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-3 border border-gray-400" colSpan={2}>JUMLAH ASET</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalAset)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalAsetLalu)}</td>
              </tr>

              {renderSection(kewajibanItems)}
              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-3 border border-gray-400" colSpan={2}>JUMLAH KEWAJIBAN</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalKewajiban)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalKewajibanLalu)}</td>
              </tr>

              {renderSection(ekuitasItems)}
              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-3 border border-gray-400" colSpan={2}>JUMLAH EKUITAS</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalEkuitas)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalEkuitasLalu)}</td>
              </tr>

              <tr className="font-bold bg-gray-700 text-white">
                <td className="py-2 px-3 border border-gray-400" colSpan={2}>JUMLAH KEWAJIBAN DAN EKUITAS</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalKewajiban + totalEkuitas)}</td>
                <td className="py-2 px-3 text-right border border-gray-400">{formatRupiah(totalKewajibanLalu + totalEkuitasLalu)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-16 flex justify-end">
            <div className="text-center" style={{ fontSize: '11px' }}>
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
