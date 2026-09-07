"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AdminProvider } from "./admin-model";
import {
  billingTypesByModality,
  canonicalKeyDraft,
  costSummary,
  formatJson,
  isModelCenterUnavailable,
  lowestRouteCost,
  marginPercent,
  modalityLabel,
  modelMatchesModality,
  parseJsonObject,
  priceSummary,
  type AdminAiModelDetail,
  type AdminAiModelSummary,
  type AiModelModality,
  type AiUpstreamDiscovery,
} from "./ai-model-center-model";
import styles from "./admin.module.css";

type AdminRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
type DetailSection = "basic" | "routes" | "capabilities" | "cost" | "pricing";
type CenterView = "models" | "unmapped";

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
  costProfile: string;
  capabilitiesOverride: string;
};

type CreateDraft = {
  canonicalModelKey: string;
  displayName: string;
  modality: AiModelModality;
  billingType: string;
  capabilities: string;
  pendingPrice: string;
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

const reasonMessage = (reason: unknown, fallback: string) => (
  reason instanceof Error ? reason.message : fallback
);

const operationalRoute = (route: AdminAiModelSummary["routes"][number]) => (
  route.enabled
  && route.upstreamAvailable
  && !["UNAVAILABLE", "UNHEALTHY", "DOWN", "FAILED", "DISABLED"]
    .includes(route.healthStatus.toUpperCase())
  && (!route.channel || route.channel.status === "ACTIVE")
);

const routeState = (route: AdminAiModelSummary["routes"][number]) => {
  if (!route.enabled) return "已停用";
  if (!route.upstreamAvailable) return "上游不可用";
  if (route.channel && route.channel.status !== "ACTIVE") return "渠道停用";
  return route.healthStatus === "HEALTHY" ? "正常" : route.healthStatus;
};

const formatDateTime = (value?: string | null) => (
  value ? new Date(value).toLocaleString("zh-CN") : "-"
);

const formatMargin = (value: number | null) => (
  value === null ? "待计算" : `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value)}%`
);

const createDraftFor = (discovery: AiUpstreamDiscovery): CreateDraft => {
  const modality = discovery.suggestedModality ?? "chat";
  return {
    canonicalModelKey: canonicalKeyDraft(discovery.upstreamModelId) || `model-${discovery.id.slice(-12)}`,
    displayName: discovery.upstreamModelId,
    modality,
    billingType: billingTypesByModality[modality][0]!,
    capabilities: formatJson(discovery.capabilities),
    pendingPrice: "",
  };
};

export function AiModelCenter({ request, providers, onError, onNotice, onUseLegacy }: Props) {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<CenterView>("models");
  const [filter, setFilter] = useState<"all" | AiModelModality>("all");
  const [models, setModels] = useState<AdminAiModelSummary[]>([]);
  const [unmapped, setUnmapped] = useState<AiUpstreamDiscovery[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [detail, setDetail] = useState<AdminAiModelDetail | null>(null);
  const [section, setSection] = useState<DetailSection>("basic");
  const [basic, setBasic] = useState<BasicDraft>(emptyBasic);
  const [capabilitiesText, setCapabilitiesText] = useState("{}");
  const [pendingText, setPendingText] = useState("{}");
  const [pricingMode, setPricingMode] = useState<"MANUAL" | "MARKUP">("MANUAL");
  const [markupMultiplier, setMarkupMultiplier] = useState("1.32");
  const [routeDrafts, setRouteDrafts] = useState<Record<string, RouteDraft>>({});
  const [mappingTargets, setMappingTargets] = useState<Record<string, string>>({});
  const [createDrafts, setCreateDrafts] = useState<Record<string, CreateDraft>>({});

  const applyDetail = useCallback((next: AdminAiModelDetail) => {
    setDetail(next);
    setBasic({
      displayName: next.displayName,
      enabled: next.enabled,
      visible: next.visible,
      sortOrder: String(next.sortOrder),
      status: next.status,
      routingMode: next.routingMode,
      defaultRouteId: next.defaultRouteId ?? "",
    });
    setCapabilitiesText(formatJson(next.capabilities));
    setPricingMode(next.pricing?.pricingMode ?? "MANUAL");
    setMarkupMultiplier(String(next.pricing?.markupMultiplier ?? "1.32"));
    setPendingText(formatJson(
      next.pricing?.pendingPrice
      ?? next.pricing?.suggestedPrice
      ?? next.pricing?.currentVersion?.pricing
      ?? { billingType: next.billingType },
    ));
    setRouteDrafts(Object.fromEntries(next.routes.map((route) => [route.id, {
      priority: String(route.priority),
      costProfile: route.costProfile ? formatJson(route.costProfile) : "",
      capabilitiesOverride: route.capabilitiesOverride ? formatJson(route.capabilitiesOverride) : "",
    }])));
  }, []);

  const refreshCenter = useCallback(async (preferredKey?: string) => {
    setLoading(true);
    try {
      const [modelPage, unmappedPage] = await Promise.all([
        request<{ items: AdminAiModelSummary[] }>("/v1/admin/ai-models/"),
        request<{ items: AiUpstreamDiscovery[] }>("/v1/admin/ai-models/unmapped"),
      ]);
      setSupported(true);
      setModels(modelPage.items);
      setUnmapped(unmappedPage.items);
      setCreateDrafts((current) => ({
        ...Object.fromEntries(unmappedPage.items.map((item) => [item.id, current[item.id] ?? createDraftFor(item)])),
      }));
      setMappingTargets((current) => ({
        ...Object.fromEntries(unmappedPage.items.map((item) => {
          const candidate = modelPage.items.find((model) => (
            !item.suggestedModality || model.modality === item.suggestedModality
          ));
          return [item.id, current[item.id] ?? candidate?.canonicalModelKey ?? ""];
        })),
      }));
      const key = preferredKey && modelPage.items.some((item) => item.canonicalModelKey === preferredKey)
        ? preferredKey
        : modelPage.items[0]?.canonicalModelKey ?? "";
      setSelectedKey(key);
      if (key) {
        const nextDetail = await request<AdminAiModelDetail>(`/v1/admin/ai-models/${encodeURIComponent(key)}`);
        applyDetail(nextDetail);
      } else {
        setDetail(null);
      }
    } catch (reason) {
      if (isModelCenterUnavailable(reason)) {
        setSupported(false);
        setModels([]);
        setUnmapped([]);
        setDetail(null);
      } else {
        onError(reasonMessage(reason, "读取 AI Model Center 失败"));
      }
    } finally {
      setLoading(false);
    }
  }, [applyDetail, onError, request]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshCenter(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshCenter]);

  const filteredModels = useMemo(
    () => models.filter((model) => modelMatchesModality(model, filter)),
    [filter, models],
  );

  const selectModel = async (modelKey: string) => {
    setSelectedKey(modelKey);
    setLoading(true);
    onError("");
    try {
      const next = await request<AdminAiModelDetail>(`/v1/admin/ai-models/${encodeURIComponent(modelKey)}`);
      applyDetail(next);
      setView("models");
    } catch (reason) {
      onError(reasonMessage(reason, "读取模型详情失败"));
    } finally {
      setLoading(false);
    }
  };

  const mutate = async (operation: () => Promise<unknown>, message: string, preferredKey = selectedKey) => {
    setBusy(true);
    onError("");
    try {
      await operation();
      await refreshCenter(preferredKey);
      onNotice(message);
    } catch (reason) {
      onError(reasonMessage(reason, "操作失败"));
    } finally {
      setBusy(false);
    }
  };

  const saveBasic = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    const sortOrder = Number(basic.sortOrder);
    if (!Number.isSafeInteger(sortOrder)) {
      onError("排序必须是整数");
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: basic.displayName.trim(),
        enabled: basic.enabled,
        visible: basic.visible,
        sortOrder,
        status: basic.status,
        routingMode: basic.routingMode,
        defaultRouteId: basic.defaultRouteId || null,
      }),
    }), "模型基础配置已保存");
  };

  const saveCapabilities = async () => {
    if (!detail) return;
    let capabilities;
    try {
      capabilities = parseJsonObject(capabilitiesText, "Capabilities");
    } catch (reason) {
      onError(reasonMessage(reason, "Capabilities 格式错误"));
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}`, {
      method: "PATCH",
      body: JSON.stringify({ capabilities }),
    }), "模型能力已保存");
  };

  const toggleRoute = async (routeId: string, enabled: boolean) => {
    await mutate(() => request(`/v1/admin/ai-models/routes/${encodeURIComponent(routeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }), enabled ? "Route 已启用，模型已切换到受管路由" : "Route 已停用");
  };

  const saveRoutePriority = async (routeId: string) => {
    const priority = Number(routeDrafts[routeId]?.priority);
    if (!Number.isSafeInteger(priority) || priority < 0) {
      onError("Route 优先级必须是非负整数");
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/routes/${encodeURIComponent(routeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    }), "Route 优先级已保存");
  };

  const saveRouteCost = async (routeId: string) => {
    const draft = routeDrafts[routeId];
    if (!draft) return;
    let costProfile;
    let capabilitiesOverride;
    try {
      costProfile = parseJsonObject(draft.costProfile, "成本配置", true);
      capabilitiesOverride = parseJsonObject(draft.capabilitiesOverride, "Route 能力覆盖", true);
    } catch (reason) {
      onError(reasonMessage(reason, "Route 配置格式错误"));
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/routes/${encodeURIComponent(routeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ costProfile, capabilitiesOverride }),
    }), "Route 成本与能力覆盖已保存");
  };

  const savePolicy = async () => {
    if (!detail) return;
    if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/.test(markupMultiplier)) {
      onError("加价倍数必须是 0 到 999、最多 6 位小数");
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/policy`, {
      method: "PATCH",
      body: JSON.stringify({ pricingMode, markupMultiplier }),
    }), pricingMode === "MARKUP" ? "加价建议已重新计算，尚未发布" : "已切换为人工定价");
  };

  const savePending = async () => {
    if (!detail) return;
    let pendingPrice;
    try {
      pendingPrice = parseJsonObject(pendingText, "Pending Price");
    } catch (reason) {
      onError(reasonMessage(reason, "Pending Price 格式错误"));
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/pending`, {
      method: "PUT",
      body: JSON.stringify(pendingPrice),
    }), "Pending Price 已保存，当前线上售价未改变");
  };

  const publishPending = async () => {
    if (!detail || !window.confirm(`发布 ${detail.displayName} 的 Pending Price？发布后新请求将使用新价格版本。`)) return;
    await mutate(() => request(`/v1/admin/ai-models/${encodeURIComponent(detail.canonicalModelKey)}/pricing/publish`, {
      method: "POST",
    }), "新价格版本已发布");
  };

  const syncProvider = async (provider: AdminProvider) => {
    await mutate(() => request(`/v1/admin/ai-models/sync/${encodeURIComponent(provider.id)}`, {
      method: "POST",
    }), `${provider.name} 上游模型与成本同步完成`);
  };

  const mapDiscovery = async (discovery: AiUpstreamDiscovery) => {
    const canonicalModelKey = mappingTargets[discovery.id];
    if (!canonicalModelKey) {
      onError("请选择要映射到的 Canonical Model");
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/unmapped/${encodeURIComponent(discovery.id)}/map`, {
      method: "POST",
      body: JSON.stringify({ canonicalModelKey }),
    }), `${discovery.upstreamModelId} 已映射，新 Route 默认保持停用`, canonicalModelKey);
  };

  const createCanonical = async (event: FormEvent, discovery: AiUpstreamDiscovery) => {
    event.preventDefault();
    const draft = createDrafts[discovery.id] ?? createDraftFor(discovery);
    let capabilities;
    let pendingPrice;
    try {
      capabilities = parseJsonObject(draft.capabilities, "Capabilities");
      pendingPrice = draft.pendingPrice.trim()
        ? parseJsonObject(draft.pendingPrice, "Pending Price")
        : undefined;
    } catch (reason) {
      onError(reasonMessage(reason, "新模型配置格式错误"));
      return;
    }
    await mutate(() => request(`/v1/admin/ai-models/unmapped/${encodeURIComponent(discovery.id)}/create`, {
      method: "POST",
      body: JSON.stringify({
        canonicalModelKey: draft.canonicalModelKey,
        displayName: draft.displayName,
        modality: draft.modality,
        billingType: draft.billingType,
        capabilities,
        ...(pendingPrice ? { pendingPrice } : {}),
      }),
    }), "Canonical Model 已创建；默认隐藏、禁用，Route 默认停用", draft.canonicalModelKey);
  };

  const ignoreDiscovery = async (discovery: AiUpstreamDiscovery) => {
    if (!window.confirm(`忽略上游模型 ${discovery.upstreamModelId}？`)) return;
    await mutate(() => request(`/v1/admin/ai-models/unmapped/${encodeURIComponent(discovery.id)}/ignore`, {
      method: "POST",
    }), "上游模型已忽略");
  };

  if (!supported) {
    return (
      <section className={`${styles.panel} ${styles.modelCenterUnavailable}`}>
        <span>LEGACY BACKEND</span>
        <h2>当前后端尚未提供 AI Model Center</h2>
        <p>现有定价和渠道管理仍可正常使用。后端升级后，这里会自动启用 Canonical Model、Route、成本和价格版本管理。</p>
        <button type="button" onClick={onUseLegacy}>打开旧版 AI 定价</button>
      </section>
    );
  }

  const currentPricing = detail?.pricing?.currentVersion?.pricing ?? null;
  const selectedSummary = models.find((model) => model.canonicalModelKey === selectedKey) ?? null;
  const currentCost = selectedSummary?.currentRoute?.costProfile
    ?? lowestRouteCost(detail?.routes ?? [])?.costProfile
    ?? null;
  const currentMargin = marginPercent(currentPricing, currentCost);

  return (
    <div className={styles.modelCenter}>
      <header className={styles.modelCenterHead}>
        <div>
          <span>CANONICAL MODEL CATALOG</span>
          <h2>AI Model Center</h2>
          <p>用户售价绑定 Canonical Model；上游成本和健康状态绑定 Route。同步成本不会自动发布新售价。</p>
        </div>
        <div className={styles.modelCenterMetrics}>
          <article><small>模型</small><strong>{models.length}</strong></article>
          <article><small>可调用</small><strong>{models.filter((model) => model.enabled).length}</strong></article>
          <article data-warning={unmapped.length > 0}><small>未映射</small><strong>{unmapped.length}</strong></article>
        </div>
      </header>

      <div className={styles.modelCenterToolbar}>
        <div className={styles.segmented}>
          {(["all", "chat", "image", "video"] as const).map((item) => (
            <button key={item} type="button" data-active={filter === item} onClick={() => { setFilter(item); setView("models"); }}>
              {item === "all" ? "全部" : modalityLabel[item]}
            </button>
          ))}
        </div>
        <div className={styles.syncActions}>
          {providers.map((provider) => (
            <button key={provider.id} type="button" disabled={busy} onClick={() => void syncProvider(provider)}>
              同步 {provider.name}
            </button>
          ))}
          <button type="button" className={styles.ghost} disabled={loading || busy} onClick={() => void refreshCenter(selectedKey)}>刷新</button>
        </div>
      </div>

      <div className={styles.modelWorkspace}>
        <aside className={styles.modelRail}>
          <div className={styles.modelRailTabs}>
            <button type="button" data-active={view === "models"} onClick={() => setView("models")}>模型 {filteredModels.length}</button>
            <button type="button" data-active={view === "unmapped"} onClick={() => setView("unmapped")}>未映射 {unmapped.length}</button>
          </div>
          {view === "models" ? (
            <div className={styles.modelList}>
              {filteredModels.map((model) => {
                const lowestCostRoute = lowestRouteCost(model.routes);
                const margin = marginPercent(model.currentPrice, model.currentRoute?.costProfile ?? lowestCostRoute?.costProfile ?? null);
                return (
                  <button key={model.id} type="button" data-selected={selectedKey === model.canonicalModelKey} onClick={() => void selectModel(model.canonicalModelKey)}>
                    <span className={styles.modelListHead}>
                      <strong>{model.displayName}</strong>
                      <em data-modality={model.modality}>{modalityLabel[model.modality]}</em>
                    </span>
                    <small>{model.canonicalModelKey}</small>
                    <span className={styles.modelListMeta}>
                      <i data-ok={model.routes.some(operationalRoute)}>{model.enabled ? "已启用" : "已禁用"}</i>
                      <i>{model.visible ? "客户端可见" : "已隐藏"}</i>
                      <i>V{model.priceVersion ?? "-"}</i>
                    </span>
                    <span className={styles.modelListPrice}>{priceSummary(model.currentPrice)}</span>
                    <small>毛利率 {formatMargin(margin)} · {model.currentRoute?.channel?.name ?? "Legacy fallback"}</small>
                  </button>
                );
              })}
              {!filteredModels.length && <p className={styles.empty}>当前筛选下没有模型</p>}
            </div>
          ) : (
            <div className={styles.unmappedRailSummary}>
              <strong>{unmapped.length}</strong>
              <span>个上游模型等待人工确认</span>
              <p>不会自动合并，也不会自动向用户开放。</p>
            </div>
          )}
        </aside>

        <section className={styles.modelDetail}>
          {loading && !detail ? <p className={styles.empty}>正在读取模型目录…</p> : view === "unmapped" ? (
            <div className={styles.unmappedList}>
              <div className={styles.modelDetailTitle}>
                <div><span>REVIEW QUEUE</span><h3>未映射上游模型</h3></div>
                <small>必须人工映射、创建或忽略</small>
              </div>
              {unmapped.map((discovery) => {
                const draft = createDrafts[discovery.id] ?? createDraftFor(discovery);
                const compatibleModels = models.filter((model) => (
                  !discovery.suggestedModality || model.modality === discovery.suggestedModality
                ));
                return (
                  <article className={styles.discoveryCard} key={discovery.id}>
                    <header>
                      <div><strong>{discovery.upstreamModelId}</strong><small>{discovery.channel.name} · {discovery.provider}</small></div>
                      <span data-available={discovery.availability !== "UNAVAILABLE"}>{discovery.availability}</span>
                    </header>
                    <div className={styles.discoveryFacts}>
                      <span>推测类型 <strong>{discovery.suggestedModality ? modalityLabel[discovery.suggestedModality] : "未知"}</strong></span>
                      <span>成本 <strong>{costSummary(discovery.discoveredCost)}</strong></span>
                      <span>同步 <strong>{formatDateTime(discovery.lastSyncedAt)}</strong></span>
                    </div>
                    <div className={styles.mappingRow}>
                      <select value={mappingTargets[discovery.id] ?? ""} onChange={(event) => setMappingTargets((current) => ({ ...current, [discovery.id]: event.target.value }))}>
                        <option value="">选择 Canonical Model</option>
                        {compatibleModels.map((model) => <option key={model.id} value={model.canonicalModelKey}>{model.displayName} · {model.canonicalModelKey}</option>)}
                      </select>
                      <button type="button" disabled={busy || !mappingTargets[discovery.id]} onClick={() => void mapDiscovery(discovery)}>映射到已有模型</button>
                      <button type="button" className={styles.danger} disabled={busy} onClick={() => void ignoreDiscovery(discovery)}>忽略</button>
                    </div>
                    <details className={styles.createCanonical}>
                      <summary>创建新的 Canonical Model</summary>
                      <form onSubmit={(event) => void createCanonical(event, discovery)}>
                        <div className={styles.formGrid}>
                          <label><strong>Canonical Key</strong><input required value={draft.canonicalModelKey} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, canonicalModelKey: canonicalKeyDraft(event.target.value) } }))} /></label>
                          <label><strong>显示名称</strong><input required value={draft.displayName} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, displayName: event.target.value } }))} /></label>
                          <label><strong>类型</strong><select value={draft.modality} onChange={(event) => {
                            const modality = event.target.value as AiModelModality;
                            setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, modality, billingType: billingTypesByModality[modality][0]! } }));
                          }}>{(["chat", "image", "video"] as const).map((item) => <option key={item} value={item}>{modalityLabel[item]}</option>)}</select></label>
                          <label><strong>计费类型</strong><select value={draft.billingType} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, billingType: event.target.value } }))}>{billingTypesByModality[draft.modality].map((item) => <option key={item}>{item}</option>)}</select></label>
                        </div>
                        <div className={styles.jsonGrid}>
                          <label><strong>Capabilities JSON</strong><textarea rows={7} value={draft.capabilities} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, capabilities: event.target.value } }))} /></label>
                          <label><strong>Pending Price JSON（可选）</strong><textarea rows={7} value={draft.pendingPrice} onChange={(event) => setCreateDrafts((current) => ({ ...current, [discovery.id]: { ...draft, pendingPrice: event.target.value } }))} placeholder='{"billingType":"request","creditsPerRequest":"10"}' /></label>
                        </div>
                        <button disabled={busy}>创建草稿模型</button>
                      </form>
                    </details>
                  </article>
                );
              })}
              {!unmapped.length && <p className={styles.empty}>没有待处理的上游模型</p>}
            </div>
          ) : detail ? (
            <>
              <div className={styles.modelDetailTitle}>
                <div><span>{detail.canonicalModelKey}</span><h3>{detail.displayName}</h3></div>
                <div className={styles.detailBadges}>
                  <i data-ok={detail.enabled}>{detail.enabled ? "可调用" : "已禁用"}</i>
                  <i data-ok={detail.visible}>{detail.visible ? "客户端可见" : "客户端隐藏"}</i>
                  <i>{detail.routingMode}</i>
                </div>
              </div>
              <nav className={styles.detailTabs} aria-label="模型详情">
                {([
                  ["basic", "Basic"],
                  ["routes", `Routes ${detail.routes.length}`],
                  ["capabilities", "Capabilities"],
                  ["cost", "Cost"],
                  ["pricing", `Pricing V${detail.pricing?.currentVersion?.version ?? "-"}`],
                ] as const).map(([value, label]) => <button key={value} type="button" data-active={section === value} onClick={() => setSection(value)}>{label}</button>)}
              </nav>

              {section === "basic" && (
                <form className={styles.modelForm} onSubmit={saveBasic}>
                  <div className={styles.formGrid}>
                    <label><strong>显示名称</strong><input required value={basic.displayName} onChange={(event) => setBasic({ ...basic, displayName: event.target.value })} /></label>
                    <label><strong>Canonical Key</strong><input value={detail.canonicalModelKey} disabled /></label>
                    <label><strong>Modality</strong><input value={modalityLabel[detail.modality]} disabled /></label>
                    <label><strong>Billing Type</strong><input value={detail.billingType} disabled /></label>
                    <label><strong>状态</strong><select value={basic.status} onChange={(event) => setBasic({ ...basic, status: event.target.value as BasicDraft["status"] })}><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option><option value="RETIRED">RETIRED</option></select></label>
                    <label><strong>路由模式</strong><select value={basic.routingMode} onChange={(event) => setBasic({ ...basic, routingMode: event.target.value as BasicDraft["routingMode"] })}><option value="LEGACY">LEGACY（兼容旧渠道）</option><option value="MANAGED">MANAGED（仅启用 Route）</option></select></label>
                    <label><strong>排序</strong><input type="number" value={basic.sortOrder} onChange={(event) => setBasic({ ...basic, sortOrder: event.target.value })} /></label>
                    <label><strong>默认 Route</strong><select value={basic.defaultRouteId} onChange={(event) => setBasic({ ...basic, defaultRouteId: event.target.value })}><option value="">按优先级自动选择</option>{detail.routes.map((route) => <option key={route.id} value={route.id}>{route.channel?.name ?? route.provider} · {route.upstreamModelId}</option>)}</select></label>
                  </div>
                  <div className={styles.booleanRow}>
                    <label><input type="checkbox" checked={basic.enabled} onChange={(event) => setBasic({ ...basic, enabled: event.target.checked })} /><span><strong>允许真实调用</strong><small>关闭后服务器拒绝新请求</small></span></label>
                    <label><input type="checkbox" checked={basic.visible} onChange={(event) => setBasic({ ...basic, visible: event.target.checked })} /><span><strong>客户端展示</strong><small>与是否允许调用独立控制</small></span></label>
                  </div>
                  <button disabled={busy}>保存 Basic</button>
                </form>
              )}

              {section === "routes" && (
                <div className={styles.routeList}>
                  {detail.routes.map((route) => (
                    <article key={route.id}>
                      <header>
                        <div><strong>{route.channel?.name ?? route.provider}</strong><small>{route.upstreamModelId}</small></div>
                        <span data-ok={operationalRoute(route)}>{routeState(route)}</span>
                      </header>
                      <div className={styles.routeFacts}>
                        <span>Provider <strong>{route.provider}</strong></span>
                        <span>成本状态 <strong>{route.pricingSyncStatus}</strong></span>
                        <span>最近同步 <strong>{formatDateTime(route.lastSyncedAt)}</strong></span>
                      </div>
                      <div className={styles.routeActions}>
                        <label><strong>优先级</strong><input type="number" min={0} value={routeDrafts[route.id]?.priority ?? route.priority} onChange={(event) => setRouteDrafts((current) => ({ ...current, [route.id]: { ...(current[route.id] ?? { costProfile: "", capabilitiesOverride: "" }), priority: event.target.value } }))} /></label>
                        <button type="button" className={styles.ghost} disabled={busy} onClick={() => void saveRoutePriority(route.id)}>保存优先级</button>
                        <button type="button" data-enabled={route.enabled} disabled={busy} onClick={() => void toggleRoute(route.id, !route.enabled)}>{route.enabled ? "停用 Route" : "启用 Route"}</button>
                      </div>
                    </article>
                  ))}
                  {!detail.routes.length && <p className={styles.empty}>{detail.routingMode === "LEGACY" ? "尚无受管 Route，当前继续使用旧渠道 fallback" : "没有可用 Route"}</p>}
                </div>
              )}

              {section === "capabilities" && (
                <div className={styles.jsonEditor}>
                  <div><strong>Canonical Capabilities</strong><span>客户端优先读取；缺失字段仍由旧客户端规则 fallback。</span></div>
                  <textarea rows={18} value={capabilitiesText} onChange={(event) => setCapabilitiesText(event.target.value)} spellCheck={false} />
                  <button type="button" disabled={busy} onClick={() => void saveCapabilities()}>保存 Capabilities</button>
                  {detail.aliases.length > 0 && <div className={styles.aliasList}><strong>已确认 Alias</strong>{detail.aliases.map((alias) => <span key={alias.id}>{alias.alias}<small>{alias.source}</small></span>)}</div>}
                </div>
              )}

              {section === "cost" && (
                <div className={styles.costWorkspace}>
                  <div className={styles.costNotice}>成本属于 Route。手工保存或上游同步只会更新成本与 Suggested Price，不会改变 Current Price。</div>
                  {detail.routes.map((route) => (
                    <article key={route.id}>
                      <header><div><strong>{route.channel?.name ?? route.provider}</strong><small>{route.upstreamModelId}</small></div><span>{costSummary(route.costProfile)}</span></header>
                      <div className={styles.jsonGrid}>
                        <label><strong>Cost Profile JSON</strong><textarea rows={10} value={routeDrafts[route.id]?.costProfile ?? ""} onChange={(event) => setRouteDrafts((current) => ({ ...current, [route.id]: { ...(current[route.id] ?? { priority: String(route.priority), capabilitiesOverride: "" }), costProfile: event.target.value } }))} placeholder="留空表示成本暂不可用" /></label>
                        <label><strong>Capabilities Override JSON</strong><textarea rows={10} value={routeDrafts[route.id]?.capabilitiesOverride ?? ""} onChange={(event) => setRouteDrafts((current) => ({ ...current, [route.id]: { ...(current[route.id] ?? { priority: String(route.priority), costProfile: "" }), capabilitiesOverride: event.target.value } }))} placeholder="留空表示不覆盖 Canonical Capabilities" /></label>
                      </div>
                      <footer><small>成本更新时间 {formatDateTime(route.costUpdatedAt)} · 历史 {route.costHistory?.length ?? 0} 条</small><button type="button" disabled={busy} onClick={() => void saveRouteCost(route.id)}>保存 Route 成本</button></footer>
                    </article>
                  ))}
                  {!detail.routes.length && <p className={styles.empty}>没有 Route 成本记录</p>}
                </div>
              )}

              {section === "pricing" && (
                <div className={styles.pricingWorkspace}>
                  <div className={styles.pricingOverview}>
                    <article><small>Current Price</small><strong>{priceSummary(currentPricing)}</strong><span>版本 {detail.pricing?.currentVersion?.version ?? "-"} · {formatDateTime(detail.pricing?.currentVersion?.publishedAt)}</span></article>
                    <article><small>当前 Route 成本</small><strong>{costSummary(currentCost)}</strong><span>{selectedSummary?.currentRoute?.channel?.name ?? "最低可用成本 / Legacy"}</span></article>
                    <article data-margin={currentMargin !== null && currentMargin >= 0}><small>代表项毛利率</small><strong>{formatMargin(currentMargin)}</strong><span>(售价 − 成本) / 售价</span></article>
                  </div>
                  <div className={styles.pricingPolicy}>
                    <label><strong>定价模式</strong><select value={pricingMode} onChange={(event) => setPricingMode(event.target.value as "MANUAL" | "MARKUP")}><option value="MANUAL">MANUAL · 人工定价</option><option value="MARKUP">MARKUP · 成本加价建议</option></select></label>
                    <label><strong>Markup Multiplier</strong><input value={markupMultiplier} onChange={(event) => setMarkupMultiplier(event.target.value)} inputMode="decimal" /></label>
                    <button type="button" className={styles.ghost} disabled={busy} onClick={() => void savePolicy()}>保存策略并重算建议</button>
                    <small>1.32 表示售价为成本的 1.32 倍，不等于 32% 毛利率。</small>
                  </div>
                  <div className={styles.priceColumns}>
                    <article><header><strong>Current Price</strong><span>线上生效</span></header><pre>{formatJson(currentPricing)}</pre></article>
                    <article><header><strong>Suggested Price</strong><span>仅建议</span></header><pre>{formatJson(detail.pricing?.suggestedPrice)}</pre><button type="button" className={styles.ghost} disabled={!detail.pricing?.suggestedPrice} onClick={() => setPendingText(formatJson(detail.pricing?.suggestedPrice))}>复制为 Pending</button></article>
                  </div>
                  <div className={styles.pendingEditor}>
                    <header><div><strong>Pending Price</strong><span>保存不会影响线上；Publish 后生成不可变价格版本。</span></div><small>Billing Type: {detail.billingType}</small></header>
                    <textarea rows={16} value={pendingText} onChange={(event) => setPendingText(event.target.value)} spellCheck={false} />
                    <footer>
                      <button type="button" className={styles.ghost} disabled={busy} onClick={() => void savePending()}>保存 Pending</button>
                      <button type="button" disabled={busy || !detail.pricing?.pendingPrice} onClick={() => void publishPending()}>Publish 新价格版本</button>
                    </footer>
                  </div>
                  {detail.priceVersions.length > 0 && (
                    <div className={styles.priceHistory}><strong>价格版本历史</strong>{detail.priceVersions.slice(0, 8).map((version) => <span key={version.id}><b>V{version.version}</b><small>{version.source} · {formatDateTime(version.publishedAt)}</small><em>{priceSummary(version.pricing)}</em></span>)}</div>
                  )}
                </div>
              )}
            </>
          ) : <p className={styles.empty}>请选择一个 Canonical Model</p>}
        </section>
      </div>
    </div>
  );
}
