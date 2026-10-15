import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as modelCenterModel from "../app/admin/ai-model-center-model.ts";
import {
  canonicalKeyDraft,
  costSummary,
  effectiveDiscoveryModality,
  humanModelStatus,
  imageRouteExecutionMode,
  imageAdapterConfigWithRequestParametersDraft,
  imageOperationPriceDraftFor,
  imageTaskOperations,
  imageTaskSpeeds,
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
  parseImageRequestParametersDraft,
  priceDiffRows,
  priceSummary,
  validateAdapterConfigDraft,
  validateCapabilitiesDraft,
  validateCostProfileDraft,
  validateImageRouteExecutionDraft,
  validateImageTaskOperationsDraft,
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

test("keeps capabilities and execution JSON read-only while operational controls remain structured", async () => {
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
  assert.doesNotMatch(source, /validateNumericTree/);
  assert.doesNotMatch(source, /canonicalModelKey: target, expectedUpdatedAt: discovery\.updatedAt/);
  assert.doesNotMatch(source, /\.\.\.draft, expectedUpdatedAt: discovery\.updatedAt/);
  assert.match(source, /该上游模型名与手动维护的兼容名称冲突/);
  assert.match(source, /该上游模型已被映射或不再处于待映射状态/);
  assert.doesNotMatch(source, /配置已被其他操作修改，请刷新后重试/);
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

test("defaults only Image 2.5 standard USELG image tasks to the effective async contract", () => {
  for (const submitEndpoint of ["/v1/images/generations", "/v1/images/edits"]) {
    const saved = { profile: "USELG_IMAGE_TASK", submitEndpoint };
    const config = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", saved, undefined, ["gpt-image-2.5"]);
    assert.equal(config.asyncParameterName, "async");
    assert.equal(config.asyncParameterValue, true);
    assert.deepEqual(saved, { profile: "USELG_IMAGE_TASK", submitEndpoint });
    assert.doesNotThrow(() => validateImageRouteExecutionDraft("TASK", config));
    const explicitFalse = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", { ...saved, asyncParameterValue: false }, undefined, ["gpt-image-2.5"]);
    assert.equal(explicitFalse.asyncParameterName, "async");
    assert.equal(explicitFalse.asyncParameterValue, false);
    assert.doesNotThrow(() => validateImageRouteExecutionDraft("TASK", explicitFalse));
  }
  for (const [profile, submitEndpoint] of [
    ["GENERIC_TASK", "/v1/images/generations"], ["GENERIC_TASK", "/v1/images/edits"],
    ["USELG_IMAGE_TASK", "/custom/image-tasks"], ["USELG_IMAGE_TASK", "/v1/images/generations?mode=custom"],
  ]) {
    const config = imageTaskExecutionConfigFor(profile, { submitEndpoint }, undefined, ["gpt-image-2.5"]);
    assert.equal(config.asyncParameterName, undefined);
    assert.equal(config.asyncParameterValue, undefined);
  }
  for (const asyncParameterName of ["async", "run_async"]) {
    const config = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
      submitEndpoint: "/v1/images/generations", asyncParameterName, asyncParameterValue: false,
    });
    assert.equal(config.asyncParameterName, asyncParameterName);
    assert.equal(config.asyncParameterValue, false);
  }
});

test("keeps explicit execution async settings ahead of adapter flags and USELG defaults", () => {
  const saved = { profile: "USELG_IMAGE_TASK", submitEndpoint: "/v1/images/generations" };
  const identities = ["gpt-image-2.5"];
  for (const adapterAsync of [true, false]) {
    const implicit = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", saved, adapterAsync, identities);
    assert.equal(implicit.asyncParameterName, "async");
    assert.equal(implicit.asyncParameterValue, adapterAsync);
    assert.equal(imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
      ...saved, asyncParameterValue: false,
    }, adapterAsync, identities).asyncParameterValue, false);
    for (const asyncParameterName of ["async", "run_async"]) {
      const explicit = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
        ...saved, asyncParameterName, asyncParameterValue: true,
      }, adapterAsync, identities);
      assert.equal(explicit.asyncParameterName, asyncParameterName);
      assert.equal(explicit.asyncParameterValue, true);
      const defaultValue = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
        ...saved, asyncParameterName,
      }, adapterAsync, identities);
      assert.equal(defaultValue.asyncParameterValue ?? true, true);
    }
  }
  const nullish = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
    ...saved, asyncParameterName: null, asyncParameterValue: null,
  }, false, identities);
  assert.equal(nullish.asyncParameterName, "async");
  assert.equal(nullish.asyncParameterValue, false);
  assert.deepEqual(saved, { profile: "USELG_IMAGE_TASK", submitEndpoint: "/v1/images/generations" });
});

