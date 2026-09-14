"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { AdminProvider } from "./admin-model";
import {
  billingTypesByModality,
  canonicalKeyDraft,
  costSummary,
  formatJson,
  humanModelStatus,
  isModelCenterUnavailable,
  isUnsupportedPrice,
  lowestRouteCost,
  marginDetails,
  marginPercent,
  modalityLabel,
  modelMatchesModality,
  priceDiffRows,
  priceSummary,
  type AdminAiModelDetail,
  type AdminAiModelSummary,
  type AdminAiUsageModelBindings,
  type AiUsageModelKey,
  type AiModelModality,
  type AiModelRoute,
  type AiUpstreamDiscovery,
  type JsonObject,
} from "./ai-model-center-model";
import styles from "./admin.module.css";

type AdminRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
type CenterView = "all" | AiModelModality | "usage" | "unmapped";
type StatusFilter = "all" | "visible" | "hidden" | "enabled" | "disabled" | "no-route" | "cost-warning" | "pending";

type BasicDraft = {
  displayName: string;
  enabled: boolean;
  visible: boolean;
  sortOrder: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  routingMode: "LEGACY" | "MANAGED";
  defaultRouteId: string;
};

type RouteDraft = {
  priority: string;
  costProfile: JsonObject;
  capabilitiesOverride: JsonObject | null;
};

type CreateDraft = {
  canonicalModelKey: string;
  displayName: string;
  modality: AiModelModality;
  billingType: string;
  capabilities: JsonObject;
  visible: boolean;
  enabled: boolean;
};

type DraftBundle = {
  basic: BasicDraft;
  capabilities: JsonObject;
  pricing: JsonObject;
  pricingMode: "MANUAL" | "MARKUP";
  markupMultiplier: string;
  routes: Record<string, RouteDraft>;
};

type SyncResult = {
  providers?: number;
  succeededProviders?: number;
  failedProviders?: number;
  discovered: number;
  mapped: number;
  unmapped: number;
  newModels: number;
  costChanges: number;
  statusChanges: number;
  changes?: Array<{
    kind: "NEW_MODEL" | "COST_CHANGED" | "STATUS_CHANGED";
    providerId: string;
    providerName: string;
    upstreamModelId: string;
    canonicalModelId: string | null;
    before: JsonObject | string | null;
    after: JsonObject | string | null;
  }>;
  failures?: Array<{ providerId: string; name: string; message: string }>;
};

type Confirmation = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  action: () => Promise<void>;
};

type Props = {
  request: AdminRequest;
  providers: AdminProvider[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onUseLegacy: () => void;
};

const emptyBasic: BasicDraft = {
  displayName: "",
  enabled: false,
  visible: false,
  sortOrder: "100",
  status: "DRAFT",
  routingMode: "LEGACY",
  defaultRouteId: "",
};

const cloneObject = (value: JsonObject | null | undefined): JsonObject => (
  JSON.parse(JSON.stringify(value ?? {})) as JsonObject
);

const objectValue = (value: unknown): JsonObject => (
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}
);

const stringArray = (value: unknown) => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const numberArray = (value: unknown) => (
  Array.isArray(value)
    ? value.map(Number).filter((item) => Number.isFinite(item))
    : []
);

const textValue = (value: unknown) => {
  if (value === null || value === undefined || isUnsupportedPrice(value)) return "";
  return String(value);
};

const reasonMessage = (reason: unknown, fallback: string) => (
  reason instanceof Error ? reason.message : fallback
);

const jsonObjectOrNull = (value: unknown) => (
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null
);

const discoveryCapabilitySummary = (discovery: AiUpstreamDiscovery) => {
  const capabilities = discovery.capabilities ?? {};
  const resolutions = stringArray(capabilities.supportedResolutions);
  const durations = numberArray(capabilities.supportedDurations);
  const flags = [
    capabilities.supportsReferenceImage ? "参考图" : "",
    capabilities.supportsVideoReference ? "参考视频" : "",
    capabilities.supportsAudioReference ? "参考音频" : "",
    capabilities.supportsTools ? "工具" : "",
  ].filter(Boolean);
  const fallbackResolution = Array.isArray(discovery.resolution)
    ? discovery.resolution.map(String)
    : typeof discovery.resolution === "string" ? [discovery.resolution] : [];
  const fallbackDuration = Array.isArray(discovery.duration)
    ? discovery.duration.map((item) => `${item}秒`)
    : [];
  return [...(resolutions.length ? resolutions.map((item) => item.toUpperCase()) : fallbackResolution), ...durations.map((item) => `${item}秒`), ...fallbackDuration, ...flags].join(" · ") || "等待运营确认";
};

const operationalRoute = (route: AiModelRoute) => (
  route.enabled
  && route.upstreamAvailable
  && !["UNAVAILABLE", "UNHEALTHY", "DOWN", "FAILED", "DISABLED"].includes(route.healthStatus.toUpperCase())
  && (!route.channel || route.channel.status === "ACTIVE")
);
const operationalManagedRoute = (route: AiModelRoute) => operationalRoute(route) && Boolean(route.channel);

const routeState = (route: AiModelRoute) => {
  if (!route.enabled) return "渠道已停用";
  if (!route.upstreamAvailable) return "上游不可用";
  if (route.channel && route.channel.status !== "ACTIVE") return "渠道已停用";
  return route.healthStatus === "HEALTHY" ? "正常" : route.healthStatus === "UNKNOWN" ? "状态待确认" : "上游异常";
};

const formatDateTime = (value?: string | null) => (
  value ? new Date(value).toLocaleString("zh-CN") : "-"
);

const formatMargin = (value: number | null) => (
  value === null ? "待计算" : `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value)}%`
);

const formatCurrency = (value: number) => new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
}).format(value);

const stripUnsupportedPriceValues = (value: unknown, key = ""): unknown => {
  if (Array.isArray(value)) return value.map((item) => stripUnsupportedPriceValues(item, key));
  if (!value || typeof value !== "object") {
    return /credits/i.test(key) && isUnsupportedPrice(value) ? "" : value;
  }
  return Object.fromEntries(Object.entries(value as JsonObject).map(([childKey, item]) => [
    childKey,
    stripUnsupportedPriceValues(item, childKey),
  ]));
};

const priceDraftFor = (detail: AdminAiModelDetail) => {
  const source = detail.pricing?.pendingPrice ?? detail.pricing?.currentVersion?.pricing ?? { billingType: detail.billingType };
  const next = cloneObject(stripUnsupportedPriceValues(source) as JsonObject);
  next.billingType = detail.billingType;
  return next;
};

const routeDraftsFor = (routes: AiModelRoute[]) => Object.fromEntries(routes.map((route) => [route.id, {
  priority: String(route.priority),
  costProfile: cloneObject(route.costProfile ?? { currency: "CNY" }),
  capabilitiesOverride: route.capabilitiesOverride === null
    ? null
    : cloneObject(route.capabilitiesOverride),
}]));

const bundleSignature = (bundle: DraftBundle) => JSON.stringify(bundle);

const setPath = (source: JsonObject, path: string[], value: unknown) => {
  const next = cloneObject(source);
  let cursor = next;
  path.slice(0, -1).forEach((key) => {
    cursor[key] = cloneObject(objectValue(cursor[key]));
    cursor = cursor[key] as JsonObject;
  });
  cursor[path[path.length - 1]!] = value;
  return next;
};

const getPath = (source: JsonObject, path: string[]) => {
  let cursor: unknown = source;
  for (const key of path) cursor = objectValue(cursor)[key];
  return cursor;
};

const withoutBlankValues = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutBlankValues);
  if (!value || typeof value !== "object") return typeof value === "string" ? value.trim() : value;
  return Object.fromEntries(Object.entries(value as JsonObject).flatMap(([key, item]) => {
    const cleaned = withoutBlankValues(item);
    if (cleaned === "" || cleaned === undefined || cleaned === null) return [];
    if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && !Object.keys(cleaned).length) return [];
    return [[key, cleaned]];
  }));
};

const validateNumericTree = (value: unknown, price = false) => {
  const visit = (item: unknown, key: string) => {
    if (Array.isArray(item)) return item.forEach((entry) => visit(entry, key));
    if (item && typeof item === "object") return Object.entries(item as JsonObject).forEach(([childKey, child]) => visit(child, childKey));
    if (!/(credits|cny|tokens|images|videos|audios|duration|count)/i.test(key)) return;
    const numeric = Number(item);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error("数字字段不能为负数、NaN 或无限值");
    if (price && /credits/i.test(key) && numeric >= 99_999) throw new Error("价格异常，请确认；不支持的规格请留空");
  };
  visit(value, "");
};

