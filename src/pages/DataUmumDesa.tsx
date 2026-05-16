import { useState, useEffect, useCallback } from "react";
import { defaultDesaProfile, type DesaProfile } from "@/data/siskeudes-data";
import { villageProfiles } from "@/data/village-profiles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, MapPin, Users, User, Crown, UserPlus, LogOut, Eye, Plus } from "lucide-react";
import {
  upsertSession,
  leaveCurrentGroup,
  getGroupMembers,
  getAllGroupsWithCounts,
  previewGroupFormData,
  getSessionId,
  type GroupWithMemberCount,
} from "@/lib/session-manager";
import { useNavigate } from "react-router-dom";
import FormPageHeader from "@/components/FormPageHeader";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

interface GroupMember {
  id: string;
  session_id: string;
  user_name: string;
  is_leader: boolean;
  joined_at: string;
}

export default function DataUmumDesa() {
  const navigate = useNavigate();
  const sessionId = getSessionId();
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  const [selectedVillage, setSelectedVillage] = useState<string>("");
  const [userName, setUserName] = useState("Mahasiswa Demo");
  const [workMode, setWorkMode] = useState<"individual" | "group">("individual");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [villageGroups, setVillageGroups] = useState<GroupWithMemberCount[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [allGroups, setAllGroups] = useState<GroupWithMemberCount[]>([]);
  const [previewGroup, setPreviewGroup] = useState<GroupWithMemberCount | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [profile, setProfile] = useState<DesaProfile>(() => {
    try {
      const saved = localStorage.getItem('siskeudes_desa_profile');
      return saved ? { ...defaultDesaProfile, ...JSON.parse(saved) } : defaultDesaProfile;
    } catch { return defaultDesaProfile; }
  });

  useEffect(() => {
    const savedVillage = localStorage.getItem('siskeudes_selected_village');
    const savedName = localStorage.getItem('siskeudes_user_name');
    const savedMode = localStorage.getItem('siskeudes_work_mode') as "individual" | "group" | null;
    const savedGroupId = localStorage.getItem('siskeudes_group_id');
    if (savedVillage) {
      setSelectedVillage(savedVillage);
      void refreshVillageGroups(savedVillage);
    }
    if (savedName) setUserName(savedName);
    if (savedMode) setWorkMode(savedMode);
    if (savedGroupId) {
      setGroupId(savedGroupId);
      loadGroupMembers(savedGroupId);
    }
  }, []);

  const loadGroupMembers = async (gId: string) => {
    if (isConvexEnabled && convex) {
      const members = await convex.query(anyApi.groups.members, { groupId: gId as never });
      setGroupMembers(members as unknown as GroupMember[]);
      return;
    }
    const members = await getGroupMembers(gId);
    setGroupMembers(members as GroupMember[]);
  };

  const refreshVillageGroups = useCallback(async (villageId: string) => {
    if (isConvexEnabled && convex) {
      try {
        const groups = await Promise.race([
          convex.query(anyApi.groups.listForVillage, { villageId }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout memuat daftar kelompok.")), 8000)),
        ]);
        setVillageGroups(groups as unknown as GroupWithMemberCount[]);
      } catch (e) {
        setVillageGroups([]);
        const msg = e instanceof Error ? e.message : "Gagal memuat daftar kelompok.";
        toast.error(msg);
      }
      return;
    }
    const all = await getAllGroupsWithCounts();
    setVillageGroups(all.filter((g) => g.village_id === villageId));
  }, []);

  const handleVillageSelect = async (villageId: string) => {
    const previousVillage = localStorage.getItem('siskeudes_selected_village');

    if (previousVillage && previousVillage !== villageId) {
      const { saveState } = await import("@/data/app-state");
      saveState({
        pendapatan: [], belanja: [], pembiayaan: [], penerimaan: [],
        silpa: [], spp: [], pencairan: [], penyetoranPajak: [],
        saldoAwal: [], spjPanjar: [], jurnalUmum: [], kegiatanAnggaran: [],
      });
      localStorage.removeItem('siskeudes_mutasi_kas');
      // leave current group when switching village
      await leaveCurrentGroup();
      setGroupId(null);
      setGroupMembers([]);
      toast.info("Data form direset karena pindah desa.");
    }

    setSelectedVillage(villageId);
    const village = villageProfiles.find((v) => v.id === villageId);
    if (village) setProfile(village.profile);
    await refreshVillageGroups(villageId);
  };

  const handleJoinSpecific = async (preferredGroupId?: string) => {
    if (!userName.trim()) { toast.error("Nama pengisi harus diisi!"); return; }
    if (!selectedVillage) { toast.error("Pilih desa terlebih dahulu!"); return; }

    localStorage.setItem('siskeudes_desa_profile', JSON.stringify(profile));
    localStorage.setItem('siskeudes_selected_village', selectedVillage);
    localStorage.setItem('siskeudes_user_name', userName);
    localStorage.setItem('siskeudes_work_mode', 'group');
    setWorkMode('group');

    setGroupLoading(true);
    try { localStorage.setItem('siskeudes_sync_pause_until', String(Date.now() + 15000)); } catch {}
    try {
      void upsertSession({
        user_name: userName,
        village_id: selectedVillage,
        village_name: profile.namaDesa,
        form_progress: { data_umum: true },
        work_mode: "group",
        group_id: null,
      });

      let gId: string;
      if (isConvexEnabled && convex) {
        toast.info("Menghubungkan ke server realtime…", { duration: 1200 });
        let maxMembers = 50;
        try {
          const limit = await convex.query(anyApi.groupLimits.getForVillage, {
            villageId: selectedVillage,
            villageName: profile.namaDesa,
          } as any);
          if ((limit as any)?.max_members) maxMembers = Number((limit as any).max_members);
        } catch {
          maxMembers = 50;
        }
        const res = await Promise.race([
          convex.mutation(anyApi.groups.joinGroup, {
            villageId: selectedVillage,
            villageName: profile.namaDesa,
            userName,
            sessionId,
            preferredGroupId: preferredGroupId ? (preferredGroupId as never) : undefined,
            maxMembers,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Join kelompok terlalu lama. Pastikan Convex sudah ter-deploy dan coba lagi (atau refresh).",
                  ),
                ),
              20000,
            ),
          ),
        ]);
        gId = (res as { groupId: string }).groupId;
        localStorage.setItem("siskeudes_group_id", gId);
        // Pre-warm the groupStates subscription (fire-and-forget query, not a mutation)
        try { void convex.query(anyApi.groupStates.get, { groupId: gId as never }); } catch {}
      } else {
        const { joinGroupSmart } = await import("@/lib/session-manager");
        gId = await Promise.race<string>([
          joinGroupSmart(selectedVillage, profile.namaDesa, userName, preferredGroupId),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Server sedang sibuk saat join kelompok. Silakan coba lagi.")), 9000),
          ),
        ]);
      }
      setGroupId(gId);
      navigate("/group-room");
      toast.success("Berhasil bergabung ke kelompok!");
      window.dispatchEvent(new StorageEvent('storage', { key: 'siskeudes_group_id' }));
      window.dispatchEvent(new CustomEvent("siskeudes:request-group-pull"));
      window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));

      void (async () => {
        try {
          await upsertSession({
            user_name: userName,
            village_id: selectedVillage,
            village_name: profile.namaDesa,
            form_progress: { data_umum: true },
            work_mode: "group",
            group_id: gId,
          });
        } catch {}
        try { await loadGroupMembers(gId); } catch {}
        try { await refreshVillageGroups(selectedVillage); } catch {}
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal bergabung kelompok";
      toast.error(msg);
    } finally {
      try { localStorage.removeItem('siskeudes_sync_pause_until'); } catch {}
      setGroupLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setGroupLoading(true);
    try { localStorage.setItem('siskeudes_sync_pause_until', String(Date.now() + 12000)); } catch {}
    try {
      if (isConvexEnabled && convex) {
        await convex.mutation(anyApi.groups.leaveGroup, { sessionId });
        try { localStorage.removeItem("siskeudes_group_id"); } catch {}
      } else {
        await leaveCurrentGroup();
      }
      setGroupId(null);
      setGroupMembers([]);
      if (selectedVillage) await refreshVillageGroups(selectedVillage);
      toast.success("Anda telah keluar dari kelompok. Anda bisa join kelompok lain sekarang.");
      window.dispatchEvent(new StorageEvent('storage', { key: 'siskeudes_group_id' }));
    } finally {
      try { localStorage.removeItem('siskeudes_sync_pause_until'); } catch {}
      setGroupLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userName.trim()) { toast.error("Nama pengisi harus diisi!"); return; }
    if (!selectedVillage) { toast.error("Pilih desa terlebih dahulu!"); return; }

    localStorage.setItem('siskeudes_desa_profile', JSON.stringify(profile));
    localStorage.setItem('siskeudes_selected_village', selectedVillage);
    localStorage.setItem('siskeudes_user_name', userName);
    localStorage.setItem('siskeudes_work_mode', workMode);

    if (workMode === "group") {
      // auto-join (first non-full or new) for the selected village
      await handleJoinSpecific(undefined);
    } else {
      await leaveCurrentGroup();
      setGroupId(null);
      setGroupMembers([]);

      await upsertSession({
        user_name: userName,
        village_id: selectedVillage,
        village_name: profile.namaDesa,
        form_progress: { data_umum: true },
        work_mode: "individual",
        group_id: null,
      });

      toast.success("Data Umum Desa berhasil disimpan");
    }
  };

  const openBrowse = async () => {
    const all = isConvexEnabled && convex
      ? await convex.query(anyApi.groups.listAllWithCounts, {})
      : await getAllGroupsWithCounts();
    setAllGroups(all);
    setBrowseOpen(true);
  };

  const openPreview = async (g: GroupWithMemberCount) => {
    setPreviewGroup(g);
    if (isConvexEnabled && convex) {
      const doc = await convex.query(anyApi.groupStates.get, { groupId: g.id as never });
      const state = (doc as { state?: unknown } | null)?.state;
      setPreviewData(state && typeof state === "object" ? (state as Record<string, unknown>) : null);
      return;
    }
    const data = await previewGroupFormData(g.id);
    setPreviewData(data);
  };

  const summarize = (data: Record<string, unknown> | null) => {
    if (!data) return null;
    const counts: Array<[string, number]> = [];
    const keys = ["pendapatan","belanja","pembiayaan","penerimaan","spp","pencairan","penyetoranPajak","jurnalUmum","kegiatanAnggaran","mutasiKas"];
    for (const k of keys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) counts.push([k, v.length]);
    }
    return counts;
  };

  const fields: { label: string; key: keyof DesaProfile; span?: number }[] = [
    { label: "Nama Desa", key: "namaDesa" },
    { label: "Kecamatan", key: "kecamatan" },
    { label: "Kabupaten/Kota", key: "kabupaten" },
    { label: "Provinsi", key: "provinsi" },
    { label: "Tahun Anggaran", key: "tahunAnggaran" },
    { label: "NPWP Desa", key: "npwpDesa" },
    { label: "Nama Kepala Desa", key: "kepalaDesaNama" },
    { label: "NIP Kepala Desa", key: "kepalaDesaNIP" },
    { label: "Nama Sekretaris", key: "sekretarisNama" },
    { label: "NIP Sekretaris", key: "sekretarisNIP" },
    { label: "Nama Bendahara", key: "bendaharaNama" },
    { label: "NIP Bendahara", key: "bendaharaNIP" },
    { label: "Alamat Kantor Desa", key: "alamatKantor", span: 2 },
    { label: "Kode Pos", key: "kodePos" },
  ];

  const update = (key: keyof DesaProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <FormPageHeader title="Data Umum Desa" subtitle="Identitas desa, perangkat, dan tahun anggaran">
        <Button variant="outline" size="sm" onClick={openBrowse} className="gap-2">
          <Eye size={14} /> Lihat Kelompok Lain
        </Button>
        <Button onClick={handleSave} className="gap-2" disabled={groupLoading}>
          <Save size={16} /> {groupLoading ? "Memproses..." : "Simpan"}
        </Button>
      </FormPageHeader>
      <div className="p-6">
        <div className="content-card p-6 space-y-6">
          {/* Village Selection & User Name */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Pilih Desa & Identitas Pengisi</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pilih Desa *</Label>
                <Select value={selectedVillage} onValueChange={handleVillageSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Pilih Desa --" />
                  </SelectTrigger>
                  <SelectContent>
                    {villageProfiles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        Desa {v.profile.namaDesa} — {v.profile.kecamatan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nama Pengisi / User *</Label>
                <Input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Masukkan nama Anda"
                />
              </div>
            </div>
          </div>

          {/* Work Mode Selection */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-accent" />
              <span className="text-sm font-semibold text-foreground">Mode Pengerjaan</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setWorkMode("individual")}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  workMode === "individual"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <User size={20} className={workMode === "individual" ? "text-primary" : "text-muted-foreground"} />
                  <span className="font-semibold text-sm">Individu</span>
                </div>
                <p className="text-xs text-muted-foreground">Mengerjakan sendiri semua form keuangan desa</p>
              </button>
              <button
                onClick={() => setWorkMode("group")}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  workMode === "group"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users size={20} className={workMode === "group" ? "text-primary" : "text-muted-foreground"} />
                  <span className="font-semibold text-sm">Kelompok</span>
                </div>
                <p className="text-xs text-muted-foreground">Bersama (max mengikuti aturan kelompok). Progress sinkron real-time.</p>
              </button>
            </div>

            {/* Group Selection: list Kelompok A/B/C for this village */}
            {workMode === "group" && selectedVillage && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users size={14} /> Kelompok di Desa {profile.namaDesa}
                  </h4>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handleJoinSpecific(undefined)} disabled={groupLoading}>
                    <Plus size={12} /> Buat / Auto-Join
                  </Button>
                </div>

                {villageGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada kelompok. Klik "Buat / Auto-Join" untuk membuat Kelompok A.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {villageGroups.map((g) => {
                      const isMine = groupId === g.id;
                      const max = (g.max_members ?? 20) as number;
                      return (
                        <div key={g.id} className={`p-3 rounded-lg border-2 transition-colors ${isMine ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{g.name || "Kelompok"}</span>
                              {isMine && <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary">Anda di sini</Badge>}
                            </div>
                            <Badge variant={g.is_full ? "destructive" : "secondary"} className="text-[10px]">
                              {g.member_count}/{max}
                            </Badge>
                          </div>
                          <div className="flex gap-1.5">
                            {!isMine ? (
                              <Button size="sm" variant="default" className="flex-1 h-7 text-xs" disabled={g.is_full || groupLoading} onClick={() => handleJoinSpecific(g.id)}>
                                <UserPlus size={12} className="mr-1" /> {g.is_full ? "Penuh" : "Join"}
                              </Button>
                            ) : (
                              <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={handleLeaveGroup} disabled={groupLoading}>
                                <LogOut size={12} className="mr-1" /> Keluar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPreview(g)}>
                              <Eye size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Current group members */}
            {workMode === "group" && groupId && groupMembers.length > 0 && (
              <div className="mt-4 p-3 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users size={14} /> Anggota Kelompok Aktif ({groupMembers.length})
                  </h4>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate("/group-room")}>
                    <UserPlus size={12} className="mr-1" /> Lihat Room
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {groupMembers.map((m) => (
                    <div key={m.id} className={`flex items-center gap-2 text-xs p-2 rounded ${m.session_id === sessionId ? "bg-primary/10 border border-primary/30" : "bg-muted/50"}`}>
                      {m.is_leader ? (
                        <Crown size={14} className="text-yellow-500 shrink-0" />
                      ) : (
                        <User size={14} className="text-muted-foreground shrink-0" />
                      )}
                      <span className={m.is_leader ? "font-semibold" : ""}>{m.user_name || "—"}</span>
                      {m.is_leader && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-yellow-100 text-yellow-700">Ketua</Badge>
                      )}
                      {m.session_id === sessionId && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary">Anda</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map((f) => (
              <div key={f.key} className={f.span === 2 ? "md:col-span-2" : ""}>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</Label>
                <Input
                  value={profile[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={`Masukkan ${f.label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Browse all groups across villages */}
      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Semua Kelompok (Lintas Desa)</DialogTitle>
            <DialogDescription>
              Lihat kelompok di desa lain. Anda bisa preview pekerjaan mereka. Untuk join, simpan dulu lalu keluar dari kelompok aktif.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {allGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Belum ada kelompok terdaftar.</p>}
            {allGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <div className="text-sm font-semibold">{g.name || "Kelompok"} — Desa {g.village_name}</div>
                  <div className="text-xs text-muted-foreground">{g.member_count}/{g.max_members ?? 20} anggota</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openPreview(g)}><Eye size={14} className="mr-1" /> Preview</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview group's work */}
      <Dialog open={!!previewGroup} onOpenChange={(o) => { if (!o) { setPreviewGroup(null); setPreviewData(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pekerjaan {previewGroup?.name} — Desa {previewGroup?.village_name}</DialogTitle>
            <DialogDescription>Ringkasan jumlah baris yang sudah diisi kelompok ini (read-only).</DialogDescription>
          </DialogHeader>
          {!previewData ? (
            <p className="text-sm text-muted-foreground py-4">Belum ada data pengisian.</p>
          ) : (
            <div className="space-y-1.5">
              {(summarize(previewData) || []).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-muted/50">
                  <span className="capitalize">{k}</span>
                  <Badge variant="secondary">{v} baris</Badge>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPreviewGroup(null); setPreviewData(null); }}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
