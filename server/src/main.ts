import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { LOGO_DIR, LOGO_FILE } from "./brand.ts";
import { loadConfig } from "./config.ts";
import { installScript } from "./install.ts";
import { rivetProxy } from "./proxy.ts";

const config = loadConfig(process.env, pkg.version);
// RivetKit's native side reads this from the real environment, so it has to be set before
// the process starts (Dockerfile, `bun run dev`); assigning process.env here is too late.
const storage = process.env.RIVETKIT_STORAGE_PATH;
if (!storage && !config.development) throw new Error("set RIVETKIT_STORAGE_PATH to the data volume");

// The game is bundled here, before the registry starts: once RivetKit's native runtime is
// up, Bun's HTML bundler fails in this process (and its dev server resolves rivetkit's Node build).
const web = await Bun.build({
  entrypoints: [join(import.meta.dir, "../../web/index.html")],
  target: "browser",
  minify: !config.development,
  sourcemap: config.development ? "inline" : "none",
});
if (!web.success) throw new AggregateError(web.logs, "building the game failed");
const assets = new Map(web.outputs.map((o) => [`/${basename(o.path)}`, o]));

// The marketing site at `/`: static files built by Astro beforehand (`bun run site:build`; the
// Dockerfile does it). Tests and a fresh checkout run without it.
const SITE = join(import.meta.dir, "../../site/dist");
if (!existsSync(SITE) && !config.development) throw new Error("build the site first: bun run site:build");
const site = new Map<string, Bun.BunFile>();
if (existsSync(SITE))
  for (const path of new Bun.Glob("**/*").scanSync(SITE)) site.set(`/${path}`, Bun.file(join(SITE, path)));

const { ENGINE_PORT, ENGINE_TOKEN, registry } = await import("./actors/registry.ts");
const { pricing } = await import("./actors/shared.ts");

const refreshPricing = async () => {
  const r = await pricing.refreshFromUpstream();
  console.log(`[pricing] ${r.failed ? "refresh failed, keeping" : "refreshed"} ${r.updated} models`);
};
void refreshPricing();
setInterval(refreshPricing, 86_400_000);

// Serve only once actors can run, so the healthcheck means the whole thing is up.
registry.start();
await registry.startAndWait();
const proxy = rivetProxy(`127.0.0.1:${ENGINE_PORT}`, ENGINE_TOKEN);

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  routes: {
    "/play": new Response(assets.get("/index.html"), { headers: { "cache-control": "no-cache" } }),
    "/health": () => Response.json({ ok: true, version: config.version }),
    "/install.sh": installScript,
    // Company logos, copied from their websites. Sandboxed: an SVG is someone else's markup.
    "/logos/:file": async (req) => {
      const file = Bun.file(join(LOGO_DIR, req.params.file));
      if (!LOGO_FILE.test(req.params.file) || !(await file.exists()))
        return new Response("Not found", { status: 404 });
      return new Response(file, {
        headers: {
          "cache-control": "public, max-age=86400",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          "x-content-type-options": "nosniff",
        },
      });
    },
  },
  fetch(req, server) {
    const path = new URL(req.url).pathname;
    const asset = assets.get(path);
    if (asset)
      return new Response(asset, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    const page = site.get(path.endsWith("/") ? `${path}index.html` : path);
    if (page)
      return new Response(page, {
        headers: {
          "cache-control": path.startsWith("/_astro/") ? "public, max-age=31536000, immutable" : "no-cache",
        },
      });
    return proxy.fetch(req, server);
  },
  websocket: proxy.websocket,
});

console.log(
  `[tokenmaxxing] v${config.version} listening on ${server.url} (data: ${storage ?? "~/.rivetkit"})`,
);
