import type { Server, WebSocketHandler } from "bun";

/** Browsers and the menu bar app reach actors under this path, on our own origin. */
const RIVET_PATH = "/api/rivet";

interface Upstream {
  target: string;
  protocols: string[];
  socket?: WebSocket;
  /** Messages from the client that arrived before the engine socket opened. */
  pending: (string | Uint8Array)[];
}

/**
 * Forwards the client gateway of the local Rivet engine: HTTP and WebSockets
 * under `/api/rivet/gateway/*` plus `/api/rivet/metadata`. Nothing else of the
 * engine's API is reachable from outside.
 */
export function rivetProxy(engine: string) {
  const isPublic = (path: string) => path.startsWith("/gateway/") || path === "/metadata";

  const fetch = async (req: Request, server: Server<Upstream>): Promise<Response | undefined> => {
    const url = new URL(req.url);
    const path = url.pathname.startsWith(`${RIVET_PATH}/`) ? url.pathname.slice(RIVET_PATH.length) : null;
    if (path === null || !isPublic(path)) return new Response("Not found", { status: 404 });
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const protocols = (req.headers.get("sec-websocket-protocol") ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const upgraded = server.upgrade(req, {
        data: { target: `ws://${engine}${path}${url.search}`, protocols, pending: [] },
        headers: protocols[0] ? { "Sec-WebSocket-Protocol": protocols[0] } : undefined,
      });
      return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
    }
    const headers = new Headers(req.headers);
    headers.delete("host");
    return globalThis.fetch(`http://${engine}${path}${url.search}`, {
      method: req.method,
      headers,
      body: req.body,
      redirect: "manual",
    });
  };

  const websocket: WebSocketHandler<Upstream> = {
    open(ws) {
      const up = new WebSocket(ws.data.target, ws.data.protocols);
      up.binaryType = "arraybuffer";
      ws.data.socket = up;
      up.onopen = () => {
        for (const m of ws.data.pending) up.send(m);
        ws.data.pending = [];
      };
      up.onmessage = (e) =>
        ws.send(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer));
      up.onclose = (e) => ws.close(e.code === 1005 ? 1000 : e.code, e.reason);
      up.onerror = () => ws.close(1011, "engine unreachable");
    },
    message(ws, msg) {
      const up = ws.data.socket;
      if (up?.readyState === WebSocket.OPEN) up.send(msg);
      else ws.data.pending.push(msg);
    },
    close(ws, code, reason) {
      ws.data.socket?.close(code === 1005 ? 1000 : code, reason);
    },
  };

  return { fetch, websocket };
}
