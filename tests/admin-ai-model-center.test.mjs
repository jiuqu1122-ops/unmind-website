import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalKeyDraft,
  costSummary,
  effectiveDiscoveryModality,
  humanModelStatus,
  imageRouteExecutionMode,
  imageTaskExecutionConfigFor,
  isModelCenterUnavailable,
  isUnsupportedPrice,
  lowestRouteCost,
  marginDetails,
  marginPercent,
  modelMatchesModality,
  normalizeCapabilityOption,
  normalizeCapabilityOptions,
  parseJsonObject,
  priceDiffRows,
  priceSummary,
  validateAdapterConfigDraft,
  validateCapabilitiesDraft,
  validateCostProfileDraft,
  validateImageRouteExecutionDraft,
  validatePricingDraft,
  resolveVideoCostBillingType,
  videoCostDraftForBillingType,
  videoBillingTypeOptions,
  videoPricingDraftForBillingType,
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
  assert.equal(priceSummary({
    billingType: "video_flat",
    creditsPerVideo: "15",
    creditsPerSecond: "999",
  }), "15 点/条");
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
  assert.match(source, /视频计费方式/);
  assert.deepEqual(videoBillingTypeOptions.map((option) => option.label), [
    "按条计费",
    "按秒计费",
    "按时长档位",
    "按分辨率 × 秒",
  ]);
  assert.match(source, /成本计费方式/);
  assert.match(source, /每条视频成本/);
  assert.match(source, /继承模型能力/);
  assert.match(source, /capabilitiesOverride,/);
  assert.match(source, /图片调用协议/);
  assert.match(source, /兼容旧逻辑 \/ Legacy/);
  assert.match(source, /Gemini Native \/ Nano Banana/);
  assert.match(source, /Seedream Images API/);
  assert.match(source, /Grok Images API/);
  assert.match(source, /Resolution 参数/);
  assert.match(source, /Generation Endpoint/);
  assert.match(source, /Edit Endpoint/);
  assert.match(source, /执行方式/);
  assert.match(source, /继承协议默认/);
  assert.match(source, /直返结果/);
  assert.match(source, /异步任务/);
  assert.match(source, /GENERIC_OPENAI_IMAGE/);
  assert.match(source, /单图 image/);
  assert.match(source, /多图 images/);
  assert.match(source, /该 Route 支持参考图，但尚未确认参考图序列化字段/);
  assert.match(source, /USELG Image Task/);
  assert.match(source, /Generic Task/);
  assert.match(source, /Submit Endpoint/);
  assert.match(source, /仅切换执行方式不会把长连接接口变成异步接口/);
  assert.match(source, /\.\.\.\(adapterChanged \? \{ adapterKey \} : \{\}\)/);
  assert.doesNotMatch(source, /<strong>Quality<\/strong>/);
  assert.match(source, /确认删除模型/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /usage-model-bindings/);
  assert.match(source, /IMAGE_ANALYSIS/);
  assert.match(source, /CANVAS_TEXT/);
  assert.match(source, /fixedCredits/);
  assert.match(source, /固定收费/);
  assert.match(source, /480p.*540p.*576p.*720p.*768p.*1080p.*1440p.*2k.*4k/);
  assert.match(source, /\+ 添加规格/);
  assert.match(source, /MINIMAX_NATIVE_VIDEO/);
  assert.match(source, /USAGE_MODEL_NOT_AVAILABLE/);
  assert.match(source, /JSON\.stringify\(\{ canonicalModelKey: target \}\)/);
  assert.match(source, /body: JSON\.stringify\(draft\)/);
  assert.match(source, /modalityOverride/);
  assert.match(source, /系统不会自动迁移；请先解除映射/);
  assert.match(source, /validateCapabilitiesDraft\(capabilities\)/);
  assert.match(source, /validateCostProfileDraft\(costProfile\)/);
  assert.match(source, /validateAdapterConfigDraft\(adapterConfig\)/);
  assert.doesNotMatch(source, /validateNumericTree/);
  assert.doesNotMatch(source, /canonicalModelKey: target, expectedUpdatedAt: discovery\.updatedAt/);
  assert.doesNotMatch(source, /\.\.\.draft, expectedUpdatedAt: discovery\.updatedAt/);
  assert.match(source, /该上游模型名与手动维护的兼容名称冲突/);
  assert.match(source, /该上游模型已被映射或不再处于待映射状态/);
  assert.doesNotMatch(source, /配置已被其他操作修改，请刷新后重试/);
  assert.doesNotMatch(source, /<textarea/);
  assert.doesNotMatch(source, /<input[^>]+upstreamModelId/);
});

test("keeps image protocol and execution lifecycle independent", () => {
  assert.equal(imageRouteExecutionMode(undefined), "INHERIT");
  assert.equal(imageRouteExecutionMode("INHERIT"), "INHERIT");
  assert.equal(imageRouteExecutionMode("DIRECT"), "DIRECT");
  assert.equal(imageRouteExecutionMode("TASK"), "TASK");

  assert.doesNotThrow(() => validateImageRouteExecutionDraft("INHERIT", null));
  assert.doesNotThrow(() => validateImageRouteExecutionDraft("DIRECT", null));
  const uselg = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
    submitEndpoint: "/v1/images/generations",
  });
  assert.equal(uselg.statusEndpointTemplate, "/v1/images/tasks/{taskId}?view=summary");
  assert.doesNotThrow(() => validateImageRouteExecutionDraft("TASK", uselg));
  assert.throws(() => validateImageRouteExecutionDraft("TASK", null), /任务协议/);
  assert.throws(() => validateImageRouteExecutionDraft("TASK", {
    profile: "GENERIC_TASK",
    submitEndpoint: "/v1/images/generations",
  }), /状态接口或结果接口/);
  assert.throws(() => validateImageRouteExecutionDraft("TASK", {
    profile: "USELG_IMAGE_TASK",
    submitEndpoint: "/v1beta/models/gemini-3.1-flash-image:generateContent",
  }), /不是已确认的快速任务提交接口/);
  assert.throws(() => validateImageRouteExecutionDraft("DIRECT", uselg), /不能保留 executionConfig/);
});

