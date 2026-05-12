import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseEnabled = !!SUPABASE_URL && !!SUPABASE_PUBLISHABLE_KEY;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const timeoutMs = 8000;
  const retries = 2;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => {
      try {
        controller.abort(new Error("timeout"));
      } catch {
        controller.abort();
      }
    }, timeoutMs);
    try {
      const res = await fetch(input, { ...(init || {}), signal: controller.signal });
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      const err = e as { name?: string; message?: string };
      const isAbort = err?.name === "AbortError";
      if (isAbort && attempt >= retries) {
        throw new Error("Koneksi ke server timeout. Silakan coba lagi.");
      }
      if (!isAbort && attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  return fetch(input, init);
}

export const supabase = isSupabaseEnabled
  ? createClient<Database>(SUPABASE_URL as string, SUPABASE_PUBLISHABLE_KEY as string, {
      global: { fetch: fetchWithTimeout },
    })
  : null;
