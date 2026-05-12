import { useState, useEffect } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { loadState, saveState, type SaldoAwalItem } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { rekeningData } from "@/data/rekening-data";

type Mode = "view" | "add" | "edit";

export default function SaldoAwal() {
  const [items, setItems] = useState<SaldoAwalItem[]>([]);
  const [selected, setSelected] = useState<SaldoAwalItem | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  // Rekening neraca (aset, kewajiban, ekuitas)
  const allDetailRekening = rekeningData.filter(r =>
    r.level === 3 && (r.kode.startsWith("1.") || r.kode.startsWith("2.") || r.kode.startsWith("3."))
  );

  const [form, setForm] = useState({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });

  useEffect(() => { setItems(loadState().saldoAwal); }, []);

  const save = (newItems: SaldoAwalItem[]) => {
    setItems(newItems);
    const state = loadState();
    state.saldoAwal = newItems;
    saveState(state);
  };

  const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2 });

  const totalDebet = items.reduce((s, i) => s + i.debet, 0);
  const totalKredit = items.reduce((s, i) => s + i.kredit, 0);

  const handleTambah = () => {
    setMode("add");
    setSelected(null);
    setForm({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });
  };

  const handleUbah = () => {
    if (!selected) { toast.error("Pilih data terlebih dahulu"); return; }
    setMode("edit");
    setForm({ kodeRekening: selected.kodeRekening, namaRekening: selected.namaRekening, debet: selected.debet, kredit: selected.kredit });
  };

  const handleHapus = () => {
    if (!selected) { toast.error("Pilih data terlebih dahulu"); return; }
    save(items.filter(i => i.id !== selected.id));
    setSelected(null);
    setMode("view");
    toast.success("Data saldo awal dihapus");
  };

  const handleBatal = () => {
    setMode("view");
    setForm({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });
  };

  const handleSimpan = () => {
    if (!form.kodeRekening) { toast.error("Pilih rekening"); return; }
    if (mode === "add") {
      save([...items, { id: crypto.randomUUID(), ...form }]);
      toast.success("Saldo awal ditambahkan");
    } else if (mode === "edit" && selected) {
      save(items.map(i => i.id === selected.id ? { ...i, ...form } : i));
      toast.success("Saldo awal diperbarui");
    }
    trackFormProgress("saldo_awal");
    setMode("view");
  };

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Saldo Awal Kekayaan Desa" subtitle="Tahun Anggaran 2024" />

      <div className="flex-1 p-4 flex flex-col gap-0 overflow-hidden">
        <div className="flex-1 border border-border rounded-md bg-card flex flex-col overflow-hidden">
          {/* Master table */}
          <div className="flex-1 overflow-auto border-b border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 text-[11px]">
                  <TableHead className="font-semibold">Kd_Rincian</TableHead>
                  <TableHead className="font-semibold">Nama_Rincian</TableHead>
                  <TableHead className="font-semibold text-right">Debet</TableHead>
                  <TableHead className="font-semibold text-right">Kredit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada saldo awal</TableCell></TableRow>
                ) : (
                  <>
                    {items.map(item => (
                      <TableRow key={item.id}
                        className={`cursor-pointer text-[11px] ${selected?.id === item.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelected(item); setMode("view"); }}>
                        <TableCell className="font-mono">{item.kodeRekening}</TableCell>
                        <TableCell>{item.namaRekening}</TableCell>
                        <TableCell className="text-right font-medium">{item.debet > 0 ? fmt(item.debet) : "0,00"}</TableCell>
                        <TableCell className="text-right font-medium">{item.kredit > 0 ? fmt(item.kredit) : "0,00"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-secondary/30 text-[11px] font-bold">
                      <TableCell colSpan={2} className="text-right">Jumlah</TableCell>
                      <TableCell className="text-right">{fmt(totalDebet)}</TableCell>
                      <TableCell className="text-right">{fmt(totalKredit)}</TableCell>
                    </TableRow>
                    {totalDebet !== totalKredit && (
                      <TableRow className="text-[11px]">
                        <TableCell colSpan={4} className="text-center text-destructive font-semibold">
                          ⚠️ Debet dan Kredit tidak seimbang!
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Detail form */}
          <div className="p-4 space-y-2 bg-muted/10">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-28 shrink-0">Kode Rekening</Label>
                  <Select value={mode !== "view" ? form.kodeRekening : selected?.kodeRekening || ""}
                    disabled={mode === "view"}
                    onValueChange={v => {
                      const r = allDetailRekening.find(x => x.kode === v);
                      setForm({...form, kodeRekening: v, namaRekening: r?.uraian || ""});
                    }}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih Rekening" /></SelectTrigger>
                    <SelectContent>{allDetailRekening.map(r => <SelectItem key={r.kode} value={r.kode} className="text-xs">{r.kode} — {r.uraian}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-28 shrink-0">Nama Rekening</Label>
                  <Input className="h-7 text-[11px]" readOnly
                    value={mode !== "view" ? form.namaRekening : selected?.namaRekening || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">Saldo Debet</Label>
                  <Input type="number" className="h-7 text-[11px] text-right font-medium" readOnly={mode === "view"}
                    value={mode !== "view" ? form.debet || "" : selected?.debet || ""}
                    onChange={e => setForm({...form, debet: Number(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">Saldo Kredit</Label>
                  <Input type="number" className="h-7 text-[11px] text-right font-medium" readOnly={mode === "view"}
                    value={mode !== "view" ? form.kredit || "" : selected?.kredit || ""}
                    onChange={e => setForm({...form, kredit: Number(e.target.value)})} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleTambah}><Plus size={12} />Tambah</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleUbah}><Pencil size={12} />Ubah</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleHapus}><Trash2 size={12} />Hapus</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleBatal}><X size={12} />Batal</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleSimpan}><Save size={12} />Simpan</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Printer size={12} />Cetak</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => window.history.back()}><DoorOpen size={12} />Tutup</Button>
      </div>
    </div>
  );
}