test("keeps other models and identity-free callers on their existing explicit task contracts", () => {
  const saved = { profile: "USELG_IMAGE_TASK", submitEndpoint: "/v1/images/generations" };
  for (const identities of [[], ["gpt-image-2"], ["gpt-image-1"], ["nano-banana-2"], ["seedream-4.5"], ["midjourney-v7"], ["not-gpt-image-2.5"]]) {
    for (const adapterAsync of [true, false]) {
      const config = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", saved, adapterAsync, identities);
      assert.equal(config.asyncParameterName, undefined);
      assert.equal(config.asyncParameterValue, undefined);
      const explicit = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", {
        ...saved, asyncParameterName: "run_async", asyncParameterValue: false,
      }, adapterAsync, identities);
      assert.equal(explicit.asyncParameterName, "run_async");
      assert.equal(explicit.asyncParameterValue, false);
    }
  }
  for (const identity of ["gpt-image-2.5", "GPT_Image_2_5-high", "Image 2.5", "image-2-5-fixture"]) {
    assert.equal(imageTaskExecutionConfigFor("USELG_IMAGE_TASK", saved, undefined, [identity]).asyncParameterName, "async");
  }
  const opaqueRoute = imageTaskExecutionConfigFor("USELG_IMAGE_TASK", saved, undefined,
    ["opaque-upstream-alias", "gpt-image-2-5-sunburst"]);
  assert.equal(opaqueRoute.asyncParameterName, "async");
  assert.equal(opaqueRoute.asyncParameterValue, true);
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

test("validates only explicit reference request overrides without adding defaults", () => {
  for (const config of [{}, { referenceRequestCount: 1 }, { referenceResponseFormat: "url" },
    { referenceTransport: "data_url", referenceRequestCount: 1, referenceResponseFormat: "b64_json" }]) {
    const saved = structuredClone(config);
    validateAdapterConfigDraft(saved);
    assert.deepEqual(saved, config);
    assert.deepEqual(JSON.parse(JSON.stringify(saved)), config);
  }
  for (const referenceRequestCount of [0, 2, "1", true, null, NaN]) {
    assert.throws(() => validateAdapterConfigDraft({ referenceRequestCount }), /referenceRequestCount/);
  }
  for (const referenceResponseFormat of ["", "base64", 1, null]) {
    assert.throws(() => validateAdapterConfigDraft({ referenceResponseFormat }), /referenceResponseFormat/);
  }
});

