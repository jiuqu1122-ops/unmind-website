import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adminUsagePeriodLabel,
  membershipQuotasFromFreeQuota,
  membershipQuotaTypeForModality,
} from "../app/admin/admin-model.ts";

test("normalizes membership quota configuration without binding upstream routes", () => {
  assert.deepEqual(membershipQuotasFromFreeQuota({
    quotas: [{
      type: "IMAGE_COUNT",
      canonicalModelId: "canonical-image-1",
      period: "DAILY",
      limit: 20,
    }],
  }), [{
    type: "IMAGE_COUNT",
    canonicalModelId: "canonical-image-1",
    period: "DAILY",
    limit: 20,
  }]);
  assert.deepEqual(membershipQuotasFromFreeQuota(undefined), []);
  assert.deepEqual(membershipQuotasFromFreeQuota({}), []);
  assert.equal(membershipQuotaTypeForModality("image"), "IMAGE_COUNT");
  assert.equal(membershipQuotaTypeForModality("chat"), "LLM_TOKENS");
  assert.equal(membershipQuotaTypeForModality("video"), null);
});

test("exposes recent usage ranges and submits freeQuota from the membership editor", async () => {
  assert.equal(adminUsagePeriodLabel(1), "今日");
  assert.equal(adminUsagePeriodLabel(7), "最近 7 天");
  assert.equal(adminUsagePeriodLabel(30), "最近 30 天");

  const source = await readFile(new URL("../app/admin/admin-console.tsx", import.meta.url), "utf8");
  assert.match(source, /\/v1\/admin\/usage\?days=\$\{days\}/);
  assert.match(source, /<option value=\{30\}>最近 30 天<\/option>/);
  assert.match(source, /freeQuota,/);
  assert.match(source, /canonicalModelId: model\.id/);
  assert.doesNotMatch(source, /provider.*freeQuota|routeId.*freeQuota|upstreamModel.*freeQuota/);
});
