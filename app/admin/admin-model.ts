export type AdminOverview = {
  users: { total: number; active: number };
  licenses: { active: number };
  credits: {
    available: string;
    reserved: string;
    lifetimeGranted: string;
    lifetimeConsumed: string;
  };
};

export type Wallet = {
  availableCredits: string;
  reservedCredits: string;
  lifetimeGranted: string;
  lifetimeConsumed: string;
};

export type AdminLicense = {
  id: string;
  customer: string | null;
  machineId: string;
  edition: string;
  expiresAt: string;
  status: string;
};

export type AdminLedgerEntry = {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  entitlementExpiresAt: string | null;
  entitlementEdition: string;
  status: string;
  wallet: Wallet | null;
  license?: AdminLicense | null;
  updatedAt: string;
};

export type AdminUserDetail = AdminUser & {
  licenses: AdminLicense[];
  ledger: AdminLedgerEntry[];
};

export type RedemptionCode = {
  id: string;
  codeHint: string;
  credits: string;
  maxRedemptions: number;
  redeemedCount: number;
  status: string;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ReviewShare = {
  id: string;
  kind: "NODE_PRESET" | "WORKFLOW";
  status: "PENDING" | "PUBLISHED" | "REJECTED";
  title: string;
  description: string | null;
  authorName: string;
  tags: string[];
  createdAt: string;
  previews: Array<{ id: string; url: string }>;
};

export type AdminProviderKind = "NEW_API" | "XAIS" | "MIKOTO" | "BIGMODEL" | "MINIMAX" | "USELG";
export type AdminProviderCapability =
  | "LLM"
  | "VISION"
  | "IMAGE"
  | "IMAGE_NANO_BANANA"
  | "IMAGE_NANO_BANANA_2"
  | "IMAGE_NANO_BANANA_DUAL_2K"
  | "IMAGE_NANO_BANANA_PRO_1K"
  | "IMAGE_GPT"
  | "IMAGE_GPT_1K"
  | "IMAGE_GROK"
  | "VIDEO"
  | "VIDEO_MINIMAX";

export type AdminProvider = {
  id: string;
  name: string;
  kind: AdminProviderKind;
  enabled: boolean;
  priority: number;
  baseUrl: string;
  defaultModel: string | null;
  allowInsecureHttp: boolean;
  apiKeyConfigured: boolean;
  apiKeyLast4: string;
  capabilities: AdminProviderCapability[];
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  lastTestModelCount: number | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderBalance = {
  available: boolean;
  endpoint: string;
  totalGranted: string | null;
  totalUsed: string | null;
  totalAvailable: string | null;
  unlimited: boolean;
  currency: string | null;
  display: string;
};

export type AdminImageModelPrice = {
  model: string;
  credits1k?: string;
  credits2k: string;
  credits4k: string;
};

export type AdminVideoModelPrice = {
  model: string;
  credits: string;
  creditsPerSecond?: string;
  creditsPerVideo?: string;
  creditsByDuration?: Record<string, string>;
  creditsByResolution?: Record<string, string>;
  creditsByCount?: Record<string, string>;
  includedReferenceImages?: number;
  creditsPerExtraReferenceImage?: string;
  creditsPerReferenceVideoSecond?: string;
  referenceVideoCreditsByResolution?: Record<string, string>;
};

export type AdminAiPricing = {
  agentRequestCredits: string;
  inspirationAnalysisCredits: string;
  imageDefaultCredits: string;
  videoDefaultCredits: string;
  imageModels: AdminImageModelPrice[];
  videoModels: AdminVideoModelPrice[];
  updatedAt: string | null;
};

export type ProviderDraft = {
  id: string | null;
  kind: AdminProviderKind;
  name: string;
  priority: number;
  baseUrl: string;
  defaultModel: string;
  allowInsecureHttp: boolean;
  apiKey: string;
  headersText: string;
  replaceHeaders: boolean;
  capabilities: AdminProviderCapability[];
  enabled: boolean;
};

export type VideoPricingDraft = {
  creditsPerSecond: string;
  creditsPerVideo: string;
  creditsByDuration: string;
  creditsByResolution: string;
  creditsByCount: string;
  includedReferenceImages: string;
  creditsPerExtraReferenceImage: string;
  creditsPerReferenceVideoSecond: string;
  referenceVideoCreditsByResolution: string;
};

export const providerMeta: Record<AdminProviderKind, {
  label: string;
  defaultName: string;
  defaultBaseUrl: string;
  placeholder: string;
}> = {
  NEW_API: {
    label: "NewAPI",
    defaultName: "NewAPI 主渠道",
    defaultBaseUrl: "",
    placeholder: "https://your-new-api.example.com",
  },
  XAIS: {
    label: "XAIS",
    defaultName: "XAIS / DCHAI 主渠道",
    defaultBaseUrl: "https://xais.dchai.cn",
    placeholder: "https://xais.dchai.cn",
  },
  MIKOTO: {
    label: "Mikoto",
    defaultName: "Mikoto 主渠道",
    defaultBaseUrl: "https://api.mikoto.vip",
    placeholder: "https://api.mikoto.vip",
  },
  BIGMODEL: {
    label: "Bigmodel",
    defaultName: "Bigmodel 主渠道",
    defaultBaseUrl: "",
    placeholder: "https://your-bigmodel.example.com",
  },
  MINIMAX: {
    label: "MiniMax",
    defaultName: "MiniMax H3 视频渠道",
    defaultBaseUrl: "https://metaso.cn",
    placeholder: "https://metaso.cn",
  },
  USELG: {
    label: "USELG",
    defaultName: "uselg",
    defaultBaseUrl: "https://api.ai-media.vip/v1",
    placeholder: "https://api.ai-media.vip/v1",
  },
};

export const providerKinds = (Object.keys(providerMeta) as AdminProviderKind[]);

export const providerCapabilities: Array<{
  value: Exclude<AdminProviderCapability, "IMAGE" | "IMAGE_NANO_BANANA_PRO_1K">;
  label: string;
}> = [
  { value: "VIDEO_MINIMAX", label: "MiniMax H3 Video" },
  { value: "LLM", label: "Agent / GPT (OpenAI)" },
  { value: "VISION", label: "图片分析 / Vision" },
  { value: "IMAGE_NANO_BANANA", label: "Nano Banana Pro / Gemini 生图" },
  { value: "IMAGE_NANO_BANANA_2", label: "Nano Banana 2 / Gemini 生图" },
  { value: "IMAGE_NANO_BANANA_DUAL_2K", label: "Banana Pro 2K + Banana 2 2K" },
  { value: "IMAGE_GPT", label: "GPT Image / Image2 生图" },
  { value: "IMAGE_GPT_1K", label: "GPT Image / Image2 1K 生图" },
  { value: "IMAGE_GROK", label: "Grok Imagine 生图 / 编辑" },
  { value: "VIDEO", label: "视频生成" },
];

const defaultProviderModel = (kind: AdminProviderKind) => {
  if (kind === "MINIMAX") return "MiniMax-H3";
  if (kind === "USELG") return "gpt-image-2";
  return "";
};

const defaultProviderCapabilities = (kind: AdminProviderKind): AdminProviderCapability[] => {
  if (kind === "MINIMAX") return ["VIDEO_MINIMAX"];
  if (kind === "USELG") {
    return ["IMAGE_NANO_BANANA", "IMAGE_NANO_BANANA_2", "IMAGE_GPT", "IMAGE_GROK"];
  }
  return ["LLM"];
};

export const newProviderDraft = (kind: AdminProviderKind = "NEW_API"): ProviderDraft => ({
  id: null,
  kind,
  name: providerMeta[kind].defaultName,
  priority: 100,
  baseUrl: providerMeta[kind].defaultBaseUrl,
  defaultModel: defaultProviderModel(kind),
  allowInsecureHttp: false,
  apiKey: "",
  headersText: "{}",
  replaceHeaders: true,
  capabilities: defaultProviderCapabilities(kind),
  enabled: true,
});

export const providerToDraft = (provider: AdminProvider): ProviderDraft => {
  const normalized = new Set<AdminProviderCapability>(provider.capabilities);
  if (normalized.delete("IMAGE_NANO_BANANA_PRO_1K")) normalized.add("IMAGE_NANO_BANANA_DUAL_2K");
  if (normalized.delete("IMAGE")) {
    normalized.add("IMAGE_NANO_BANANA");
    normalized.add("IMAGE_NANO_BANANA_2");
    normalized.add("IMAGE_NANO_BANANA_DUAL_2K");
    normalized.add("IMAGE_GPT");
    normalized.add("IMAGE_GPT_1K");
  }
  return {
    id: provider.id,
    kind: provider.kind,
    name: provider.name,
    priority: provider.priority ?? 100,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel || "",
    allowInsecureHttp: provider.allowInsecureHttp,
    apiKey: "",
    headersText: "{}",
    replaceHeaders: false,
    capabilities: providerCapabilities.map((item) => item.value).filter((item) => normalized.has(item)),
    enabled: provider.enabled,
  };
};

const modelToken = (model: string) => model.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const canonicalImageModel = (model: string) => {
  const token = modelToken(model);
  if (token.includes("nanobananapro") || token.includes("xaisnanopro") || token.includes("gemini3proimage")) return "nano-banana-pro";
  if (token.includes("nanobanana2") || token.includes("xaisnano2") || token.includes("gemini31flashimage")) return "nano-banana-2";
  if (token.includes("gptimage2") || token.includes("image2") || token.includes("img2")) return "image2";
  return model.trim();
};

const canonicalVideoModel = (model: string) => {
  const token = modelToken(model);
  if (token === "sourcemix20" || token === "seedance20") return "seedance2";
  if (token === "sourcemix20fast" || token === "seedance20fast") return "seedance2fast";
  return model.trim();
};

const knownImageModels = ["nano-banana-pro", "nano-banana-2", "image2"] as const;
const knownVideoModels = [
  "seedance2",
  "seedance2fast",
  "kling-video",
  "kling-omni-video",
  "MiniMax-H3",
  "sora-2",
  "veo-3.1",
  "veo-3.1-fast",
] as const;

export const normalizePricing = (pricing: AdminAiPricing): AdminAiPricing => {
  const imageMap = new Map(pricing.imageModels.map((item) => [modelToken(canonicalImageModel(item.model)), item]));
  const imageModels = knownImageModels.map((model) => {
    const existing = imageMap.get(modelToken(model));
    if (existing) return { ...existing, model };
    return {
      model,
      ...(model !== "nano-banana-2" ? { credits1k: pricing.imageDefaultCredits } : {}),
      credits2k: pricing.imageDefaultCredits,
      credits4k: pricing.imageDefaultCredits,
    };
  });

  const videoMap = new Map<string, AdminVideoModelPrice>();
  pricing.videoModels.forEach((item) => {
    const model = canonicalVideoModel(item.model);
    const token = modelToken(model);
    if (knownVideoModels.some((known) => modelToken(known) === token) && !videoMap.has(token)) {
      videoMap.set(token, { ...item, model });
    }
  });
  const videoModels = knownVideoModels.map((model) => (
    videoMap.get(modelToken(model)) || { model, credits: pricing.videoDefaultCredits }
  ));
  return { ...pricing, imageModels, videoModels };
};

export const videoPricingDraft = (item: Partial<AdminVideoModelPrice> = {}): VideoPricingDraft => ({
  creditsPerSecond: item.creditsPerSecond ?? "",
  creditsPerVideo: item.creditsPerVideo ?? "",
  creditsByDuration: item.creditsByDuration ? JSON.stringify(item.creditsByDuration) : "",
  creditsByResolution: item.creditsByResolution ? JSON.stringify(item.creditsByResolution) : "",
  creditsByCount: item.creditsByCount ? JSON.stringify(item.creditsByCount) : "",
  includedReferenceImages: item.includedReferenceImages === undefined ? "" : String(item.includedReferenceImages),
  creditsPerExtraReferenceImage: item.creditsPerExtraReferenceImage ?? "",
  creditsPerReferenceVideoSecond: item.creditsPerReferenceVideoSecond ?? "",
  referenceVideoCreditsByResolution: item.referenceVideoCreditsByResolution
    ? JSON.stringify(item.referenceVideoCreditsByResolution)
    : "",
});

export const pricingLabel = (model: string) => {
  const token = modelToken(model);
  if (token === "seedance2" || token === "seedance20" || token === "sourcemix20") return "Seedance 2.0";
  if (token === "seedance2fast" || token === "seedance20fast" || token === "sourcemix20fast") return "Seedance Fast";
  if (token === "klingvideo") return "Kling Video";
  if (token === "klingomnivideo") return "Kling Omni Video";
  if (token === "minimaxh3") return "MiniMax H3";
  if (token.includes("nanobananapro")) return "Nano Banana Pro";
  if (token.includes("nanobanana2")) return "Nano Banana 2";
  if (token.includes("image2") || token.includes("gptimage2")) return "GPT Image 2";
  return model.trim() || "未命名模型";
};
