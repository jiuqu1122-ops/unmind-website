import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalKeyDraft,
  costSummary,
  isModelCenterUnavailable,
  lowestRouteCost,
  marginPercent,
  modelMatchesModality,
  parseJsonObject,
  priceSummary,
} from "../app/admin/ai-model-center-model.ts";

test("summarizes canonical image, chat, and video prices", () => {
  assert.equal(priceSummary({
    billingType: "image_resolution",
    creditsPerImageByResolution: { "2k": "16", "4k": "20" },
  }), "2K 16 点 · 4K 20 点");
  assert.equal(priceSummary({
    billingType: "token",
    standard: {
      inputCreditsPerMillion: "300",
      outputCreditsPerMillion: "1500",
    },
  }), "输入 300 / 输出 1,500 点·1M");
  assert.equal(priceSummary({
    billingType: "video_second",
    creditsPerSecond: "19",
  }), "19 点/秒");
});

test("keeps route cost and sell price separate when calculating margin", () => {
  const price = {
    billingType: "image_resolution",
    creditsPerImageByResolution: { "2k": "16", "4k": "20" },
  };
  const cost = {
    currency: "CNY",
    cnyPerImageByResolution: { "2k": "0.07", "4k": "0.11" },
  };
  assert.equal(costSummary(cost), "2K ¥0.07 · 4K ¥0.11");
  assert.equal(marginPercent(price, cost), 56.25);
  assert.deepEqual(price, {
    billingType: "image_resolution",
    creditsPerImageByResolution: { "2k": "16", "4k": "20" },
  });
});

test("chooses the lowest representative upstream route without changing priority", () => {
  const routes = [{
    id: "route-a",
    priority: 1,
    costProfile: { cnyPerImageByResolution: { "2k": "0.09" } },
  }, {
    id: "route-b",
    priority: 9,
    costProfile: { cnyPerImageByResolution: { "2k": "0.07" } },
  }];
  assert.equal(lowestRouteCost(routes).id, "route-b");
  assert.equal(routes[0].priority, 1);
});

test("normalizes create keys, validates JSON objects, and filters modality", () => {
  assert.equal(canonicalKeyDraft(" Gemini 3.1 Pro Image Preview "), "gemini-3-1-pro-image-preview");
  assert.deepEqual(parseJsonObject('{"supportsReferenceImage":true}', "Capabilities"), {
    supportsReferenceImage: true,
  });
  assert.throws(() => parseJsonObject("[]", "Capabilities"), /JSON 对象/);
  assert.equal(modelMatchesModality({ modality: "video" }, "video"), true);
  assert.equal(modelMatchesModality({ modality: "video" }, "image"), false);
  assert.equal(isModelCenterUnavailable(Object.assign(new Error("not found"), { status: 404 })), true);
  assert.equal(isModelCenterUnavailable(Object.assign(new Error("server error"), { status: 500 })), false);
});
