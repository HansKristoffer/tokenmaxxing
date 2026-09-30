/**
 * Security headers for the pages we serve. The game and the admin page keep tokens in
 * `localStorage`, so their CSP allows only our own scripts, and connections to our own origin:
 * even if some text ever got past React's escaping, it couldn't load a script or send a token away.
 */
export type Page = "game" | "admin" | "site";

const COMMON = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/** `host` is the request's, for WebSockets back to us (older WebKit doesn't count them as 'self'). */
export function pageHeaders(page: Page, host: string, production: boolean): Record<string, string> {
  const headers: Record<string, string> = { ...COMMON };
  if (production) headers["strict-transport-security"] = "max-age=31536000";
  if (page === "site") return headers;
  const sockets = `ws://${host} wss://${host}`;
  // The desktop app's window calls the app (sign-in, updates) over Tauri's IPC, which is a fetch.
  const connect = page === "game" ? `'self' ${sockets} ipc: http://ipc.localhost` : `'self' ${sockets}`;
  headers["content-security-policy"] = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  if (page === "admin") {
    headers["referrer-policy"] = "no-referrer";
    headers["x-robots-tag"] = "noindex";
  }
  return headers;
}
