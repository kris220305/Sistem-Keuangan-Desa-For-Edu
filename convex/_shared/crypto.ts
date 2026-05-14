const webCrypto = (globalThis as any).crypto;

function bytesToHex(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string) {
  const s = (hex || "").trim();
  if (s.length % 2 !== 0) throw new Error("Invalid hex");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string) {
  const bin = atob((b64 || "").trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function parseKeyBytes(raw: string) {
  const s = (raw || "").trim();
  if (!s) throw new Error("Encryption key not configured");
  const asHex = /^[0-9a-fA-F]+$/.test(s) && s.length === 64;
  const bytes = asHex ? hexToBytes(s) : base64ToBytes(s);
  if (bytes.length !== 32) throw new Error("Encryption key must be 32 bytes");
  return bytes;
}

async function importAesKey(keyRaw: string) {
  const keyBytes = parseKeyBytes(keyRaw);
  if (!webCrypto?.subtle) throw new Error("Crypto not available");
  return await webCrypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function randomBytes(n: number) {
  const out = new Uint8Array(n);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export async function encryptJson(value: unknown, keyRaw: string) {
  const key = await importAesKey(keyRaw);
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await webCrypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, plaintext);
  const ct = new Uint8Array(encrypted);
  const tag = ct.slice(Math.max(0, ct.length - 16));
  const ciphertext = ct.slice(0, Math.max(0, ct.length - 16));
  return {
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tag),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export async function decryptJson(payload: { iv: string; tag: string; ciphertext: string }, keyRaw: string) {
  const key = await importAesKey(keyRaw);
  const iv = base64ToBytes(payload.iv);
  const tag = base64ToBytes(payload.tag);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const decrypted = await webCrypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, combined);
  const text = new TextDecoder().decode(new Uint8Array(decrypted));
  return JSON.parse(text);
}

export const cryptoUtils = { bytesToHex, hexToBytes, bytesToBase64, base64ToBytes, randomBytes };
