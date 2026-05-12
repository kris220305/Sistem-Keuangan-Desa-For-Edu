import { useState, useEffect } from "react";
import { Monitor, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { hasScreenShareConsent, setScreenShareConsent, startScreenCapture, stopScreenCapture } from "@/lib/screenshot-capture";

export default function ScreenShareConsent() {
  const [showDialog, setShowDialog] = useState(false);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const consent = hasScreenShareConsent();
    setConsented(consent);
    if (consent) {
      startScreenCapture(15000);
    }
    // Show prompt if not yet decided
    if (localStorage.getItem("siskeudes_screen_share_consent") === null) {
      const timer = setTimeout(() => setShowDialog(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setScreenShareConsent(true);
    setConsented(true);
    startScreenCapture(15000);
    setShowDialog(false);
  };

  const handleDecline = () => {
    setScreenShareConsent(false);
    setConsented(false);
    stopScreenCapture();
    setShowDialog(false);
  };

  return (
    <>
      {/* Floating indicator when screen sharing is active */}
      {consented && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-green-600/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg backdrop-blur cursor-pointer hover:bg-green-700/90 transition-colors"
          onClick={() => setShowDialog(true)}
        >
          <Eye size={12} className="animate-pulse" />
          <span>Screen Share Aktif</span>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor size={20} /> Izin Monitoring Layar
            </DialogTitle>
            <DialogDescription>
              Admin ingin memantau pengerjaan Anda secara berkala melalui tangkapan layar otomatis (setiap 15 detik). 
              Data hanya digunakan untuk keperluan monitoring pembelajaran.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={handleDecline}>
              {consented ? "Matikan" : "Tolak"}
            </Button>
            <Button onClick={handleAccept} className="bg-green-600 hover:bg-green-700">
              {consented ? "Tetap Aktif" : "Izinkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
