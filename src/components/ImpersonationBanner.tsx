import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, X, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImpersonation, refreshImpersonatedData, stopImpersonation } from "@/lib/admin-impersonation";
import { toast } from "sonner";

/**
 * Floating banner shown to admin while viewing the app as a user.
 * Auto-refreshes the impersonated user's data every 5 seconds so the
 * admin sees a near-live mirror of what that user is doing.
 */
export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(getImpersonation());
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    setInfo(getImpersonation());
    if (!getImpersonation()) return;

    let cancelled = false;
    const tick = async () => {
      setRefreshing(true);
      const result = await refreshImpersonatedData();
      if (cancelled) return;
      if (result.ok) {
        setLastSync(new Date());
        if (result.changed) {
          // Notify all components to re-read state from localStorage
          window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
        }
      }
      setRefreshing(false);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Listen across tabs / external changes
  useEffect(() => {
    const onStorage = () => setInfo(getImpersonation());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!info) return null;

  const handleExit = async () => {
    await stopImpersonation();
    toast.success(`Keluar dari mode pantau: ${info.user_name}`);
    navigate("/admin/dashboard");
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    const result = await refreshImpersonatedData();
    if (result.ok) {
      setLastSync(new Date());
      // Notify all components to re-read state
      window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
    }
    setRefreshing(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] bg-gradient-to-r from-[hsl(38,90%,45%)] to-[hsl(20,85%,50%)] text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] border-t-2 border-[hsl(20,80%,35%)]">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur px-2.5 py-1 rounded-md">
            <Shield size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Admin View</span>
          </div>
          <Eye size={16} className="opacity-80" />
          <div className="text-xs leading-tight min-w-0">
            <div className="font-semibold truncate">
              Memantau: <span className="font-bold">{info.user_name || "—"}</span>
              {" "}<span className="opacity-80">• {info.village_name || "—"}</span>
            </div>
            <div className="text-[10px] opacity-80">
              {refreshing ? "Sinkronisasi..." : lastSync ? `Sinkron terakhir: ${lastSync.toLocaleTimeString("id-ID")}` : "Menunggu sinkron..."}
              {" • Auto-refresh setiap 5 detik"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="h-7 text-[11px] text-white hover:bg-white/20 gap-1"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleExit}
            className="h-7 text-[11px] bg-white/20 hover:bg-white/30 text-white gap-1 backdrop-blur"
          >
            <X size={12} />
            Keluar Mode Pantau
          </Button>
        </div>
      </div>
    </div>
  );
}
