import { describe, expect, test } from "bun:test";
import { clientIp, close, gatewayAllowed } from "../src/proxy.ts";

test("closes pass on as codes that can be sent, so a dropped socket can't crash the server", () => {
  const sent: [number | undefined, string | undefined][] = [];
  const socket = { close: (code?: number, reason?: string) => void sent.push([code, reason]) };
  close(socket, 1006, "");
  close(socket, 1005, "");
  close(socket, 1011, "engine unreachable");
  close(socket, 4001, "kicked");
  expect(sent).toEqual([
    [1000, ""],
    [1000, ""],
    [1011, "engine unreachable"],
    [4001, "kicked"],
  ]);
});

describe("what the gateway lets through", () => {
  const allowed = (url: string) => {
    const u = new URL(url, "http://x");
    return gatewayAllowed(u.pathname, u.searchParams);
  };
  const q = (method: string, name: string, key: string, extra = "") =>
    `/gateway/${name}/connect?rvt-namespace=default&rvt-method=${method}&rvt-key=${key}${extra}`;

  test("the singletons as ['main'], and any existing actor", () => {
    for (const name of ["town", "world", "arcade"])
      expect(allowed(q("getOrCreate", name, "main"))).toBe(true);
    expect(allowed(q("get", "player", "42"))).toBe(true);
    expect(allowed(q("get", "match", "7"))).toBe(true);
    expect(allowed("/gateway/abc123actorid/connect")).toBe(true);
    expect(allowed("/metadata")).toBe(true);
  });

  test("nothing that could create an actor", () => {
    expect(allowed(q("getOrCreate", "player", "43"))).toBe(false);
    expect(allowed(q("getOrCreate", "match", "8"))).toBe(false);
    expect(allowed(q("getOrCreate", "town", "evil"))).toBe(false);
    expect(allowed(q("getOrCreate", "town", "main", "&rvt-input=abc"))).toBe(false);
    expect(allowed(q("getOrCreate", "town", "main", "&rvt-key=other"))).toBe(false);
    expect(allowed(q("get", "town", "main", "&rvt-method=getOrCreate"))).toBe(false);
    expect(allowed(q("create", "town", "main"))).toBe(false);
    expect(allowed(q("get", "nope", "1"))).toBe(false);
    expect(allowed("/actors")).toBe(false);
    expect(allowed("/gateway/abc123actorid/connect?rvt-key=x")).toBe(false);
  });
});

test("the client's IP comes from the edge's header, else the socket", () => {
  const server = { requestIP: () => ({ address: "10.0.0.1", family: "IPv4" as const, port: 1 }) };
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });
  expect(clientIp(req({ "x-real-ip": "1.2.3.4" }), server, "x-real-ip")).toBe("1.2.3.4");
  expect(clientIp(req({ "x-forwarded-for": "5.6.7.8, 10.0.0.9" }), server, "x-forwarded-for")).toBe(
    "5.6.7.8",
  );
  expect(clientIp(req({}), server, "x-real-ip")).toBe("10.0.0.1");
});
