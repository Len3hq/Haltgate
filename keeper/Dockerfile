# Built from the REPO ROOT (Railway: Root Directory = /), because the keeper
# reads market addresses from frontend/lib instead of keeping its own copy.
# /.dockerignore keeps the context down to exactly what is copied here.
FROM node:22-alpine

WORKDIR /app

# The two registries the watchlist is built from. Plain data, no imports.
COPY frontend/lib/mainnet.ts frontend/lib/contracts.ts frontend/lib/

COPY keeper/package.json keeper/package-lock.json keeper/
RUN npm ci --prefix keeper --omit=dev --no-audit --no-fund

COPY keeper/src keeper/src

WORKDIR /app/keeper
ENV NODE_ENV=production \
    DATA_DIR=/data

# One image, two Railway services: the keeper (default) and the sync watchdog
# (KEEPER_ENTRY=src/tools/sync-watchdog.ts). `exec` so node itself receives
# SIGTERM, which Railway sends on every redeploy; `npm start` would swallow it.
CMD ["sh", "-c", "exec node --import tsx ${KEEPER_ENTRY:-src/watch.ts}"]
