#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/unmind-website}"
WEBSITE_IMAGE_REPOSITORY="${WEBSITE_IMAGE_REPOSITORY:-ghcr.io/jiuqu1122-ops/unmind-website}"

cd "$PROJECT_DIR"

command -v git >/dev/null 2>&1 || { echo "Git is not installed" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is not installed" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is not available" >&2; exit 1; }

test -f .env || { echo ".env is missing; copy .env.example to .env first" >&2; exit 1; }
docker network inspect inspiration_backend >/dev/null 2>&1 || {
  echo "Docker network inspiration_backend is missing; start the backend stack first" >&2
  exit 1
}

git pull --ff-only
source_revision="$(git rev-parse HEAD 2>/dev/null)" || { echo "Cannot resolve the Git revision for the prebuilt image" >&2; exit 1; }
deployment_image="${WEBSITE_IMAGE:-${WEBSITE_IMAGE_REPOSITORY}:sha-${source_revision}}"
export WEBSITE_IMAGE="$deployment_image"

echo "Pulling prebuilt website image: $WEBSITE_IMAGE"
if ! docker compose pull website; then
  echo "Prebuilt image pull failed. Confirm that the 'Build website image' GitHub Actions run for $source_revision succeeded and that this server can read the GHCR package." >&2
  exit 1
fi
docker compose up -d --no-build website

container_id="$(docker compose ps -q website)"
test -n "$container_id" || { echo "Website container was not created" >&2; exit 1; }

for _ in $(seq 1 20); do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  if [[ "$status" == "healthy" ]]; then
    docker compose ps
    exit 0
  fi
  if [[ "$status" == "unhealthy" || "$status" == "exited" ]]; then
    docker compose logs --tail=100 website >&2
    exit 1
  fi
  sleep 2
done

docker compose logs --tail=100 website >&2
echo "Website health check timed out" >&2
exit 1
