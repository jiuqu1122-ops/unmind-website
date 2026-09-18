export type JsonObject = Record<string, unknown>;

export type AiModelModality = "chat" | "image" | "video";
export type AiModelStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type AiRoutingMode = "LEGACY" | "MANAGED";
export type AiPricingMode = "MANUAL" | "MARKUP";
export type AiUsageModelKey = "IMAGE_ANALYSIS" | "CANVAS_TEXT";
export type AiModelRoute = {
  id: string;
  canonicalModelId: string | null;
  provider: string;
  channelId: string | null;
  upstreamModelId: string;
  enabled: boolean;
  priority: number;
  healthStatus: string;
  upstreamAvailable: boolean;
  lastSyncedAt: string | null;
  costProfile: JsonObject | null;
  capabilitiesOverride: JsonObject | null;
  adapterKey: string | null;
  adapterConfig: JsonObject | null;
  metadata: JsonObject | null;
  pricingSyncStatus: string;
  costUpdatedAt: string | null;
  updatedAt: string;
  channel: {
    id: string;
    name: string;
    kind: string;
    status: string;
  } | null;
  costHistory?: Array<{
    id: string;
    costProfile: JsonObject;
    pricingSyncStatus: string;
    observedAt: string;
  }>;
};

export type AdminAiModelSummary = {
  id: string;
  canonicalModelKey: string;
  displayName: string;
  modality: AiModelModality;
  enabled: boolean;
  visible: boolean;
  sortOrder: number;
  billingType: string;
  routingMode: AiRoutingMode;
  capabilities: JsonObject;
  status: AiModelStatus;
  updatedAt: string;
  defaultRouteId: string | null;
  currentRoute: AiModelRoute | null;
  routes: AiModelRoute[];
  currentPrice: JsonObject | null;
  pendingPrice: JsonObject | null;
  suggestedPrice: JsonObject | null;
  pricingMode: AiPricingMode;
  markupMultiplier: string;
  priceVersion: number | null;
  upstreamCosts: JsonObject[];
  lastSync: string | null;
};

export type AdminAiModelDetail = Omit<AdminAiModelSummary,
  "currentRoute" | "currentPrice" | "pendingPrice" | "suggestedPrice" | "pricingMode"
  | "markupMultiplier" | "priceVersion" | "upstreamCosts" | "lastSync"
> & {
  aliases: Array<{
    id: string;
    alias: string;
    source: string;
    confirmed: boolean;
  }>;
  pricing: {
    pricingMode: AiPricingMode;
    markupMultiplier: string;
    pendingPrice: JsonObject | null;
    suggestedPrice: JsonObject | null;
    currentVersion: {
      id: string;
      version: number;
      pricing: JsonObject;
      source: string;
      publishedAt: string;
    } | null;
  } | null;
  priceVersions: Array<{
    id: string;
    version: number;
    pricing: JsonObject;
    source: string;
    publishedAt: string;
  }>;
  _count?: {
    routes: number;
    priceVersions: number;
    requests: number;
    billingSettlements: number;
    usageBindings: number;
  };
};

export type AdminAiUsageModelBinding = {
  key: AiUsageModelKey;
  canonicalModelId: string | null;
  canonicalModelKey: string | null;
  displayName: string | null;
  fixedCredits: string | null;
  updatedAt: string | null;
  operational: boolean;
  route: AiModelRoute | null;
};

export type CapabilityOptionKind = "resolution" | "duration" | "aspectRatio";

export function normalizeCapabilityOption(value: string, kind: CapabilityOptionKind) {
  const normalized = value.trim().toLowerCase();
  if (kind === "duration") {
    const duration = Number(normalized);
    if (!Number.isSafeInteger(duration) || duration <= 0 || duration > 600) {
      throw new Error("时长必须是 1 到 600 秒的正整数");
    }
    return String(duration);
  }
  if (kind === "aspectRatio") {
    if (!/^\d{1,5}:\d{1,5}$/.test(normalized)) throw new Error("画面比例格式应为宽:高，例如 21:9");
    return normalized;
  }
  if (!/^[a-z0-9][a-z0-9._+-]{0,31}$/.test(normalized)) {
    throw new Error("分辨率只能包含字母、数字、点、下划线、加号或连字符");
  }
  return normalized;
}