const normalizedPrice = (detail: AdminAiModelDetail, capabilities: JsonObject, pricing: JsonObject) => {
  const cleaned = withoutBlankValues({ ...pricing, billingType: detail.billingType }) as JsonObject;
  validateNumericTree(cleaned, true);
  if (detail.billingType === "token") {
    const standard = objectValue(cleaned.standard);
    const extended = objectValue(cleaned.extended);
    const keys = ["inputCreditsPerMillion", "outputCreditsPerMillion", "cachedInputCreditsPerMillion", "cacheWriteCreditsPerMillion"];
    if (!keys.every((key) => textValue(standard[key])) || !keys.every((key) => textValue(extended[key]))) {
      throw new Error("请完整填写普通上下文和长上下文的四项价格");
    }
  }
  if (detail.billingType === "image_resolution") {
    const prices = objectValue(cleaned.creditsPerImageByResolution);
    const supported = stringArray(capabilities.supportedResolutions).map((item) => item.toLowerCase());
    const required = supported.length ? supported : ["2k", "4k"];
    if (!required.every((resolution) => textValue(prices[resolution]))) {
      throw new Error(`请填写所有支持分辨率的图片售价：${required.map((item) => item.toUpperCase()).join("、")}`);
    }
  }
  if (detail.billingType === "image_flat" && !textValue(cleaned.creditsPerRequest)) {
    throw new Error("请填写每次图片请求售价");
  }
  if (detail.billingType === "image_count" && !textValue(cleaned.creditsPerImage)) {
    throw new Error("请填写每张图片售价");
  }
  if (detail.billingType === "request" && !textValue(cleaned.creditsPerRequest)) throw new Error("请填写每次请求售价");
  if (detail.billingType === "video_second") {
    const credits = cleaned.creditsPerSecond ?? cleaned.credits;
    if (!textValue(credits)) throw new Error("请填写每秒视频售价");
    cleaned.credits = credits;
    cleaned.creditsPerSecond = credits;
  }
  if (detail.billingType === "video_flat" && !textValue(cleaned.creditsPerVideo ?? cleaned.credits)) {
    throw new Error("请填写每段视频售价");
  }
  if (detail.billingType === "video_duration") {
    const durations = objectValue(cleaned.creditsByDuration);
    if (!Object.keys(durations).length && !textValue(cleaned.creditsPerSecond)) {
      throw new Error("请至少填写一项时长价格或每秒价格");
    }
  }
  if (detail.billingType === "video_resolution_duration" && !Object.keys(objectValue(cleaned.creditsByResolution)).length) {
    throw new Error("请至少填写一项分辨率价格");
  }
  return cleaned;
};

const defaultCapabilities = (modality: AiModelModality): JsonObject => modality === "image" ? {
  supportedResolutions: ["2k", "4k"],
  supportedAspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
  minReferenceImages: 0,
  maxReferenceImages: 9,
  maxOutputs: 4,
  supportsReferenceImage: true,
  supportsTransparentBackground: false,
  supportedOutputFormats: ["jpg", "png"],
} : modality === "video" ? {
  supportedResolutions: ["720p", "1080p"],
  supportedDurations: [5, 10],
  supportedAspectRatios: ["1:1", "16:9", "9:16"],
  maxReferenceImages: 9,
  maxReferenceVideos: 3,
  maxReferenceAudios: 3,
  supportsReferenceImage: true,
  supportsVideoReference: true,
  supportsAudioReference: true,
  supportsFirstLastFrame: false,
  supportedInputModes: ["TEXT", "IMAGE", "REF"],
  maxOutputs: 4,
} : {
  contextTiers: [{ maxInputTokens: 272000 }, { minInputTokens: 272001 }],
};

const createDraftFor = (discovery: AiUpstreamDiscovery): CreateDraft => {
  const modality = discovery.suggestedModality ?? "chat";
  return {
    canonicalModelKey: canonicalKeyDraft(discovery.upstreamModelId) || `model-${discovery.id.slice(-12)}`,
    displayName: discovery.upstreamModelId,
    modality,
    billingType: billingTypesByModality[modality][0]!,
    capabilities: Object.keys(discovery.capabilities ?? {}).length
      ? cloneObject(discovery.capabilities)
      : defaultCapabilities(modality),
    visible: false,
    enabled: false,
  };
};

