# Repository workflow instructions

## Trigger: “给我部署代码”

When the user says “给我部署代码” for this repository, treat it as a deployment handoff request, not a request for an archive.

1. Fetch `origin`, confirm the current branch is the latest `main`, and preserve unrelated working-tree changes.
2. Run the relevant typecheck, lint, tests, and build.
3. Commit only the requested files and push `main` to `origin`.
4. Wait for the GitHub Actions workflow `Build website image` for that commit to succeed before returning the production commands. If it fails, diagnose or report the failure instead of telling the user to deploy it. The deployment script must select the immutable `sha-*` image for the checked-out Git revision so a stale `WEBSITE_IMAGE` value in production `.env` cannot deploy an older build.
5. Do not SSH to or mutate production unless the user separately and explicitly asks for production deployment.
6. Do not provide deployment commands while the workflow is queued, running, or failed. A failed validation/build must be fixed and pushed first.
7. Return one directly executable root-server command block, adjusted only if the checked-in deployment scripts change:

```bash
set -euo pipefail
cd /opt/unmind-website
git status --short
git pull --ff-only origin main
expected_sha="$(git rev-parse HEAD)"
chmod +x scripts/deploy.sh
PROJECT_DIR=/opt/unmind-website ./scripts/deploy.sh
website_id="$(docker compose ps -q website)"
test "$(docker inspect --format '{{.Config.Image}}' "$website_id")" = "ghcr.io/jiuqu1122-ops/unmind-website:sha-$expected_sha"
curl --fail --location --show-error --head https://www.unmind.art/admin/
```

The deployment script derives `WEBSITE_IMAGE=ghcr.io/jiuqu1122-ops/unmind-website:sha-<current Git SHA>` after pulling and exports it before Compose runs. This is required because production `.env` may contain an older pinned `WEBSITE_IMAGE`; Compose previously used that stale value even while the script printed `latest`. Always verify the running container image against `expected_sha` as shown above.

The production `.env` and its keys already live under `/opt/unmind-website` for the root deployment. Never print, replace, upload, commit, or recreate that file. Do not build the website on the production server; deploy the prebuilt GHCR image produced by GitHub Actions. Never use `docker compose down -v` in this workflow. Verify the final HTTPS URL with `/admin/` and `curl --location`; an HTTP 301 alone is not success. Nginx must keep directory redirects relative (`absolute_redirect off`) because it receives HTTP from Caddy internally and must not emit an `http://www.unmind.art/...` Location header.

When a release also changes `inspiration-wallet-server`, deploy and verify the backend first, then deploy this website. Do not run both deployments concurrently on the 2 GiB server.
