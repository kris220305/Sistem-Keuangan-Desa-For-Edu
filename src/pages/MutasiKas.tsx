import { useEffect, useMemo, useState } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress, getSessionId } from "@/lib/session-manager";
import { loadState, saveState, type PenerimaanItem } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadMutasiKas, saveMutasiKasLocal, type MutasiKasItem } from "@/data/mutasi-kas";
import { getEffectivePencairan, getSaldoTunai } from "@/lib/financial-engine";
import { saveMutasiKasAndSync } from "@/lib/mutasi-kas-sync";
import { appendMutasiKasAudit } from "@/data/mutasi-kas-audit";

function saveMutasi(d: MutasiKasItem[]) {
  saveMutasiKasAndSync(d, saveMutasiKasLocal);
}

export default function MutasiKas() {
  const sessionId = getSessionId();
  const [state, setState] = useState(loadState());
  const [items, setItems] = useState(loadMutasiKas());
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"tunai" | "mutasi">("tunai");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTanggal, setConfirmTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [confirmKeterangan, setConfirmKeterangan] = useState("");
  const [confirmNoBukti, setConfirmNoBukti] = useState("");
  const [confirmRekening, setConfirmRekening] = useState("");
  const [confirmNamaBank, setConfirmNamaBank] = useState("BPD Simulasi");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [isLeader, setIsLeader] = useState<boolean>(true);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [form, setForm] = useState<Omit<MutasiKasItem, 'id'>>({
    tanggal: new Date().toISOString().split("T")[0],
    noBukti: "",
    jenis: "setor",
    uraian: "",
    jumlah: 0,
    rekening: "",
    namaBank: "",
    createdAt: Date.now(),
    createdBySessionId: sessionId,
    createdByName: (() => { try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; } })(),
    sumberPenerimaanIds: [],
  });

  useEffect(() => {
    const onUpd = () => setState(loadState());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "siskeudes_mutasi_kas") setItems(loadMutasiKas());
    };
    const onMutasi = () => setItems(loadMutasiKas());
    window.addEventListener("siskeudes:state-updated", onUpd);
    window.addEventListener("storage", onStorage);
    window.addEventListener("siskeudes:mutasi-kas-updated", onMutasi);
    return () => {
      window.removeEventListener("siskeudes:state-updated", onUpd);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("siskeudes:mutasi-kas-updated", onMutasi);
    };
  }, []);

  useEffect(() => {
    if (!(isConvexEnabled && convex)) { setIsLeader(true); return; }
    const workMode = (() => {
      try { return localStorage.getItem("siskeudes_work_mode") || "individual"; } catch { return "individual"; }
    })();
    const groupId = (() => {
      try { return localStorage.getItem("siskeudes_group_id"); } catch { return null; }
    })();
    if (workMode !== "group" || !groupId) { setIsLeader(true); return; }
    void (async () => {
      try {
        const ok = await convex.query(anyApi.groups.isLeader, { groupId: groupId as never, sessionId });
        setIsLeader(!!ok);
      } catch {
        setIsLeader(false);
      }
    })();
  }, [sessionId]);

  const pendingTunai = useMemo(() => {
    const list = (state.penerimaan || []).filter((p) => p.jenis === "tunai");
    return list.filter((p) => !p.sudahMutasi);
  }, [state.penerimaan]);

  const pengeluaranTunai = useMemo(() => {
    const outPencairan = getEffectivePencairan(state)
      .filter((p) => p.pembayaran === "tunai")
      .map((p) => ({ id: p.id, tanggal: p.tanggal, noBukti: p.nomorPencairan, uraian: `Pencairan SPP (${p.noCek})`, jumlah: p.jumlah || 0 }));
    const outPajak = (state.penyetoranPajak || [])
      .filter((p) => p.jenis === "tunai")
      .map((p) => ({ id: p.id, tanggal: p.tanggal, noBukti: p.noBukti, uraian: `Penyetoran Pajak (${p.kodeMAP})`, jumlah: p.jumlah || 0 }));
    return [...outPencairan, ...outPajak].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [state]);

  const saldoTunai = useMemo(() => getSaldoTunai(state, items), [state, items]);

  const canMutate = isLeader && (() => {
    try { return !localStorage.getItem("siskeudes_admin_impersonate"); } catch { return true; }
  })();

  const fmt = (n: number) => (n || 0).toLocaleString("id-ID", { minimumFractionDigits: 2 });

  const selectedPending = useMemo(() => {
    const picked = pendingTunai.filter((p) => !!selectedIds[p.id]);
    return picked;
  }, [pendingTunai, selectedIds]);

  const selectedTotal = useMemo(
    () => selectedPending.reduce((s, p) => s + (p.jumlah || 0), 0),
    [selectedPending],
  );

  const applyTransfer = (picked: PenerimaanItem[], tanggal: string, noBukti: string, rekening: string, namaBank: string, uraian: string) => {
    const total = picked.reduce((s, p) => s + (p.jumlah || 0), 0);
    if (!picked.length) { toast.error("Pilih transaksi tunai terlebih dahulu."); return false; }
    if (total <= 0) { toast.error("Total mutasi harus lebih dari 0."); return false; }
    if (total > saldoTunai) { toast.error("Mutasi melebihi saldo kas yang tersedia."); return false; }
    if (!canMutate) { toast.error("Anda tidak memiliki akses untuk melakukan mutasi."); return false; }
    if (!tanggal || !noBukti) { toast.error("Tanggal dan No Bukti wajib diisi."); return false; }

    const newMutasi: MutasiKasItem = {
      id: crypto.randomUUID(),
      tanggal,
      noBukti,
      jenis: "setor",
      uraian: uraian || "Setor tunai ke bank",
      jumlah: total,
      rekening: rekening || "1.1.1.02",
      namaBank: namaBank || "BPD Simulasi",
      createdAt: Date.now(),
      createdBySessionId: sessionId,
      createdByName: (() => { try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; } })(),
      sumberPenerimaanIds: picked.map((p) => p.id),
    };

    const nextMutasi = [...items, newMutasi];
    try {
      appendMutasiKasAudit({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        at: Date.now(),
        action: "create",
        mutasiId: newMutasi.id,
        bySessionId: sessionId,
        byName: newMutasi.createdByName,
        mutasi: newMutasi,
        source: { type: "mutasi-kas" },
      });
    } catch {}
    saveMutasi(nextMutasi);
    setItems(nextMutasi);

    const nextState = loadState();
    nextState.penerimaan = (nextState.penerimaan || []).map((p) =>
      picked.some((x) => x.id === p.id) ? { ...p, sudahMutasi: true } : p,
    );
    saveState(nextState);
    setState(nextState);

    setSelectedIds({});
    void trackFormProgress("mutasi");
    toast.success("Mutasi kas ke bank berhasil dicatat.");
    return true;
  };

  const handleSave = () => {
    if (!canMutate) { toast.error("Anda tidak memiliki akses untuk melakukan mutasi."); return; }
    if (!form.tanggal || !form.noBukti) { toast.error("Tanggal dan No Bukti wajib diisi."); return; }
    if (!form.jumlah || form.jumlah <= 0) { toast.error("Jumlah mutasi harus lebih dari 0."); return; }
    if (form.jenis === "setor" && form.jumlah > saldoTunai) { toast.error("Mutasi melebihi saldo kas yang tersedia."); return; }

    const now = Date.now();
    const newMutasi = {
      ...form,
      id: (crypto?.randomUUID ? crypto.randomUUID() : String(now)),
      createdAt: now,
      createdBySessionId: sessionId,
      createdByName: (() => { try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; } })(),
    } as MutasiKasItem;
    const updated = [...items, newMutasi];
    try {
      appendMutasiKasAudit({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(now),
        at: now,
        action: "create",
        mutasiId: newMutasi.id,
        bySessionId: sessionId,
        byName: newMutasi.createdByName,
        mutasi: newMutasi,
        source: { type: "mutasi-kas-manual" },
      });
    } catch {}
    saveMutasi(updated);
    setItems(updated);
    void trackFormProgress("mutasi");
    setShowForm(false);
    setForm({
      tanggal: new Date().toISOString().split("T")[0],
      noBukti: "",
      jenis: "setor",
      uraian: "",
      jumlah: 0,
      rekening: "",
      namaBank: "",
      createdAt: Date.now(),
      createdBySessionId: sessionId,
      createdByName: (() => { try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; } })(),
      sumberPenerimaanIds: [],
    });
  };

  const handleDelete = (id: string) => {
    if (!canMutate) { toast.error("Anda tidak memiliki akses untuk melakukan mutasi."); return; }
    const removed = items.find((i) => i.id === id);
    if (removed) {
      try {
        appendMutasiKasAudit({
          id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
          at: Date.now(),
          action: "delete",
          mutasiId: removed.id,
          bySessionId: sessionId,
          byName: (() => { try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; } })(),
          mutasi: removed,
          source: { type: "mutasi-kas" },
        });
      } catch {}
    }
    const updated = items.filter(i => i.id !== id);
    saveMutasi(updated);
    setItems(updated);
    const src = removed?.sumberPenerimaanIds || [];
    if (src.length > 0) {
      const still = new Set<string>();
      for (const it of updated) {
        for (const sid of it.sumberPenerimaanIds || []) still.add(sid);
      }
      const nextState = loadState();
      nextState.penerimaan = (nextState.penerimaan || []).map((p) =>
        src.includes(p.id) && !still.has(p.id) ? { ...p, sudahMutasi: false } : p,
      );
      saveState(nextState);
      setState(nextState);
    }
  };

  const filteredHistory = useMemo(() => {
    const s = filterStart ? new Date(filterStart).getTime() : null;
    const e = filterEnd ? new Date(filterEnd).getTime() : null;
    return items
      .filter((m) => {
        const t = new Date(m.tanggal).getTime();
        if (s !== null && t < s) return false;
        if (e !== null && t > e) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [items, filterStart, filterEnd]);

  const labelJenis = (j: MutasiKasItem["jenis"]) => {
    if (j === "setor") return "Setor";
    if (j === "ambil") return "Ambil";
    if (j === "masuk") return "Masuk";
    if (j === "keluar") return "Keluar";
    return j as string;
  };

  const recap = useMemo(() => {
    const byDay = new Map<string, number>();
    const byWeek = new Map<string, number>();
    const byMonth = new Map<string, number>();
    for (const m of filteredHistory) {
      if (m.jenis !== "setor") continue;
      const day = m.tanggal;
      const dt = new Date(m.tanggal + "T00:00:00");
      const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      const weekKey = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      const month = m.tanggal.slice(0, 7);
      byDay.set(day, (byDay.get(day) || 0) + (m.jumlah || 0));
      byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + (m.jumlah || 0));
      byMonth.set(month, (byMonth.get(month) || 0) + (m.jumlah || 0));
    }
    const days = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const weeks = Array.from(byWeek.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const months = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return { days, weeks, months };
  }, [filteredHistory]);

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Mutasi Kas" subtitle="Penyetoran Penerimaan ke Bank / Pengambilan dari Bank" />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs">
            <span className="font-semibold">Saldo Kas (Tunai):</span>{" "}
            <span className={`${saldoTunai < 0 ? "text-destructive" : ""}`}>Rp {fmt(saldoTunai)}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "tunai" ? "default" : "outline"} onClick={() => setTab("tunai")}>
              Transaksi Tunai
            </Button>
            <Button size="sm" variant={tab === "mutasi" ? "default" : "outline"} onClick={() => setTab("mutasi")}>
              Mutasi Kas
            </Button>
            <Button size="sm" disabled={!canMutate} onClick={() => setShowForm(true)}>Tambah Manual</Button>
          </div>
        </div>

        {tab === "tunai" && (
          <div className="space-y-4">
            <div className="content-card overflow-x-auto">
              <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">Penerimaan Tunai (Otomatis) — belum dimutasi ({pendingTunai.length})</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!selectedPending.length || !canMutate}
                    onClick={() => {
                      const picked = selectedPending;
                      const today = new Date().toISOString().slice(0, 10);
                      const dates = picked.map((p) => p.tanggal).filter(Boolean);
                      const sameDate = dates.length > 0 && dates.every((d) => d === dates[0]);
                      const defaultTanggal = dates.length === 0 ? today : (sameDate ? dates[0] : dates.slice().sort().at(-1) || today);

                      const defaultNoBukti = (() => {
                        if (picked.length === 1) return picked[0].noBukti || "";
                        if (picked.length > 1) return `SETOR/${picked[0].noBukti || "TBP"}`;
                        return "";
                      })();

                      setConfirmTanggal(defaultTanggal);
                      setConfirmNoBukti(defaultNoBukti);
                      setConfirmRekening(picked[0]?.rekening || "1.1.1.02");
                      setConfirmNamaBank(picked[0]?.namaBank || "BPD Simulasi");
                      setConfirmKeterangan(`Setor tunai ke bank (${selectedPending.length} transaksi)`);
                      setConfirmOpen(true);
                    }}
                  >
                    Setor ke Bank
                  </Button>
                </div>
              </div>
              {!canMutate && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  Akses mutasi dibatasi: pada mode kelompok hanya ketua yang bisa melakukan mutasi.
                </div>
              )}
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left border-b border-border/60 w-10"></th>
                    <th className="px-3 py-2 text-left border-b border-border/60">Tanggal</th>
                    <th className="px-3 py-2 text-left border-b border-border/60">No Bukti</th>
                    <th className="px-3 py-2 text-left border-b border-border/60">Uraian</th>
                    <th className="px-3 py-2 text-right border-b border-border/60">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTunai.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Tidak ada penerimaan tunai baru</td></tr>
                  ) : pendingTunai.map(p => {
                    const checked = !!selectedIds[p.id];
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedIds((prev) => ({ ...prev, [p.id]: !checked }))}
                      >
                        <td className="px-3 py-2"><input type="checkbox" readOnly checked={checked} /></td>
                        <td className="px-3 py-2">{p.tanggal}</td>
                        <td className="px-3 py-2 font-mono">{p.noBukti}</td>
                        <td className="px-3 py-2">{p.uraian}</td>
                        <td className="px-3 py-2 text-right">{fmt(p.jumlah)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {pendingTunai.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold">Terpilih</td>
                      <td className="px-3 py-2 text-right font-semibold">Rp {fmt(selectedTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="content-card overflow-x-auto">
              <div className="p-3 border-b border-border/60">
                <div className="text-xs font-semibold">Pengeluaran Tunai (Otomatis)</div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left border-b border-border/60">Tanggal</th>
                    <th className="px-3 py-2 text-left border-b border-border/60">No Bukti</th>
                    <th className="px-3 py-2 text-left border-b border-border/60">Uraian</th>
                    <th className="px-3 py-2 text-right border-b border-border/60">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {pengeluaranTunai.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Tidak ada pengeluaran tunai</td></tr>
                  ) : pengeluaranTunai.map(x => (
                    <tr key={x.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-2">{x.tanggal}</td>
                      <td className="px-3 py-2 font-mono">{x.noBukti}</td>
                      <td className="px-3 py-2">{x.uraian}</td>
                      <td className="px-3 py-2 text-right">{fmt(x.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "mutasi" && (
          <div className="content-card overflow-x-auto">
            <div className="p-3 border-b border-border/60 flex items-end justify-between gap-3 flex-wrap">
              <div className="text-xs font-semibold">Histori Mutasi Kas ↔ Bank</div>
              <div className="flex gap-2 items-end flex-wrap">
                <div>
                  <Label className="text-[10px]">Dari</Label>
                  <Input type="date" className="h-8 text-xs" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px]">Sampai</Label>
                  <Input type="date" className="h-8 text-xs" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left border-b border-border/60">Tanggal</th>
                  <th className="px-3 py-2 text-left border-b border-border/60">No Bukti</th>
                  <th className="px-3 py-2 text-center border-b border-border/60">Jenis</th>
                  <th className="px-3 py-2 text-left border-b border-border/60">Uraian</th>
                  <th className="px-3 py-2 text-right border-b border-border/60">Jumlah</th>
                  <th className="px-3 py-2 text-left border-b border-border/60">Rekening</th>
                  <th className="px-3 py-2 text-left border-b border-border/60">Nama Bank</th>
                  <th className="px-3 py-2 text-left border-b border-border/60">User</th>
                  <th className="px-3 py-2 text-center border-b border-border/60">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Belum ada data</td></tr>
                ) : filteredHistory.map(item => (
                  <tr key={item.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2">{item.tanggal}</td>
                    <td className="px-3 py-2 font-mono">{item.noBukti}</td>
                    <td className="px-3 py-2 text-center capitalize">{labelJenis(item.jenis)}</td>
                    <td className="px-3 py-2">{item.uraian}</td>
                    <td className="px-3 py-2 text-right">{fmt(item.jumlah)}</td>
                    <td className="px-3 py-2">{item.rekening}</td>
                    <td className="px-3 py-2">{item.namaBank}</td>
                    <td className="px-3 py-2">{item.createdByName || item.createdBySessionId || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)}>Hapus</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] font-semibold mb-2">Rekap Harian (Setor)</div>
                <div className="max-h-[160px] overflow-auto border border-border rounded">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50"><th className="px-3 py-2 text-left border-b border-border/60">Tanggal</th><th className="px-3 py-2 text-right border-b border-border/60">Total</th></tr></thead>
                    <tbody>
                      {recap.days.length === 0 ? (
                        <tr><td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">—</td></tr>
                      ) : recap.days.map(([d, v]) => (
                        <tr key={d} className="border-b border-border/40"><td className="px-3 py-2">{d}</td><td className="px-3 py-2 text-right">Rp {fmt(v)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold mb-2">Rekap Mingguan (Setor)</div>
                <div className="max-h-[160px] overflow-auto border border-border rounded">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50"><th className="px-3 py-2 text-left border-b border-border/60">Minggu</th><th className="px-3 py-2 text-right border-b border-border/60">Total</th></tr></thead>
                    <tbody>
                      {recap.weeks.length === 0 ? (
                        <tr><td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">—</td></tr>
                      ) : recap.weeks.map(([w, v]) => (
                        <tr key={w} className="border-b border-border/40"><td className="px-3 py-2">{w}</td><td className="px-3 py-2 text-right">Rp {fmt(v)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold mb-2">Rekap Bulanan (Setor)</div>
                <div className="max-h-[160px] overflow-auto border border-border rounded">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50"><th className="px-3 py-2 text-left border-b border-border/60">Bulan</th><th className="px-3 py-2 text-right border-b border-border/60">Total</th></tr></thead>
                    <tbody>
                      {recap.months.length === 0 ? (
                        <tr><td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">—</td></tr>
                      ) : recap.months.map(([m, v]) => (
                        <tr key={m} className="border-b border-border/40"><td className="px-3 py-2">{m}</td><td className="px-3 py-2 text-right">Rp {fmt(v)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="content-card p-4 space-y-3">
            <h3 className="text-sm font-bold font-heading">Form Mutasi Kas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label className="text-xs">Tanggal</Label><Input type="date" value={form.tanggal} onChange={e => setForm({...form, tanggal: e.target.value})} className="text-xs h-8" /></div>
              <div><Label className="text-xs">No Bukti</Label><Input value={form.noBukti} onChange={e => setForm({...form, noBukti: e.target.value})} className="text-xs h-8" placeholder="0001/STS/05.2001/2024" /></div>
              <div>
                <Label className="text-xs">Jenis</Label>
                <Select value={form.jenis} onValueChange={v => setForm({...form, jenis: v as 'setor' | 'ambil'})}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setor" className="text-xs">Setor ke Bank</SelectItem>
                    <SelectItem value="ambil" className="text-xs">Ambil dari Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Uraian</Label><Input value={form.uraian} onChange={e => setForm({...form, uraian: e.target.value})} className="text-xs h-8" /></div>
              <div><Label className="text-xs">Jumlah</Label><Input type="number" value={form.jumlah} onChange={e => setForm({...form, jumlah: Number(e.target.value)})} className="text-xs h-8" /></div>
              <div><Label className="text-xs">Rekening Bank</Label><Input value={form.rekening} onChange={e => setForm({...form, rekening: e.target.value})} className="text-xs h-8" /></div>
              <div><Label className="text-xs">Nama Bank</Label><Input value={form.namaBank} onChange={e => setForm({...form, namaBank: e.target.value})} className="text-xs h-8" /></div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSave}>Simpan</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </div>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfirmasi Transfer Tunai ke Bank</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-xs">
                <div><span className="font-semibold">Jumlah:</span> Rp {fmt(selectedTotal)}</div>
                <div><span className="font-semibold">Saldo Kas tersedia:</span> Rp {fmt(saldoTunai)}</div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div><Label className="text-xs">Tanggal</Label><Input type="date" className="h-8 text-xs" value={confirmTanggal} onChange={(e) => setConfirmTanggal(e.target.value)} /></div>
                <div><Label className="text-xs">No Bukti</Label><Input className="h-8 text-xs" value={confirmNoBukti} onChange={(e) => setConfirmNoBukti(e.target.value)} /></div>
                <div><Label className="text-xs">Rekening Bank</Label><Input className="h-8 text-xs" value={confirmRekening} onChange={(e) => setConfirmRekening(e.target.value)} /></div>
                <div><Label className="text-xs">Nama Bank</Label><Input className="h-8 text-xs" value={confirmNamaBank} onChange={(e) => setConfirmNamaBank(e.target.value)} /></div>
                <div><Label className="text-xs">Keterangan</Label><Input className="h-8 text-xs" value={confirmKeterangan} onChange={(e) => setConfirmKeterangan(e.target.value)} /></div>
              </div>
              <div className="max-h-[160px] overflow-auto border border-border rounded">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted/50"><th className="px-3 py-2 text-left border-b border-border/60">No Bukti</th><th className="px-3 py-2 text-left border-b border-border/60">Uraian</th><th className="px-3 py-2 text-right border-b border-border/60">Jumlah</th></tr></thead>
                  <tbody>
                    {selectedPending.map((p) => (
                      <tr key={p.id} className="border-b border-border/40">
                        <td className="px-3 py-2 font-mono">{p.noBukti}</td>
                        <td className="px-3 py-2">{p.uraian}</td>
                        <td className="px-3 py-2 text-right">{fmt(p.jumlah)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  const ok = applyTransfer(selectedPending, confirmTanggal, confirmNoBukti, confirmRekening, confirmNamaBank, confirmKeterangan);
                  if (ok) setConfirmOpen(false);
                }}
              >
                Konfirmasi Transfer
              </Button>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Batal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