function ToggleChoices({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className={styles.choiceField}>
      <legend>{label}</legend>
      <div>
        {values.map((item) => (
          <label key={item.value}>
            <input
              type="checkbox"
              checked={selected.includes(item.value)}
              onChange={(event) => onChange(event.target.checked
                ? [...selected, item.value]
                : selected.filter((value) => value !== item.value))}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SwitchField({ label, hint, checked, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.switchField}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <b>{label}<small>{hint}</small></b>
    </label>
  );
}

function CapabilitiesEditor({ modality, value, onChange, compact = false }: {
  modality: AiModelModality;
  value: JsonObject;
  onChange: (next: JsonObject) => void;
  compact?: boolean;
}) {
  const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  if (modality === "chat") {
    const tiers = Array.isArray(value.contextTiers) ? value.contextTiers.map(objectValue) : [];
    const standard = tiers[0] ?? {};
    const extended = tiers[1] ?? {};
    const updateTier = (index: number, key: string, next: string) => {
      const updated = [cloneObject(standard), cloneObject(extended)];
      updated[index] = { ...updated[index], [key]: Number(next) || 0 };
      update("contextTiers", updated);
    };
    return (
      <div className={styles.structuredForm} data-compact={compact}>
        <div className={styles.formGrid}>
          <label><strong>普通上下文上限</strong><input type="number" min={1} value={textValue(standard.maxInputTokens)} onChange={(event) => updateTier(0, "maxInputTokens", event.target.value)} /><small>输入 Token</small></label>
          <label><strong>长上下文起点</strong><input type="number" min={1} value={textValue(extended.minInputTokens)} onChange={(event) => updateTier(1, "minInputTokens", event.target.value)} /><small>输入 Token</small></label>
        </div>
        {(Object.hasOwn(value, "supportsCaching") || Object.hasOwn(value, "supportsTools")) && (
          <div className={styles.switchGrid}>
            {Object.hasOwn(value, "supportsCaching") && <SwitchField label="支持缓存" hint="展示真实服务端能力" checked={Boolean(value.supportsCaching)} onChange={(next) => update("supportsCaching", next)} />}
            {Object.hasOwn(value, "supportsTools") && <SwitchField label="支持工具" hint="允许模型调用工具" checked={Boolean(value.supportsTools)} onChange={(next) => update("supportsTools", next)} />}
          </div>
        )}
      </div>
    );
  }
  const resolutions = modality === "image"
    ? [{ value: "1k", label: "1K" }, { value: "2k", label: "2K" }, { value: "4k", label: "4K" }]
    : [{ value: "480p", label: "480p" }, { value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }, { value: "2k", label: "2K" }];
  return (
    <div className={styles.structuredForm} data-compact={compact}>
      <ToggleChoices label="支持分辨率" values={resolutions} selected={stringArray(value.supportedResolutions)} onChange={(next) => update("supportedResolutions", next)} />
      {modality === "video" && <ToggleChoices label="支持时长" values={[5, 10, 15].map((item) => ({ value: String(item), label: `${item} 秒` }))} selected={numberArray(value.supportedDurations).map(String)} onChange={(next) => update("supportedDurations", next.map(Number))} />}
      <ToggleChoices label="支持比例" values={["1:1", "3:4", "4:3", "9:16", "16:9"].map((item) => ({ value: item, label: item }))} selected={stringArray(value.supportedAspectRatios)} onChange={(next) => update("supportedAspectRatios", next)} />
      <div className={styles.formGrid}>
        <label><strong>最少参考图</strong><input type="number" min={0} value={textValue(value.minReferenceImages ?? 0)} onChange={(event) => update("minReferenceImages", Number(event.target.value))} /></label>
        <label><strong>最大参考图</strong><input type="number" min={0} value={textValue(value.maxReferenceImages ?? 0)} onChange={(event) => update("maxReferenceImages", Number(event.target.value))} /></label>
        {modality === "video" && <label><strong>最大参考视频</strong><input type="number" min={0} value={textValue(value.maxReferenceVideos ?? 0)} onChange={(event) => update("maxReferenceVideos", Number(event.target.value))} /></label>}
        {modality === "video" && <label><strong>最大参考音频</strong><input type="number" min={0} value={textValue(value.maxReferenceAudios ?? 0)} onChange={(event) => update("maxReferenceAudios", Number(event.target.value))} /></label>}
        <label><strong>最大输出数量</strong><input type="number" min={1} value={textValue(value.maxOutputs ?? 1)} onChange={(event) => update("maxOutputs", Number(event.target.value))} /></label>
      </div>
      <div className={styles.switchGrid}>
        <SwitchField label="支持参考图" hint="允许上传图片作为输入" checked={Boolean(value.supportsReferenceImage)} onChange={(next) => update("supportsReferenceImage", next)} />
        {modality === "image" && <SwitchField label="透明背景" hint="允许输出透明 PNG" checked={Boolean(value.supportsTransparentBackground)} onChange={(next) => update("supportsTransparentBackground", next)} />}
        {modality === "video" && <SwitchField label="支持参考视频" hint="允许视频参考输入" checked={Boolean(value.supportsVideoReference)} onChange={(next) => update("supportsVideoReference", next)} />}
        {modality === "video" && <SwitchField label="支持参考音频" hint="允许音频参考输入" checked={Boolean(value.supportsAudioReference)} onChange={(next) => update("supportsAudioReference", next)} />}
        {modality === "video" && <SwitchField label="支持首尾帧" hint="允许首帧与尾帧控制" checked={Boolean(value.supportsFirstLastFrame)} onChange={(next) => update("supportsFirstLastFrame", next)} />}
      </div>
      {modality === "image" ? (
        <ToggleChoices label="输出格式" values={["jpg", "png", "webp"].map((item) => ({ value: item, label: item.toUpperCase() }))} selected={stringArray(value.supportedOutputFormats)} onChange={(next) => update("supportedOutputFormats", next)} />
      ) : (
        <ToggleChoices label="输入模式" values={[
          { value: "TEXT", label: "文生视频" },
          { value: "IMAGE", label: "图生视频" },
          { value: "REF", label: "参考模式" },
          { value: "FLF", label: "首尾帧" },
        ]} selected={stringArray(value.supportedInputModes)} onChange={(next) => update("supportedInputModes", next)} />
      )}
    </div>
  );
}

function NumericInput({ label, unit, value, onChange, disabled = false }: {
  label: string;
  unit: string;
  value: unknown;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.numberField} data-disabled={disabled}>
      <strong>{label}</strong>
      {disabled ? <span>不支持</span> : <div><input inputMode="decimal" value={textValue(value)} onChange={(event) => onChange(event.target.value)} placeholder="未设置" /><small>{unit}</small></div>}
    </label>
  );
}

function PricingEditor({ detail, capabilities, value, onChange }: {
  detail: AdminAiModelDetail;
  capabilities: JsonObject;
  value: JsonObject;
  onChange: (next: JsonObject) => void;
}) {
  const set = (path: string[], next: string) => onChange(setPath(value, path, next));
  if (detail.billingType === "request") {
    return <div className={styles.priceForm}><NumericInput label="每次请求" unit="积分 / 次" value={value.creditsPerRequest} onChange={(next) => set(["creditsPerRequest"], next)} /></div>;
  }
  if (detail.billingType === "token") {
    const rateFields = [
      ["inputCreditsPerMillion", "输入"],
      ["outputCreditsPerMillion", "输出"],
      ["cachedInputCreditsPerMillion", "缓存读取"],
      ["cacheWriteCreditsPerMillion", "缓存写入"],
    ] as const;
    return (
      <div className={styles.priceForm}>
        <label className={styles.thresholdField}><strong>上下文分界</strong><div><input type="number" min={1} value={textValue(value.contextThresholdTokens ?? 272000)} onChange={(event) => set(["contextThresholdTokens"], event.target.value)} /><small>Token</small></div></label>
        <section><header><strong>普通上下文</strong><span>不超过分界值</span></header><div className={styles.priceFieldGrid}>{rateFields.map(([key, label]) => <NumericInput key={key} label={label} unit="积分 / 1M" value={getPath(value, ["standard", key])} onChange={(next) => set(["standard", key], next)} />)}</div></section>
        <section><header><strong>长上下文</strong><span>超过分界值</span></header><div className={styles.priceFieldGrid}>{rateFields.map(([key, label]) => <NumericInput key={key} label={label} unit="积分 / 1M" value={getPath(value, ["extended", key])} onChange={(next) => set(["extended", key], next)} />)}</div></section>
      </div>
    );
  }
  if (detail.modality === "image") {
    const prices = objectValue(value.creditsPerImageByResolution);
    if (detail.billingType === "image_flat") {
      return <div className={styles.priceForm}><NumericInput label="每次图片请求" unit="积分 / 次" value={value.creditsPerRequest} onChange={(next) => set(["creditsPerRequest"], next)} /></div>;
    }
    if (detail.billingType === "image_count") {
      return <div className={styles.priceForm}><NumericInput label="每张图片" unit="积分 / 张" value={value.creditsPerImage} onChange={(next) => set(["creditsPerImage"], next)} /></div>;
    }
    const supported = stringArray(capabilities.supportedResolutions).map((item) => item.toLowerCase());
    const effectiveSupported = supported.length ? supported : Object.keys(prices).length ? Object.keys(prices) : ["2k", "4k"];
    const resolutions = Array.from(new Set(["1k", "2k", "4k", ...effectiveSupported, ...Object.keys(prices)]));
    return (
      <div className={styles.priceForm}>
        <div className={styles.priceFieldGrid}>
          {resolutions.map((resolution) => <NumericInput key={resolution} label={resolution.toUpperCase()} unit="积分 / 张" value={prices[resolution]} disabled={!effectiveSupported.includes(resolution)} onChange={(next) => set(["creditsPerImageByResolution", resolution], next)} />)}
        </div>
      </div>
    );
  }
  const resolutionPrices = objectValue(value.creditsByResolution);
  const durationPrices = objectValue(value.creditsByDuration);
  const referenceVideoPrices = objectValue(value.referenceVideoCreditsByResolution);
  const videoResolutions = Array.from(new Set([
    ...stringArray(capabilities.supportedResolutions).map((item) => item.toLowerCase()),
    ...Object.keys(resolutionPrices),
  ]));
  const durations = Array.from(new Set([
    ...numberArray(capabilities.supportedDurations).map(String),
    ...Object.keys(durationPrices),
  ]));
  const effectiveVideoResolutions = videoResolutions.length ? videoResolutions : ["480p", "720p", "1080p"];
  const effectiveDurations = durations.length ? durations : ["5", "10", "15"];
  return (
    <div className={styles.priceForm}>
      <div className={styles.priceFieldGrid}>
        <NumericInput label={detail.billingType === "video_duration" || detail.billingType === "video_resolution_duration" ? "备用每秒价格" : "基础价格"} unit={detail.billingType === "video_flat" ? "积分 / 段" : "积分 / 秒"} value={detail.billingType === "video_flat" ? value.creditsPerVideo : value.creditsPerSecond ?? value.credits} onChange={(next) => set([detail.billingType === "video_flat" ? "creditsPerVideo" : "creditsPerSecond"], next)} />
        <NumericInput label="免费参考图" unit="张" value={value.includedReferenceImages} onChange={(next) => set(["includedReferenceImages"], next)} />
        <NumericInput label="额外参考图" unit="积分 / 张" value={value.creditsPerExtraReferenceImage} onChange={(next) => set(["creditsPerExtraReferenceImage"], next)} />
        <NumericInput label="参考视频" unit="积分 / 秒" value={value.creditsPerReferenceVideoSecond} onChange={(next) => set(["creditsPerReferenceVideoSecond"], next)} />
      </div>
      {(detail.billingType === "video_resolution_duration" || Object.keys(resolutionPrices).length > 0) && <section><header><strong>分辨率价格</strong><span>按服务端支持规格显示</span></header><div className={styles.priceFieldGrid}>{effectiveVideoResolutions.map((item) => <NumericInput key={item} label={item.toUpperCase()} unit="积分 / 秒" value={resolutionPrices[item]} onChange={(next) => set(["creditsByResolution", item], next)} />)}</div></section>}
      {(detail.billingType === "video_duration" || detail.billingType === "video_resolution_duration" || Object.keys(durationPrices).length > 0) && <section><header><strong>时长价格</strong><span>按完整视频计价</span></header><div className={styles.priceFieldGrid}>{effectiveDurations.map((item) => <NumericInput key={item} label={`${item} 秒`} unit="积分" value={durationPrices[item]} onChange={(next) => set(["creditsByDuration", item], next)} />)}</div></section>}
      {Object.keys(referenceVideoPrices).length > 0 && <section><header><strong>参考视频分辨率价格</strong><span>可选附加价格</span></header><div className={styles.priceFieldGrid}>{Array.from(new Set([...effectiveVideoResolutions, ...Object.keys(referenceVideoPrices)])).map((item) => <NumericInput key={item} label={item.toUpperCase()} unit="积分 / 秒" value={referenceVideoPrices[item]} onChange={(next) => set(["referenceVideoCreditsByResolution", item], next)} />)}</div></section>}
    </div>
  );
}

function CostEditor({ modality, value, onChange }: {
  modality: AiModelModality;
  value: JsonObject;
  onChange: (next: JsonObject) => void;
}) {
  const set = (path: string[], next: string) => onChange(setPath(value, path, next));
  if (modality === "chat") {
    return <div className={styles.costForm}><div className={styles.priceFieldGrid}>{[
      ["upstreamInputCnyPer1m", "输入"],
      ["upstreamOutputCnyPer1m", "输出"],
      ["upstreamCacheReadCnyPer1m", "缓存读取"],
      ["upstreamCacheWriteCnyPer1m", "缓存写入"],
    ].map(([key, label]) => <NumericInput key={key} label={label!} unit="元 / 1M" value={getPath(value, ["standard", key!])} onChange={(next) => set(["standard", key!], next)} />)}</div></div>;
  }
  if (modality === "image") {
    const prices = objectValue(value.cnyPerImageByResolution);
    return <div className={styles.costForm}><div className={styles.priceFieldGrid}>{["1k", "2k", "4k"].map((item) => <NumericInput key={item} label={item.toUpperCase()} unit="元 / 张" value={prices[item]} onChange={(next) => set(["cnyPerImageByResolution", item], next)} />)}</div></div>;
  }
  return <div className={styles.costForm}><div className={styles.priceFieldGrid}><NumericInput label="每秒成本" unit="元 / 秒" value={value.cnyPerSecond} onChange={(next) => set(["cnyPerSecond"], next)} /><NumericInput label="每段成本" unit="元 / 段" value={value.cnyPerRequest} onChange={(next) => set(["cnyPerRequest"], next)} /></div></div>;
}

export function AiModelCenter({ request, providers, onError, onNotice, onUseLegacy }: Props) {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<CenterView>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<AdminAiModelSummary[]>([]);
  const [unmapped, setUnmapped] = useState<AiUpstreamDiscovery[]>([]);
  const [usageBindings, setUsageBindings] = useState<AdminAiUsageModelBindings>({
    items: [],
    candidates: { IMAGE_ANALYSIS: [], CANVAS_TEXT: [] },
  });
  const [usageDrafts, setUsageDrafts] = useState<Record<AiUsageModelKey, string>>({
    IMAGE_ANALYSIS: "",
    CANVAS_TEXT: "",
  });
  const [selectedKey, setSelectedKey] = useState("");
  const [detail, setDetail] = useState<AdminAiModelDetail | null>(null);
  const [basic, setBasic] = useState<BasicDraft>(emptyBasic);
  const [capabilities, setCapabilities] = useState<JsonObject>({});
  const [pricing, setPricing] = useState<JsonObject>({});
  const [pricingMode, setPricingMode] = useState<"MANUAL" | "MARKUP">("MANUAL");
  const [markupMultiplier, setMarkupMultiplier] = useState("1.32");
  const [routeDrafts, setRouteDrafts] = useState<Record<string, RouteDraft>>({});
  const [baseline, setBaseline] = useState<DraftBundle | null>(null);
  const [mappingTargets, setMappingTargets] = useState<Record<string, string>>({});
  const [createDrafts, setCreateDrafts] = useState<Record<string, CreateDraft>>({});
  const [expandedCreate, setExpandedCreate] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [remapRoute, setRemapRoute] = useState<AiModelRoute | null>(null);
  const [remapTarget, setRemapTarget] = useState("");
  const [remapQuery, setRemapQuery] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState<{ label: string; action: () => void } | null>(null);

  const currentBundle = useMemo<DraftBundle>(() => ({
    basic,
    capabilities,
    pricing,
    pricingMode,
    markupMultiplier,
    routes: routeDrafts,
  }), [basic, capabilities, pricing, pricingMode, markupMultiplier, routeDrafts]);
  const dirty = Boolean(detail && baseline && bundleSignature(currentBundle) !== bundleSignature(baseline));

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);

  const applyDetail = useCallback((next: AdminAiModelDetail) => {
    const nextBasic = {
      displayName: next.displayName,
      enabled: next.enabled,
      visible: next.visible,
      sortOrder: String(next.sortOrder),
      status: next.status,
      routingMode: next.routingMode,
      defaultRouteId: next.defaultRouteId ?? "",
    } satisfies BasicDraft;
    const nextCapabilities = cloneObject(next.capabilities);
    const nextPricing = priceDraftFor(next);
    const nextRoutes = routeDraftsFor(next.routes);
    const nextMode = next.pricing?.pricingMode ?? "MANUAL";
    const nextMarkup = String(next.pricing?.markupMultiplier ?? "1.32");
    setDetail(next);
    setBasic(nextBasic);
    setCapabilities(nextCapabilities);
    setPricing(nextPricing);
    setPricingMode(nextMode);
    setMarkupMultiplier(nextMarkup);
    setRouteDrafts(nextRoutes);
    setBaseline({ basic: nextBasic, capabilities: nextCapabilities, pricing: nextPricing, pricingMode: nextMode, markupMultiplier: nextMarkup, routes: nextRoutes });
    setNewAlias("");
  }, []);

  const loadDetail = useCallback(async (modelKey: string) => {
    setLoading(true);
    try {
      const next = await request<AdminAiModelDetail>(`/v1/admin/ai-models/${encodeURIComponent(modelKey)}`);
      setSelectedKey(modelKey);
      applyDetail(next);
    } finally {
      setLoading(false);
    }
  }, [applyDetail, request]);

  const refreshCenter = useCallback(async (preferredKey?: string) => {
    setLoading(true);
    try {
      const [modelPage, unmappedPage, usagePage] = await Promise.all([
        request<{ items: AdminAiModelSummary[] }>("/v1/admin/ai-models/"),
        request<{ items: AiUpstreamDiscovery[] }>("/v1/admin/ai-models/unmapped"),
        request<AdminAiUsageModelBindings>("/v1/admin/ai-models/usage-model-bindings"),
      ]);
      setSupported(true);
      setModels(modelPage.items);
      setUnmapped(unmappedPage.items);
      setUsageBindings(usagePage);
      setUsageDrafts({
        IMAGE_ANALYSIS: usagePage.items.find((item) => item.key === "IMAGE_ANALYSIS")?.canonicalModelId ?? "",
        CANVAS_TEXT: usagePage.items.find((item) => item.key === "CANVAS_TEXT")?.canonicalModelId ?? "",
      });
      setCreateDrafts((current) => Object.fromEntries(unmappedPage.items.map((item) => [item.id, current[item.id] ?? createDraftFor(item)])));
      setMappingTargets((current) => Object.fromEntries(unmappedPage.items.map((item) => {
        const candidate = modelPage.items.find((model) => !item.suggestedModality || model.modality === item.suggestedModality);
        return [item.id, current[item.id] ?? candidate?.canonicalModelKey ?? ""];
      })));
      const key = preferredKey && modelPage.items.some((item) => item.canonicalModelKey === preferredKey)
        ? preferredKey
        : modelPage.items[0]?.canonicalModelKey ?? "";
      if (key) {
        const next = await request<AdminAiModelDetail>(`/v1/admin/ai-models/${encodeURIComponent(key)}`);
        setSelectedKey(key);
        applyDetail(next);
      } else {
        setSelectedKey("");
        setDetail(null);
        setBaseline(null);
      }
    } catch (reason) {
      if (isModelCenterUnavailable(reason)) {
        setSupported(false);
        setModels([]);
        setUnmapped([]);
        setUsageBindings({ items: [], candidates: { IMAGE_ANALYSIS: [], CANVAS_TEXT: [] } });
        setDetail(null);
      } else {
        onError(reasonMessage(reason, "AI 模型目录读取失败"));
      }
    } finally {
      setLoading(false);
    }
  }, [applyDetail, onError, request]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) return refreshCenter();
    });
    return () => { active = false; };
  }, [refreshCenter]);

  const perform = async (operation: () => Promise<unknown>, message: string, preferredKey = selectedKey) => {
    setBusy(true);
    try {
      await operation();
      onNotice(message);
      await refreshCenter(preferredKey);
      return true;
    } catch (reason) {
      const status = reason && typeof reason === "object" ? (reason as { status?: number }).status : undefined;
      onError(status === 409 ? "配置已被其他操作修改，请刷新后重试。" : reasonMessage(reason, "操作失败"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (refresh = true) => {
    if (!detail) return false;
    const sortOrder = Number(basic.sortOrder);
    if (!Number.isInteger(sortOrder)) {
      onError("排序必须是整数");
      return false;
    }
    try {
      validateNumericTree(capabilities);
    } catch (reason) {
      onError(reasonMessage(reason, "模型能力格式错误"));
      return false;
    }
    const operation = () => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...basic, sortOrder, defaultRouteId: basic.defaultRouteId || null, capabilities, expectedUpdatedAt: detail.updatedAt }),
    });
    if (refresh) return perform(operation, "模型设置已保存");
    await operation();
    return true;
  };

  const savePendingPrice = async (refresh = true) => {
    if (!detail) return false;
    let next: JsonObject;
    try {
      next = normalizedPrice(detail, capabilities, pricing);
    } catch (reason) {
      onError(reasonMessage(reason, "售价格式错误"));
      return false;
    }
    const operation = () => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/pending`, {
      method: "PUT",
      body: JSON.stringify(next),
    });
    if (refresh) return perform(operation, "售价修改已保存为待发布版本");
    await operation();
    return true;
  };

  const savePricingPolicy = async (refresh = true) => {
    if (!detail) return false;
    const multiplier = Number(markupMultiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) {
      onError("成本加价倍数必须大于 0 且不超过 100");
      return false;
    }
    const operation = () => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/policy`, {
      method: "PATCH",
      body: JSON.stringify({ pricingMode, markupMultiplier }),
    });
    if (refresh) return perform(operation, "定价策略已保存，用户当前售价没有改变");
    await operation();
    return true;
  };

  const saveRoute = async (route: AiModelRoute, refresh = true) => {
    const draft = routeDrafts[route.id];
    if (!draft) return false;
    const priority = Number(draft.priority);
    if (!Number.isInteger(priority) || priority < 0) {
      onError("渠道优先级必须是非负整数");
      return false;
    }
    const costProfile = withoutBlankValues(draft.costProfile) as JsonObject;
    const capabilitiesOverride = draft.capabilitiesOverride === null
      ? null
      : withoutBlankValues(draft.capabilitiesOverride) as JsonObject;
    const capabilitiesChanged = JSON.stringify(capabilitiesOverride)
      !== JSON.stringify(route.capabilitiesOverride);
    try {
      validateNumericTree(costProfile);
      if (capabilitiesOverride) validateNumericTree(capabilitiesOverride);
    } catch (reason) {
      onError(reasonMessage(reason, "上游成本格式错误"));
      return false;
    }
    const operation = () => request(`/v1/admin/ai-models/routes/${encodeURIComponent(route.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        priority,
        costProfile,
        ...(capabilitiesChanged ? { capabilitiesOverride } : {}),
        expectedUpdatedAt: route.updatedAt,
      }),
    });
    if (refresh) return perform(operation, "上游渠道设置已保存");
    await operation();
    return true;
  };

  const saveAllDrafts = async () => {
    if (!detail || !baseline) return true;
    setBusy(true);
    try {
      const settingsChanged = JSON.stringify({ basic, capabilities }) !== JSON.stringify({ basic: baseline.basic, capabilities: baseline.capabilities });
      const pricingChanged = JSON.stringify(pricing) !== JSON.stringify(baseline.pricing);
      const policyChanged = pricingMode !== baseline.pricingMode || markupMultiplier !== baseline.markupMultiplier;
      if (settingsChanged && !await saveSettings(false)) return false;
      if (pricingChanged && !await savePendingPrice(false)) return false;
      if (policyChanged && !await savePricingPolicy(false)) return false;
      for (const route of detail.routes) {
        if (JSON.stringify(routeDrafts[route.id]) !== JSON.stringify(baseline.routes[route.id])) {
          if (!await saveRoute(route, false)) return false;
        }
      }
      onNotice("未保存修改已保存");
      return true;
    } catch (reason) {
      const status = reason && typeof reason === "object" ? (reason as { status?: number }).status : undefined;
      onError(status === 409 ? "配置已被其他操作修改，请刷新后重试。" : reasonMessage(reason, "保存失败"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const requestNavigation = (label: string, action: () => void) => {
    if (dirty) setPendingNavigation({ label, action });
    else action();
  };

  const selectModel = (modelKey: string) => requestNavigation("切换模型", () => { void loadDetail(modelKey); });
  const changeView = (next: CenterView) => requestNavigation("切换页面", () => setView(next));

  const toggleRoute = async (route: AiModelRoute, enabled: boolean) => {
    const enabledRoutes = detail?.routes.filter((item) => item.enabled) ?? [];
    const needsWarning = !enabled && (enabledRoutes.length === 1 || detail?.defaultRouteId === route.id);
    const execute = async () => { await perform(() => request(`/v1/admin/ai-models/routes/${encodeURIComponent(route.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled, expectedUpdatedAt: route.updatedAt }),
    }), enabled ? "渠道已启用" : "渠道已停用"); };
    if (needsWarning) {
      setConfirmation({
        title: "停用当前关键渠道？",
        message: "停用后该模型可能暂时没有可用上游渠道。系统会自动修复默认渠道，但不会改动用户售价。",
        confirmLabel: "确认停用",
        danger: true,
        action: execute,
      });
    } else await execute();
  };

  const setDefaultRoute = async (route: AiModelRoute) => {
    if (!detail || !route.enabled) return;
    await perform(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}`, {
      method: "PATCH",
      body: JSON.stringify({ defaultRouteId: route.id, expectedUpdatedAt: detail.updatedAt }),
    }), `${route.channel?.name ?? route.provider} 已设为默认渠道`);
  };

  const confirmRemap = async () => {
    if (!detail || !remapRoute || !remapTarget || !remapRoute.canonicalModelId) return;
    const target = models.find((model) => model.canonicalModelKey === remapTarget);
    if (!target || target.modality !== detail.modality) {
      onError("只能映射到相同类型的模型");
      return;
    }
    const succeeded = await perform(() => request(`/v1/admin/ai-models/routes/${encodeURIComponent(remapRoute.id)}/remap`, {
      method: "POST",
      body: JSON.stringify({ canonicalModelKey: target.canonicalModelKey, currentCanonicalModelId: remapRoute.canonicalModelId, expectedUpdatedAt: remapRoute.updatedAt }),
    }), `上游渠道已改为映射到 ${target.displayName}`, target.canonicalModelKey);
    if (succeeded) {
      setRemapRoute(null);
      setRemapTarget("");
    }
  };

  const unmapRoute = (route: AiModelRoute) => {
    if (!detail || !route.canonicalModelId) return;
    const onlyRoute = detail.routes.filter((item) => item.enabled).length <= 1;
    const isDefault = detail.defaultRouteId === route.id;
    setConfirmation({
      title: "解除上游映射？",
      message: <><p>解除后，该上游模型会重新进入“未映射模型”列表；Route ID、上游模型名、成本和同步记录都会保留。</p>{(onlyRoute || isDefault) && <strong>解除后该模型将暂时没有可用上游渠道。</strong>}</>,
      confirmLabel: "确认解除映射",
      danger: true,
      action: async () => { await perform(() => request(`/v1/admin/ai-models/routes/${encodeURIComponent(route.id)}/unmap`, {
        method: "POST",
        body: JSON.stringify({ currentCanonicalModelId: route.canonicalModelId, expectedUpdatedAt: route.updatedAt }),
      }), "上游模型已解除映射并进入待处理列表"); },
    });
  };

  const mapDiscovery = async (discovery: AiUpstreamDiscovery) => {
    const target = mappingTargets[discovery.id];
    const targetModel = models.find((model) => model.canonicalModelKey === target);
    if (!target || !targetModel || (discovery.suggestedModality && targetModel.modality !== discovery.suggestedModality)) {
      onError("请选择相同类型的 Canonical 模型");
      return;
    }
    await perform(() => request(`/v1/admin/ai-models/unmapped/${encodeURIComponent(discovery.id)}/map`, {
      method: "POST",
      body: JSON.stringify({ canonicalModelKey: target, expectedUpdatedAt: discovery.updatedAt }),
    }), `${discovery.upstreamModelId} 已映射；新渠道默认保持停用`, target);
  };

  const createCanonical = async (event: FormEvent, discovery: AiUpstreamDiscovery) => {
    event.preventDefault();
    const draft = createDrafts[discovery.id] ?? createDraftFor(discovery);
    try {
      validateNumericTree(draft.capabilities);
    } catch (reason) {
      onError(reasonMessage(reason, "模型能力格式错误"));
      return;
    }
    await perform(() => request(`/v1/admin/ai-models/unmapped/${encodeURIComponent(discovery.id)}/create`, {
      method: "POST",
      body: JSON.stringify({ ...draft, expectedUpdatedAt: discovery.updatedAt }),
    }), "新模型已创建并完成映射；上游渠道默认保持停用", draft.canonicalModelKey);
  };

  const ignoreDiscovery = (discovery: AiUpstreamDiscovery) => setConfirmation({
    title: "忽略这个上游模型？",
    message: "忽略后它不会出现在待处理列表中；后续同步会保留这项人工决定。",
    confirmLabel: "确认忽略",
    danger: true,
    action: async () => { await perform(() => request(`/v1/admin/ai-models/unmapped/${encodeURIComponent(discovery.id)}/ignore`, { method: "POST" }), "上游模型已忽略"); },
  });

  const addAlias = async () => {
    if (!detail || !newAlias.trim()) return;
    await perform(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/aliases`, {
      method: "POST",
      body: JSON.stringify({ alias: newAlias.trim() }),
    }), "兼容名称已添加");
  };

  const deleteAlias = (alias: AdminAiModelDetail["aliases"][number]) => {
    if (!detail) return;
    setConfirmation({
      title: "删除兼容名称？",
      message: `删除“${alias.alias}”后，使用该旧名称的请求可能无法识别。`,
      confirmLabel: "确认删除",
      danger: true,
      action: async () => { await perform(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/aliases/${encodeURIComponent(alias.id)}`, { method: "DELETE" }), "兼容名称已删除"); },
    });
  };

  const saveUsageBinding = async (key: AiUsageModelKey) => {
    const canonicalModelId = usageDrafts[key];
    if (!canonicalModelId) {
      onError("请选择可用的 Chat 模型");
      return;
    }
    await perform(() => request(`/v1/admin/ai-models/usage-model-bindings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ canonicalModelId }),
    }), key === "IMAGE_ANALYSIS" ? "图片分析任务模型已保存" : "文字节点任务模型已保存");
  };

  const deleteModel = () => {
    if (!detail) return;
    const model = detail;
    setConfirmation({
      title: "永久删除这个模型？",
      message: <><p>将删除“{model.displayName}”及其未发布配置和兼容名称。此操作无法撤销。</p><strong>仅未启用、未展示、没有渠道、没有价格版本和调用记录的草稿模型允许删除。</strong></>,
      confirmLabel: "确认删除模型",
      danger: true,
      action: async () => { await perform(() => request(`/v1/admin/ai-models/${encodeURIComponent(model.canonicalModelKey)}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedUpdatedAt: model.updatedAt }),
      }), `${model.displayName} 已删除`, ""); },
    });
  };

  const publishPrice = () => {
    if (!detail?.pricing?.pendingPrice) return;
    setConfirmation({
      title: "发布新价格？",
      message: <><p>发布后，新请求将按照新价格计费。已经开始的任务仍按原价格版本结算。</p><strong>价格版本：V{detail.pricing.currentVersion?.version ?? 0} → V{(detail.pricing.currentVersion?.version ?? 0) + 1}</strong></>,
      confirmLabel: "确认发布",
      action: async () => { await perform(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/publish`, { method: "POST" }), "新价格版本已发布"); },
    });
  };

  const discardPendingPrice = () => {
    if (!detail) return;
    setConfirmation({
      title: "放弃待发布价格？",
      message: "这只会清除准备发布的新价格，不会改变当前生效价格或历史版本。",
      confirmLabel: "放弃修改",
      danger: true,
      action: async () => { await perform(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/pending`, { method: "DELETE" }), "待发布价格已清除"); },
    });
  };

  const syncProvider = async (provider?: AdminProvider) => {
    setBusy(true);
    try {
      const result = await request<SyncResult>(provider
        ? `/v1/admin/ai-models/sync/${encodeURIComponent(provider.id)}`
        : "/v1/admin/ai-models/sync", { method: "POST" });
      setSyncResult(result);
      setShowChanges(true);
      onNotice(provider ? `${provider.name} 同步完成` : "全部上游模型同步完成");
      await refreshCenter(selectedKey);
    } catch (reason) {
      onError(reasonMessage(reason, "上游同步失败"));
    } finally {
      setBusy(false);
    }
  };

  const filteredModels = useMemo(() => models.filter((model) => {
    if (view !== "all" && view !== "unmapped" && view !== "usage" && !modelMatchesModality(model, view)) return false;
    const haystack = `${model.displayName} ${model.canonicalModelKey} ${model.routes.map((route) => `${route.channel?.name ?? ""} ${route.upstreamModelId}`).join(" ")}`.toLowerCase();
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
    if (statusFilter === "visible" && !model.visible) return false;
    if (statusFilter === "hidden" && model.visible) return false;
    if (statusFilter === "enabled" && !model.enabled) return false;
    if (statusFilter === "disabled" && model.enabled) return false;
    if (statusFilter === "no-route" && model.routes.some(operationalRoute)) return false;
    if (statusFilter === "cost-warning" && !model.routes.some((route) => route.pricingSyncStatus.startsWith("WARNING"))) return false;
    if (statusFilter === "pending" && !model.pendingPrice) return false;
    return true;
  }), [models, query, statusFilter, view]);

  const filteredUnmapped = useMemo(() => unmapped.filter((item) => (
    !query.trim() || `${item.upstreamModelId} ${item.provider} ${item.channel.name}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [query, unmapped]);

  const selectedSummary = models.find((model) => model.canonicalModelKey === selectedKey) ?? null;
  const currentPrice = detail?.pricing?.currentVersion?.pricing ?? null;
  const selectedCost = selectedSummary?.currentRoute?.costProfile ?? lowestRouteCost(detail?.routes ?? [])?.costProfile ?? null;
  const currentMargin = marginDetails(currentPrice, selectedCost);
  const pendingDiff = priceDiffRows(currentPrice, detail?.pricing?.pendingPrice ?? null);
  const attentionModels = models.filter((model) => model.pendingPrice || model.routes.some((route) => route.pricingSyncStatus.startsWith("WARNING") || !route.upstreamAvailable));
  const syncChanges = syncResult?.changes ?? [];
  const canDeleteSelectedModel = Boolean(detail
    && detail.status === "DRAFT"
    && !detail.enabled
    && !detail.visible
    && detail.routes.length === 0
    && detail.priceVersions.length === 0
    && (detail._count?.requests ?? 0) === 0
    && (detail._count?.billingSettlements ?? 0) === 0
    && (detail._count?.usageBindings ?? 0) === 0);

  if (!supported) return (
    <section className={`${styles.panel} ${styles.modelCenterUnavailable}`}>
      <span>AI MODEL CENTER</span>
      <h2>模型中心尚未启用</h2>
      <p>现有定价和渠道管理仍可正常使用。后端完成兼容迁移后，这里会自动启用。</p>
      <button type="button" onClick={onUseLegacy}>继续使用旧版定价</button>
    </section>
  );

  return (
    <div className={styles.modelCenterV2}>
      <header className={styles.modelCenterHero}>
        <div><span>AI MODEL OPERATIONS</span><h2>AI 模型管理</h2><p>管理用户看到的模型、实际调用渠道、采购成本和用户售价。成本同步不会自动改变售价。</p></div>
        <div className={styles.modelCenterMetrics}>
          <article><small>全部模型</small><strong>{models.length}</strong></article>
          <article><small>正常调用</small><strong>{models.filter((model) => model.enabled && model.routes.some(operationalRoute)).length}</strong></article>
          <article data-warning={unmapped.length > 0}><small>待映射</small><strong>{unmapped.length}</strong></article>
        </div>
      </header>

      <section className={styles.modelCommandBar}>
        <nav aria-label="模型类型">
          {(["all", "chat", "image", "video", "usage", "unmapped"] as const).map((item) => (
            <button key={item} type="button" data-active={view === item} onClick={() => changeView(item)}>{item === "all" ? "全部" : item === "usage" ? "任务模型" : item === "unmapped" ? `未映射 ${unmapped.length}` : modalityLabel[item]}</button>
          ))}
        </nav>
        <div className={styles.modelSearchFilters}>
          {view !== "usage" && <input type="search" placeholder="搜索模型、渠道或上游名称" value={query} onChange={(event) => setQuery(event.target.value)} />}
          {view !== "unmapped" && view !== "usage" && <select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="visible">用户可见</option><option value="hidden">已隐藏</option><option value="enabled">允许调用</option><option value="disabled">已停用</option><option value="no-route">无上游</option><option value="cost-warning">成本异常</option><option value="pending">价格待发布</option></select>}
        </div>
        <div className={styles.syncMenu}>
          <button type="button" disabled={busy} onClick={() => void syncProvider()}>{busy ? "正在同步…" : "同步上游模型"}</button>
          <details><summary aria-label="选择同步渠道">▾</summary><div><button type="button" disabled={busy} onClick={() => void syncProvider()}>全部同步</button>{providers.map((provider) => <button key={provider.id} type="button" disabled={busy} onClick={() => void syncProvider(provider)}>{provider.name}</button>)}</div></details>
        </div>
      </section>

      {syncResult && <section className={styles.syncResult}><div><span>同步完成</span><strong>{syncResult.failedProviders ? `${syncResult.failedProviders} 个渠道失败` : "上游数据已刷新"}</strong></div><dl><div><dt>发现新模型</dt><dd>{syncResult.newModels}</dd></div><div><dt>成本变化</dt><dd>{syncResult.costChanges}</dd></div><div><dt>状态变化</dt><dd>{syncResult.statusChanges}</dd></div><div><dt>未映射模型</dt><dd>{syncResult.unmapped}</dd></div></dl><button type="button" onClick={() => setShowChanges((current) => !current)}>{showChanges ? "收起变化" : "查看变化"}</button></section>}

      {showChanges && <section className={styles.changeCenter}><header><div><span>待处理变化</span><h3>需要运营确认的事项</h3></div><strong>{syncChanges.length + attentionModels.length}</strong></header><div>{syncChanges.slice(0, 8).map((item, index) => { const model = models.find((candidate) => candidate.id === item.canonicalModelId); return <button type="button" key={`${item.providerId}:${item.upstreamModelId}:${item.kind}:${index}`} onClick={() => model ? selectModel(model.canonicalModelKey) : setView("unmapped")}><b>{item.kind === "NEW_MODEL" ? "新上游模型" : item.kind === "COST_CHANGED" ? "成本变化" : "状态变化"}</b><span>{item.providerName} · {item.upstreamModelId}</span><small>{item.kind === "COST_CHANGED" ? `${costSummary(jsonObjectOrNull(item.before))} → ${costSummary(jsonObjectOrNull(item.after))}；用户售价保持不变` : item.kind === "STATUS_CHANGED" ? `${String(item.before ?? "未知")} → ${String(item.after ?? "未知")}` : model ? `已识别为 ${model.displayName}，新渠道默认停用` : "等待映射"}</small></button>; })}{attentionModels.slice(0, 6).map((model) => <button type="button" key={model.id} onClick={() => selectModel(model.canonicalModelKey)}><b>{model.pendingPrice ? "价格待发布" : "渠道需处理"}</b><span>{model.displayName}</span><small>{model.pendingPrice ? `${priceSummary(model.currentPrice)} → ${priceSummary(model.pendingPrice)}` : "用户售价保持不变"}</small></button>)}</div>{!syncChanges.length && !attentionModels.length && <p>没有待处理变化</p>}</section>}

      {view === "usage" ? (
        <section className={styles.modelEditor} aria-busy={loading || busy}>
          <header className={styles.modelEditorHeader}>
            <div><span>USAGE MODEL BINDINGS</span><h3>任务模型</h3><p>业务用途绑定 canonical Chat 模型；真实上游渠道仍由服务端路由决定。</p></div>
          </header>
          <div className={styles.editorSectionGrid}>
            {(["IMAGE_ANALYSIS", "CANVAS_TEXT"] as const).map((key) => {
              const binding = usageBindings.items.find((item) => item.key === key);
              const candidates = usageBindings.candidates[key];
              const selectedStillAvailable = candidates.some((candidate) => candidate.id === usageDrafts[key]);
              const currentRouteLabel = binding?.route
                ? `${binding.route.channel?.name ?? binding.route.provider} · ${binding.route.upstreamModelId}`
                : "无可用调用路由";
              return <section className={styles.editorCard} key={key}>
                <header><div><span>{key === "IMAGE_ANALYSIS" ? "01" : "02"}</span><h4>{key === "IMAGE_ANALYSIS" ? "图片分析" : "文字节点 / 提示词优化"}</h4></div><button type="button" disabled={busy || !usageDrafts[key]} onClick={() => void saveUsageBinding(key)}>{busy ? "正在保存…" : "保存"}</button></header>
                <p>{key === "IMAGE_ANALYSIS" ? "仅列出具备 operational Vision route 的 Chat 模型。" : "canvas_text_agent 与 prompt_optimization 共用此模型；普通 Chat 不受影响。"}</p>
                <div className={styles.formGrid}><label><strong>当前 canonical 模型</strong><select aria-label={key === "IMAGE_ANALYSIS" ? "图片分析任务模型" : "文字节点任务模型"} value={usageDrafts[key]} onChange={(event) => setUsageDrafts((current) => ({ ...current, [key]: event.target.value }))}><option value="">请选择模型</option>{usageDrafts[key] && !selectedStillAvailable && <option value={usageDrafts[key]}>{binding?.displayName ?? binding?.canonicalModelKey ?? "当前模型"}（当前不可用）</option>}{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName} · {candidate.canonicalModelKey}</option>)}</select></label><label><strong>当前路由</strong><input value={currentRouteLabel} disabled /></label></div>
                {!binding?.operational && <div className={styles.inlineWarning}>无可用调用路由。服务端会返回 USAGE_MODEL_NOT_AVAILABLE，不会静默切换模型。</div>}
              </section>;
            })}
          </div>
        </section>
      ) : view === "unmapped" ? (
        <section className={styles.unmappedWorkspace}>
          <header><div><span>REVIEW QUEUE</span><h3>未映射模型</h3><p>新上游不会自动合并，也不会自动向用户开放。</p></div><strong>{filteredUnmapped.length}</strong></header>
          <div className={styles.unmappedTable}>
            {filteredUnmapped.map((discovery) => {
              const draft = createDrafts[discovery.id] ?? createDraftFor(discovery);
              const compatible = models.filter((model) => !discovery.suggestedModality || model.modality === discovery.suggestedModality);
              return <article key={discovery.id}>
                <div className={styles.discoveryIdentity}><strong>{discovery.upstreamModelId}</strong><small>{discovery.channel.name} · {discovery.provider}</small></div>
                <span>{discovery.suggestedModality ? modalityLabel[discovery.suggestedModality] : "类型待确认"}</span>
                <span>{discoveryCapabilitySummary(discovery)}</span>
                <span>{costSummary(discovery.discoveredCost)}</span>
                <span>{formatDateTime(discovery.lastSyncedAt)}</span>
                <div className={styles.discoveryActions}><select aria-label={`映射 ${discovery.upstreamModelId}`} value={mappingTargets[discovery.id] ?? ""} onChange={(event) => setMappingTargets((current) => ({ ...current, [discovery.id]: event.target.value }))}><option value="">选择已有模型</option>{compatible.map((model) => <option key={model.id} value={model.canonicalModelKey}>{model.displayName}</option>)}</select><button type="button" disabled={busy || !mappingTargets[discovery.id]} onClick={() => void mapDiscovery(discovery)}>映射</button><button type="button" className={styles.ghost} onClick={() => setExpandedCreate(expandedCreate === discovery.id ? "" : discovery.id)}>创建新模型</button><button type="button" className={styles.textDanger} onClick={() => ignoreDiscovery(discovery)}>忽略</button></div>
                {expandedCreate === discovery.id && <form className={styles.createModelPanel} onSubmit={(event) => void createCanonical(event, discovery)}>
                  <header><div><strong>创建并映射新模型</strong><small>信息已根据上游检测结果预填</small></div><button type="button" className={styles.ghost} onClick={() => setExpandedCreate("")}>关闭</button></header>
                  <div className={styles.formGrid}><label><strong>显示名称</strong><input required value={draft.displayName} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, displayName: event.target.value } }))} /></label><label><strong>客户端模型 ID</strong><input required value={draft.canonicalModelKey} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, canonicalModelKey: canonicalKeyDraft(event.target.value) } }))} /></label><label><strong>类型</strong><select value={draft.modality} onChange={(event) => { const modality = event.target.value as AiModelModality; setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, modality, billingType: billingTypesByModality[modality][0]!, capabilities: defaultCapabilities(modality) } })); }}>{(["chat", "image", "video"] as const).map((item) => <option key={item} value={item}>{modalityLabel[item]}</option>)}</select></label><label><strong>计费方式</strong><select value={draft.billingType} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, billingType: event.target.value } }))}>{billingTypesByModality[draft.modality].map((item) => <option key={item} value={item}>{item === "token" ? "按 Token" : item === "request" ? "按次" : item.includes("resolution") ? "按分辨率" : item.includes("second") ? "按秒" : "固定价格"}</option>)}</select></label></div>
                  <div className={styles.switchGrid}><SwitchField label="用户可见" hint="创建后出现在客户端列表" checked={draft.visible} onChange={(visible) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, visible } }))} /><SwitchField label="允许调用" hint="服务器接受新请求" checked={draft.enabled} onChange={(enabled) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, enabled } }))} /></div>
                  <CapabilitiesEditor modality={draft.modality} value={draft.capabilities} onChange={(next) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, capabilities: next } }))} compact />
                  <footer><p>新 Route 会默认保持停用，确认成本与能力后再启用。</p><button disabled={busy}>{busy ? "正在创建…" : "创建并映射"}</button></footer>
                </form>}
              </article>;
            })}
            {!filteredUnmapped.length && <p className={styles.empty}>没有待处理的上游模型</p>}
          </div>
        </section>
      ) : (
        <>
          <section className={styles.modelTablePanel}>
            <table className={styles.modelTable}>
              <thead><tr><th>模型</th><th>状态</th><th>用户可见</th><th>允许调用</th><th>上游</th><th>成本</th><th>售价</th><th>毛利率</th><th>价格状态</th><th>最后同步</th><th /></tr></thead>
              <tbody>{filteredModels.map((model) => {
                const costRoute = model.currentRoute ?? lowestRouteCost(model.routes);
                const margin = marginPercent(model.currentPrice, costRoute?.costProfile ?? null);
                return <tr key={model.id} data-selected={selectedKey === model.canonicalModelKey}><td><strong>{model.displayName}</strong><small>{modalityLabel[model.modality]} · {model.canonicalModelKey}</small></td><td><span className={styles.humanStatus} data-status={humanModelStatus(model)}>{humanModelStatus(model)}</span></td><td><i data-on={model.visible}>{model.visible ? "开" : "关"}</i></td><td><i data-on={model.enabled}>{model.enabled ? "开" : "关"}</i></td><td>{model.routes.length} 个渠道</td><td>{costSummary(costRoute?.costProfile ?? null)}</td><td>{priceSummary(model.currentPrice)}</td><td>{formatMargin(margin)}</td><td>{model.pendingPrice ? <b className={styles.pendingBadge}>有待发布修改</b> : `已发布 V${model.priceVersion ?? "-"}`}</td><td>{formatDateTime(model.lastSync)}</td><td><button type="button" onClick={() => selectModel(model.canonicalModelKey)}>编辑</button></td></tr>;
              })}</tbody>
            </table>
            {!filteredModels.length && <p className={styles.empty}>当前筛选下没有模型</p>}
          </section>

          {detail && <section className={styles.modelEditor} aria-busy={loading || busy}>
            <header className={styles.modelEditorHeader}><div><span>{detail.canonicalModelKey}</span><h3>{detail.displayName}</h3><p>{basic.routingMode === "LEGACY" ? "正在使用旧版兼容配置，不影响当前使用。" : "由已启用的上游渠道按优先级提供服务。"}</p></div><div><i data-on={detail.visible}>{detail.visible ? "用户可见" : "已隐藏"}</i><i data-on={detail.enabled}>{detail.enabled ? "允许调用" : "已停用"}</i>{dirty && <b>有未保存修改</b>}{canDeleteSelectedModel && <button type="button" className={styles.textDanger} disabled={busy || dirty} onClick={deleteModel}>删除模型</button>}</div></header>

            {basic.visible && !basic.enabled && <div className={styles.inlineWarning}>用户可以看到，但当前无法调用。</div>}
            {basic.status === "PUBLISHED" && basic.enabled && basic.routingMode === "MANAGED" && !detail.routes.some(operationalManagedRoute) && <div className={styles.inlineWarning}>无可用调用路由：该模型已发布并允许调用，但没有 enabled、upstream available、健康且渠道 ACTIVE 的 route。</div>}

            <div className={styles.editorSectionGrid}>
              <section className={styles.editorCard}>
                <header><div><span>01</span><h4>基本设置</h4></div><button type="button" disabled={busy} onClick={() => void saveSettings()}>{busy ? "正在保存…" : "保存设置"}</button></header>
                <div className={styles.formGrid}><label><strong>模型名称</strong><input value={basic.displayName} onChange={(event) => setBasic({ ...basic, displayName: event.target.value })} /></label><label><strong>模型类型</strong><input value={modalityLabel[detail.modality]} disabled /></label><label><strong>发布状态</strong><select value={basic.status} onChange={(event) => setBasic({ ...basic, status: event.target.value as BasicDraft["status"] })}><option value="DRAFT">草稿（客户端不可见）</option><option value="PUBLISHED">已发布</option><option value="RETIRED">已退役</option></select></label><label><strong>默认渠道</strong><select value={basic.defaultRouteId} onChange={(event) => setBasic({ ...basic, defaultRouteId: event.target.value })}><option value="">按优先级自动选择</option>{detail.routes.filter((route) => route.enabled).map((route) => <option key={route.id} value={route.id}>{route.channel?.name ?? route.provider}</option>)}</select></label><label><strong>排序</strong><input type="number" value={basic.sortOrder} onChange={(event) => setBasic({ ...basic, sortOrder: event.target.value })} /></label></div>
                <div className={styles.switchGrid}><SwitchField label="用户可见" hint="开启后出现在客户端模型列表" checked={basic.visible} onChange={(visible) => setBasic({ ...basic, visible })} /><SwitchField label="允许调用" hint="开启后服务器接受实际请求" checked={basic.enabled} onChange={(enabled) => setBasic({ ...basic, enabled })} /></div>
                <div className={styles.aliasManager}><header><div><strong>兼容名称</strong><small>旧客户端或上游名称仍可识别</small></div><div><input placeholder="输入兼容名称" value={newAlias} onChange={(event) => setNewAlias(event.target.value)} /><button type="button" disabled={busy || !newAlias.trim()} onClick={() => void addAlias()}>添加</button></div></header><div>{detail.aliases.map((alias) => <span key={alias.id}>{alias.alias}<small>{alias.source === "ADMIN" ? "手工兼容" : alias.source.includes("MAPPING") ? "上游映射" : "旧版兼容"}</small>{alias.source === "ADMIN" && <button type="button" aria-label={`删除 ${alias.alias}`} onClick={() => deleteAlias(alias)}>×</button>}</span>)}</div></div>
              </section>

              <section className={`${styles.editorCard} ${styles.pricingCard}`}>
                <header><div><span>02</span><h4>用户售价</h4></div><button type="button" disabled={busy} onClick={() => void savePendingPrice()}>{busy ? "正在保存…" : "保存为待发布"}</button></header>
                <div className={styles.priceOverviewV2}><article><small>当前生效价格</small><strong>{priceSummary(currentPrice)}</strong><span>V{detail.pricing?.currentVersion?.version ?? "-"} · {formatDateTime(detail.pricing?.currentVersion?.publishedAt)}</span></article><article><small>上游采购成本</small><strong>{costSummary(selectedCost)}</strong><span>{selectedSummary?.currentRoute?.channel?.name ?? "最低可用成本"}</span></article><article><small>默认渠道毛利</small><strong>{currentMargin ? `${formatCurrency(currentMargin.profitCny)} 元 · ${formatMargin(currentMargin.marginPercent)}` : "待计算"}</strong><span>{currentMargin ? `${currentMargin.sellPoints} 积分 = ¥${formatCurrency(currentMargin.sellCny)}，成本 ¥${formatCurrency(currentMargin.costCny)}` : "需要同时具备售价与成本"}</span></article><article><small>根据成本计算的建议价格</small><strong>{priceSummary(detail.pricing?.suggestedPrice ?? null)}</strong><span>仅供运营采用，不会自动改变用户售价</span></article></div>
                <PricingEditor detail={detail} capabilities={capabilities} value={pricing} onChange={setPricing} />
                <div className={styles.pricingPolicyV2}><label><strong>定价方式</strong><select value={pricingMode} onChange={(event) => setPricingMode(event.target.value as "MANUAL" | "MARKUP")}><option value="MANUAL">人工定价</option><option value="MARKUP">按成本给出建议</option></select></label>{pricingMode === "MARKUP" && <label><strong>成本加价倍数</strong><input inputMode="decimal" value={markupMultiplier} onChange={(event) => setMarkupMultiplier(event.target.value)} /><small>1.32 表示售价为成本的 1.32 倍</small></label>}<button type="button" className={styles.ghost} disabled={busy} onClick={() => void savePricingPolicy()}>保存定价策略</button>{detail.pricing?.suggestedPrice && <button type="button" className={styles.ghost} onClick={() => setPricing(cloneObject(detail.pricing?.suggestedPrice))}>采用成本建议</button>}</div>
                {detail.pricing?.pendingPrice && <div className={styles.priceDiffPanel}><header><div><strong>有未发布价格修改</strong><small>当前生效价格不会在发布前改变</small></div><span>V{detail.pricing.currentVersion?.version ?? 0} → V{(detail.pricing.currentVersion?.version ?? 0) + 1}</span></header><div>{pendingDiff.map((row) => <article key={row.key}><span>{row.label}</span><b>{row.before ?? "未设置"} → {row.after ?? "不支持"}</b><small>{row.after !== null && row.before !== null ? `${row.after - row.before >= 0 ? "+" : ""}${row.after - row.before} ${row.unit}${row.before ? ` · ${(((row.after - row.before) / row.before) * 100).toFixed(1)}%` : ""}` : row.unit}</small></article>)}</div><footer><button type="button" className={styles.textDanger} onClick={discardPendingPrice}>放弃修改</button><button type="button" disabled={busy} onClick={publishPrice}>发布新价格</button></footer></div>}
              </section>

              <section className={styles.editorCard}>
                <header><div><span>03</span><h4>上游渠道</h4></div><small>成本属于渠道，用户售价属于模型</small></header>
                <div className={styles.routeCards}>{detail.routes.map((route) => {
                  const routeDraft = routeDrafts[route.id] ?? {
                    priority: String(route.priority),
                    costProfile: {},
                    capabilitiesOverride: route.capabilitiesOverride === null
                      ? null
                      : cloneObject(route.capabilitiesOverride),
                  };
                  const isDefault = detail.defaultRouteId === route.id;
                  return <article key={route.id}>
                    <header><div><strong>{route.channel?.name ?? route.provider}</strong><small>上游模型：{route.upstreamModelId}</small></div><span data-ok={operationalRoute(route)}>● {routeState(route)}</span></header>
                    <dl><div><dt>采购成本</dt><dd>{costSummary(route.costProfile)}</dd></div><div><dt>优先级</dt><dd>{route.priority}</dd></div><div><dt>默认渠道</dt><dd>{isDefault ? "是" : "否"}</dd></div><div><dt>最后同步</dt><dd>{formatDateTime(route.lastSyncedAt)}</dd></div></dl>
                    <details className={styles.routeCostEditor}>
                      <summary>编辑渠道成本与能力</summary>
                      <label><strong>优先级</strong><input type="number" min={0} value={routeDraft.priority} onChange={(event) => setRouteDrafts((current) => ({ ...current, [route.id]: { ...routeDraft, priority: event.target.value } }))} /></label>
                      <CostEditor modality={detail.modality} value={routeDraft.costProfile} onChange={(costProfile) => setRouteDrafts((current) => ({ ...current, [route.id]: { ...routeDraft, costProfile } }))} />
                      <label className={styles.inlineCheck}>
                        <input
                          type="checkbox"
                          checked={routeDraft.capabilitiesOverride === null}
                          onChange={(event) => setRouteDrafts((current) => ({
                            ...current,
                            [route.id]: {
                              ...routeDraft,
                              capabilitiesOverride: event.target.checked
                                ? null
                                : cloneObject(route.capabilitiesOverride ?? detail.capabilities),
                            },
                          }))}
                        />
                        继承模型能力
                      </label>
                      {routeDraft.capabilitiesOverride !== null && (
                        <CapabilitiesEditor
                          modality={detail.modality}
                          value={routeDraft.capabilitiesOverride}
                          onChange={(capabilitiesOverride) => setRouteDrafts((current) => ({
                            ...current,
                            [route.id]: { ...routeDraft, capabilitiesOverride },
                          }))}
                          compact
                        />
                      )}
                      <button type="button" disabled={busy} onClick={() => void saveRoute(route)}>保存渠道设置</button>
                    </details>
                    <footer>{!isDefault && route.enabled && <button type="button" className={styles.ghost} onClick={() => void setDefaultRoute(route)}>设为默认</button>}<button type="button" className={styles.ghost} onClick={() => { setRemapRoute(route); setRemapTarget(""); setRemapQuery(""); }}>更改映射</button><button type="button" className={route.enabled ? styles.textDanger : styles.ghost} onClick={() => void toggleRoute(route, !route.enabled)}>{route.enabled ? "停用" : "启用"}</button><details><summary>更多</summary><div><button type="button" className={styles.textDanger} disabled={!route.channelId} onClick={() => unmapRoute(route)}>解除映射</button><details><summary>高级信息</summary><pre>{formatJson({ routeId: route.id, canonicalModelId: route.canonicalModelId, upstreamModelId: route.upstreamModelId, provider: route.provider, pricingSyncStatus: route.pricingSyncStatus, capabilitiesOverride: route.capabilitiesOverride, metadata: route.metadata })}</pre></details></div></details></footer>
                  </article>;
                })}{!detail.routes.length && <div className={styles.noUpstream}><strong>暂无可用上游</strong><p>请从“未映射”页面添加渠道，或继续使用旧版兼容配置。</p></div>}</div>
              </section>

              <section className={styles.editorCard}>
                <header><div><span>04</span><h4>模型能力</h4></div><button type="button" disabled={busy} onClick={() => void saveSettings()}>保存能力</button></header>
                <CapabilitiesEditor modality={detail.modality} value={capabilities} onChange={setCapabilities} />
              </section>
            </div>

            <details className={styles.advancedInfo}><summary>高级信息</summary><div><article><strong>模型内部信息</strong><pre>{formatJson({ id: detail.id, canonicalModelKey: detail.canonicalModelKey, billingType: detail.billingType, routingMode: detail.routingMode, status: detail.status, updatedAt: detail.updatedAt })}</pre></article><article><strong>Capabilities JSON（只读）</strong><pre>{formatJson(capabilities)}</pre></article><article><strong>价格版本历史</strong>{detail.priceVersions.slice(0, 12).map((version) => <span key={version.id}><b>V{version.version}</b><small>{version.source} · {formatDateTime(version.publishedAt)}</small><em>{priceSummary(version.pricing)}</em></span>)}</article></div></details>
          </section>}
        </>
      )}

      {remapRoute && detail && <div className={styles.modalBackdrop} role="presentation"><section className={styles.operationModal} role="dialog" aria-modal="true" aria-labelledby="remap-title"><header><div><span>映射变更</span><h3 id="remap-title">更改上游映射</h3></div><button type="button" aria-label="关闭" onClick={() => setRemapRoute(null)}>×</button></header><div className={styles.mappingSummary}><article><small>当前上游</small><strong>{remapRoute.channel?.name ?? remapRoute.provider}</strong><span>{remapRoute.upstreamModelId}</span></article><b>→</b><article><small>重新映射到</small><strong>{models.find((model) => model.canonicalModelKey === remapTarget)?.displayName ?? "请选择模型"}</strong><span>{modalityLabel[detail.modality]}模型</span></article></div><input type="search" placeholder="搜索同类型模型" value={remapQuery} onChange={(event) => setRemapQuery(event.target.value)} /><div className={styles.remapCandidates}>{models.filter((model) => model.modality === detail.modality && model.canonicalModelKey !== detail.canonicalModelKey && `${model.displayName} ${model.canonicalModelKey}`.toLowerCase().includes(remapQuery.toLowerCase())).map((model) => <label key={model.id} data-selected={remapTarget === model.canonicalModelKey}><input type="radio" name="remap-target" checked={remapTarget === model.canonicalModelKey} onChange={() => setRemapTarget(model.canonicalModelKey)} /><span><strong>{model.displayName}</strong><small>{modalityLabel[model.modality]}模型 · 当前售价 {priceSummary(model.currentPrice)}</small></span></label>)}</div>{remapTarget && <div className={styles.impactNotice}><strong>确认影响</strong><ul><li>上游渠道归属会改变</li><li>Route ID、成本和优先级会保留</li><li>两个模型的用户售价都不会移动</li><li>历史账单和价格快照不会变化</li></ul></div>}<footer><button type="button" className={styles.ghost} onClick={() => setRemapRoute(null)}>取消</button><button type="button" disabled={busy || !remapTarget} onClick={() => void confirmRemap()}>{busy ? "正在更改…" : "确认更改"}</button></footer></section></div>}

      {confirmation && <div className={styles.modalBackdrop} role="presentation"><section className={styles.confirmModal} role="alertdialog" aria-modal="true"><header><h3>{confirmation.title}</h3></header><div>{confirmation.message}</div><footer><button type="button" className={styles.ghost} onClick={() => setConfirmation(null)}>取消</button><button type="button" data-danger={confirmation.danger} disabled={busy} onClick={() => void (async () => { await confirmation.action(); setConfirmation(null); })()}>{busy ? "正在处理…" : confirmation.confirmLabel}</button></footer></section></div>}

      {pendingNavigation && <div className={styles.modalBackdrop} role="presentation"><section className={styles.confirmModal} role="alertdialog" aria-modal="true"><header><h3>有未保存的修改</h3></header><div><p>要{pendingNavigation.label}吗？你可以先保存当前修改，或放弃后继续。</p></div><footer className={styles.threeActions}><button type="button" className={styles.ghost} onClick={() => setPendingNavigation(null)}>继续编辑</button><button type="button" className={styles.textDanger} onClick={() => { const action = pendingNavigation.action; setPendingNavigation(null); action(); }}>放弃修改</button><button type="button" disabled={busy} onClick={() => void (async () => { if (await saveAllDrafts()) { const action = pendingNavigation.action; setPendingNavigation(null); action(); } })()}>保存后继续</button></footer></section></div>}
    </div>
  );
}
