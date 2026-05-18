import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import SiteLockGuard from "@/components/SiteLockGuard";
import Beranda from "@/pages/Beranda";
import DataUmumDesa from "@/pages/DataUmumDesa";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import GroupRoom from "@/pages/GroupRoom";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense, Component, type ReactNode } from "react";
import { ConvexProvider } from "convex/react";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { GroupProvider } from "@/hooks/use-group-context";
import { SyncStatusProvider } from "@/hooks/use-sync-status";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";

// Error Boundary to prevent white screen
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f2a1e, #1a3a2b)", padding: 24 }}>
          <div style={{ maxWidth: 600, width: "100%", background: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 24, fontFamily: "system-ui, sans-serif" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#dc2626" }}>Terjadi Kesalahan</h1>
            <p style={{ fontSize: 14, color: "#334155", marginBottom: 16 }}>Aplikasi mengalami error. Coba refresh halaman.</p>
            <pre style={{ fontSize: 11, background: "#f1f5f9", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 200, color: "#475569" }}>{this.state.error.message}{"\n"}{this.state.error.stack?.slice(0, 500)}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 20px", background: "#16a34a", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Refresh Halaman</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Auto-reload on stale chunk (after deploy, browser may cache old HTML referencing old assets)
function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() => importFn().catch(() => {
    // Asset not found — likely stale cache after deploy. Reload once.
    const reloaded = sessionStorage.getItem("siskeudes_chunk_reload");
    if (!reloaded) {
      sessionStorage.setItem("siskeudes_chunk_reload", "1");
      window.location.reload();
    }
    return importFn(); // fallback attempt
  }));
}

const ParameterBidangKegiatan = lazyWithRetry(() => import("@/pages/ParameterBidangKegiatan"));
const ParameterSumberDana = lazyWithRetry(() => import("@/pages/ParameterSumberDana"));
const ParameterRekening = lazyWithRetry(() => import("@/pages/ParameterRekening"));
const ParameterOutputKegiatan = lazyWithRetry(() => import("@/pages/ParameterOutputKegiatan"));
const DetailKegiatan = lazyWithRetry(() => import("@/pages/DetailKegiatan"));
const PendapatanDesa = lazyWithRetry(() => import("@/pages/PendapatanDesa"));
const BelanjaDesa = lazyWithRetry(() => import("@/pages/BelanjaDesa"));
const PembiayaanDesa = lazyWithRetry(() => import("@/pages/PembiayaanDesa"));
const PenerimaanDesa = lazyWithRetry(() => import("@/pages/PenerimaanDesa"));
const SPPPanjar = lazyWithRetry(() => import("@/pages/SPPPanjar"));
const SPPDefinitif = lazyWithRetry(() => import("@/pages/SPPDefinitif"));
const SPPPembiayaan = lazyWithRetry(() => import("@/pages/SPPPembiayaan"));
const SPJKegiatan = lazyWithRetry(() => import("@/pages/SPJKegiatan"));
const PenyetoranPajak = lazyWithRetry(() => import("@/pages/PenyetoranPajak"));
const MutasiKas = lazyWithRetry(() => import("@/pages/MutasiKas"));
const JurnalUmum = lazyWithRetry(() => import("@/pages/JurnalUmum"));
const SaldoAwal = lazyWithRetry(() => import("@/pages/SaldoAwal"));
const LaporanLRA = lazyWithRetry(() => import("@/pages/LaporanLRA"));
const LaporanNeraca = lazyWithRetry(() => import("@/pages/LaporanNeraca"));
const LaporanBKU = lazyWithRetry(() => import("@/pages/LaporanBKU"));
const LaporanBKPPajak = lazyWithRetry(() => import("@/pages/LaporanBKPPajak"));
const LaporanPenjabaran = lazyWithRetry(() => import("@/pages/LaporanPenjabaran"));
const LaporanLRAPerKegiatan = lazyWithRetry(() => import("@/pages/LaporanLRAPerKegiatan"));
const TentangAplikasi = lazyWithRetry(() => import("@/pages/TentangAplikasi"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const SiteLockGuardLayout = () => (
  <SiteLockGuard><AppLayout /></SiteLockGuard>
);

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(152,40%,14%)] to-[hsl(152,35%,22%)]">
    <p className="text-white/60 text-sm animate-pulse">Memuat...</p>
  </div>
);

const MaybeConvexProvider = ({ children }: { children: ReactNode }) => {
  if (!isConvexEnabled || !convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <MaybeConvexProvider>
        <GroupProvider>
          <SyncStatusProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <SyncStatusIndicator />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/admin" element={<AdminLogin />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route element={<SiteLockGuardLayout />}>
                      <Route path="/" element={<Beranda />} />
                      <Route path="/data-umum" element={<DataUmumDesa />} />
                      <Route path="/group-room" element={<GroupRoom />} />
                      <Route path="/parameter/bidang-kegiatan" element={<ParameterBidangKegiatan />} />
                      <Route path="/parameter/sumber-dana" element={<ParameterSumberDana />} />
                      <Route path="/parameter/rekening" element={<ParameterRekening />} />
                      <Route path="/parameter/output-kegiatan" element={<ParameterOutputKegiatan />} />
                      <Route path="/penganggaran/pendapatan" element={<PendapatanDesa />} />
                      <Route path="/penganggaran/belanja" element={<BelanjaDesa />} />
                      <Route path="/penganggaran/pembiayaan" element={<PembiayaanDesa />} />
                      <Route path="/detail-kegiatan" element={<DetailKegiatan />} />
                      <Route path="/penatausahaan/penerimaan" element={<PenerimaanDesa />} />
                      <Route path="/penatausahaan/spp-panjar" element={<SPPPanjar />} />
                      <Route path="/penatausahaan/spp-definitif" element={<SPPDefinitif />} />
                      <Route path="/penatausahaan/spp-pembiayaan" element={<SPPPembiayaan />} />
                      <Route path="/penatausahaan/spj" element={<SPJKegiatan />} />
                      <Route path="/penatausahaan/penyetoran-pajak" element={<PenyetoranPajak />} />
                      <Route path="/penatausahaan/mutasi-kas" element={<MutasiKas />} />
                      <Route path="/pembukuan/saldo-awal" element={<SaldoAwal />} />
                      <Route path="/pembukuan/jurnal-umum" element={<JurnalUmum />} />
                      <Route path="/laporan/lra" element={<LaporanLRA />} />
                      <Route path="/laporan/lra-desa" element={<LaporanLRAPerKegiatan />} />
                      <Route path="/laporan/neraca" element={<LaporanNeraca />} />
                      <Route path="/laporan/bku" element={<LaporanBKU />} />
                      <Route path="/laporan/bkp-pajak" element={<LaporanBKPPajak />} />
                      <Route path="/laporan/penjabaran" element={<LaporanPenjabaran />} />
                      <Route path="/tentang" element={<TentangAplikasi />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </SyncStatusProvider>
        </GroupProvider>
      </MaybeConvexProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
