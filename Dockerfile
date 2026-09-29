# syntax=docker/dockerfile:1
# Server image for Railway (railway.json builds this). One process runs the web server, the
# Rivet engine and every actor; the game is bundled by Bun at startup from web/.
ARG BUN_VERSION=1.4.2
FROM oven/bun:${BUN_VERSION}-slim
WORKDIR /app

COPY package.json bun.lock ./
COPY core/package.json core/
COPY server/package.json server/
COPY web/package.json web/
COPY app/helper/package.json app/helper/
# --ignore-scripts: the engine and runtime ship prebuilt per platform; the one script is a native
# better-sqlite3 build pulled in by an optional RivetKit feature we don't use.
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY core core
COPY server server
COPY web web

# Mount the Railway volume at /data: the engine keeps every actor's state and SQLite there,
# and company logos go next to it in /data/logos.
# Both RIVET* vars are read by RivetKit's native side, so they must be real environment.
# Runs as root because Railway mounts volumes root-owned.
ENV NODE_ENV=production \
    PORT=8787 \
    RIVETKIT_STORAGE_PATH=/data/rivet \
    RIVET_LOG_LEVEL=error
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["bun", "server/src/main.ts"]