const require = createRequire(import.meta.url);
let imageAdapterEditor;
let pricingEditor;
const loadImageAdapterEditor = async () => {
  if (imageAdapterEditor) return imageAdapterEditor;
  const source = await readFile(new URL("../app/admin/ai-model-center.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  const componentRequire = (id) => {
    if (id === "./ai-model-center-model") return modelCenterModel;
    if (id === "./admin.module.css") return {};
    return require(id);
  };
  new Function("require", "exports", compiled)(componentRequire, exports);
  imageAdapterEditor = exports.ImageAdapterEditor;
  pricingEditor = exports.PricingEditor;
  assert.equal(typeof imageAdapterEditor, "function");
  return imageAdapterEditor;
};

const editorFixture = async (overrides = {}) => {
  const Editor = await loadImageAdapterEditor();
  let changes = 0;
  let value = {
    priority: "100", costProfile: {}, capabilitiesOverride: null,
    adapterKey: "GENERIC_OPENAI_IMAGE", adapterConfig: {},
    executionMode: "TASK", executionConfig: { profile: "GENERIC_TASK", submitEndpoint: "/custom/submit", asyncParameterName: "async", asyncParameterValue: false },
    ...overrides,
  };
  const element = () => Editor({
    routeId: "route-1", upstreamModel: "documented-image-model", canonicalModelKey: "configured-image",
    supportsReferenceImages: true, value,
    onChange: (next) => { changes++; value = next; },
  });
  const controls = () => {
    const found = new Map();
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object" || !node.props) return;
      if (node.props["aria-label"]) found.set(node.props["aria-label"], node);
      visit(node.props.children);
    };
    visit(element());
    return found;
  };
  return {
    get value() { return value; },
    get changes() { return changes; },
    controls,
    html: () => renderToStaticMarkup(element()),
    select: (label, next) => {
      const control = controls().get(label);
      assert.ok(control, `missing control ${label}`);
      control.props.onChange({ target: { value: next } });
    },
    check: (label, checked) => {
      const control = controls().get(label);
      assert.ok(control, `missing control ${label}`);
      control.props.onChange({ target: { checked } });
    },
  };
};

test("Generic reference controls stay unset until selected and round-trip explicit values", async () => {
  const editor = await editorFixture({ adapterConfig: {
    generationEndpoint: "/v1/images/generations", resolutionParameter: "size", resolutionValueMode: "exact",
    exactDimensions: { "2K": { "16:9": "2048x1152" } },
  } });
  const original = structuredClone(editor.value);
  assert.match(editor.html(), /参考图请求数量 n/);
  for (const label of ["参考图传输方式", "参考图请求数量 n", "参考图返回格式 response_format"]) {
    assert.equal(editor.controls().get(label).props.value, "");
  }
  assert.equal(editor.changes, 0);
  assert.deepEqual(editor.value, original);
  editor.select("Generation Endpoint", "/v1/images/generations");
  for (const field of ["referenceTransport", "referenceRequestCount", "referenceResponseFormat"]) {
    assert.equal(Object.hasOwn(editor.value.adapterConfig, field), false);
  }
  editor.select("参考图格式", "object_image_url");
  editor.select("参考图传输方式", "data_url");
  editor.select("参考图请求数量 n", "1");
  editor.select("参考图返回格式 response_format", "b64_json");
  const saved = JSON.parse(JSON.stringify(editor.value.adapterConfig));
  validateAdapterConfigDraft(saved);
  assert.equal(saved.referenceSerializer, "object_image_url");
  assert.equal(saved.referenceTransport, "data_url");
  assert.equal(saved.referenceRequestCount, 1);
  assert.equal(saved.referenceResponseFormat, "b64_json");
  assert.equal(saved.generationEndpoint, original.adapterConfig.generationEndpoint);
  assert.deepEqual(saved.exactDimensions, original.adapterConfig.exactDimensions);
  assert.deepEqual(editor.value.executionConfig, original.executionConfig);
  const reopened = await editorFixture({ adapterConfig: saved });
  assert.equal(reopened.controls().get("参考图传输方式").props.value, "data_url");
  assert.equal(reopened.controls().get("参考图请求数量 n").props.value, "1");
  assert.equal(reopened.controls().get("参考图返回格式 response_format").props.value, "b64_json");
  for (const label of ["参考图传输方式", "参考图请求数量 n", "参考图返回格式 response_format"]) editor.select(label, "");
  for (const field of ["referenceTransport", "referenceRequestCount", "referenceResponseFormat"]) {
    assert.equal(Object.hasOwn(editor.value.adapterConfig, field), false);
  }
  assert.deepEqual(editor.value.executionConfig, original.executionConfig);
});

