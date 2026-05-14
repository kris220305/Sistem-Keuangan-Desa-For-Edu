import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSiteSettings, getActiveSessions, heartbeat, getSessionId, upsertSession } from "@/lib/session-manager";
import { isConvexEnabled, convex } from "@/integrations/convex/client";
import { anyApi } from "convex/server";
import { Lock, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_BYPASS_PASSWORD = "12345";

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
          toast.info("Progress Anda telah direset oleh admin. Halaman akan dimuat ulang.");
          localStorage.removeItem("siskeudes_app_state");
          localStorage.removeItem("siskeudes_state");
          localStorage.removeItem("siskeudes_mutasi_kas");
          setTimeout(() => window.location.reload(), 1200);
        }
      } catch { /* silent fail for kick check */ }
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
      } catch { /* silent fail for settings check */ }
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

  const handleBypass = () => {
    if (bypassPassword === ADMIN_BYPASS_PASSWORD) {
      setBypassed(true);
      setShowBypass(false);
      toast.success("Verifikasi admin berhasil. Website terbuka.");
    } else {
      toast.error("Password salah!");
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
