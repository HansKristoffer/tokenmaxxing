import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, URL-safe. Only its hash is ever stored. */
export const randomToken = (): string => randomBytes(32).toString("base64url");

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