test("Generic public HTTPS is explicit and reference options do not follow an unrelated adapter", async () => {
  const generic = await editorFixture();
  generic.select("参考图传输方式", "public_https");
  assert.equal(generic.value.adapterConfig.referenceTransport, "public_https");
  assert.equal(Object.hasOwn(generic.value.adapterConfig, "referenceRequestCount"), false);
  assert.equal(Object.hasOwn(generic.value.adapterConfig, "referenceResponseFormat"), false);
  const originalExecution = structuredClone(generic.value.executionConfig);
  generic.select("参考图请求数量 n", "1");
  generic.select("参考图返回格式 response_format", "url");
  generic.select("图片调用协议", "GPT_IMAGE");
  assert.equal(generic.value.adapterConfig, null);
  assert.equal(generic.controls().has("参考图传输方式"), false);
  assert.equal(generic.controls().has("参考图请求数量 n"), false);
  assert.equal(generic.controls().has("参考图返回格式 response_format"), false);
  assert.deepEqual(generic.value.executionConfig, originalExecution);
});

test("validates flat fixed parameters, protected fields and reference override conflicts", () => {
  const parameters = { operation: "imagine", speed: "fast", n: 1, response_format: "b64_json", flag: false, weight: 0, empty: "" };
  validateAdapterConfigDraft({ requestParameters: parameters, referenceRequestCount: 1, referenceResponseFormat: "b64_json" });
  assert.deepEqual(parameters, { operation: "imagine", speed: "fast", n: 1, response_format: "b64_json", flag: false, weight: 0, empty: "" });
  validateAdapterConfigDraft({ requestParameters: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`param_${index}`, "x"])) });
  validateAdapterConfigDraft({ requestParameters: { n: 10, operation: "x".repeat(1000) } });
  for (const key of ["model", "PROMPT", "image", "images", "input", "input_images", "mask", "mask_base64",
    "size", "resolution", "aspect_ratio", "quality", "background", "output_format", "output_compression", "stream", "async",
    "__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "bad-key", "x".repeat(65)]) {
    assert.throws(() => validateAdapterConfigDraft({ requestParameters: JSON.parse(`{"${key}":"value"}`) }), /字段名/);
  }
  for (const requestParameters of [null, [], "string", { nested: {} }, { nested: [] }, { value: null },
    { value: NaN }, { value: Infinity }, { value: "x".repeat(1001) },
    Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`param_${index}`, true]))]) {
    assert.throws(() => validateAdapterConfigDraft({ requestParameters }), /固定请求参数/);
  }
  for (const n of [0, 11, 1.5, "1", true]) assert.throws(() => validateAdapterConfigDraft({ requestParameters: { n } }), /n/);
  for (const response_format of ["base64", "", false]) assert.throws(() => validateAdapterConfigDraft({ requestParameters: { response_format } }), /response_format/);
  assert.throws(() => validateAdapterConfigDraft({ requestParameters: { n: 2 }, referenceRequestCount: 1 }), /冲突/);
  assert.throws(() => validateAdapterConfigDraft({ requestParameters: { response_format: "url" }, referenceResponseFormat: "b64_json" }), /冲突/);
  assert.doesNotThrow(() => validateAdapterConfigDraft({ idempotencyHeader: "Idempotency-Key" }, "GENERIC_OPENAI_IMAGE"));
  assert.throws(() => validateAdapterConfigDraft({ idempotencyHeader: "X-Request-Id" }, "GENERIC_OPENAI_IMAGE"), /Idempotency-Key/);
  assert.doesNotThrow(() => validateAdapterConfigDraft({ idempotencyHeader: "X-Task-Id" }, "GENERIC_ASYNC_VIDEO"));
  assert.doesNotThrow(() => validateAdapterConfigDraft({ requestParameters: { model: { legacy: true } } }, "GPT_IMAGE"));
  assert.doesNotThrow(() => validateAdapterConfigDraft({ preserveTaskMetadata: true }, "GENERIC_OPENAI_IMAGE"));
  for (const preserveTaskMetadata of [false, "true", 1, null]) {
    assert.throws(() => validateAdapterConfigDraft({ preserveTaskMetadata }, "GENERIC_OPENAI_IMAGE"), /任务信息保留/);
  }
  assert.doesNotThrow(() => validateAdapterConfigDraft({ preserveTaskMetadata: false }, "GPT_IMAGE"));
});

