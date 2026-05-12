import { useMemo, useState } from "react";
import { loadState } from "@/data/app-state";
import FormPageHeader from "@/components/FormPageHeader";
import { formatRupiah } from "@/lib/financial-engine";
import { exportToPDF, getTahunAnggaran } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildBKU, type BKUJenis } from "@/lib/bku-engine";
import { buildBkuFilename, formatJenisLabel, formatTanggalId } from "@/lib/bku-utils";
import { exportBkuToXlsx } from "@/lib/excel-export";

export default function LaporanBKU() {
  const state = loadState();
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahunPreferred = getTahunAnggaran();

  const [jenis, setJenis] = useState<BKUJenis>("utama");
  const unit = namaDesa;

  const filter = useMemo(() => ({
    tahunAnggaran: Math.max(0, Math.floor(Number(tahunPreferred) || 0)) || new Date().getFullYear(),
  }), [tahunPreferred]);

  const resultUtama = useMemo(() => buildBKU(state, "utama", filter), [state, filter]);
  const resultTunai = useMemo(() => buildBKU(state, "tunai", filter), [state, filter]);
  const resultBank = useMemo(() => buildBKU(state, "bank", filter), [state, filter]);

  const activeResult = jenis === "tunai" ? resultTunai : jenis === "bank" ? resultBank : resultUtama;
  const totals = useMemo(() => {
    const rows = activeResult.rows.slice(1);
    const totalPenerimaan = rows.reduce((s, r) => s + (r.penerimaan || 0), 0);
    const totalPengeluaran = rows.reduce((s, r) => s + (r.pengeluaran || 0), 0);
    const saldoAkhir = activeResult.saldoAkhir || 0;
    return { totalPenerimaan, totalPengeluaran, saldoAkhir };
  }, [activeResult]);

  const tahunUsed = resultUtama.tahunUsed;
  const periodeLabel = useMemo(() => {
    const start = activeResult.startUsed;
    const end = activeResult.endUsed;
    return `Periode ${formatTanggalId(start)} s.d ${formatTanggalId(end)}`;
  }, [activeResult.endUsed, activeResult.startUsed]);

  const sheetId = (j: BKUJenis) => `bku-${j}-content`;

  const exportPdf = (j: BKUJenis) => {
    const res = j === "tunai" ? resultTunai : j === "bank" ? resultBank : resultUtama;
    const start = res.startUsed;
    const end = res.endUsed;
    const filename = buildBkuFilename({ jenis: j, unit, start, end, ext: "pdf" }).replace(/\.pdf$/i, "");
    exportToPDF(sheetId(j), filename);
  };

  const exportXlsx = (j: BKUJenis) => {
    const res = j === "tunai" ? resultTunai : j === "bank" ? resultBank : resultUtama;
    const start = res.startUsed;
    const end = res.endUsed;
    const filename = buildBkuFilename({ jenis: j, unit, start, end, ext: "xlsx" });
    exportBkuToXlsx({
      filename,
      jenis: formatJenisLabel(j),
      unit,
      periode: `${start} s.d ${end}`,
      rows: res.rows,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Buku Kas Umum" subtitle="BKU — Seluruh transaksi tahun berjalan">
        <Button size="sm" onClick={() => exportPdf(jenis)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportXlsx(jenis)} className="gap-2">
          <FileSpreadsheet size={14} /> Export Excel
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-5xl mx-auto space-y-3">
          {activeResult.negativeRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900">
              <div className="font-semibold">Saldo minus terdeteksi</div>
              <div className="mt-1 text-xs">Baris: {activeResult.negativeRows.slice(0, 20).join(", ")}{activeResult.negativeRows.length > 20 ? "…" : ""}</div>
            </div>
          )}

          <Tabs value={jenis} onValueChange={(v) => setJenis(v as BKUJenis)}>
            <TabsList className="bg-white border rounded-xl p-1 h-10 justify-start">
              <TabsTrigger value="utama">Utama</TabsTrigger>
              <TabsTrigger value="tunai">Tunai</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
            </TabsList>
            <TabsContent value="utama" className="mt-0">
              <BkuSheet
                id={sheetId("utama")}
                jenis="utama"
                namaDesa={namaDesa}
                desaProfile={desaProfile}
                tahun={tahunUsed}
                periodeLabel={periodeLabel}
                result={resultUtama}
              />
            </TabsContent>
            <TabsContent value="tunai" className="mt-0">
              <BkuSheet
                id={sheetId("tunai")}
                jenis="tunai"
                namaDesa={namaDesa}
                desaProfile={desaProfile}
                tahun={tahunUsed}
                periodeLabel={periodeLabel}
                result={resultTunai}
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-0">
              <BkuSheet
                id={sheetId("bank")}
                jenis="bank"
                namaDesa={namaDesa}
                desaProfile={desaProfile}
                tahun={tahunUsed}
                periodeLabel={periodeLabel}
                result={resultBank}
              />
            </TabsContent>
          </Tabs>

          <div className="bg-white rounded-xl border p-4 text-sm">
            <div className="font-semibold">Ringkasan ({formatJenisLabel(jenis)})</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>Penerimaan: Rp {formatRupiah(totals.totalPenerimaan)}</div>
              <div>Pengeluaran: Rp {formatRupiah(totals.totalPengeluaran)}</div>
              <div>Saldo akhir: Rp {formatRupiah(totals.saldoAkhir)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BkuSheet(props: {
  id: string;
  jenis: BKUJenis;
  namaDesa: string;
  desaProfile: any;
  tahun: number;
  periodeLabel: string;
  result: ReturnType<typeof buildBKU>;
}) {
  const { id, jenis, namaDesa, desaProfile, tahun, periodeLabel, result } = props;
  const title = jenis === "utama" ? "BUKU KAS UMUM" : jenis === "tunai" ? "BUKU PEMBANTU KAS TUNAI" : "BUKU PEMBANTU BANK";
  const rows = result.rows;
  const totalPenerimaan = rows.slice(1).reduce((s, r) => s + (r.penerimaan || 0), 0);
  const totalPengeluaran = rows.slice(1).reduce((s, r) => s + (r.pengeluaran || 0), 0);

  return (
    <div id={id} className="bg-white text-black p-10 max-w-5xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.4' }}>
      <div className="text-center mb-6">
        <p className="text-base font-bold tracking-wide">{title}</p>
        <p className="text-base font-bold">{String(namaDesa).toUpperCase()}</p>
        <p className="text-sm font-bold">TAHUN ANGGARAN {tahun}</p>
        {desaProfile.kecamatan && <p className="text-xs mt-1">KECAMATAN {String(desaProfile.kecamatan).toUpperCase()}</p>}
        {desaProfile.kabupaten && <p className="text-xs">{String(desaProfile.kabupaten).toUpperCase()}</p>}
      </div>
      <p className="text-xs mb-3">{periodeLabel}</p>

      <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
        <thead>
          <tr className="bg-gray-700 text-white">
            <th className="py-2 px-1 text-center border border-gray-400 w-8">No.</th>
            <th className="py-2 px-1 text-left border border-gray-400 w-20">Tanggal</th>
            <th className="py-2 px-1 text-left border border-gray-400 w-20">Kode Rek</th>
            <th className="py-2 px-1 text-left border border-gray-400">Uraian</th>
            <th className="py-2 px-1 text-right border border-gray-400 w-24">Penerimaan</th>
            <th className="py-2 px-1 text-right border border-gray-400 w-24">Pengeluaran</th>
            <th className="py-2 px-1 text-left border border-gray-400 w-24">No. Bukti</th>
            <th className="py-2 px-1 text-right border border-gray-400 w-24">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isMinus = (r.flags || []).includes("saldo_minus");
            return (
              <tr key={i} className={isMinus ? "bg-red-50" : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                <td className="py-1 px-1 text-center border border-gray-300">{r.no}</td>
                <td className="py-1 px-1 border border-gray-300">{formatTanggalId(r.tanggal)}</td>
                <td className="py-1 px-1 border border-gray-300">{r.kodeRekening}</td>
                <td className="py-1 px-1 border border-gray-300 whitespace-pre-wrap">{r.uraian}</td>
                <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(r.penerimaan)}</td>
                <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(r.pengeluaran)}</td>
                <td className="py-1 px-1 border border-gray-300 text-[8px]">{r.noBukti}</td>
                <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(r.saldo)}</td>
              </tr>
            );
          })}

          <tr className="font-bold bg-gray-200">
            <td className="py-2 px-1 text-center border border-gray-400" colSpan={4}>JUMLAH</td>
            <td className="py-2 px-1 text-right border border-gray-400">{formatRupiah(totalPenerimaan)}</td>
            <td className="py-2 px-1 text-right border border-gray-400">{formatRupiah(totalPengeluaran)}</td>
            <td className="py-2 px-1 border border-gray-400"></td>
            <td className="py-2 px-1 text-right border border-gray-400"></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-10 flex justify-between" style={{ fontSize: '10px' }}>
        <div className="text-center">
          <p>Diverifikasi Oleh (Digital),</p>
          <p>Sekretaris Desa</p>
          <div className="h-16"></div>
          <p className="font-bold underline">{desaProfile.sekretarisNama || "___"}</p>
          <p className="mt-6">Kaur Keuangan</p>
          <div className="h-16"></div>
          <p className="font-bold underline">{desaProfile.bendaharaNama || "___"}</p>
        </div>
        <div className="text-center">
          <p>{desaProfile.kecamatan || "___"}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p>Disetujui oleh (Digital),</p>
          <p>Kepala Desa</p>
          <div className="h-16"></div>
          <p className="font-bold underline">{desaProfile.kepalaDesaNama || "___"}</p>
        </div>
      </div>
      <p className="mt-10 text-[8px] text-gray-400 text-center">Dicetak oleh Sistem Pengelolaan Keuangan Desa for Education</p>
    </div>
  );
}
