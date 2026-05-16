import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSiteSettings, getActiveSessions, heartbeat, getSessionId, upsertSession, hasConvexServerSession } from "@/lib/session-manager";
import { isConvexEnabled, convex } from "@/integrations/convex/client";
import { anyApi } from "convex/server";
import { useQuery } from "convex/react";
import { Lock, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Admin bypass now validated server-side via Convex admin.login mutation
// No hardcoded password in frontend

function wipeLocalUserData() {
  const keysToKeep = ["siskeudes_session_id"];
  const allKeys = Object.keys(localStorage);
  for (const k of allKeys) {
    if (k.startsWith("siskeudes_") && !keysToKeep.includes(k)) {
      localStorage.removeItem(k);
    }
  }
  sessionStorage.clear();
}

function getLastLocalWriteAt(): number {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem("siskeudes_last_local_write_at") || "0") || 0));
  } catch {
    return 0;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback;
  }
}

export default function SiteLockGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const [maxReached, setMaxReached] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bypassed, setBypassed] = useState(false);
  const [bypassPassword, setBypassPassword] = useState("");
  const [showBypass, setShowBypass] = useState(false);

  // Realtime subscription for site settings — reacts immediately when admin locks/unlocks
  const realtimeSettings = useQuery(anyApi.siteSettings.get, {}) as {
    is_locked: boolean;
    max_users: number;
    demo_seed_version: number;
    wipe_all_version: number;
  } | null | undefined;

  // React to realtime settings changes (lock/unlock, wipe, demo)
  useEffect(() => {
    if (!realtimeSettings) return;
    if (sessionStorage.getItem("siskeudes_admin") === "true") return;
    if (localStorage.getItem("siskeudes_admin_impersonate")) return;

    // Handle lock state change
    if (realtimeSettings.is_locked && !bypassed) {
      setLocked(true);
    } else if (!realtimeSettings.is_locked) {
      setLocked(false);
    }

    // Handle wipe_all_version change
    const wipeVer = Math.max(0, Math.floor(realtimeSettings.wipe_all_version || 0));
    const appliedWipe = Math.max(0, Math.floor(Number(localStorage.getItem("siskeudes_wipe_all_applied_v") || "0") || 0));
    if (wipeVer > 0 && wipeVer !== appliedWipe) {
      localStorage.setItem("siskeudes_wipe_all_applied_v", String(wipeVer));
      // Pause sync to prevent pushing empty state back to server
      localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 2000));
      // Clear local cache directly (don't use saveState which triggers sync)
      localStorage.removeItem("siskeudes_state");
      localStorage.removeItem("siskeudes_app_state");
      localStorage.removeItem("siskeudes_mutasi_kas");
      window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
      toast.success("Semua data input direset oleh admin.");
    }

    // Handle demo_seed_version change
    const demoVer = Math.max(0, Math.floor(realtimeSettings.demo_seed_version || 0));
    const appliedDemo = Math.max(0, Math.floor(Number(localStorage.getItem("siskeudes_demo_seed_applied_v") || "0") || 0));
    if (demoVer > 0 && demoVer !== appliedDemo) {
      localStorage.setItem("siskeudes_demo_seed_applied_v", String(demoVer));
      // Pause sync to prevent pushing demo state back to server
      localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 2000));
      import("@/data/demo-seed-data").then(({ getDemoSeedData }) => {
        const demo = getDemoSeedData();
        // Write directly to localStorage cache (don't use saveState which triggers sync)
        const json = JSON.stringify(demo);
        localStorage.setItem("siskeudes_state", json);
        localStorage.setItem("siskeudes_app_state", json);
        localStorage.removeItem("siskeudes_mutasi_kas");
        window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
        toast.success("Data demo dimuat oleh admin.");
      });
    }
  }, [realtimeSettings, bypassed]);

  useEffect(() => {
    if (sessionStorage.getItem("siskeudes_admin") === "true") {
      setChecking(false);
      return;
    }
    if (localStorage.getItem("siskeudes_admin_impersonate")) {
      setChecking(false);
      return;
    }
    if (!isConvexEnabled || !convex) {
      setChecking(false);
      return;
    }

    const sessionId = getSessionId();
    let cancelled = false;

    const checkKick = async () => {
      const hadVillage = !!localStorage.getItem("siskeudes_selected_village");
      if (!hadVillage) return;

      try {
        const data = await withTimeout(
          convex.query(anyApi.sessions.getBySessionId, { sessionId } as any),
          5000,
          null,
        );
        if (cancelled) return;

        if (!data) {
          if (!hasConvexServerSession()) {
            const userName = localStorage.getItem("siskeudes_user_name") || "";
            const villageId = localStorage.getItem("siskeudes_selected_village") || "";
            const villageName = (() => {
              try { return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}").namaDesa || ""; } catch { return ""; }
            })();
            const workMode = localStorage.getItem("siskeudes_work_mode") || "individual";
            const groupId = localStorage.getItem("siskeudes_group_id");
            try {
              await upsertSession({
                user_name: userName,
                village_id: villageId,
                village_name: villageName,
                work_mode: workMode,
                group_id: groupId || null,
              });
            } catch {}
            return;
          }

          toast.error("Anda telah dikeluarkan dari sistem oleh admin.");
          wipeLocalUserData();
          setTimeout(() => { window.location.href = "/"; }, 800);
          return;
        }

        const localState = localStorage.getItem("siskeudes_app_state");
        const serverFormData = (data as any).form_data;
        const serverEmpty = !serverFormData ||
          (typeof serverFormData === "object" && Object.keys(serverFormData as object).length === 0);
        const localHasData = !!localState && localState !== "{}" && localState.length > 4;

        if (serverEmpty && localHasData) {
          toast.info("Progress Anda telah direset oleh admin.");
          localStorage.removeItem("siskeudes_app_state");
          localStorage.removeItem("siskeudes_state");
          localStorage.removeItem("siskeudes_mutasi_kas");
          // Dispatch state-updated so all forms rerender with empty state
          window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
        }
      } catch (e) { console.warn('[SiteLockGuard] kick check failed:', e); }
    };

    const checkSettings = async () => {
      try {
        const settings = await withTimeout(getSiteSettings(), 5000, null);
        if (cancelled) return;
        if (!settings) {
          setLocked(false);
          setMaxReached(false);
          setChecking(false);
          return;
        }

        const wipeVer = Math.max(0, Math.floor(Number((settings as any).wipe_all_version || 0) || 0));
        const demoVer = Math.max(0, Math.floor(Number((settings as any).demo_seed_version || 0) || 0));
        const appliedWipe = Math.max(0, Math.floor(Number(localStorage.getItem("siskeudes_wipe_all_applied_v") || "0") || 0));
        const appliedDemo = Math.max(0, Math.floor(Number(localStorage.getItem("siskeudes_demo_seed_applied_v") || "0") || 0));

        const lastWriteAt = getLastLocalWriteAt();
        const msSinceWrite = Date.now() - lastWriteAt;
        const isBusy = lastWriteAt > 0 && msSinceWrite >= 0 && msSinceWrite < 3000;

        if (wipeVer > 0 && wipeVer !== appliedWipe) {
          if (isBusy) {
            toast.warning("Admin meminta reset data. Sedang ada input baru — reset diterapkan sebentar lagi.", { duration: 2600 });
            setTimeout(() => checkSettings(), 3200);
            return;
          }
          localStorage.setItem("siskeudes_wipe_all_applied_v", String(wipeVer));
          // Pause sync + clear cache directly (don't trigger saveState sync)
          localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 2000));
          localStorage.removeItem("siskeudes_state");
          localStorage.removeItem("siskeudes_app_state");
          localStorage.removeItem("siskeudes_mutasi_kas");
          window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
          toast.success("Semua data input direset oleh admin.");
          return;
        }

        if (demoVer > 0 && demoVer !== appliedDemo) {
          if (isBusy) {
            toast.warning("Admin memuat data demo. Sedang ada input baru — data demo diterapkan sebentar lagi.", { duration: 2600 });
            setTimeout(() => checkSettings(), 3200);
            return;
          }
          localStorage.setItem("siskeudes_demo_seed_applied_v", String(demoVer));
          // Pause sync + write cache directly (don't trigger saveState sync)
          localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 2000));
          import("@/data/demo-seed-data").then(({ getDemoSeedData: getDemo }) => {
            const demo = getDemo();
            const json = JSON.stringify(demo);
            localStorage.setItem("siskeudes_state", json);
            localStorage.setItem("siskeudes_app_state", json);
            localStorage.removeItem("siskeudes_mutasi_kas");
            window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
            toast.success("Data demo dimuat oleh admin.");
          });
          return;
        }

        if (settings?.is_locked) {
          setLocked(true);
          setChecking(false);
          return;
        }

        if (settings?.max_users && settings.max_users > 0) {
          const active = await withTimeout(getActiveSessions(5), 5000, []);
          const sessionId = getSessionId();
          const isExisting = active.some((s: { session_id: string }) => s.session_id === sessionId);
          if (!isExisting && active.length >= settings.max_users) {
            setMaxReached(true);
            setChecking(false);
            return;
          }
        }

        setLocked(false);
        setMaxReached(false);
      } catch (e) { console.warn('[SiteLockGuard] settings check failed:', e); }
      setChecking(false);
    };

    checkKick();
    checkSettings();

    const kickInterval = setInterval(checkKick, 20000);
    const settingsInterval = setInterval(checkSettings, 30000);

    return () => {
      cancelled = true;
      clearInterval(kickInterval);
      clearInterval(settingsInterval);
    };
  }, [navigate]);

  useEffect(() => {
    if ((locked || maxReached) && !bypassed) return;
    heartbeat();
    const ms = isConvexEnabled ? 15000 : 120000;
    const interval = setInterval(heartbeat, ms);
    const onFocus = () => heartbeat();
    const onVis = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [locked, maxReached, bypassed]);

  const handleBypass = async () => {
    if (!isConvexEnabled || !convex) {
      toast.error("Verifikasi admin membutuhkan Convex.");
      setBypassPassword("");
      return;
    }
    try {
      const res = await convex.mutation(anyApi.admin.login, { password: bypassPassword } as any);
      sessionStorage.setItem("siskeudes_admin_token", (res as any).token);
      sessionStorage.setItem("siskeudes_admin", "true");
      setBypassed(true);
      setShowBypass(false);
      toast.success("Verifikasi admin berhasil. Website terbuka.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password salah!";
      toast.error(msg);
    }
    setBypassPassword("");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(152,40%,14%)] to-[hsl(152,35%,22%)]">
        <p className="text-white/60 text-sm animate-pulse">Memuat...</p>
      </div>
    );
  }

  if ((locked || maxReached) && !bypassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(152,40%,14%)] to-[hsl(152,35%,22%)]">
        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {locked ? "Website Terkunci" : "Batas Akses Tercapai"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {locked
              ? "Website sedang dikunci oleh admin. Silakan hubungi admin untuk membuka akses."
              : "Jumlah pengguna aktif telah mencapai batas maksimum. Silakan coba lagi nanti."}
          </p>

          {!showBypass ? (
            <Button variant="outline" size="sm" onClick={() => setShowBypass(true)} className="gap-2">
              <KeyRound size={14} /> Verifikasi Admin
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Masukkan password admin untuk membuka akses:</p>
              <Input
                type="password"
                value={bypassPassword}
                onChange={(e) => setBypassPassword(e.target.value)}
                placeholder="Password admin"
                className="text-center"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleBypass()}
              />
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" size="sm" onClick={() => { setShowBypass(false); setBypassPassword(""); }}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleBypass}>
                  Buka Akses
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