test("keeps unset fixed parameters absent and clears only the explicit JSON draft", () => {
  const original = { generationEndpoint: "/v1/images/generations", requestParameters: { operation: "imagine", empty: "", flag: false, weight: 0 } };
  assert.equal(imageAdapterConfigWithRequestParametersDraft("GENERIC_OPENAI_IMAGE", original), original);
  assert.equal(imageAdapterConfigWithRequestParametersDraft("GENERIC_OPENAI_IMAGE", null, ""), null);
  for (const text of ["", " \n ", "{}", "{ } "]) {
    assert.equal(parseImageRequestParametersDraft(text), undefined);
    assert.deepEqual(imageAdapterConfigWithRequestParametersDraft("GENERIC_OPENAI_IMAGE", original, text), { generationEndpoint: "/v1/images/generations" });
  }
  const parsed = imageAdapterConfigWithRequestParametersDraft("GENERIC_OPENAI_IMAGE", {}, JSON.stringify(original.requestParameters));
  assert.deepEqual(parsed, { requestParameters: original.requestParameters });
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
  assert.deepEqual(original.requestParameters, { operation: "imagine", empty: "", flag: false, weight: 0 });
  for (const text of ["{", "null", "[]", '{"size":"2K"}']) {
    assert.throws(() => imageAdapterConfigWithRequestParametersDraft("GENERIC_OPENAI_IMAGE", original, text), /固定请求参数/);
  }
  assert.equal(imageAdapterConfigWithRequestParametersDraft("GPT_IMAGE", null, '{"operation":"imagine"}'), null);
});

test("edits fixed request JSON without losing invalid text and round-trips only deliberate Generic options", async () => {
  const editor = await editorFixture({ adapterConfig: { generationEndpoint: "/v1/images/generations", resolutionParameter: "none", aspectRatioParameter: "aspect_ratio" } });
  const originalConfig = structuredClone(editor.value.adapterConfig);
  const originalExecution = structuredClone(editor.value.executionConfig);
  assert.equal(editor.controls().get("固定请求参数").props.value, "");
  assert.equal(editor.controls().get("按原请求编号生成 Idempotency-Key").props.checked, false);
  assert.equal(editor.controls().get("保留任务与按钮信息（供后续操作使用）").props.checked, false);
  assert.equal(editor.changes, 0);
  editor.select("固定请求参数", '{"operation":');
  assert.equal(editor.controls().get("固定请求参数").props.value, '{"operation":');
  assert.equal(editor.controls().get("固定请求参数").props["aria-invalid"], true);
  assert.throws(() => imageAdapterConfigWithRequestParametersDraft(editor.value.adapterKey, editor.value.adapterConfig, editor.value.requestParametersDraft), /JSON/);
  assert.deepEqual(editor.value.adapterConfig, originalConfig);
  const text = '{"operation":"imagine","speed":"fast","n":1,"empty":"","flag":false,"weight":0}';
  editor.select("固定请求参数", text);
  editor.select("Generation Endpoint", "/v1/images/generations");
  editor.check("按原请求编号生成 Idempotency-Key", true);
  editor.check("保留任务与按钮信息（供后续操作使用）", true);
  assert.equal(editor.controls().get("固定请求参数").props["aria-invalid"], false);
  const saved = imageAdapterConfigWithRequestParametersDraft(editor.value.adapterKey, editor.value.adapterConfig, editor.value.requestParametersDraft);
  validateAdapterConfigDraft(saved, editor.value.adapterKey);
  assert.deepEqual(saved.requestParameters, JSON.parse(text));
  assert.equal(saved.idempotencyHeader, "Idempotency-Key");
  assert.equal(saved.preserveTaskMetadata, true);
  assert.equal(saved.resolutionParameter, "none");
  assert.equal(saved.aspectRatioParameter, "aspect_ratio");
  assert.deepEqual(editor.value.executionConfig, originalExecution);
  const reopened = await editorFixture({ adapterConfig: JSON.parse(JSON.stringify(saved)) });
  assert.deepEqual(JSON.parse(reopened.controls().get("固定请求参数").props.value), JSON.parse(text));
  assert.equal(reopened.controls().get("按原请求编号生成 Idempotency-Key").props.checked, true);
  assert.equal(reopened.controls().get("保留任务与按钮信息（供后续操作使用）").props.checked, true);
  reopened.select("固定请求参数", "{}");
  reopened.check("按原请求编号生成 Idempotency-Key", false);
  reopened.check("保留任务与按钮信息（供后续操作使用）", false);
  const cleared = imageAdapterConfigWithRequestParametersDraft(reopened.value.adapterKey, reopened.value.adapterConfig, reopened.value.requestParametersDraft);
  assert.equal(Object.hasOwn(cleared, "requestParameters"), false);
  assert.equal(Object.hasOwn(cleared, "idempotencyHeader"), false);
  assert.equal(Object.hasOwn(cleared, "preserveTaskMetadata"), false);
  editor.select("图片调用协议", "GPT_IMAGE");
  assert.equal(editor.value.requestParametersDraft, undefined);
  assert.equal(editor.controls().has("固定请求参数"), false);
  assert.equal(editor.controls().has("按原请求编号生成 Idempotency-Key"), false);
  assert.equal(editor.controls().has("保留任务与按钮信息（供后续操作使用）"), false);
});