export function normalizeCapabilityOptions(values: string[], kind: CapabilityOptionKind) {
  return Array.from(new Set(values.map(value => normalizeCapabilityOption(value, kind))));
}

type NumericRules = {
  integer?: boolean;
  min?: number;
  max?: number;
  rejectUnsupportedPrice?: boolean;
};

const validatedNumber = (value: unknown, label: string, rules: NumericRules = {}) => {
  if ((typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !value.trim())) {
    throw new Error(`${label}必须是数字`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`${label}不能是 NaN 或无限值`);
  if (rules.integer && !Number.isSafeInteger(numeric)) throw new Error(`${label}必须是整数`);
  if (rules.min !== undefined && numeric < rules.min) throw new Error(`${label}不能小于 ${rules.min}`);
  if (rules.max !== undefined && numeric > rules.max) throw new Error(`${label}不能大于 ${rules.max}`);
  if (rules.rejectUnsupportedPrice && numeric >= 99_999) {
    throw new Error("价格异常，请确认；不支持的规格请留空");
  }
  return numeric;
};

const numericObjectValues = (
  value: unknown,
  label: string,
  rules: NumericRules,
) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必须是对象`);
  }
  const visit = (item: unknown, path: string) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.entries(item as JsonObject).forEach(([key, child]) => visit(child, `${path}.${key}`));
      return;
    }
    validatedNumber(item, path, rules);
  };
  Object.entries(value as JsonObject).forEach(([key, item]) => visit(item, `${label}.${key}`));
};

const optionalPositiveDuration = (value: unknown, label: string) => (
  value === undefined
    ? undefined
    : validatedNumber(value, label, { integer: true, min: 1, max: 600 })
);

export function validateCapabilitiesDraft(capabilities: JsonObject) {
  const durationModeValue = capabilities.durationMode;
  const durationMode = durationModeValue === undefined ? undefined : String(durationModeValue);
  if (durationMode !== undefined && !["list", "range", "fixed"].includes(durationMode)) {
    throw new Error("durationMode 必须是 list、range 或 fixed");
  }
  const supportedDurationsValue = capabilities.supportedDurations;
  if (supportedDurationsValue !== undefined && !Array.isArray(supportedDurationsValue)) {
    throw new Error("supportedDurations 必须是数组");
  }
  const supportedDurations = Array.isArray(supportedDurationsValue)
    ? supportedDurationsValue.map((value, index) => validatedNumber(
      value,
      `supportedDurations[${index}]`,
      { integer: true, min: 1, max: 600 },
    ))
    : [];
  const defaultDuration = optionalPositiveDuration(
    capabilities.defaultDurationSeconds,
    "defaultDurationSeconds",
  );
  const rangeValue = capabilities.durationRange;
  let durationRange: { min: number; max: number; step: number } | undefined;
  if (rangeValue !== undefined) {
    if (!rangeValue || typeof rangeValue !== "object" || Array.isArray(rangeValue)) {
      throw new Error("durationRange 必须是对象");
    }
    const range = rangeValue as JsonObject;
    const min = validatedNumber(range.min, "durationRange.min", { integer: true, min: 1, max: 600 });
    const max = validatedNumber(range.max, "durationRange.max", { integer: true, min: 1, max: 600 });
    const step = validatedNumber(range.step, "durationRange.step", { integer: true, min: 1, max: 600 });
    if (min > max) throw new Error("durationRange.min 不能大于 durationRange.max");
    durationRange = { min, max, step };
  }
  if (durationMode === "list") {
    if (!supportedDurations.length) throw new Error("list 时长模式至少需要一个 supportedDurations");
    if (defaultDuration !== undefined && !supportedDurations.includes(defaultDuration)) {
      throw new Error("defaultDurationSeconds 必须属于 supportedDurations");
    }
  }
  if (durationMode === "range") {
    if (!durationRange) throw new Error("range 时长模式必须配置 durationRange");
    if (defaultDuration !== undefined
      && (defaultDuration < durationRange.min
        || defaultDuration > durationRange.max
        || (defaultDuration - durationRange.min) % durationRange.step !== 0)) {
      throw new Error("defaultDurationSeconds 必须落在 durationRange 的有效步长上");
    }
  }
  if (durationMode === "fixed") {
    const fixedDurations = new Set([
      ...supportedDurations,
      ...(defaultDuration === undefined ? [] : [defaultDuration]),
    ]);
    if (supportedDurations.length > 1 || fixedDurations.size !== 1) {
      throw new Error("fixed 时长模式必须且只能配置一个固定时长");
    }
  }

  const aspectRatioMode = capabilities.aspectRatioMode;
  if (aspectRatioMode !== undefined && !["list", "any", "unspecified"].includes(String(aspectRatioMode))) {
    throw new Error("aspectRatioMode 必须是 list、any 或 unspecified");
  }

  const referenceKinds = [
    ["Images", "supportsReferenceImage", "supportsReferenceImages", 32],
    ["Videos", "supportsReferenceVideo", "supportsVideoReference", 8],
    ["Audios", "supportsReferenceAudio", "supportsAudioReference", 8],
  ] as const;
  for (const [suffix, supportKey, supportAlias, limit] of referenceKinds) {
    const minKey = `minReference${suffix}`;
    const maxKey = `maxReference${suffix}`;
    const hasLimits = capabilities[minKey] !== undefined || capabilities[maxKey] !== undefined;
    const hasSupport = capabilities[supportKey] !== undefined || capabilities[supportAlias] !== undefined;
    if (!hasLimits && !hasSupport) continue;
    const min = capabilities[minKey] === undefined
      ? 0
      : validatedNumber(capabilities[minKey], minKey, { integer: true, min: 0, max: limit });
    const max = capabilities[maxKey] === undefined
      ? 0
      : validatedNumber(capabilities[maxKey], maxKey, { integer: true, min: 0, max: limit });
    if (min > max) throw new Error(`${minKey} 不能大于 ${maxKey}`);
    const supported = capabilities[supportKey] ?? capabilities[supportAlias];
    if (supported === false && (min !== 0 || max !== 0)) {
      throw new Error(`${supportKey} 关闭时参考数量必须为 0`);
    }
  }

  if (capabilities.maxOutputs !== undefined) {
    validatedNumber(capabilities.maxOutputs, "maxOutputs", { integer: true, min: 1, max: 16 });
  }
  if (capabilities.contextTiers !== undefined) {
    if (!Array.isArray(capabilities.contextTiers)) throw new Error("contextTiers 必须是数组");
    capabilities.contextTiers.forEach((tier, index) => {
      if (!tier || typeof tier !== "object" || Array.isArray(tier)) {
        throw new Error(`contextTiers[${index}] 必须是对象`);
      }
      const record = tier as JsonObject;
      for (const key of ["minInputTokens", "maxInputTokens", "maxOutputTokens"]) {
        if (record[key] !== undefined) {
          validatedNumber(record[key], `contextTiers[${index}].${key}`, { integer: true, min: 1 });
        }
      }
    });
  }
}

const pricingNumericKeys = new Set([
  "credits",
  "creditsPerRequest",
  "creditsPerImage",
  "creditsPerSecond",
  "creditsPerVideo",
  "creditsPerExtraReferenceImage",
  "creditsPerReferenceVideoSecond",
  "inputCreditsPerMillion",
  "outputCreditsPerMillion",
  "cachedInputCreditsPerMillion",
  "cacheWriteCreditsPerMillion",
]);
const pricingIntegerKeys = new Set(["includedReferenceImages"]);
const pricingMapKeys = new Set([
  "creditsPerImageByResolution",
  "creditsByDuration",
  "creditsByResolution",
  "creditsByCount",
  "creditsByInputMode",
  "referenceVideoCreditsByResolution",
]);

export function validatePricingDraft(pricing: JsonObject) {
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    Object.entries(value as JsonObject).forEach(([key, item]) => {
      if (pricingMapKeys.has(key)) {
        numericObjectValues(item, key, { min: 0, rejectUnsupportedPrice: true });
      } else if (pricingNumericKeys.has(key)) {
        validatedNumber(item, key, { min: 0, rejectUnsupportedPrice: true });
      } else if (pricingIntegerKeys.has(key)) {
        validatedNumber(item, key, { integer: true, min: 0 });
      } else {
        visit(item);
      }
    });
  };
  visit(pricing);
}

const costNumericKeys = new Set([
  "cnyPerSecond",
  "cnyPerRequest",
  "cnyPerImage",
  "amountPerSecond",
  "amountPerVideo",
  "upstreamInputCnyPer1m",
  "upstreamOutputCnyPer1m",
  "upstreamCacheReadCnyPer1m",
  "upstreamCacheWriteCnyPer1m",
]);
const costMapKeys = new Set(["cnyPerImageByResolution"]);

export function validateCostProfileDraft(costProfile: JsonObject) {
  if (costProfile.currency !== undefined && costProfile.currency !== "USD" && costProfile.currency !== "CNY") {
    throw new Error("currency 必须是 USD 或 CNY");
  }
  const isCostNumericKey = (key: string) => costNumericKeys.has(key)
    || /^cnyPer[A-Z0-9_]/.test(key)
    || /^amountPer[A-Z0-9_]/.test(key)
    || (/^upstream[A-Z0-9_]/.test(key) && /Cny(?:Per|$)/.test(key));
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    Object.entries(value as JsonObject).forEach(([key, item]) => {
      if (costMapKeys.has(key)) numericObjectValues(item, key, { min: 0 });
      else if (isCostNumericKey(key)) validatedNumber(item, key, { min: 0 });
      else visit(item);
    });
  };
  visit(costProfile);
}

export function validateAdapterConfigDraft(adapterConfig: JsonObject) {
  const enumFields: Record<string, readonly string[]> = {
    durationParameter: ["none", "seconds", "duration"],
    resolutionParameter: ["none", "size", "resolution"],
    aspectRatioParameter: ["none", "aspect_ratio", "ratio"],
    referenceSerialization: ["array"],
  };
  Object.entries(enumFields).forEach(([key, allowed]) => {
    const value = adapterConfig[key];
    if (value !== undefined && (typeof value !== "string" || !allowed.includes(value))) {
      throw new Error(`${key} 配置无效`);
    }
  });
  const stringFields = [
    "taskIdPath",
    "statusPath",
    "videoAvailablePath",
    "assetStatePath",
    "pollAfterMsPath",
    "submitEndpoint",
    "statusEndpointTemplate",
    "contentEndpointTemplate",
    "generationEndpoint",
    "statusEndpoint",
  ];
  stringFields.forEach((key) => {
    if (adapterConfig[key] !== undefined && typeof adapterConfig[key] !== "string") {
      throw new Error(`${key} 必须是字符串`);
    }
  });
}

export type AdminAiUsageModelBindings = {
  items: AdminAiUsageModelBinding[];
  candidates: Record<AiUsageModelKey, Array<{
    id: string;
    canonicalModelKey: string;
    displayName: string;
  }>>;
};

export type AiUpstreamDiscovery = {
  id: string;
  provider: string;
  channelId: string;
  upstreamModelId: string;
  suggestedModality: AiModelModality | null;
  modalityOverride: AiModelModality | null;
  effectiveModality: AiModelModality | null;
  availability: string;
  capabilities: JsonObject | null;
  context: unknown;
  resolution: unknown;
  duration: unknown;
  discoveredCost: JsonObject | null;
  metadata: JsonObject | null;
  status: string;
  lastSyncedAt: string;
  updatedAt: string;
  channel: {
    id: string;
    name: string;
    kind: string;
    status: string;
  };
};

export function effectiveDiscoveryModality(discovery: Pick<
  AiUpstreamDiscovery,
  "effectiveModality" | "modalityOverride" | "suggestedModality"
>) {
  return discovery.effectiveModality
    ?? discovery.modalityOverride
    ?? discovery.suggestedModality;
}

export const modalityLabel: Record<AiModelModality, string> = {
  chat: "Chat",
  image: "图片",
  video: "视频",
};

export const billingTypesByModality: Record<AiModelModality, string[]> = {
  chat: ["token", "request"],
  image: ["image_resolution", "image_flat", "image_count"],
  video: ["video_second", "video_flat", "video_duration", "video_resolution_duration"],
};

const isObject = (value: unknown): value is JsonObject => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const numberValue = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const objectValue = (value: unknown) => isObject(value) ? value : null;

const firstNumber = (value: JsonObject | null, keys: string[]) => {
  for (const key of keys) {
    const numeric = numberValue(value?.[key]);
    if (numeric !== null) return numeric;
  }
  return null;
};

const compactNumber = (value: number) => new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 6,
}).format(value);

const resolutionEntries = (value: unknown) => {
  const object = objectValue(value);
  if (!object) return [] as Array<[string, number]>;
  const preferred = ["1k", "2k", "4k", "480p", "720p", "768p", "1080p", "2K", "4K"];
  const entries = Object.entries(object).flatMap(([key, item]) => {
    const numeric = numberValue(item);
    return numeric === null ? [] : [[key, numeric] as [string, number]];
  });
  return entries.sort(([left], [right]) => {
    const leftIndex = preferred.indexOf(left);
    const rightIndex = preferred.indexOf(right);
    return (leftIndex < 0 ? preferred.length : leftIndex) - (rightIndex < 0 ? preferred.length : rightIndex);
  });
};

export const unsupportedPriceSentinel = 99_999;

export const isUnsupportedPrice = (value: unknown) => {
  const numeric = numberValue(value);
  return numeric !== null && numeric >= unsupportedPriceSentinel;
};

export function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseJsonObject(text: string, label: string, allowEmpty = false): JsonObject | null {
  if (!text.trim() && allowEmpty) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim() || "{}");
  } catch {
    throw new Error(`${label}必须是有效的 JSON`);
  }
  if (!isObject(parsed)) throw new Error(`${label}必须是 JSON 对象`);
  return parsed;
}

export function canonicalKeyDraft(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function priceSummary(pricing: JsonObject | null) {
  if (!pricing) return "未发布";
  const billingType = String(pricing.billingType || "");
  const resolutions = resolutionEntries(pricing.creditsPerImageByResolution);
  if (resolutions.length) {
    return resolutions.map(([key, value]) => (
      isUnsupportedPrice(value)
        ? `${key.toUpperCase()} 不支持`
        : `${key.toUpperCase()} ${compactNumber(value)} 点`
    )).join(" · ");
  }
  if (billingType === "token") {
    const standard = objectValue(pricing.standard);
    const input = firstNumber(standard, ["inputCreditsPerMillion"]);
    const output = firstNumber(standard, ["outputCreditsPerMillion"]);
    if (input !== null && output !== null) return `输入 ${compactNumber(input)} / 输出 ${compactNumber(output)} 点·1M`;
  }
  const perRequest = firstNumber(pricing, ["creditsPerRequest"]);
  if (perRequest !== null) return isUnsupportedPrice(perRequest) ? "不支持" : `${compactNumber(perRequest)} 点/次`;
  const perImage = firstNumber(pricing, ["creditsPerImage"]);
  if (perImage !== null) return isUnsupportedPrice(perImage) ? "不支持" : `${compactNumber(perImage)} 点/张`;
  const perSecond = firstNumber(pricing, ["creditsPerSecond", "credits"]);
  if (perSecond !== null) return isUnsupportedPrice(perSecond) ? "不支持" : `${compactNumber(perSecond)} 点/秒`;
  return billingType || "已配置";
}

export function costSummary(cost: JsonObject | null) {
  if (!cost) return "成本未同步";
  const resolutions = resolutionEntries(cost.cnyPerImageByResolution);
  if (resolutions.length) {
    return resolutions.map(([key, value]) => `${key.toUpperCase()} ¥${compactNumber(value)}`).join(" · ");
  }
  const standard = objectValue(cost.standard);
  const input = firstNumber(standard, ["upstreamInputCnyPer1m"]);
  const output = firstNumber(standard, ["upstreamOutputCnyPer1m"]);
  if (input !== null && output !== null) return `输入 ¥${compactNumber(input)} / 输出 ¥${compactNumber(output)}·1M`;
  const perSecond = firstNumber(cost, ["cnyPerSecond"]);
  if (perSecond !== null) return `¥${compactNumber(perSecond)}/秒`;
  const perRequest = firstNumber(cost, ["cnyPerRequest", "cnyPerImage"]);
  if (perRequest !== null) return `¥${compactNumber(perRequest)}/次`;
  return "成本已记录";
}

function representativePair(pricing: JsonObject | null, cost: JsonObject | null) {
  if (!pricing || !cost) return null;
  const priceResolutions = new Map(resolutionEntries(pricing.creditsPerImageByResolution));
  const costResolutions = new Map(resolutionEntries(cost.cnyPerImageByResolution));
  for (const resolution of ["2k", "1k", "4k", "768p", "1080p"]) {
    const sellPoints = priceResolutions.get(resolution);
    const costCny = costResolutions.get(resolution);
    if (sellPoints !== undefined && costCny !== undefined) return { sellPoints, costCny };
  }
  const standardPrice = objectValue(pricing.standard);
  const standardCost = objectValue(cost.standard);
  const tokenSell = firstNumber(standardPrice, ["inputCreditsPerMillion"]);
  const tokenCost = firstNumber(standardCost, ["upstreamInputCnyPer1m"]);
  if (tokenSell !== null && tokenCost !== null) return { sellPoints: tokenSell, costCny: tokenCost };
  const sellPoints = firstNumber(pricing, ["creditsPerSecond", "credits", "creditsPerRequest", "creditsPerImage"]);
  const costCny = firstNumber(cost, ["cnyPerSecond", "cnyPerRequest", "cnyPerImage"]);
  return sellPoints !== null && costCny !== null ? { sellPoints, costCny } : null;
}

export function marginPercent(pricing: JsonObject | null, cost: JsonObject | null) {
  const pair = representativePair(pricing, cost);
  if (!pair || pair.sellPoints <= 0 || isUnsupportedPrice(pair.sellPoints)) return null;
  const sellCny = pair.sellPoints / 100;
  return ((sellCny - pair.costCny) / sellCny) * 100;
}

export function marginDetails(pricing: JsonObject | null, cost: JsonObject | null) {
  const pair = representativePair(pricing, cost);
  if (!pair || pair.sellPoints <= 0 || isUnsupportedPrice(pair.sellPoints)) return null;
  const sellCny = pair.sellPoints / 100;
  const profitCny = sellCny - pair.costCny;
  return {
    sellPoints: pair.sellPoints,
    sellCny,
    costCny: pair.costCny,
    profitCny,
    marginPercent: (profitCny / sellCny) * 100,
  };
}

export type PriceDiffRow = {
  key: string;
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
};

const pricingValueRows = (pricing: JsonObject | null) => {
  if (!pricing) return new Map<string, Omit<PriceDiffRow, "before" | "after"> & { value: number }>();
  const rows = new Map<string, Omit<PriceDiffRow, "before" | "after"> & { value: number }>();
  const add = (key: string, label: string, unit: string, value: unknown) => {
    const numeric = numberValue(value);
    if (numeric === null || isUnsupportedPrice(numeric)) return;
    rows.set(key, { key, label, unit, value: numeric });
  };
  const billingType = String(pricing.billingType || "");
  if (billingType === "token") {
    const standard = objectValue(pricing.standard);
    const extended = objectValue(pricing.extended);
    add("standard.input", "普通上下文 · 输入", "积分 / 1M", standard?.inputCreditsPerMillion);
    add("standard.output", "普通上下文 · 输出", "积分 / 1M", standard?.outputCreditsPerMillion);
    add("standard.cacheRead", "普通上下文 · 缓存读取", "积分 / 1M", standard?.cachedInputCreditsPerMillion);
    add("standard.cacheWrite", "普通上下文 · 缓存写入", "积分 / 1M", standard?.cacheWriteCreditsPerMillion);
    add("extended.input", "长上下文 · 输入", "积分 / 1M", extended?.inputCreditsPerMillion);
    add("extended.output", "长上下文 · 输出", "积分 / 1M", extended?.outputCreditsPerMillion);
    add("extended.cacheRead", "长上下文 · 缓存读取", "积分 / 1M", extended?.cachedInputCreditsPerMillion);
    add("extended.cacheWrite", "长上下文 · 缓存写入", "积分 / 1M", extended?.cacheWriteCreditsPerMillion);
  }
  for (const [resolution, value] of resolutionEntries(pricing.creditsPerImageByResolution)) {
    add(`image.${resolution.toLowerCase()}`, resolution.toUpperCase(), "积分 / 张", value);
  }
  add("request", "每次请求", "积分 / 次", pricing.creditsPerRequest);
  add("image", "每张图片", "积分 / 张", pricing.creditsPerImage);
  add("video.second", "基础价格", "积分 / 秒", pricing.creditsPerSecond ?? pricing.credits);
  add("video.flat", "每段视频", "积分 / 段", pricing.creditsPerVideo);
  for (const [duration, value] of resolutionEntries(pricing.creditsByDuration)) {
    add(`duration.${duration}`, `${duration} 秒`, "积分", value);
  }
  for (const [resolution, value] of resolutionEntries(pricing.creditsByResolution)) {
    add(`videoResolution.${resolution}`, resolution.toUpperCase(), "积分 / 秒", value);
  }
  return rows;
};

export function priceDiffRows(current: JsonObject | null, pending: JsonObject | null) {
  const before = pricingValueRows(current);
  const after = pricingValueRows(pending);
  return Array.from(new Set([...before.keys(), ...after.keys()])).flatMap((key) => {
    const previous = before.get(key);
    const next = after.get(key);
    const beforeValue = previous?.value ?? null;
    const afterValue = next?.value ?? null;
    if (beforeValue === afterValue) return [];
    return [{
      key,
      label: next?.label ?? previous?.label ?? key,
      unit: next?.unit ?? previous?.unit ?? "积分",
      before: beforeValue,
      after: afterValue,
    }];
  });
}

export function humanModelStatus(model: AdminAiModelSummary) {
  if (model.status === "DRAFT") return "草稿";
  if (model.status === "RETIRED") return "已退役";
  if (!model.enabled) return "已停用";
  if (model.routingMode === "MANAGED" && !model.routes.some((route) => (
    route.enabled
    && route.upstreamAvailable
    && !["UNAVAILABLE", "UNHEALTHY", "DOWN", "FAILED", "DISABLED"].includes(route.healthStatus.toUpperCase())
    && Boolean(route.channel)
    && route.channel?.status === "ACTIVE"
  ))) return "无可用调用路由";
  if (!model.routes.some((route) => route.enabled)) return "无可用上游";
  if (!model.routes.some((route) => route.enabled && route.upstreamAvailable)) return "上游异常";
  return "正常";
}

export function lowestRouteCost(routes: AiModelRoute[]) {
  const candidates = routes.flatMap((route) => {
    const cost = route.costProfile;
    if (!cost) return [];
    const resolutions = resolutionEntries(cost.cnyPerImageByResolution);
    const standard = objectValue(cost.standard);
    const numeric = resolutions.find(([key]) => key.toLowerCase() === "2k")?.[1]
      ?? resolutions[0]?.[1]
      ?? firstNumber(standard, ["upstreamInputCnyPer1m"])
      ?? firstNumber(cost, ["cnyPerSecond", "cnyPerRequest", "cnyPerImage"]);
    return numeric === null || numeric === undefined ? [] : [{ route, numeric }];
  });
  return candidates.sort((left, right) => left.numeric - right.numeric)[0]?.route ?? null;
}

export function modelMatchesModality(model: AdminAiModelSummary, filter: "all" | AiModelModality) {
  return filter === "all" || model.modality === filter;
}

export function isModelCenterUnavailable(reason: unknown) {
  if (!reason || typeof reason !== "object") return false;
  return (reason as { status?: unknown }).status === 404;
}
