import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  newProviderDraft,
  normalizePricing,
  pricingLabel,
  providerToDraft,
} from "../app/admin/admin-model.ts";

test("new channels keep only a coarse legacy capability fallback", () => {
  assert.deepEqual(newProviderDraft("NEW_API").capabilities, ["LLM"]);
  assert.deepEqual(newProviderDraft("USELG").capabilities, ["IMAGE"]);
  assert.deepEqual(newProviderDraft("BIGMODEL").capabilities, ["IMAGE"]);
  assert.deepEqual(newProviderDraft("MINIMAX").capabilities, ["VIDEO_MINIMAX"]);
});

test("editing a channel preserves its legacy capability data without exposing model checkboxes", async () => {
  const capabilities = ["IMAGE_NANO_BANANA_PRO_FAST", "IMAGE_GPT_1K"];
  const draft = providerToDraft({
    id: "provider-1",
    name: "Dynamic provider",
    kind: "USELG",
    enabled: true,
    priority: 10,
    baseUrl: "https://provider.example.com/v1",
    defaultModel: "future-image-model",
    allowInsecureHttp: false,
    apiKeyConfigured: true,
    apiKeyLast4: "1234",
    capabilities,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestModelCount: null,
    lastTestedAt: null,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  });
  assert.deepEqual(draft.capabilities, capabilities);

  const source = await readFile(new URL("../app/admin/admin-console.tsx", import.meta.url), "utf8");
  assert.match(source, /模型、能力与实际路由统一在 AI Model Center 中管理/);
  assert.doesNotMatch(source, /providerCapabilities\.map/);
  assert.doesNotMatch(source, /capabilities:\s*providerDraft\.capabilities/);
});

test("fast Banana pricing has independent 2K and 4K rows", () => {
  const pricing = normalizePricing({
    agentRequestCredits: "7",
    inspirationAnalysisCredits: "3",
    imageDefaultCredits: "55",
    videoDefaultCredits: "500",
    imageModels: [{
      model: "nano-banana-pro-fast",
      credits2k: "28",
      credits4k: "30",
    }, {
      model: "nano-banana-2-fast",
      credits2k: "24",
      credits4k: "27",
    }],
    videoModels: [],
    updatedAt: null,
  });
  const fastPro = pricing.imageModels.find((item) => item.model === "nano-banana-pro-fast");
  const fastBanana2 = pricing.imageModels.find((item) => item.model === "nano-banana-2-fast");

  assert.deepEqual(fastPro, {
    model: "nano-banana-pro-fast",
    credits2k: "28",
    credits4k: "30",
  });
  assert.deepEqual(fastBanana2, {
    model: "nano-banana-2-fast",
    credits2k: "24",
    credits4k: "27",
  });
  assert.equal(pricingLabel("nano-banana-pro-fast"), "Nano Banana Pro（稳定高速）");
  assert.equal(pricingLabel("nano-banana-2-fast"), "Nano Banana 2（稳定高速）");
});
