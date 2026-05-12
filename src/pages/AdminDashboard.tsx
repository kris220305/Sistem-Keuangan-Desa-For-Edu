import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Activity, Lock, Unlock, Eye, Trash2, RefreshCw, Shield, LogOut, Monitor, FileText, Camera, Download,
  AlertTriangle, UserX, Database, Eraser, ScanEye, Settings2, Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllSessions, getActiveSessions, getSiteSettings, updateSiteSettings, deleteSession, getSubmittedReports,
  getAllVillageGroupLimits, upsertVillageGroupLimit, type VillageGroupLimit,
} from "@/lib/session-manager";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { getScreenshotUrl } from "@/lib/screenshot-capture";
import { startImpersonation } from "@/lib/admin-impersonation";
import { villageProfiles } from "@/data/village-profiles";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

const FORM_STEPS = [
  { key: "data_umum", label: "Data Umum Desa" },
  { key: "pendapatan", label: "Pendapatan" },
  { key: "belanja", label: "Belanja" },
  { key: "pembiayaan", label: "Pembiayaan" },
  { key: "penerimaan", label: "Penerimaan" },
  { key: "penganggaran", label: "Penganggaran APBDes" },
  { key: "spp_definitif", label: "SPP Definitif" },
  { key: "spp_panjar", label: "SPP Panjar" },
  { key: "spp_pembiayaan", label: "SPP Pembiayaan" },
  { key: "pencairan", label: "Pencairan SPP" },
  { key: "spj", label: "SPJ Kegiatan" },
  { key: "pajak", label: "Penyetoran Pajak" },
  { key: "saldo_awal", label: "Saldo Awal" },
  { key: "jurnal", label: "Jurnal Umum" },
  { key: "mutasi", label: "Mutasi Kas" },
];

interface SessionRow {
  id: string;
  session_id: string;
  user_name: string;
  village_id: string;
  village_name: string;
  last_active: string;
  form_progress: Record<string, boolean>;
  form_data: Record<string, unknown>;
  created_at: string;
  work_mode: string;
  group_id: string | null;
}

interface ReportRow {
  id: string;
  group_id: string | null;
  session_id: string;
  submitted_by: string;
  village_id: string;
  village_name: string;
  report_data: Record<string, unknown>;
  created_at: string;
}

