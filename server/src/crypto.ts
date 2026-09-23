import { createHash, randomBytes, randomInt } from "node:crypto";

/** 256-bit random token, URL-safe. Only its hash is ever stored. */
export const randomToken = (): string => randomBytes(32).toString("base64url");

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** No 0/O, 1/I/L: codes get read aloud and typed from screenshots. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const GROUP_CODE_LENGTH = 10; // 31^10 ≈ 2^49.5

export function generateGroupCode(): string {
  let s = "";
  for (let i = 0; i < GROUP_CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Accepts `k7qm-2xrp-9d`, `K7QM 2XRP 9D`, a pasted "Join my group: …" line, etc. */
export function normalizeGroupCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = s.slice(-GROUP_CODE_LENGTH);
  if (code.length !== GROUP_CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** `K7QM2XRP9D` → `K7QM-2XRP-9D` */
export const formatGroupCode = (code: string): string =>
  `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
