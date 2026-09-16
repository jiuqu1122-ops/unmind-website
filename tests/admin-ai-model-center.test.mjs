import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalKeyDraft,
  costSummary,
  humanModelStatus,
  isModelCenterUnavailable,
  isUnsupportedPrice,
  lowestRouteCost,
  marginDetails,
  marginPercent,
  modelMatchesModality,
  parseJsonObject,
  priceDiffRows,
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
  assert.deepEqual(marginDetails(price, cost), {
    sellPoints: 16,
    sellCny: 0.16,
    costCny: 0.07,
    profitCny: 0.09,
    marginPercent: 56.25,
  });
  assert.deepEqual(price, {
    billingType: "image_resolution",
    creditsPerImageByResolution: { "2k": "16", "4k": "20" },
  });
});

test("hides unsupported price sentinels and produces an operator-readable price diff", () => {
  const current = {
    billingType: "image_resolution",
    creditsPerImageByResolution: { "1k": "99999", "2k": "16", "4k": "20" },
  };
  const pending = {
    billingType: "image_resolution",
    creditsPerImageByResolution: { "2k": "18", "4k": "22" },
  };
  assert.equal(isUnsupportedPrice("99999"), true);
  assert.equal(priceSummary(current), "1K 不支持 · 2K 16 点 · 4K 20 点");
  assert.doesNotMatch(priceSummary(current), /99,?999/);
  assert.deepEqual(priceDiffRows(current, pending), [{
    key: "image.2k",
    label: "2K",
    unit: "积分 / 张",
    before: 16,
    after: 18,
  }, {
    key: "image.4k",
    label: "4K",
    unit: "积分 / 张",
    before: 20,
    after: 22,
  }]);
});

test("keeps all operational edits structured and raw JSON read-only", async () => {
  const source = await readFile(new URL("../app/admin/ai-model-center.tsx", import.meta.url), "utf8");
  assert.match(source, /更改上游映射/);
  assert.match(source, /解除上游映射/);
  assert.match(source, /保存为待发布/);
  assert.match(source, /发布新价格/);
  assert.match(source, /Capabilities JSON（只读）/);
  assert.match(source, /编辑渠道成本与能力/);
  assert.match(source, /继承模型能力/);
  assert.match(source, /capabilitiesOverride,/);
  assert.match(source, /图片调用适配器/);
  assert.match(source, /兼容旧逻辑 \/ Legacy/);
  assert.match(source, /Seedream Images API/);
  assert.match(source, /Grok Images API/);
  assert.match(source, /Resolution 参数/);
  assert.match(source, /Generation Endpoint/);
  assert.match(source, /Edit Endpoint/);
  assert.match(source, /\.\.\.\(adapterChanged \? \{ adapterKey \} : \{\}\)/);
  assert.doesNotMatch(source, /<strong>Quality<\/strong>/);
  assert.match(source, /确认删除模型/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /usage-model-bindings/);
  assert.match(source, /IMAGE_ANALYSIS/);
  assert.match(source, /CANVAS_TEXT/);
  assert.match(source, /USAGE_MODEL_NOT_AVAILABLE/);
  assert.match(source, /JSON\.stringify\(\{ canonicalModelKey: target \}\)/);
  assert.match(source, /body: JSON\.stringify\(draft\)/);
  assert.doesNotMatch(source, /canonicalModelKey: target, expectedUpdatedAt: discovery\.updatedAt/);
  assert.doesNotMatch(source, /\.\.\.draft, expectedUpdatedAt: discovery\.updatedAt/);
  assert.doesNotMatch(source, /<textarea/);
  assert.doesNotMatch(source, /<input[^>]+upstreamModelId/);
});

test("shows lifecycle state before route health", () => {
  assert.equal(humanModelStatus({ status: "DRAFT", enabled: true, routes: [{ enabled: true, upstreamAvailable: true }] }), "草稿");
  assert.equal(humanModelStatus({ status: "RETIRED", enabled: false, routes: [] }), "已退役");
  assert.equal(humanModelStatus({ status: "PUBLISHED", enabled: false, routes: [{ enabled: true }] }), "已停用");
  assert.equal(humanModelStatus({
    status: "PUBLISHED",
    enabled: true,
    routingMode: "MANAGED",
    routes: [{
      enabled: true,
      upstreamAvailable: true,
      healthStatus: "HEALTHY",
      channel: { status: "DISABLED" },
    }],
  }), "无可用调用路由");
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