interface PdfFile {
  name: string;
  fullPath: string;
  url: string;
  folder: string;
  created_at: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const canUseSupabase = isSupabaseEnabled && !!supabase;
  const canUseConvex = isConvexEnabled && !!convex;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [siteSettings, setSiteSettings] = useState<{ is_locked: boolean; max_users: number | null }>({
    is_locked: false, max_users: 0,
  });
  const [lockDialog, setLockDialog] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [lockAction, setLockAction] = useState<"lock" | "unlock">("lock");
  const [selectedUser, setSelectedUser] = useState<SessionRow | null>(null);
  const [monitorUser, setMonitorUser] = useState<SessionRow | null>(null);
  const [screenshotKey, setScreenshotKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [villageLimits, setVillageLimits] = useState<Record<string, { min: number; max: number }>>({});
  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [all, active, settings, submitted, limits] = await Promise.all([
        getAllSessions(),
        getActiveSessions(2),
        getSiteSettings(),
        getSubmittedReports(),
        getAllVillageGroupLimits(),
      ]);
      setSessions(all as SessionRow[]);
      setActiveSessions(active as SessionRow[]);
      setReports(submitted as ReportRow[]);
      if (settings) setSiteSettings({ is_locked: settings.is_locked, max_users: settings.max_users });

      // Build limits map keyed by village_id with defaults for missing villages
      const map: Record<string, { min: number; max: number }> = {};
      villageProfiles.forEach((v) => {
        const found = limits.find((l) => l.village_id === v.id);
        map[v.id] = {
          min: found?.min_members ?? 1,
          max: found?.max_members ?? 10,
        };
      });
      setVillageLimits(map);

      if (canUseSupabase) {
        try {
          const { data: folders } = await supabase!.storage.from("report-pdfs").list("", { limit: 100 });
          if (folders) {
            const allPdfs: PdfFile[] = [];
            for (const folder of folders) {
              if (folder.id === null && folder.name === ".emptyFolderPlaceholder") continue;
              const { data: files } = await supabase!.storage.from("report-pdfs").list(folder.name, { limit: 50 });
              if (files) {
                for (const f of files) {
                  if (f.name.endsWith(".pdf")) {
                    const path = `${folder.name}/${f.name}`;
                    const { data: urlData } = supabase!.storage.from("report-pdfs").getPublicUrl(path);
                    allPdfs.push({
                      name: f.name, fullPath: path, url: urlData.publicUrl,
                      folder: folder.name, created_at: f.created_at || "",
                    });
                  }
                }
              }
            }
            allPdfs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setPdfFiles(allPdfs);
          }
        } catch { /* ignore */ }
      } else {
        setPdfFiles([]);
      }
    } catch (e) {
      toast.error("Gagal memuat data admin. Coba refresh.");
      setSessions([]);
      setActiveSessions([]);
      setReports([]);
      setPdfFiles([]);
    } finally {
      setLoading(false);
    }

  }, [canUseSupabase]);

  useEffect(() => {
    const token = (() => {
      try { return sessionStorage.getItem("siskeudes_admin_token"); } catch { return null; }
    })();
    if (!token) {
      navigate("/admin");
      return;
    }
    if (canUseConvex) {
      void (async () => {
        try {
          const ok = await convex!.query(anyApi.admin.validate, { adminToken: token } as any);
          if (!ok) {
            try { sessionStorage.removeItem("siskeudes_admin_token"); } catch {}
            try { sessionStorage.removeItem("siskeudes_admin"); } catch {}
            navigate("/admin");
          }
        } catch {}
      })();
    }
    refresh();
    const interval = setInterval(refresh, 5000);
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, navigate]);

  useEffect(() => {
    if (!monitorUser) return;
    const interval = setInterval(() => setScreenshotKey((k) => k + 1), 10000);
    return () => clearInterval(interval);
  }, [monitorUser]);

  const handleLockToggle = (action: "lock" | "unlock") => {
    setLockAction(action);
    setLockPassword("");
    setLockDialog(true);
  };

  const confirmLockAction = async () => {
    if (!canUseConvex) {
      toast.error("Verifikasi admin membutuhkan Convex.");
      return;
    }
    try {
      const res = await convex!.mutation(anyApi.admin.login, { password: lockPassword } as any);
      sessionStorage.setItem("siskeudes_admin_token", (res as any).token);
      sessionStorage.setItem("siskeudes_admin", "true");
    } catch (e) {
      toast.error((e as Error)?.message || "Password salah!");
      return;
    }
    await updateSiteSettings({ is_locked: lockAction === "lock" });
    toast.success(lockAction === "lock" ? "Website telah dikunci" : "Website telah dibuka kembali");
    setLockDialog(false);
    refresh();
  };

  const handleKickUser = (s: SessionRow) => {
    setConfirmAction({
      title: `Kick User: ${s.user_name || "—"}`,
      description: `User "${s.user_name || s.session_id}" akan langsung dikeluarkan dari sistem dalam beberapa detik. Session, progress, dan data form mereka dihapus permanen — mereka harus membuka link lagi untuk masuk kembali.`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Fitur kick admin membutuhkan Supabase (untuk memaksa logout user).");
          return;
        }
        // 1. Remove from groups first (FK)
        if (s.group_id) {
          await supabase!.from("group_members").delete().eq("session_id", s.session_id);
        }
        // 2. Delete the session row → triggers kick-detection on user side
        const { error } = await supabase
          .from("user_sessions")
          .delete()
          .eq("session_id", s.session_id);
        if (error) {
          toast.error(`Gagal kick user: ${error.message}`);
          return;
        }
        // 3. Cleanup screenshots
        try {
          await supabase!.storage.from("screenshots").remove([`${s.session_id}.png`]);
        } catch { /* ignore */ }

        toast.success(`User "${s.user_name || s.session_id}" dikeluarkan. User akan otomatis logout dalam ±4 detik.`);
        refresh();
      },
    });
  };

  const handleKickAllUsers = () => {
    setConfirmAction({
      title: "Kick Semua User",
      description: `PERINGATAN: Semua ${sessions.length} user akan langsung dikeluarkan dari sistem dalam beberapa detik. Session, progress, dan data form mereka akan hilang permanen.`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Fitur kick massal membutuhkan Supabase.");
          return;
        }
        // Bulk delete group members + groups + sessions
        const { error: gmErr } = await supabase
          .from("group_members")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: gErr } = await supabase
          .from("groups")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: sErr } = await supabase
          .from("user_sessions")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (gmErr || gErr || sErr) {
          toast.error(`Gagal hapus sebagian data: ${(sErr || gErr || gmErr)?.message}`);
        }

        // Cleanup all screenshots
        try {
          const paths = sessions.map((x) => `${x.session_id}.png`);
          if (paths.length > 0) await supabase!.storage.from("screenshots").remove(paths);
        } catch { /* ignore */ }

        toast.success(`${sessions.length} user dikeluarkan. Mereka akan otomatis logout.`);
        refresh();
      },
    });
  };

  const handleDeleteAllReports = () => {
    setConfirmAction({
      title: "Hapus Semua Laporan",
      description: `PERINGATAN: Ini akan menghapus semua ${reports.length} laporan yang telah dikirim. Tindakan ini tidak bisa dibatalkan.`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Fitur laporan admin membutuhkan Supabase.");
          return;
        }
        const { error } = await supabase
          .from("report_submissions")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          toast.error(`Gagal: ${error.message}`);
          return;
        }
        toast.success(`${reports.length} laporan berhasil dihapus`);
        refresh();
      },
    });
  };

  const handleDeleteReport = (r: ReportRow) => {
    setConfirmAction({
      title: "Hapus Laporan",
      description: `Hapus laporan dari "${r.village_name}" yang dikirim oleh "${r.submitted_by}"?`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Fitur laporan admin membutuhkan Supabase.");
          return;
        }
        await supabase!.from("report_submissions").delete().eq("id", r.id);
        toast.success("Laporan berhasil dihapus");
        refresh();
      },
    });
  };

  const handleDeleteAllPdfs = () => {
    setConfirmAction({
      title: "Hapus Semua PDF",
      description: `PERINGATAN: Ini akan menghapus semua ${pdfFiles.length} file PDF laporan. Tindakan ini tidak bisa dibatalkan.`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Fitur PDF admin membutuhkan Supabase Storage.");
          return;
        }
        const paths = pdfFiles.map((p) => p.fullPath);
        if (paths.length > 0) {
          await supabase!.storage.from("report-pdfs").remove(paths);
        }
        toast.success("Semua PDF berhasil dihapus");
        refresh();
      },
    });
  };

  const handleResetUserProgress = (s: SessionRow) => {
    setConfirmAction({
      title: `Reset Progress: ${s.user_name || "—"}`,
      description: `Progress dan SEMUA data form (Penganggaran, Penatausahaan, Pembukuan, Laporan) milik user "${s.user_name}" akan direset ke kosong. Aplikasi user akan otomatis dimuat ulang dalam beberapa detik.`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Reset progress via admin membutuhkan Supabase.");
          return;
        }
        const { error } = await supabase
          .from("user_sessions")
          .update({
            form_progress: {} as never,
            form_data: {} as never,
            last_active: new Date().toISOString(),
          })
          .eq("session_id", s.session_id);
        if (error) {
          toast.error(`Gagal reset: ${error.message}`);
          return;
        }
        toast.success(`Progress "${s.user_name}" berhasil direset. User akan refresh otomatis.`);
        refresh();
      },
    });
  };

  const handleResetAllProgress = () => {
    setConfirmAction({
      title: "Reset Semua Progress",
      description: `PERINGATAN: Semua progress dan SELURUH data form (Penganggaran, Penatausahaan, Pembukuan, Laporan) dari ${sessions.length} user akan dihapus total. Aplikasi mereka akan otomatis dimuat ulang. Tindakan ini tidak dapat dibatalkan.`,
      action: async () => {
        if (!canUseSupabase) {
          toast.error("Reset massal via admin membutuhkan Supabase.");
          return;
        }
        // Single bulk update
        const { error } = await supabase
          .from("user_sessions")
          .update({
            form_progress: {} as never,
            form_data: {} as never,
            last_active: new Date().toISOString(),
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          toast.error(`Gagal reset: ${error.message}`);
          return;
        }
        toast.success(`Progress ${sessions.length} user berhasil direset. Aplikasi user akan refresh otomatis.`);
        refresh();
      },
    });
  };

  const handleMaxUsersChange = async (val: string) => {
    const num = parseInt(val) || 0;
    await updateSiteSettings({ max_users: num });
    setSiteSettings((prev) => ({ ...prev, max_users: num }));
    toast.success(`Batas akses diatur: ${num === 0 ? "Tidak terbatas" : num + " user"}`);
  };

  const handleVillageLimitChange = (villageId: string, key: "min" | "max", val: string) => {
    const num = Math.max(1, parseInt(val) || 1);
    setVillageLimits((prev) => ({
      ...prev,
      [villageId]: { ...prev[villageId], [key]: num },
    }));
  };

  const handleSaveVillageLimit = async (villageId: string, villageName: string) => {
    const cur = villageLimits[villageId];
    if (!cur) return;
    if (cur.min > cur.max) {
      toast.error("Min anggota tidak boleh lebih besar dari Max anggota");
      return;
    }
    try {
      await upsertVillageGroupLimit({
        village_id: villageId,
        village_name: villageName,
        min_members: cur.min,
        max_members: cur.max,
      });
      toast.success(`Batas kelompok "${villageName}" tersimpan & disinkronkan ke semua user.`);
    } catch (e) {
      toast.error(`Gagal menyimpan: ${(e as Error).message}`);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("siskeudes_admin");
    sessionStorage.removeItem("siskeudes_admin_token");
    navigate("/");
  };

  const handleViewAsUser = async (s: SessionRow) => {
    await startImpersonation({
      session_id: s.session_id,
      user_name: s.user_name,
      village_id: s.village_id,
      village_name: s.village_name,
      form_data: (s.form_data as Record<string, unknown>) ?? null,
    });
    toast.success(`Memantau pekerjaan: ${s.user_name || "—"}`);
    // Send admin into the user UI starting from Data Umum
    navigate("/data-umum");
  };

  const getProgressPercent = (progress: Record<string, boolean>) => {
    if (!progress || typeof progress !== "object") return 0;
    const completed = FORM_STEPS.filter((s) => progress[s.key]).length;
    return Math.round((completed / FORM_STEPS.length) * 100);
  };

  const isOnline = (lastActive: string) => {
    return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(152,40%,8%)] to-[hsl(210,25%,12%)]">
      {/* Header */}
      <div className="bg-[hsl(152,40%,12%)]/90 backdrop-blur border-b border-[hsl(152,30%,20%)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-lg font-bold text-white font-heading">Admin Dashboard</h1>
            <p className="text-[10px] text-[hsl(0,0%,60%)]">Kontrol Penuh & Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="text-white/70 hover:text-white hover:bg-white/10">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-white/70 hover:text-white hover:bg-white/10">
            <Monitor size={14} className="mr-1" /> Mode User
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut size={14} className="mr-1" /> Logout
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)] text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[hsl(0,0%,60%)] uppercase tracking-wider">Total User</p>
                  <p className="text-3xl font-bold mt-1">{sessions.length}</p>
                </div>
                <Users className="w-10 h-10 text-primary/40" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)] text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[hsl(0,0%,60%)] uppercase tracking-wider">Online Sekarang</p>
                  <p className="text-3xl font-bold mt-1 text-green-400">{activeSessions.length}</p>
                </div>
                <Activity className="w-10 h-10 text-green-400/40" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)] text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[hsl(0,0%,60%)] uppercase tracking-wider">Status Website</p>
                  <p className="text-lg font-bold mt-1">
                    {siteSettings.is_locked ? (
                      <span className="text-red-400 flex items-center gap-1"><Lock size={16} /> Terkunci</span>
                    ) : (
                      <span className="text-green-400 flex items-center gap-1"><Unlock size={16} /> Aktif</span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant={siteSettings.is_locked ? "default" : "destructive"}
                  onClick={() => handleLockToggle(siteSettings.is_locked ? "unlock" : "lock")} className="text-xs">
                  {siteSettings.is_locked ? "Buka" : "Kunci"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)] text-white">
            <CardContent className="p-5">
              <div>
                <p className="text-[10px] text-[hsl(0,0%,60%)] uppercase tracking-wider mb-2">Batas Akses</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={siteSettings.max_users || 0}
                    onChange={(e) => handleMaxUsersChange(e.target.value)}
                    className="h-8 w-20 bg-[hsl(152,20%,20%)] border-[hsl(152,30%,25%)] text-white text-sm" />
                  <span className="text-xs text-[hsl(0,0%,55%)]">
                    {(siteSettings.max_users || 0) === 0 ? "Tidak terbatas" : `Max ${siteSettings.max_users} user`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Power Actions */}
        <Card className="bg-[hsl(0,70%,15%)]/40 border-[hsl(0,50%,25%)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-sm font-semibold text-red-300">Kontrol Admin — Tindakan Berbahaya</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleKickAllUsers}
                disabled={sessions.length === 0}>
                <UserX size={13} /> Hapus Semua User ({sessions.length})
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleResetAllProgress}
                disabled={sessions.length === 0}>
                <Eraser size={13} /> Reset Semua Progress
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleDeleteAllReports}
                disabled={reports.length === 0}>
                <Trash2 size={13} /> Hapus Semua Laporan ({reports.length})
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleDeleteAllPdfs}
                disabled={pdfFiles.length === 0}>
                <Trash2 size={13} /> Hapus Semua PDF ({pdfFiles.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="bg-[hsl(152,30%,15%)] border border-[hsl(152,30%,22%)]">
            <TabsTrigger value="users" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-white/60">
              <Users size={14} className="mr-1" /> User ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-white/60">
              <Camera size={14} className="mr-1" /> Monitoring
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-white/60">
              <FileText size={14} className="mr-1" /> Laporan ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="pdfs" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-white/60">
              <Download size={14} className="mr-1" /> PDF ({pdfFiles.length})
            </TabsTrigger>
            <TabsTrigger value="kelompok" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-white/60">
              <Settings2 size={14} className="mr-1" /> Kelompok
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)]">
              <CardContent className="p-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-[hsl(0,0%,50%)] text-center py-8">Belum ada user yang mengakses</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[hsl(152,30%,22%)]">
                          <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Status</th>
                          <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Nama</th>
                          <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Desa</th>
                          <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Mode</th>
                          <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Progress</th>
                          <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Terakhir Aktif</th>
                          <th className="text-center py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => {
                          const online = isOnline(s.last_active);
                          const progress = getProgressPercent(s.form_progress as Record<string, boolean>);
                          return (
                            <tr key={s.id} className="border-b border-[hsl(152,30%,20%)] hover:bg-[hsl(152,20%,18%)] transition-colors">
                              <td className="py-2.5 px-3">
                                <Badge variant={online ? "default" : "secondary"} className={`text-[10px] ${online ? "bg-green-600 text-white" : "bg-[hsl(0,0%,30%)] text-[hsl(0,0%,60%)]"}`}>
                                  {online ? "Online" : "Offline"}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-white font-medium">{s.user_name || "—"}</td>
                              <td className="py-2.5 px-3 text-[hsl(0,0%,70%)]">{s.village_name || "Belum pilih"}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className={`text-[10px] ${s.work_mode === "group" ? "border-blue-500 text-blue-400" : "border-[hsl(0,0%,40%)] text-[hsl(0,0%,55%)]"}`}>
                                  {s.work_mode === "group" ? "Kelompok" : "Individu"}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-[hsl(152,20%,20%)] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${
                                      progress === 100 ? "bg-green-500" : progress > 50 ? "bg-accent" : "bg-primary"
                                    }`} style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-xs text-[hsl(0,0%,55%)]">{progress}%</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-[hsl(0,0%,55%)]">
                                {new Date(s.last_active).toLocaleString("id-ID")}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleViewAsUser(s)} className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 h-7 w-7 p-0" title="Lihat sebagai user (live view)">
                                    <ScanEye size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(s)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 w-7 p-0" title="Lihat detail">
                                    <Eye size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setMonitorUser(s)} className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 w-7 p-0" title="Monitor screenshot">
                                    <Camera size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleResetUserProgress(s)} className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 h-7 w-7 p-0" title="Reset progress">
                                    <Eraser size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleKickUser(s)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0" title="Kick & hapus user">
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring">
            <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Camera size={18} /> Monitoring Layar User (Screenshot)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeSessions.length === 0 ? (
                  <p className="text-sm text-[hsl(0,0%,50%)] text-center py-8">Tidak ada user online saat ini</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeSessions.map((s) => (
                      <div key={s.session_id} className="border border-[hsl(152,30%,22%)] rounded-lg overflow-hidden bg-[hsl(152,20%,12%)]">
                        <div className="p-2 bg-[hsl(152,30%,18%)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-white text-xs font-medium">{s.user_name || "—"}</span>
                          </div>
                          <span className="text-[hsl(0,0%,50%)] text-[10px]">{s.village_name}</span>
                        </div>
                        <div className="aspect-video bg-[hsl(0,0%,10%)] relative">
                          <img key={screenshotKey}
                            src={`${getScreenshotUrl(s.session_id)}?t=${screenshotKey}`}
                            alt={`Screenshot ${s.user_name}`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).parentElement!.querySelector(".no-ss")?.classList.remove("hidden");
                            }}
                          />
                          <div className="no-ss hidden absolute inset-0 flex items-center justify-center text-[hsl(0,0%,40%)] text-xs">
                            <div className="text-center">
                              <Camera size={24} className="mx-auto mb-1 opacity-30" />
                              <p>Belum ada screenshot</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <FileText size={18} /> Laporan yang Dikirim
                  </CardTitle>
                  {reports.length > 0 && (
                    <Button variant="destructive" size="sm" className="text-[10px] gap-1 h-7" onClick={handleDeleteAllReports}>
                      <Trash2 size={12} /> Hapus Semua
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-sm text-[hsl(0,0%,50%)] text-center py-8">Belum ada laporan yang dikirim</p>
                ) : (
                  <div className="space-y-3">
                    {reports.map((r) => (
                      <div key={r.id} className="border border-[hsl(152,30%,22%)] rounded-lg p-4 bg-[hsl(152,20%,18%)]">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-medium text-sm">{r.village_name || "—"}</p>
                            <p className="text-[hsl(0,0%,55%)] text-xs mt-0.5">Dikirim oleh: {r.submitted_by}</p>
                            <p className="text-[hsl(0,0%,45%)] text-[10px] mt-1">
                              {new Date(r.created_at).toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-600 text-white text-[10px]">
                              <FileText size={10} className="mr-1" /> Diterima
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(r)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                        {r.report_data && typeof r.report_data === "object" && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {FORM_STEPS.map((step) => {
                              const done = (r.report_data as Record<string, boolean>)?.[step.key];
                              return (
                                <div key={step.key} className="flex items-center gap-2 text-[10px]">
                                  <div className={`w-2 h-2 rounded-full ${done ? "bg-green-500" : "bg-[hsl(0,0%,30%)]"}`} />
                                  <span className={done ? "text-green-400" : "text-[hsl(0,0%,45%)]"}>{step.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PDF Files Tab */}
          <TabsContent value="pdfs">
            <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Download size={18} /> File PDF Laporan Keuangan
                  </CardTitle>
                  {pdfFiles.length > 0 && (
                    <Button variant="destructive" size="sm" className="text-[10px] gap-1 h-7" onClick={handleDeleteAllPdfs}>
                      <Trash2 size={12} /> Hapus Semua PDF
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pdfFiles.length === 0 ? (
                  <p className="text-sm text-[hsl(0,0%,50%)] text-center py-8">Belum ada PDF laporan yang dikirim</p>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const folderMap = new Map<string, PdfFile[]>();
                      pdfFiles.forEach((pdf) => {
                        const existing = folderMap.get(pdf.folder) || [];
                        existing.push(pdf);
                        folderMap.set(pdf.folder, existing);
                      });
                      return Array.from(folderMap.entries()).map(([folderName, files]) => {
                        const displayName = folderName.replace(/_/g, " ");
                        return (
                          <div key={folderName} className="border border-[hsl(152,30%,22%)] rounded-lg overflow-hidden">
                            <div className="bg-[hsl(152,30%,18%)] px-4 py-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText size={16} className="text-accent" />
                                <span className="text-white text-sm font-medium">{displayName}</span>
                                <span className="text-[hsl(0,0%,50%)] text-[10px] ml-2">({files.length} file)</span>
                              </div>
                              <Button variant="ghost" size="sm"
                                onClick={async () => {
                                  for (const f of files) {
                                    await supabase!.storage.from("report-pdfs").remove([f.fullPath]);
                                  }
                                  toast.success(`Folder "${displayName}" berhasil dihapus`);
                                  refresh();
                                }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[10px] h-6">
                                <Trash2 size={12} className="mr-1" /> Hapus Folder
                              </Button>
                            </div>
                            <div className="divide-y divide-[hsl(152,30%,20%)]">
                              {files.map((pdf, i) => {
                                const reportLabel = pdf.name
                                  .replace(".pdf", "").replace(/_/g, " ")
                                  .replace(/(\d{4})-(\d{2})-(\d{2})/, "$3/$2/$1")
                                  .replace(/(\d{4})$/, " $1");
                                return (
                                  <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-[hsl(152,20%,14%)] hover:bg-[hsl(152,20%,16%)] transition-colors">
                                    <div className="flex items-center gap-3">
                                      <FileText size={16} className="text-red-400/70" />
                                      <div>
                                        <p className="text-white text-xs font-medium">{reportLabel}</p>
                                        <p className="text-[hsl(0,0%,45%)] text-[10px]">
                                          {pdf.created_at ? new Date(pdf.created_at).toLocaleString("id-ID") : "—"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm"
                                        onClick={() => window.open(pdf.url, "_blank")}
                                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 text-[10px] gap-1">
                                        <Eye size={12} /> Lihat
                                      </Button>
                                      <Button variant="ghost" size="sm"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(pdf.url);
                                            const blob = await res.blob();
                                            const blobUrl = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = blobUrl; a.download = pdf.name; a.click();
                                            URL.revokeObjectURL(blobUrl);
                                          } catch { toast.error("Gagal mengunduh file"); }
                                        }}
                                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 text-[10px] gap-1">
                                        <Download size={12} /> Unduh
                                      </Button>
                                      <Button variant="ghost" size="sm"
                                        onClick={async () => {
                                          await supabase!.storage.from("report-pdfs").remove([pdf.fullPath]);
                                          toast.success("File berhasil dihapus"); refresh();
                                        }}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0">
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Kelompok Tab — per-village min/max members */}
          <TabsContent value="kelompok">
            <Card className="bg-[hsl(152,30%,15%)]/80 border-[hsl(152,30%,22%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Settings2 size={18} /> Kontrol Jumlah Anggota Kelompok per Desa
                </CardTitle>
                <p className="text-[11px] text-[hsl(0,0%,55%)] mt-1">
                  Atur batas minimum dan maksimum anggota tiap kelompok untuk masing-masing desa.
                  Perubahan tersinkron real-time ke semua user.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(152,30%,22%)]">
                        <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase">Desa</th>
                        <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase w-32">Min Anggota</th>
                        <th className="text-left py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase w-32">Max Anggota</th>
                        <th className="text-center py-2 px-3 text-[10px] text-[hsl(0,0%,55%)] uppercase w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {villageProfiles.map((v) => {
                        const cur = villageLimits[v.id] || { min: 1, max: 10 };
                        return (
                          <tr key={v.id} className="border-b border-[hsl(152,30%,20%)] hover:bg-[hsl(152,20%,18%)]">
                            <td className="py-2.5 px-3 text-white">
                              <div className="font-medium">Desa {v.profile.namaDesa}</div>
                              <div className="text-[10px] text-[hsl(0,0%,50%)]">{v.profile.kecamatan}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <Input type="number" min={1} value={cur.min}
                                onChange={(e) => handleVillageLimitChange(v.id, "min", e.target.value)}
                                className="h-8 w-24 bg-[hsl(152,20%,20%)] border-[hsl(152,30%,25%)] text-white text-sm" />
                            </td>
                            <td className="py-2.5 px-3">
                              <Input type="number" min={1} value={cur.max}
                                onChange={(e) => handleVillageLimitChange(v.id, "max", e.target.value)}
                                className="h-8 w-24 bg-[hsl(152,20%,20%)] border-[hsl(152,30%,25%)] text-white text-sm" />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Button size="sm" onClick={() => handleSaveVillageLimit(v.id, v.profile.namaDesa)}
                                className="h-8 text-xs gap-1 bg-primary hover:bg-primary/80 text-primary-foreground">
                                <Save size={12} /> Simpan
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-[11px] text-[hsl(0,0%,55%)] flex items-start gap-2">
                  <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span>
                    User hanya bisa join kelompok jika belum mencapai <b>Max</b>. Min digunakan sebagai info
                    untuk memastikan kelompok memiliki cukup anggota sebelum mengirim laporan.
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User Detail Modal */}
        {selectedUser && (
          <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
            <DialogContent className="max-w-lg bg-[hsl(152,30%,12%)] border-[hsl(152,30%,22%)] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Detail User: {selectedUser.user_name || "—"}</DialogTitle>
                <DialogDescription className="text-[hsl(0,0%,55%)]">
                  Desa: {selectedUser.village_name || "Belum dipilih"} • Mode: {selectedUser.work_mode === "group" ? "Kelompok" : "Individu"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-[10px] text-[hsl(0,0%,55%)] uppercase">Progress ({getProgressPercent(selectedUser.form_progress as Record<string, boolean>)}%)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {FORM_STEPS.map((step) => {
                      const done = (selectedUser.form_progress as Record<string, boolean>)?.[step.key];
                      return (
                        <div key={step.key} className="flex items-center gap-2 text-xs">
                          <div className={`w-2.5 h-2.5 rounded-full ${done ? "bg-green-500" : "bg-[hsl(0,0%,30%)]"}`} />
                          <span className={done ? "text-green-400" : "text-[hsl(0,0%,50%)]"}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-xs text-[hsl(0,0%,50%)]">
                  <p>Session ID: {selectedUser.session_id.substring(0, 8)}...</p>
                  <p>Mulai: {new Date(selectedUser.created_at).toLocaleString("id-ID")}</p>
                  <p>Terakhir aktif: {new Date(selectedUser.last_active).toLocaleString("id-ID")}</p>
                </div>
                <div className="flex gap-2 pt-2 border-t border-[hsl(152,30%,22%)] flex-wrap">
                  <Button size="sm" className="gap-1 text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => { const u = selectedUser; setSelectedUser(null); handleViewAsUser(u); }}>
                    <ScanEye size={12} /> Lihat sebagai User
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setSelectedUser(null); handleResetUserProgress(selectedUser); }}>
                    <Eraser size={12} /> Reset Progress
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setSelectedUser(null); handleKickUser(selectedUser); }}>
                    <UserX size={12} /> Kick User
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Screenshot Monitor Modal */}
        {monitorUser && (
          <Dialog open={!!monitorUser} onOpenChange={() => setMonitorUser(null)}>
            <DialogContent className="max-w-3xl bg-[hsl(152,30%,12%)] border-[hsl(152,30%,22%)] text-white">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Camera size={18} /> Monitoring: {monitorUser.user_name || "—"}
                </DialogTitle>
                <DialogDescription className="text-[hsl(0,0%,55%)]">
                  Desa: {monitorUser.village_name} • Auto-refresh setiap 10 detik
                </DialogDescription>
              </DialogHeader>
              <div className="bg-[hsl(0,0%,5%)] rounded-lg overflow-hidden">
                <img key={screenshotKey}
                  src={`${getScreenshotUrl(monitorUser.session_id)}?t=${screenshotKey}`}
                  alt={`Screenshot ${monitorUser.user_name}`}
                  className="w-full object-contain max-h-[60vh]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-[hsl(0,0%,50%)]">
                <span>Auto-refresh setiap 10 detik</span>
                <Button size="sm" variant="ghost" onClick={() => setScreenshotKey((k) => k + 1)} className="text-white/60">
                  <RefreshCw size={12} className="mr-1" /> Refresh
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Lock/Unlock Dialog */}
        <Dialog open={lockDialog} onOpenChange={setLockDialog}>
          <DialogContent className="max-w-sm bg-[hsl(152,30%,12%)] border-[hsl(152,30%,22%)] text-white">
            <DialogHeader>
              <DialogTitle className="text-white">
                {lockAction === "lock" ? "Kunci Website" : "Buka Website"}
              </DialogTitle>
              <DialogDescription className="text-[hsl(0,0%,55%)]">
                Masukkan password admin untuk {lockAction === "lock" ? "mengunci" : "membuka"} akses website
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input type="password" value={lockPassword} onChange={(e) => setLockPassword(e.target.value)}
                placeholder="Password admin" className="bg-[hsl(152,20%,20%)] border-[hsl(152,30%,25%)] text-white"
                autoFocus onKeyDown={(e) => e.key === "Enter" && confirmLockAction()} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setLockDialog(false)} className="text-white/70">Batal</Button>
              <Button onClick={confirmLockAction} variant={lockAction === "lock" ? "destructive" : "default"}>
                {lockAction === "lock" ? "Kunci Sekarang" : "Buka Sekarang"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Action Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent className="bg-[hsl(152,30%,12%)] border-[hsl(152,30%,22%)] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" /> {confirmAction?.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[hsl(0,0%,55%)]">
                {confirmAction?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-[hsl(152,30%,25%)] text-white hover:bg-[hsl(152,20%,20%)]">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
                if (confirmAction) await confirmAction.action();
                setConfirmAction(null);
              }}>
                Ya, Lanjutkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
