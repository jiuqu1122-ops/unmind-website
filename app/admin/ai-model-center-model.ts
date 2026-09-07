export type JsonObject = Record<string, unknown>;

export type AiModelModality = "chat" | "image" | "video";
export type AiModelStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type AiRoutingMode = "LEGACY" | "MANAGED";
export type AiPricingMode = "MANUAL" | "MARKUP";

export type AiModelRoute = {
  id: string;
  canonicalModelId: string;
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
  metadata: JsonObject | null;
  pricingSyncStatus: string;
  costUpdatedAt: string | null;
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
};

export type AiUpstreamDiscovery = {
  id: string;
  provider: string;
  channelId: string;
  upstreamModelId: string;
  suggestedModality: AiModelModality | null;
  availability: string;
  capabilities: JsonObject | null;
  discoveredCost: JsonObject | null;
  metadata: JsonObject | null;
  status: string;
  lastSyncedAt: string;
  channel: {
    id: string;
    name: string;
    kind: string;
    status: string;
  };
};

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
    return resolutions.map(([key, value]) => `${key.toUpperCase()} ${compactNumber(value)} 点`).join(" · ");
  }
  if (billingType === "token") {
    const standard = objectValue(pricing.standard);
    const input = firstNumber(standard, ["inputCreditsPerMillion"]);
    const output = firstNumber(standard, ["outputCreditsPerMillion"]);
    if (input !== null && output !== null) return `输入 ${compactNumber(input)} / 输出 ${compactNumber(output)} 点·1M`;
  }
  const perRequest = firstNumber(pricing, ["creditsPerRequest"]);
  if (perRequest !== null) return `${compactNumber(perRequest)} 点/次`;
  const perImage = firstNumber(pricing, ["creditsPerImage"]);
  if (perImage !== null) return `${compactNumber(perImage)} 点/张`;
  const perSecond = firstNumber(pricing, ["creditsPerSecond", "credits"]);
  if (perSecond !== null) return `${compactNumber(perSecond)} 点/秒`;
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
  if (!pair || pair.sellPoints <= 0) return null;
  const sellCny = pair.sellPoints / 100;
  return ((sellCny - pair.costCny) / sellCny) * 100;
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
