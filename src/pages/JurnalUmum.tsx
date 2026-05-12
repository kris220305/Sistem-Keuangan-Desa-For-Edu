import { useState, useEffect } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { loadState, saveState, type JurnalUmumItem, type JurnalRincian } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen, Check, Undo2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { toast } from "sonner";
import { rekeningData } from "@/data/rekening-data";

type Mode = "view" | "add" | "edit";

export default function JurnalUmum() {
  const [entries, setEntries] = useState<JurnalUmumItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("view");

  // All detail rekening for journal entries
  const allRekening = rekeningData.filter(r => r.level === 3);

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    kodeBuku: "JAU-00001",
    nomorBukti: "",
    uraian: "",
  });

  const [rincian, setRincian] = useState<JurnalRincian[]>([
    { id: crypto.randomUUID(), kodeRekening: "", uraian: "", debet: 0, kredit: 0 },
  ]);

  useEffect(() => {
    const state = loadState();
    const jurnal = state.jurnalUmum || [];
    setEntries(jurnal);
    if (jurnal.length > 0) setCurrentIndex(0);
  }, []);

  const current = entries[currentIndex] || null;
  const totalDebet = (mode !== "view" ? rincian : current?.rincian || []).reduce((s, r) => s + r.debet, 0);
  const totalKredit = (mode !== "view" ? rincian : current?.rincian || []).reduce((s, r) => s + r.kredit, 0);

  const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2 });

  const saveEntries = (newEntries: JurnalUmumItem[]) => {
    const state = loadState();
    state.jurnalUmum = newEntries;
    saveState(state);
    setEntries(newEntries);
  };

  const generateKodeBuku = () => {
    const count = entries.length + 1;
    return `JAU-${String(count).padStart(5, "0")}`;
  };

  const handleTambah = () => {
    setMode("add");
    const count = entries.length + 1;
    setForm({
      tanggal: new Date().toISOString().split("T")[0],
      kodeBuku: generateKodeBuku(),
      nomorBukti: `${String(count).padStart(4, "0")}/JU/05.2001/2024`,
      uraian: "",
    });
    setRincian([{ id: crypto.randomUUID(), kodeRekening: "", uraian: "", debet: 0, kredit: 0 }]);
  };

  const handleUbah = () => {
    if (!current) { toast.error("Pilih jurnal terlebih dahulu"); return; }
    if (current.posting) { toast.error("Jurnal sudah di-posting, tidak bisa diubah"); return; }
    setMode("edit");
    setForm({
      tanggal: current.tanggal, kodeBuku: current.kodeBuku,
      nomorBukti: current.nomorBukti, uraian: current.uraian,
    });
    setRincian([...current.rincian]);
  };

  const handleHapus = () => {
    if (!current) { toast.error("Pilih jurnal terlebih dahulu"); return; }
    if (current.posting) { toast.error("Jurnal sudah di-posting, tidak bisa dihapus"); return; }
    const newEntries = entries.filter(e => e.id !== current.id);
    saveEntries(newEntries);
    if (currentIndex >= newEntries.length) setCurrentIndex(Math.max(0, newEntries.length - 1));
    toast.success("Jurnal dihapus");
  };

  const handleSimpan = () => {
    if (totalDebet !== totalKredit) { toast.error("Debet dan Kredit harus seimbang!"); return; }
    if (!form.uraian) { toast.error("Isi uraian jurnal"); return; }

    const validRincian = rincian.filter(r => r.kodeRekening && (r.debet > 0 || r.kredit > 0));
    if (validRincian.length === 0) { toast.error("Tambahkan minimal 1 rincian jurnal"); return; }

    if (mode === "add") {
      const newEntry: JurnalUmumItem = {
        id: crypto.randomUUID(), ...form, posting: false, rincian: validRincian,
      };
      const newEntries = [...entries, newEntry];
      saveEntries(newEntries);
      setCurrentIndex(newEntries.length - 1);
      toast.success("Jurnal umum disimpan");
    } else if (mode === "edit" && current) {
      const newEntries = entries.map(e => e.id === current.id ? { ...e, ...form, rincian: validRincian } : e);
      saveEntries(newEntries);
      toast.success("Jurnal umum diperbarui");
    }
    trackFormProgress("jurnal");
    setMode("view");
  };

  const handlePosting = () => {
    if (!current) return;
    if (current.posting) { toast.info("Jurnal sudah di-posting"); return; }
    const totalD = current.rincian.reduce((s, r) => s + r.debet, 0);
    const totalK = current.rincian.reduce((s, r) => s + r.kredit, 0);
    if (totalD !== totalK) { toast.error("Debet dan Kredit harus seimbang sebelum posting!"); return; }
    const newEntries = entries.map(e => e.id === current.id ? { ...e, posting: true } : e);
    saveEntries(newEntries);
    toast.success("Jurnal berhasil di-posting");
  };

  const handleUnposting = () => {
    if (!current || !current.posting) return;
    const newEntries = entries.map(e => e.id === current.id ? { ...e, posting: false } : e);
    saveEntries(newEntries);
    toast.success("Posting jurnal dibatalkan");
  };

  // Rincian management
  const addRincianRow = () => {
    setRincian([...rincian, { id: crypto.randomUUID(), kodeRekening: "", uraian: "", debet: 0, kredit: 0 }]);
  };

  const removeRincianRow = (idx: number) => {
    if (rincian.length <= 1) return;
    setRincian(rincian.filter((_, i) => i !== idx));
  };

  const updateRincian = (idx: number, field: keyof JurnalRincian, value: string | number) => {
    const updated = [...rincian];
    (updated[idx] as any)[field] = value;
    setRincian(updated);
  };

  // Navigation
  const goFirst = () => setCurrentIndex(0);
  const goPrev = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const goNext = () => setCurrentIndex(Math.min(entries.length - 1, currentIndex + 1));
  const goLast = () => setCurrentIndex(entries.length - 1);

  const displayRincian = mode !== "view" ? rincian : current?.rincian || [];

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Jurnal Umum Keuangan Desa" subtitle="Pencatatan transaksi" />

      <div className="flex-1 p-4 flex flex-col gap-0 overflow-hidden">
        <div className="flex-1 border border-border rounded-md bg-card flex flex-col overflow-hidden">
          {/* Header form */}
          <div className="p-4 space-y-2 border-b border-border bg-muted/10">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-28 shrink-0">Tanggal</Label>
                  <Input type="date" className="h-7 text-[11px]" readOnly={mode === "view"}
                    value={mode !== "view" ? form.tanggal : current?.tanggal || ""}
                    onChange={e => setForm({...form, tanggal: e.target.value})} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-28 shrink-0">Nomor Bukti / Ref</Label>
                  <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                    value={mode !== "view" ? form.nomorBukti : current?.nomorBukti || ""}
                    onChange={e => setForm({...form, nomorBukti: e.target.value})} />
                  <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0"><Search size={12} />Cari</Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-28 shrink-0">Uraian</Label>
                  <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                    value={mode !== "view" ? form.uraian : current?.uraian || ""}
                    onChange={e => setForm({...form, uraian: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20 shrink-0">Kode Buku</Label>
                  <Input className="h-7 text-[11px] font-mono" readOnly
                    value={mode !== "view" ? form.kodeBuku : current?.kodeBuku || ""} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20 shrink-0">Posting</Label>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${current?.posting ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {current?.posting ? "✓ Posted" : "Belum"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20 shrink-0">Debet</Label>
                  <Input className="h-7 text-[11px] text-right font-bold bg-muted" readOnly value={fmt(totalDebet)} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20 shrink-0">Kredit</Label>
                  <Input className="h-7 text-[11px] text-right font-bold bg-muted" readOnly value={fmt(totalKredit)} />
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Jurnal */}
          <div className="px-4 py-2 border-b border-border bg-secondary/20 flex items-center justify-between">
            <p className="text-[11px] font-semibold">Rincian Jurnal</p>
            {mode !== "view" && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={addRincianRow}>Tambah</Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 text-[11px]">
                  <TableHead className="font-semibold w-[80px]">Desa</TableHead>
                  <TableHead className="font-semibold">Kd_Rincian</TableHead>
                  <TableHead className="font-semibold">Uraian</TableHead>
                  <TableHead className="font-semibold text-right">Debet</TableHead>
                  <TableHead className="font-semibold text-right">Kredit</TableHead>
                  {mode !== "view" && <TableHead className="font-semibold w-[40px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRincian.length === 0 ? (
                  <TableRow><TableCell colSpan={mode !== "view" ? 6 : 5} className="text-center text-muted-foreground py-8 text-xs">Belum ada rincian</TableCell></TableRow>
                ) : displayRincian.map((r, idx) => (
                  <TableRow key={r.id || idx} className="text-[11px]">
                    <TableCell className="font-mono text-muted-foreground">05.2001.</TableCell>
                    <TableCell>
                      {mode !== "view" ? (
                        <Select value={r.kodeRekening} onValueChange={v => {
                          const rek = allRekening.find(x => x.kode === v);
                          updateRincian(idx, "kodeRekening", v);
                          updateRincian(idx, "uraian", rek?.uraian || "");
                        }}>
                          <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Pilih" /></SelectTrigger>
                          <SelectContent>{allRekening.map(rek => <SelectItem key={rek.kode} value={rek.kode} className="text-xs">{rek.kode} — {rek.uraian}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <span className="font-mono">{r.kodeRekening}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mode !== "view" ? (
                        <Input className="h-6 text-[10px]" value={r.uraian} onChange={e => updateRincian(idx, "uraian", e.target.value)} />
                      ) : r.uraian}
                    </TableCell>
                    <TableCell className="text-right">
                      {mode !== "view" ? (
                        <Input type="number" className="h-6 text-[10px] text-right" value={r.debet || ""} onChange={e => updateRincian(idx, "debet", Number(e.target.value))} />
                      ) : r.debet > 0 ? fmt(r.debet) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {mode !== "view" ? (
                        <Input type="number" className="h-6 text-[10px] text-right" value={r.kredit || ""} onChange={e => updateRincian(idx, "kredit", Number(e.target.value))} />
                      ) : r.kredit > 0 ? fmt(r.kredit) : ""}
                    </TableCell>
                    {mode !== "view" && (
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeRincianRow(idx)}>
                          <Trash2 size={10} className="text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                <TableRow className="bg-secondary/30 text-[11px] font-bold">
                  <TableCell colSpan={mode !== "view" ? 3 : 3} className="text-right">Jumlah:</TableCell>
                  <TableCell className="text-right">{fmt(totalDebet)}</TableCell>
                  <TableCell className="text-right">{fmt(totalKredit)}</TableCell>
                  {mode !== "view" && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Balance warning */}
          {totalDebet !== totalKredit && (mode !== "view" || current) && (
            <div className="px-4 py-1 bg-destructive/10 text-destructive text-[11px] text-center font-medium">
              ⚠️ Debet dan Kredit tidak seimbang!
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar with posting, actions, and record navigation */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handlePosting}><Check size={12} />Posting</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleUnposting}><Undo2 size={12} />UnPosting</Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleTambah}><Plus size={12} />Tambah</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleUbah}><Pencil size={12} />Ubah</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleHapus}><Trash2 size={12} />Hapus</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setMode("view")}><X size={12} />Batal</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleSimpan}><Save size={12} />Simpan</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Printer size={12} />Cetak</Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => window.history.back()}><DoorOpen size={12} />Tutup</Button>
        </div>

        {/* Record Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goFirst} disabled={entries.length === 0}><ChevronsLeft size={12} /></Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goPrev} disabled={currentIndex <= 0}><ChevronLeft size={12} /></Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goNext} disabled={currentIndex >= entries.length - 1}><ChevronRight size={12} /></Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goLast} disabled={entries.length === 0}><ChevronsRight size={12} /></Button>
          <span className="text-[10px] text-muted-foreground ml-2">
            Record {entries.length > 0 ? currentIndex + 1 : 0}/{entries.length}
          </span>
        </div>
      </div>
    </div>
  );
}
