# syntax=docker/dockerfile:1
# Server image for Railway (railway.json builds this). The dashboard is bundled
# by Bun at startup from web/, so the image carries source, not a build.
ARG BUN_VERSION=1.4.2
FROM oven/bun:${BUN_VERSION}-slim
WORKDIR /app

COPY package.json bun.lock ./
COPY core/package.json core/
COPY server/package.json server/
COPY web/package.json web/
COPY app/helper/package.json app/helper/
RUN bun install --frozen-lockfile --production

COPY core core
COPY server server
COPY web web

# Mount the Railway volume at /data. Runs as root because Railway mounts volumes root-owned.
ENV NODE_ENV=production \
    PORT=8787 \
    TOKENMAXXING_DATA_DIR=/data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["bun", "server/src/main.ts"]
