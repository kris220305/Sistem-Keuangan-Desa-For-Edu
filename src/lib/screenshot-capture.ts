import html2canvas from "html2canvas";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session-manager";

const CONSENT_KEY = "siskeudes_screen_share_consent";

export function hasScreenShareConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setScreenShareConsent(consent: boolean) {
  localStorage.setItem(CONSENT_KEY, consent ? "true" : "false");
}

let captureInterval: ReturnType<typeof setInterval> | null = null;

export async function captureAndUpload() {
  if (!hasScreenShareConsent()) return;
  if (!isSupabaseEnabled || !supabase) return;
  
  try {
    const canvas = await html2canvas(document.body, {
      scale: 0.5,
      useCORS: true,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.6);
    });
    
    const sessionId = getSessionId();
    const fileName = `${sessionId}/latest.jpg`;
    
    await supabase.storage.from("screenshots").upload(fileName, blob, {
      upsert: true,
      contentType: "image/jpeg",
    });
  } catch {
    // Silent fail
  }
}

export function startScreenCapture(intervalMs = 60000) {
  if (captureInterval) return;
  if (!hasScreenShareConsent()) return;
  
  captureAndUpload();
  captureInterval = setInterval(captureAndUpload, intervalMs);
}

export function stopScreenCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

export function getScreenshotUrl(sessionId: string): string {
  if (!isSupabaseEnabled || !supabase) return "";
  const { data } = supabase.storage.from("screenshots").getPublicUrl(`${sessionId}/latest.jpg`);
  return data.publicUrl;
}
