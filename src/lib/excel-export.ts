import * as XLSX from "xlsx";
import type { BKURow } from "@/lib/bku-engine";
import { formatTanggalId } from "@/lib/bku-utils";

export function exportBkuToXlsx(params: {
  filename: string;
  jenis: string;
  unit: string;
  periode: string;
  rows: BKURow[];
}) {
  const { filename, jenis, unit, periode, rows } = params;

  const aoa: Array<Array<string | number>> = [];
  aoa.push([`BKU ${jenis}`]);
  aoa.push([`Unit: ${unit}`]);
  aoa.push([`Periode: ${periode}`]);
  aoa.push([]);
  aoa.push(["No", "Tanggal", "Kode Rekening", "Uraian", "Penerimaan", "Pengeluaran", "No Bukti", "Saldo"]);

  for (const r of rows) {
    aoa.push([
      r.no,
      formatTanggalId(r.tanggal),
      r.kodeRekening || "",
      r.uraian || "",
      r.penerimaan || 0,
      r.pengeluaran || 0,
      r.noBukti || "",
      r.saldo || 0,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `BKU_${jenis}`);
  XLSX.writeFile(wb, filename);
}

