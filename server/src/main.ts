import pkg from "../../package.json" with { type: "json" };
import dashboard from "../../web/index.html";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDb } from "./db/db.ts";
import { PricingCache } from "./pricing.ts";

const config = loadConfig(process.env, pkg.version);
const db = openDb(config.dbPath);
const pricing = new PricingCache();
const app = buildApp({ db, pricing, version: config.version, secureCookies: config.secureCookies });

const refreshPricing = async () => {
  const r = await pricing.refreshFromUpstream();
  console.log(`[pricing] ${r.failed ? "refresh failed, keeping" : "refreshed"} ${r.updated} models`);
};
void refreshPricing();
setInterval(refreshPricing, 86_400_000);

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  development: config.development,
  routes: { "/": dashboard },
  fetch: app.fetch,
});

console.log(`[tokenmaxxing] v${config.version} listening on ${server.url} (db: ${config.dbPath})`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.stop();
    db.close();
    process.exit(0);
  });
}
