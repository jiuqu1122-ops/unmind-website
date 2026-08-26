import assert from "node:assert/strict";
import test from "node:test";
import {
  getUselgOpenAiRouting,
  getUselgOpenAiRoutingHint,
  newProviderDraft,
  normalizePricing,
  pricingLabel,
  providerCapabilities,
  providerToDraft,
} from "../app/admin/admin-model.ts";

test("USELG Agent and Vision OpenAI routing can be enabled independently", () => {
  assert.deepEqual(getUselgOpenAiRouting("USELG", ["LLM", "IMAGE_GPT"]), {
    agent: true,
    vision: false,
  });
  assert.deepEqual(getUselgOpenAiRouting("USELG", ["VISION", "IMAGE_GPT"]), {
    agent: false,
    vision: true,
  });
  assert.deepEqual(getUselgOpenAiRouting("USELG", ["LLM", "VISION", "IMAGE_GPT"]), {
    agent: true,
    vision: true,
  });
});

test("USELG image generation alone does not opt into the OpenAI text route", () => {
  assert.deepEqual(getUselgOpenAiRouting("USELG", ["IMAGE_GPT"]), {
    agent: false,
    vision: false,
  });
  assert.equal(getUselgOpenAiRoutingHint("USELG", ["IMAGE_GPT"]), "");
  assert.equal(getUselgOpenAiRoutingHint("MIKOTO", ["LLM", "VISION"]), "");
});

test("USELG routing hint keeps the native image path unchanged", () => {
  const hint = getUselgOpenAiRoutingHint("USELG", ["VISION", "IMAGE_GPT"]);
  assert.match(hint, /图片分析.*\/v1\/chat\/completions.*生图能力仍使用原有接口/);
  assert.match(hint, /默认模型必须支持 image_url/);
});

test("new USELG channels use the documented OpenAI-compatible API base", () => {
  const draft = newProviderDraft("USELG");
  assert.equal(draft.baseUrl, "https://api.uselg.top/v1");
  assert.equal(draft.capabilities.includes("LLM"), false);
  assert.equal(draft.capabilities.includes("VISION"), false);
});

test("fast Banana channels are selectable and preserved without changing their model", () => {
  const labels = new Map(providerCapabilities.map((item) => [item.value, item.label]));
  assert.equal(labels.get("IMAGE_NANO_BANANA_PRO_FAST"), "Nano Banana Pro（稳定高速）");
  assert.equal(labels.get("IMAGE_NANO_BANANA_2_FAST"), "Nano Banana 2（稳定高速）");

  const draft = providerToDraft({
    id: "fast-banana-pro",
    name: "高速 Banana Pro",
    kind: "USELG",
    enabled: true,
    priority: 10,
    baseUrl: "https://fast.example.com/v1",
    defaultModel: "gemini-3-pro-image",
    allowInsecureHttp: false,
    apiKeyConfigured: true,
    apiKeyLast4: "1234",
    capabilities: ["IMAGE_NANO_BANANA_PRO_FAST"],
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestModelCount: null,
    lastTestedAt: null,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  });

  assert.deepEqual(draft.capabilities, ["IMAGE_NANO_BANANA_PRO_FAST"]);
  assert.equal(draft.defaultModel, "gemini-3-pro-image");
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
