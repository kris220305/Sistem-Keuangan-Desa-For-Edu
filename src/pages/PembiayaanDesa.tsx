import { useState, useEffect } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { getRekeningDetail } from "@/data/rekening-data";
import { sumberDanaData } from "@/data/siskeudes-data";
import { loadState, saveState, type PembiayaanItem } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Mode = "view" | "tambah" | "ubah";

export default function PembiayaanDesa() {
  const [items, setItems] = useState<PembiayaanItem[]>([]);
  const [activeTab, setActiveTab] = useState<"penerimaan" | "pengeluaran">("penerimaan");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  const rekeningPembiayaan = getRekeningDetail("pembiayaan");
  const filteredRekening = rekeningPembiayaan.filter(r =>
    activeTab === "penerimaan" ? r.kode.startsWith("6.1") : r.kode.startsWith("6.2")
  );

  const emptyForm: Omit<PembiayaanItem, "id"> = {
    jenis: "penerimaan", kodeRekening: "", namaRekening: "",
    uraian: "", anggaran: 0,
    jumlahSatuan: "", hargaSatuan: 0, sumberDana: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { setItems(loadState().pembiayaan); }, []);

  const save = (newItems: PembiayaanItem[]) => {
    setItems(newItems);
    const state = loadState();
    state.pembiayaan = newItems;
    saveState(state);
  };

  const filtered = items.filter(i => i.jenis === activeTab);
  const selectedItem = items.find(i => i.id === selectedId);
  const totalPenerimaan = items.filter(i => i.jenis === "penerimaan").reduce((s, i) => s + i.anggaran, 0);
  const totalPengeluaran = items.filter(i => i.jenis === "pengeluaran").reduce((s, i) => s + i.anggaran, 0);

  const handleTambah = () => { setMode("tambah"); setSelectedId(null); setForm({ ...emptyForm, jenis: activeTab }); };

  const handleUbah = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan diubah");
    setMode("ubah");
    setForm({
      jenis: selectedItem.jenis,
      kodeRekening: selectedItem.kodeRekening,
      namaRekening: selectedItem.namaRekening,
      uraian: selectedItem.uraian,
      anggaran: selectedItem.anggaran,
      jumlahSatuan: selectedItem.jumlahSatuan,
      hargaSatuan: selectedItem.hargaSatuan,
      sumberDana: selectedItem.sumberDana,
    });
  };

  const handleHapus = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan dihapus");
    if (!confirm("Yakin hapus data ini?")) return;
    save(items.filter(i => i.id !== selectedItem.id));
    setSelectedId(null);
    toast.success("Data dihapus");
  };

  const handleBatal = () => { setMode("view"); setForm(emptyForm); };

  const handleSimpan = () => {
    if (!form.kodeRekening) return toast.error("Pilih rekening");
    const computed = Number(form.jumlahSatuan) * form.hargaSatuan;
    const anggaran = computed > 0 ? computed : form.anggaran;

    if (mode === "ubah" && selectedId) {
      save(items.map(i => i.id === selectedId ? { ...i, ...form, anggaran } : i));
      toast.success("Data diperbarui");
    } else {
      const newItem: PembiayaanItem = { id: crypto.randomUUID(), ...form, jenis: activeTab, anggaran };
      save([...items, newItem]);
      setSelectedId(newItem.id);
      toast.success("Data ditambahkan");
    }
    trackFormProgress("pembiayaan");
    setMode("view");
    setForm(emptyForm);
  };

  const computedAnggaran = (Number(form.jumlahSatuan) * form.hargaSatuan) || form.anggaran;

  return (
    <div className="flex flex-col h-full">
      <FormPageHeader title="Data Pembiayaan Desa" subtitle="Penerimaan dan pengeluaran pembiayaan" />

      <div className="flex-1 p-4 space-y-3 overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="content-card p-3">
            <p className="text-xs text-muted-foreground">Penerimaan Pembiayaan</p>
            <p className="text-lg font-bold font-heading text-primary">Rp {totalPenerimaan.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="content-card p-3">
            <p className="text-xs text-muted-foreground">Pengeluaran Pembiayaan</p>
            <p className="text-lg font-bold font-heading text-destructive">Rp {totalPengeluaran.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as "penerimaan" | "pengeluaran"); setSelectedId(null); setMode("view"); setForm(emptyForm); }}>
          <TabsList>
            <TabsTrigger value="penerimaan">Penerimaan Pembiayaan</TabsTrigger>
            <TabsTrigger value="pengeluaran">Pengeluaran Pembiayaan</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab}>
            <div className="content-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs font-semibold">Kd_Rincian</TableHead>
                    <TableHead className="text-xs font-semibold">Nama_Rincian</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Anggaran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Belum ada data</TableCell></TableRow>
                  ) : filtered.map(item => (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer transition-colors ${selectedId === item.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/30"}`}
                      onClick={() => { if (mode === "view") setSelectedId(item.id); }}
                    >
                      <TableCell className="font-mono text-xs">{item.kodeRekening}</TableCell>
                      <TableCell className="text-sm">{item.namaRekening}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{item.anggaran.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Detail Panel */}
        <div className="content-card p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold">Kode</Label>
                {mode !== "view" ? (
                  <Select value={form.kodeRekening} onValueChange={v => { const r = filteredRekening.find(x => x.kode === v); setForm({ ...form, kodeRekening: v, namaRekening: r?.uraian || "" }); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih Rekening" /></SelectTrigger>
                    <SelectContent>{filteredRekening.map(r => <SelectItem key={r.kode} value={r.kode}>{r.kode} — {r.uraian}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={selectedItem?.kodeRekening || ""} readOnly className="h-8 text-xs bg-muted" />
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold">Nama Rekening</Label>
                <Input value={mode !== "view" ? form.namaRekening : (selectedItem?.namaRekening || "")} readOnly className="h-8 text-xs bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-t pt-1"><Label className="text-xs font-bold">Anggaran</Label><span className="text-sm font-mono font-bold">{(mode !== "view" ? computedAnggaran : (selectedItem?.anggaran || 0)).toLocaleString("id-ID", { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>

          {mode !== "view" && (
            <div className="mt-4 pt-3 border-t space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Rincian</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Nomer Urut</Label><Input value="01" readOnly className="h-8 text-xs bg-muted" /></div>
                <div className="col-span-2"><Label className="text-xs">Uraian (Max 50 chr)</Label><Input value={form.uraian} onChange={e => setForm({ ...form, uraian: e.target.value })} maxLength={50} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Anggaran (Rp)</Label><Input value={computedAnggaran || ""} readOnly className="h-8 text-xs bg-muted" /></div>
                <div><Label className="text-xs">Harga Satuan (Rp)</Label><Input type="number" value={form.hargaSatuan || ""} onChange={e => setForm({ ...form, hargaSatuan: Number(e.target.value) })} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Jumlah Satuan</Label><Input value={form.jumlahSatuan} onChange={e => setForm({ ...form, jumlahSatuan: e.target.value })} className="h-8 text-xs" /></div>
              </div>
              <div>
                <Label className="text-xs">Sumber Dana</Label>
                <Select value={form.sumberDana} onValueChange={v => setForm({ ...form, sumberDana: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{sumberDanaData.map(s => <SelectItem key={s.kode} value={s.kode}>{s.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {mode === "view" && selectedItem && (
            <div className="mt-4 pt-3 border-t">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Rincian</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="text-xs">No</TableHead>
                    <TableHead className="text-xs">Uraian</TableHead>
                    <TableHead className="text-xs text-right">Anggaran</TableHead>
                    <TableHead className="text-xs text-right">Harga Satuan</TableHead>
                    <TableHead className="text-xs">Sumber Dana</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs">01</TableCell>
                    <TableCell className="text-xs">{selectedItem.uraian || "-"}</TableCell>
                    <TableCell className="text-xs text-right">{selectedItem.anggaran.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-xs text-right">{selectedItem.hargaSatuan.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-xs">{sumberDanaData.find(s => s.kode === selectedItem.sumberDana)?.nama || selectedItem.sumberDana}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t bg-secondary/30 px-4 py-2 flex items-center gap-2">
        <Button size="sm" variant={mode === "tambah" ? "default" : "outline"} onClick={handleTambah} disabled={mode !== "view"}>Tambah</Button>
        <Button size="sm" variant={mode === "ubah" ? "default" : "outline"} onClick={handleUbah} disabled={mode !== "view"}>Ubah</Button>
        <Button size="sm" variant="outline" onClick={handleHapus} disabled={mode !== "view"} className="text-destructive hover:text-destructive">Hapus</Button>
        <Button size="sm" variant="outline" onClick={handleBatal} disabled={mode === "view"}>Batal</Button>
        <Button size="sm" onClick={handleSimpan} disabled={mode === "view"}>Simpan Tanpa Cetak</Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => window.history.back()}>Tutup</Button>
      </div>
    </div>
  );
}
