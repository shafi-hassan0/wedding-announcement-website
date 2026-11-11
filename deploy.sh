#!/usr/bin/env bash
# Pulls the latest code and brings the site up to date on the server.
# Usage: ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Backstop against overlapping deploys (a manual run alongside a CI trigger)
# racing on this repo's git refs when both run `git pull` below.
exec 200>"$ROOT/.deploy.lock"
flock -w 300 200 || {
  echo "Could not acquire deploy lock within 5 minutes" >&2
  exit 1
}

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

if ! docker network inspect portfolio-net >/dev/null 2>&1; then
  echo "Docker network 'portfolio-net' not found. Bring up the portfolio stack first." >&2
  exit 1
fi

echo "=== Pulling latest ==="
git pull

echo "=== Rebuilding and restarting ==="
# Both images are built here: the backend from server/, and the site from web/
# (with nginx.conf baked in). Docker only recreates a container whose image changed,
# so a text edit to the page does not restart the backend.
docker compose up -d --build

echo
docker compose ps
echo
echo "Done. Site deployed."
