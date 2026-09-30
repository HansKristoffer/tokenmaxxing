import { describe, expect, test } from "bun:test";
import { publicOrigin } from "../src/install.ts";
import { origin } from "./rivet.ts";

describe("/install.sh", () => {
  test("points the CLI at the server it came from", async () => {
    const r = await fetch(`${origin}/install.sh`);
    expect(r.headers.get("content-type")).toContain("shellscript");
    const script = await r.text();
    expect(script).toStartWith("#!/bin/sh");
    expect(script).toContain(`SERVER="${origin}"`);
    expect(script).not.toContain("__SERVER__");
  });

  test("behind the proxy, the public scheme is the forwarded one", () => {
    const req = (host: string, proto?: string) =>
      new Request(`http://${host}/install.sh`, proto ? { headers: { "x-forwarded-proto": proto } } : {});
    expect(publicOrigin(req("tokenmaxxing.app", "https"))).toBe("https://tokenmaxxing.app");
    expect(publicOrigin(req("localhost:8787"))).toBe("http://localhost:8787");
    expect(publicOrigin(req("tokenmaxxing.app", "https;rm -rf"))).toBeNull();
  });
});
