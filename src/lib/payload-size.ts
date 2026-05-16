export const CONVEX_DOCUMENT_SAFE_BYTES = 850 * 1024;
export const CONVEX_DOCUMENT_WARNING_BYTES = 700 * 1024;

export function getJsonByteSize(value: unknown): number {
  const json = JSON.stringify(value);
  return new TextEncoder().encode(json).length;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isWithinConvexDocumentSafeLimit(value: unknown): {
  ok: boolean;
  bytes: number;
  warning: boolean;
} {
  const bytes = getJsonByteSize(value);
  return {
    ok: bytes <= CONVEX_DOCUMENT_SAFE_BYTES,
    bytes,
    warning: bytes >= CONVEX_DOCUMENT_WARNING_BYTES,
  };
}