test("validates operation pricing as exact optional decimal strings without a base-price fallback", () => {
  validatePricingDraft({ billingType: "image_flat", creditsPerRequest: "50" });
  const allOperations = Object.fromEntries(imageTaskOperations.map(operation => [operation,
    Object.fromEntries(imageTaskSpeeds.map(speed => [speed, "0"]))]));
  validatePricingDraft({ billingType: "image_flat", creditsPerOperation: allOperations });
  validatePricingDraft({ billingType: "image_flat", creditsPerOperation: { imagine: { fast: "9999999999999999.999999" } } });
  for (const price of [0, -1, "-1", "1e2", " 1", "01", "1.1234567", "10000000000000000", ""]) {
    assert.throws(() => validatePricingDraft({ billingType: "image_flat", creditsPerOperation: { upscale: { fast: price } } }), /操作价格/);
  }
  for (const creditsPerOperation of [null, [], { unknown: { fast: "1" } }, { upscale: null }, { upscale: { unknown: "1" } }]) {
    assert.throws(() => validatePricingDraft({ billingType: "image_flat", creditsPerOperation }), /操作/);
  }
  assert.throws(() => validatePricingDraft({ billingType: "image_count", creditsPerOperation: { upscale: { fast: "1" } } }), /image_flat/);
  const current = { billingType: "image_flat", creditsPerRequest: "50", creditsPerOperation: { upscale: { fast: "9999999999999999.999998" } } };
  const pending = { ...current, creditsPerOperation: { upscale: { fast: "9999999999999999.999999" }, upscale_subtle: { fast: "0" }, upscale_subtile: { fast: "1.5" } } };
  const changes = priceDiffRows(current, pending);
  assert.deepEqual(changes.find(row => row.key === "operation.upscale.fast"), {
    key: "operation.upscale.fast", label: "upscale · fast", unit: "积分 / 次",
    before: "9999999999999999.999998", after: "9999999999999999.999999",
  });
  assert.equal(changes.find(row => row.key === "operation.upscale_subtle.fast").after, "0");
  assert.equal(changes.find(row => row.key === "operation.upscale_subtile.fast").after, "1.5");
  assert.equal(priceSummary(current), "按操作定价 · 1 项");
  assert.equal(priceSummary({ billingType: "image_flat", creditsPerRequest: "50" }), "50 点/次");
});

