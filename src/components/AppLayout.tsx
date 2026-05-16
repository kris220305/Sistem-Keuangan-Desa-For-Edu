import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import TopMenuBar from "./TopMenuBar";
import ScreenShareConsent from "./ScreenShareConsent";
import ImpersonationBanner from "./ImpersonationBanner";
import EditingPresenceBar from "./EditingPresenceBar";
import { useGroupRealtimeSync } from "@/hooks/use-group-realtime-sync";
import { useSyncStatusListener } from "@/hooks/use-sync-status-listener";
import bgLandscape from "@/assets/bg-sawah-sunset.jpg";
import { flushSaveStateNow } from "@/data/app-state";

export default function AppLayout() {
  useGroupRealtimeSync();
  useSyncStatusListener();
  const location = useLocation();
  const [transitioning, setTransitioning] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      flushSaveStateNow();
      setTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitioning(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation]);

  useEffect(() => {
    const flush = () => flushSaveStateNow();
    const onVis = () => {
      if (document.visibilityState !== "visible") flushSaveStateNow();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Admin impersonation banner (only renders when active) */}
      <ImpersonationBanner />

      {/* Editing presence bar (shows who is editing what) */}
      <EditingPresenceBar />

      {/* Top Menu Bar */}
      <TopMenuBar />

      {/* Main content area with background */}
      <div className="relative flex-1 overflow-hidden">
        {/* Full-screen background image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgLandscape})` }} />
        
        {/* Subtle dark overlay for readability on non-home pages */}
        {location.pathname !== "/" &&
        <div className="absolute inset-0 z-0 bg-[hsl(152,20%,10%/0.3)] backdrop-blur-[1px]" />
        }

        {/* Content with morph transition */}
        <main
          className={`relative z-10 h-full overflow-y-auto transition-all duration-300 ease-out ${
          transitioning ?
          "opacity-0 scale-[0.97] translate-y-2 blur-sm" :
          "opacity-100 scale-100 translate-y-0 blur-0"}`
          }>
          
          <Outlet />
          <ScreenShareConsent />
        </main>
      </div>

      {/* Footer */}
      <div className="relative z-10 bg-gradient-to-r from-[hsl(152,40%,14%)] to-[hsl(152,35%,18%)] border-t border-[hsl(152,30%,22%)] text-[10px] text-[hsl(0,0%,75%)] px-[17px] py-[7px] rounded-sm flex-row border-0 border-none flex items-center justify-between">
        <span>© 2024 Sistem Pengelolaan Keuangan Desa for Education</span>
        <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>Tahun Anggaran 2026</span>
      </div>
    </div>);

}
