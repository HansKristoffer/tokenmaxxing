import { describe, expect, test } from "bun:test";
import { appBundlePath, checkForUpdate, isNewer, parseCaskVersion } from "../src/update.ts";

const cask = (v: string) =>
  `cask "tokenmaxxing" do\n  arch arm: "arm64"\n\n  version "${v}"\n  sha256 arm: "x"\nend\n`;

describe("update check", () => {
  test("reads the version from the published cask", () => {
    expect(parseCaskVersion(cask("0.2.0"))).toBe("0.2.0");
    expect(parseCaskVersion("no version here")).toBeNull();
  });

  test("relaunches the bundle the helper lives in", () => {
    expect(appBundlePath("/Applications/Tokenmaxxing.app/Contents/Helpers/tokenmaxxing-helper")).toBe(
      "/Applications/Tokenmaxxing.app",
    );
    expect(appBundlePath("/usr/local/bin/bun")).toBe("/Applications/Tokenmaxxing.app");
  });

  test("compares versions numerically", () => {
    expect(isNewer("0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("1.0.0", "0.99.0")).toBe(true);
    expect(isNewer("0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("0.1.0", "0.2.0")).toBe(false);
    expect(isNewer("0.1.1", "0.1")).toBe(true);
  });

  test("reports only newer versions and treats network errors as no update", async () => {
    const serve = (body: string, status = 200) =>
      (async () => new Response(body, { status })) as unknown as typeof fetch;
    expect(await checkForUpdate("0.1.0", serve(cask("0.2.0")))).toBe("0.2.0");
    expect(await checkForUpdate("0.2.0", serve(cask("0.2.0")))).toBeNull();
    expect(await checkForUpdate("0.1.0", serve("", 404))).toBeNull();
    const offline = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await checkForUpdate("0.1.0", offline)).toBeNull();
  });
});