test("edits operation and speed prices under image_flat without default entries and prunes cleared prices", async () => {
  await loadImageAdapterEditor();
  let value = { billingType: "image_flat", creditsPerRequest: "50" };
  const render = (billingType = "image_flat") => pricingEditor({
    detail: { modality: "image", billingType }, capabilities: {}, value,
    onChange: next => { value = next; },
  });
  const controls = () => {
    const found = new Map();
    const visit = node => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object" || !node.props) return;
      if (typeof node.type === "function") return visit(node.type(node.props));
      if (node.props["aria-label"]) found.set(node.props["aria-label"], node);
      visit(node.props.children);
    };
    visit(render());
    return found;
  };
  const set = (operation, speed, next) => controls().get(`操作售价 ${operation} ${speed}`).props.onChange({ target: { value: next } });
  assert.equal(controls().size, 54);
  assert.deepEqual(value, { billingType: "image_flat", creditsPerRequest: "50" });
  assert.match(renderToStaticMarkup(render()), /0 表示明确免费/);
  assert.doesNotMatch(renderToStaticMarkup(render("image_count")), /操作售价/);
  set("imagine", "fast", "25");
  set("upscale_subtle", "fast", "0");
  set("upscale_subtile", "fast", "1.5");
  assert.deepEqual(value.creditsPerOperation, { imagine: { fast: "25" }, upscale_subtle: { fast: "0" }, upscale_subtile: { fast: "1.5" } });
  assert.equal(value.creditsPerRequest, "50");
  const saved = JSON.parse(JSON.stringify(value));
  validatePricingDraft(saved);
  value = saved;
  assert.equal(controls().get("操作售价 upscale_subtle fast").props.value, "0");
  assert.equal(controls().get("操作售价 upscale_subtile fast").props.value, "1.5");
  assert.equal(controls().get("操作售价 upscale turbo").props.value, "");
  set("upscale", "turbo", "9999999999999999.999999");
  assert.equal(controls().get("操作售价 upscale turbo").props.value, "9999999999999999.999999");
  assert.match(renderToStaticMarkup(render()), /value="9999999999999999\.999999"/);
  value = JSON.parse(JSON.stringify(value));
  assert.equal(controls().get("操作售价 upscale turbo").props.value, "9999999999999999.999999");
  set("upscale", "turbo", "");
  for (const operation of ["imagine", "upscale_subtle", "upscale_subtile"]) set(operation, "fast", "");
  assert.equal(Object.hasOwn(value, "creditsPerOperation"), false);
  assert.deepEqual(imageOperationPriceDraftFor({ billingType: "image_flat", creditsPerRequest: "50" }, "upscale", "fast", ""), value);
});

