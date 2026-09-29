import { describe, expect, test } from "bun:test";
import { fetchLogo, isPublicHost, plainPalette } from "../src/brand.ts";
import { parseWebsite } from "../src/validate.ts";

describe("company websites", () => {
  test("parsed to a bare host", () => {
    expect(parseWebsite("acme.com")).toBe("acme.com");
    expect(parseWebsite(" https://www.Acme.co.uk/about?x=1 ")).toBe("acme.co.uk");
    for (const bad of [
      "localhost",
      "http://127.0.0.1",
      "acme",
      "ftp://acme.com",
      "https://u:p@acme.com",
      "acme.com:8080",
      42,
    ])
      expect(parseWebsite(bad)).toBeNull();
  });

  test("logos only come from the public internet", async () => {
    for (const host of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.5",
      "169.254.169.254",
      "[::1]",
      "[::ffff:127.0.0.1]",
      "localhost",
    ])
      expect(await isPublicHost(host)).toBe(false);
    expect(await isPublicHost("8.8.8.8")).toBe(true);
    expect(await fetchLogo("http://127.0.0.1:1/logo.png")).toBeNull();
    expect(await fetchLogo("file:///etc/passwd")).toBeNull();
  });

  test("inline logos are taken as they are, images only", async () => {
    const svg = await fetchLogo(
      `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'/>")}`,
    );
    expect(svg?.ext).toBe("svg");
    expect(await fetchLogo("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  test("without Claude, the site's colours are used, readable", () => {
    expect(plainPalette({ colors: { primary: "#FF0000", background: "#101010" } })).toEqual({
      roof: "#ff0000",
      wall: "#f3e7cf",
      trim: "#6b4a33",
      plaque: "#ffffff",
    });
  });
});
