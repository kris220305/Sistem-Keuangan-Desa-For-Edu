import { useState } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { bidangKegiatanData, sumberDanaData, outputKegiatanData } from "@/data/siskeudes-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Info } from "lucide-react";

export default function DetailKegiatan() {
  const [selectedKegiatan, setSelectedKegiatan] = useState("");
  const kegiatans = bidangKegiatanData.filter((i) => i.level === "kegiatan");
  const outputs = outputKegiatanData.filter((o) => o.kodeKegiatan === selectedKegiatan);
  const keg = bidangKegiatanData.find((i) => i.kode === selectedKegiatan);

  return (
    <div>
      <FormPageHeader title="Detail Kegiatan" subtitle="Lihat detail dan output kegiatan berdasarkan referensi parameter" />
      <div className="p-6 space-y-6">
        <div className="content-card p-5">
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">Pilih Kegiatan</Label>
          <Select value={selectedKegiatan} onValueChange={setSelectedKegiatan}>
            <SelectTrigger className="max-w-xl"><SelectValue placeholder="Pilih kegiatan untuk melihat detail..." /></SelectTrigger>
            <SelectContent>
              {kegiatans.map((k) => (
                <SelectItem key={k.kode} value={k.kode}>{k.kode} — {k.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {keg && (
          <div className="content-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <FileText size={20} className="text-primary mt-1" />
              <div>
                <p className="font-mono text-xs text-primary">{keg.kode}</p>
                <h2 className="text-lg font-bold font-heading">{keg.nama}</h2>
              </div>
            </div>

            {outputs.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold mb-2">Output Kegiatan</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="font-semibold">Kode Output</TableHead>
                      <TableHead className="font-semibold">Uraian Output</TableHead>
                      <TableHead className="font-semibold">Satuan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outputs.map((o) => (
                      <TableRow key={o.kodeOutput}>
                        <TableCell>
                          <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{o.kodeOutput}</span>
                        </TableCell>
                        <TableCell className="text-sm">{o.uraianOutput}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.satuanOutput}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-4">
                <Info size={16} />
                <span>Tidak ada data output untuk kegiatan ini dalam referensi parameter.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
