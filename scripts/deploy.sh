#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/unmind-website}"

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
echo "Pulling prebuilt website image: ${WEBSITE_IMAGE:-ghcr.io/jiuqu1122-ops/unmind-website:latest}"
docker compose pull website
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