test("requires explicit Generic Task operation prerequisites and round-trips the opt-in without auto-enabling anything", async () => {
  const config = { enableTaskOperations: true, preserveTaskMetadata: true, idempotencyHeader: "Idempotency-Key",
    requestParameters: { operation: "imagine", speed: "fast", n: 1 } };
  const executionConfig = { profile: "GENERIC_TASK" };
  validateAdapterConfigDraft(config, "GENERIC_OPENAI_IMAGE");
  validateImageTaskOperationsDraft("GENERIC_OPENAI_IMAGE", "TASK", config, executionConfig);
  for (const patch of [{ preserveTaskMetadata: undefined }, { idempotencyHeader: undefined },
    { requestParameters: {} }, { requestParameters: { operation: "upscale", speed: "fast", n: 1 } },
    { requestParameters: { operation: "imagine", speed: "unknown", n: 1 } },
    { requestParameters: { operation: "imagine", speed: "fast", n: 2 } }]) {
    assert.throws(() => validateAdapterConfigDraft({ ...config, ...patch }, "GENERIC_OPENAI_IMAGE"), /后续操作/);
  }
  assert.throws(() => validateAdapterConfigDraft({ enableTaskOperations: false }, "GENERIC_OPENAI_IMAGE"), /后续操作/);
  for (const mode of ["INHERIT", "DIRECT"]) assert.throws(() => validateImageTaskOperationsDraft("GENERIC_OPENAI_IMAGE", mode, config, executionConfig), /Generic Task/);
  assert.throws(() => validateImageTaskOperationsDraft("GENERIC_OPENAI_IMAGE", "TASK", config, { profile: "USELG_IMAGE_TASK" }), /Generic Task/);
  const editor = await editorFixture();
  assert.equal(editor.controls().get("开放任务后续操作接口").props.checked, false);
  editor.check("开放任务后续操作接口", true);
  assert.equal(editor.value.adapterConfig.enableTaskOperations, true);
  assert.equal(Object.hasOwn(editor.value.adapterConfig, "preserveTaskMetadata"), false);
  assert.equal(Object.hasOwn(editor.value.adapterConfig, "idempotencyHeader"), false);
  assert.equal(Object.hasOwn(editor.value.adapterConfig, "requestParameters"), false);
  assert.equal(editor.controls().get("固定请求参数").props["aria-invalid"], true);
  editor.check("开放任务后续操作接口", false);
  assert.equal(Object.hasOwn(editor.value.adapterConfig, "enableTaskOperations"), false);
  const enabled = await editorFixture({ adapterConfig: JSON.parse(JSON.stringify(config)) });
  assert.equal(enabled.controls().get("开放任务后续操作接口").props.checked, true);
  enabled.check("开放任务后续操作接口", false);
  assert.equal(Object.hasOwn(enabled.value.adapterConfig, "enableTaskOperations"), false);
  assert.equal((await editorFixture({ adapterKey: "GPT_IMAGE" })).controls().has("开放任务后续操作接口"), false);
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

test("validates configured image quality, result mode and quality price matrices", () => {
  validateCapabilitiesDraft({ supportedQualities: ["low", "high", "xhigh", "max"], qualityParameter: "render_quality", outputMode: "multiple_assets", maxOutputImages: 4, billingMode: "per_request" });
  assert.throws(() => validateCapabilitiesDraft({ supportedQualities: ["high"], qualityParameter: "model" }));
  assert.throws(() => validateCapabilitiesDraft({ maxOutputImages: 0 }));
  validatePricingDraft({ billingType: "image_resolution", creditsPerImageByResolution: { "2k": "10" }, creditsPerImageByResolutionQuality: { "2k": { high: "20", max: "40" } } });
  assert.throws(() => validatePricingDraft({ creditsPerImageByResolutionQuality: { "2k": { high: "-1" } } }));
  assert.throws(() => validateCostProfileDraft({ cnyPerImageByResolutionQuality: { "2k": { high: "bad" } } }));
  const rows = priceDiffRows({ billingType: "image_resolution", creditsPerImageByResolutionQuality: { "2k": { high: "20" } } }, { billingType: "image_resolution", creditsPerImageByResolutionQuality: { "2k": { high: "25", max: "40" } } });
  assert.ok(rows.some(row => row.label === "2K + high" && row.before === 20 && row.after === 25));
  assert.ok(rows.some(row => row.label === "2K + max" && row.after === 40));
});

test("exposes editable quality, quality cost and music controls in AI CENTER", async () => {
  const source = await readFile(new URL("../app/admin/ai-model-center.tsx", import.meta.url), "utf8");
  for (const field of ["supportedQualities", "qualityParameter", "outputMode", "maxOutputImages", "billingMode", "creditsPerImageByResolutionQuality", "music_flat"]) assert.ok(source.includes(field));
  assert.ok(source.includes('value="audio"'));
  assert.ok(source.includes('capabilities={effectiveRouteCapabilities}'));
  assert.ok(source.includes('selectedBillingType === "music_flat"'));
});
