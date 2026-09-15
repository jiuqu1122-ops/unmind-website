# Repository workflow instructions

## Trigger: “给我部署代码”

When the user says “给我部署代码” for this repository, treat it as a deployment handoff request, not a request for an archive.

1. Fetch `origin`, confirm the current branch is the latest `main`, and preserve unrelated working-tree changes.
2. Run the relevant typecheck, lint, tests, and build.
3. Commit only the requested files and push `main` to `origin`.
4. Wait for the GitHub Actions workflow `Build website image` for that commit to succeed before returning the production commands. If it fails, diagnose or report the failure instead of telling the user to deploy it.
5. Do not SSH to or mutate production unless the user separately and explicitly asks for production deployment.
6. Return the following root-server command block, adjusted only if the checked-in deployment scripts change:

```bash
cd /opt/unmind-website
git status --short
git pull --ff-only origin main
chmod +x scripts/deploy.sh
PROJECT_DIR=/opt/unmind-website ./scripts/deploy.sh
curl --fail --show-error --head https://www.unmind.art/admin
```

The production `.env` and its keys already live under `/opt/unmind-website` for the root deployment. Never print, replace, upload, commit, or recreate that file. Do not build the website on the production server; deploy the prebuilt GHCR image produced by GitHub Actions. Never use `docker compose down -v` in this workflow.
