import crypto from "crypto";

function parseKey(raw: string) {
  const s = (raw || "").trim();
  if (!s) throw new Error("Encryption key not configured");
  const asHex = /^[0-9a-fA-F]+$/.test(s) && s.length === 64;
  const buf = asHex ? Buffer.from(s, "hex") : Buffer.from(s, "base64");
  if (buf.length !== 32) throw new Error("Encryption key must be 32 bytes");
  return buf;
}

export function encryptJson(value: unknown, keyRaw: string) {
  const key = parseKey(keyRaw);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptJson(payload: { iv: string; tag: string; ciphertext: string }, keyRaw: string) {
  const key = parseKey(keyRaw);
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

