import assert from "node:assert/strict";
import test from "node:test";
import {
  getUselgOpenAiRouting,
  getUselgOpenAiRoutingHint,
  newProviderDraft,
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
