import { copyFileSync, createReadStream, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

// The header's background loop lives in the repository root (`tokenmaxxing-hero-loop.mp4`), next to
// the launch film, so there is one copy of it. This puts it at `/tokenmaxxing-hero-loop.mp4`: copied
// into the build, and served from the root by `astro dev`.
const HERO_VIDEO = "tokenmaxxing-hero-loop.mp4";
const heroSource = fileURLToPath(new URL(`../${HERO_VIDEO}`, import.meta.url));

const heroVideo = {
  name: "hero-video",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.middlewares.use(`/${HERO_VIDEO}`, (_req, res) => {
        res.setHeader("content-type", "video/mp4");
        res.setHeader("content-length", statSync(heroSource).size);
        createReadStream(heroSource).pipe(res);
      });
    },
    "astro:build:done": ({ dir }) => copyFileSync(heroSource, new URL(HERO_VIDEO, dir)),
  },
};

// The marketing site, built to static files that the server serves at `/` (the game is at `/play`).
export default defineConfig({
  site: "https://tokenmaxxing.dk",
  integrations: [heroVideo],
});
