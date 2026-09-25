#!/usr/bin/env bash
# Deploy the keeper image to a Railway service from this machine.
#
#   keeper/scripts/railway-deploy.sh keeper      # the keeper service
#   keeper/scripts/railway-deploy.sh watchdog    # the sync watchdog service
#
# `railway up` uploads a directory. Pointing it at the repo would send the
# whole working tree, so this stages exactly what keeper/Dockerfile copies,
# plus railway.json at the root where Railway looks for it, and uploads that.
# Nothing else leaves the machine: no .env, no private notes, no node_modules.
set -euo pipefail

SERVICE="${1:?usage: railway-deploy.sh <service>}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/frontend/lib" "$STAGE/keeper"
cp "$REPO/frontend/lib/mainnet.ts" "$REPO/frontend/lib/contracts.ts" "$STAGE/frontend/lib/"
cp "$REPO/keeper/package.json" "$REPO/keeper/package-lock.json" "$REPO/keeper/Dockerfile" "$STAGE/keeper/"
cp -R "$REPO/keeper/src" "$STAGE/keeper/src"
cp "$REPO/keeper/railway.json" "$STAGE/railway.json"
# Also at the root, where Railway detects a Dockerfile without any config. The
# repo's /.dockerignore is deliberately NOT staged: the stage is already
# minimal, and Railway applies that file before reading railway.json, which it
# would then hide (the first deploy failed exactly that way).
cp "$REPO/keeper/Dockerfile" "$STAGE/Dockerfile"

echo "uploading $(find "$STAGE" -type f | wc -l | tr -d ' ') files to service '$SERVICE'"
# Run from the repo so the CLI uses this directory's linked project.
cd "$REPO"
railway up "$STAGE" --path-as-root --service "$SERVICE" --detach
