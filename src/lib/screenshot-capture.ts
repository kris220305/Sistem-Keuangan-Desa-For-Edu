import html2canvas from "html2canvas";
import { getSessionId } from "@/lib/session-manager";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

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
  if (!isConvexEnabled || !convex) return;
  
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
    const { uploadUrl } = await convex.mutation(anyApi.screenshots.generateUploadUrl, { sessionId } as any);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });
    if (!uploadRes.ok) return;
    const uploadJson = await uploadRes.json();
    const storageId = uploadJson.storageId as string;
    if (!storageId) return;
    await convex.mutation(anyApi.screenshots.attachLatest, { sessionId, storageId } as any);
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
