import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("deploys the pulled revision despite stale image tags in the shell and Compose env", async () => {
  const directory = await mkdtemp(join(tmpdir(), "website-deploy-test-"));
  const revision = "a".repeat(40);
  try {
    await mkdir(join(directory, "bin"));
    await writeFile(join(directory, ".env"), "WEBSITE_IMAGE=ghcr.io/example/website:sha-old-compose\n");
    const script = await readFile(new URL("../scripts/deploy.sh", import.meta.url), "utf8");
    await writeFile(join(directory, "deploy.sh"), script.replace(/\r\n/g, "\n"));
    await writeFile(join(directory, "bin", "git"), `#!/usr/bin/env bash\nif [[ "$*" == "rev-parse HEAD" ]]; then printf '%s\\n' '${revision}'; fi\n`);
    await writeFile(join(directory, "bin", "docker"), `#!/usr/bin/env bash
case "$*" in
  "compose pull website") printf '%s' "$WEBSITE_IMAGE" > selected-image.txt ;;
  "compose ps -q website") printf '%s\\n' 'test-website' ;;
  inspect*) printf '%s\\n' 'healthy' ;;
esac
exit 0
`);
    await Promise.all(["git", "docker"].map(name => chmod(join(directory, "bin", name), 0o755)));
    const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
    const result = spawnSync(bash, ["-c", 'export PATH="$PWD/bin:$PATH"; bash ./deploy.sh'], {
      cwd: directory,
      env: { ...process.env, PROJECT_DIR: directory.replace(/\\/g, "/"), WEBSITE_IMAGE: "ghcr.io/example/website:sha-old-shell" },
      encoding: "utf8",
      timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.equal(await readFile(join(directory, "selected-image.txt"), "utf8"), `ghcr.io/jiuqu1122-ops/unmind-website:sha-${revision}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