test("normalizes dynamic video resolutions, durations, and aspect ratios", () => {
  assert.deepEqual(normalizeCapabilityOptions([" 768P ", "768p", "2K", "1280x768"], "resolution"), [
    "768p",
    "2k",
    "1280x768",
  ]);
  assert.deepEqual(normalizeCapabilityOptions(["3", "7", "20"], "duration"), ["3", "7", "20"]);
  assert.equal(normalizeCapabilityOption(" 21:9 ", "aspectRatio"), "21:9");
  assert.throws(() => normalizeCapabilityOption("601", "duration"), /600/);
  assert.throws(() => normalizeCapabilityOption("../../bad", "resolution"), /分辨率/);
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

test("prefers a manual discovery modality override", () => {
  assert.equal(effectiveDiscoveryModality({
    effectiveModality: "image",
    modalityOverride: "image",
    suggestedModality: "video",
  }), "image");
  assert.equal(effectiveDiscoveryModality({
    effectiveModality: null,
    modalityOverride: null,
    suggestedModality: "video",
  }), "video");
});

test("validates structured range and fixed video capabilities without parsing mode strings as numbers", () => {
  assert.doesNotThrow(() => validateCapabilitiesDraft({
    durationMode: "range",
    durationRange: { min: 4, max: 15, step: 1 },
    defaultDurationSeconds: 5,
    supportedResolutions: ["720p"],
    aspectRatioMode: "list",
    supportedAspectRatios: ["16:9", "9:16"],
    minReferenceImages: 0,
    maxReferenceImages: 9,
    minReferenceVideos: 0,
    maxReferenceVideos: 3,
    minReferenceAudios: 0,
    maxReferenceAudios: 3,
  }));
  assert.doesNotThrow(() => validateCapabilitiesDraft({
    durationMode: "fixed",
    supportedDurations: [30],
    defaultDurationSeconds: 30,
    aspectRatioMode: "unspecified",
  }));
});

test("rejects invalid duration ranges and reference bounds", () => {
  assert.throws(() => validateCapabilitiesDraft({
    durationMode: "range",
    durationRange: { min: 15, max: 4, step: 1 },
  }), /min/);
  assert.throws(() => validateCapabilitiesDraft({
    durationMode: "range",
    durationRange: { min: 4, max: 15, step: 0 },
  }), /step/);
  assert.throws(() => validateCapabilitiesDraft({
    minReferenceImages: 10,
    maxReferenceImages: 9,
  }), /minReferenceImages/);
});

test("keeps pricing, cost, and adapter validation schema-specific", () => {
  assert.doesNotThrow(() => validatePricingDraft({
    billingType: "video_duration",
    creditsPerSecond: "12.5",
    creditsByDuration: { "5": "60", "10": 110 },
    durationMode: "range",
  }));
  assert.doesNotThrow(() => validateCostProfileDraft({
    currency: "CNY",
    cnyPerSecond: "0.25",
    standard: { upstreamInputCnyPer1m: 2.5 },
  }));
  assert.doesNotThrow(() => validateAdapterConfigDraft({
    durationParameter: "seconds",
    resolutionParameter: "none",
    aspectRatioParameter: "none",
    referenceSerialization: "array",
    taskIdPath: "data.id",
    statusPath: "data.status",
    videoAvailablePath: "data.video_available",
    assetStatePath: "data.asset_state",
    pollAfterMsPath: "data.poll_after_ms",
  }));
  assert.throws(() => validatePricingDraft({ creditsPerSecond: "NaN" }), /NaN/);
  assert.throws(() => validateCostProfileDraft({ currency: "POINTS" }), /USD/);
});

test("switches video sell-price drafts without retaining mutually exclusive base fields", () => {
  const surcharge = {
    includedReferenceImages: "2",
    creditsPerExtraReferenceImage: "3",
    creditsPerReferenceVideoSecond: "4",
  };
  const flat = videoPricingDraftForBillingType({
    billingType: "video_second",
    credits: "15",
    creditsPerSecond: "15",
    creditsPerVideo: "90",
    creditsByDuration: { "10": "80" },
    creditsByResolution: { "2k": "9" },
    ...surcharge,
  }, "video_flat");
  assert.deepEqual(flat, {
    billingType: "video_flat",
    creditsPerVideo: "90",
    ...surcharge,
  });
  const second = videoPricingDraftForBillingType(flat, "video_second");
  assert.deepEqual(second, { billingType: "video_second", ...surcharge });
});

test("normalizes video route costs to an explicit per-video or per-second mode", () => {
  assert.equal(resolveVideoCostBillingType({ cnyPerRequest: "3" }), "video_flat");
  assert.equal(resolveVideoCostBillingType({ cnyPerSecond: "0.06" }), "video_second");
  assert.deepEqual(videoCostDraftForBillingType({
    currency: "USD",
    cnyPerRequest: "3",
    cnyPerSecond: "0.06",
  }, "video_flat"), {
    currency: "USD",
    billingType: "video_flat",
    amountPerVideo: "3",
  });
  assert.doesNotThrow(() => validateCostProfileDraft({
    currency: "USD",
    billingType: "video_second",
    amountPerSecond: "0.06",
  }));
});
