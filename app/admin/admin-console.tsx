"use client";

import { FormEvent, useCallback, useState } from "react";
import { apiBaseUrl } from "../site-shared";
import {
  newProviderDraft,
  normalizePricing,
  pricingLabel,
  providerCapabilities,
  providerKinds,
  providerMeta,
  providerToDraft,
  videoPricingDraft,
  type AdminAiPricing,
  type AdminLedgerEntry,
  type AdminOverview,
  type AdminProvider,
  type AdminProviderCapability,
  type AdminProviderKind,
  type AdminUser,
  type AdminUserDetail,
  type ProviderBalance,
  type ProviderDraft,
  type RedemptionCode,
  type ReviewShare,
  type VideoPricingDraft,
} from "./admin-model";
import styles from "./admin.module.css";

type Tab = "users" | "codes" | "providers" | "pricing" | "reviews";
type AuthorizationStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

const formatCredits = (value?: string | null) => {
  try {
    return BigInt(value || "0").toLocaleString("zh-CN");
  } catch {
    return value || "0";
  }
};

const formatDateTime = (value?: string | null) => (
  value ? new Date(value).toLocaleString("zh-CN") : "-"
);

const operationKey = (prefix: string) => (
  `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`
);

const creditPattern = /^(?:0|[1-9]\d{0,6})$/;

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || `请求失败（HTTP ${response.status}）`);
  return payload as T;
}

export function AdminConsole() {
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [authorizationName, setAuthorizationName] = useState("");
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState("");
  const [authorizationStatus, setAuthorizationStatus] = useState<AuthorizationStatus>("ACTIVE");
  const [codes, setCodes] = useState<RedemptionCode[]>([]);
  const [reviews, setReviews] = useState<ReviewShare[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(() => newProviderDraft());
  const [providerBalance, setProviderBalance] = useState<ProviderBalance | null>(null);
  const [pricing, setPricing] = useState<AdminAiPricing | null>(null);
  const [videoAdvanced, setVideoAdvanced] = useState<Record<number, VideoPricingDraft>>({});
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("1000");
  const [grantNote, setGrantNote] = useState("网页管理员发放");
  const [codeCredits, setCodeCredits] = useState("1000");
  const [codeQuantity, setCodeQuantity] = useState("1");
  const [codeUses, setCodeUses] = useState("1");
  const [codeExpiresAt, setCodeExpiresAt] = useState("");
  const [codeNote, setCodeNote] = useState("");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const clearMessage = () => {
    setError("");
    setNotice("");
  };

  const request = useCallback(async <T,>(
    path: string,
    options: RequestInit = {},
    credential = adminKey,
  ) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${credential}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (response.status === 204) return undefined as T;
    return parseResponse<T>(response);
  }, [adminKey]);

  const applyPricing = (value: AdminAiPricing) => {
    const normalized = normalizePricing(value);
    setPricing(normalized);
    setVideoAdvanced(Object.fromEntries(
      normalized.videoModels.map((item, index) => [index, videoPricingDraft(item)]),
    ));
  };

  const refreshDashboard = useCallback(async (credential: string, search = "") => {
    const queryString = search ? `?query=${encodeURIComponent(search)}&limit=80` : "?limit=80";
    const [nextOverview, userPage, codePage, sharePage, providerPage, nextPricing] = await Promise.all([
      request<AdminOverview>("/v1/admin/overview", {}, credential),
      request<{ items: AdminUser[] }>(`/v1/admin/users${queryString}`, {}, credential),
      request<{ items: RedemptionCode[] }>("/v1/admin/redemption-codes?limit=200", {}, credential),
      request<{ items: ReviewShare[] }>("/v1/admin/inspiration-space?limit=200", {}, credential),
      request<{ items: AdminProvider[] }>("/v1/admin/providers", {}, credential),
      request<AdminAiPricing>("/v1/admin/pricing", {}, credential),
    ]);
    setOverview(nextOverview);
    setUsers(userPage.items);
    setCodes(codePage.items);
    setReviews(sharePage.items);
    setProviders(providerPage.items);
    setProviderDraft(providerPage.items[0] ? providerToDraft(providerPage.items[0]) : newProviderDraft());
    applyPricing(nextPricing);
  }, [request]);

  const refreshUsers = async (search = query) => {
    const queryString = search ? `?query=${encodeURIComponent(search)}&limit=80` : "?limit=80";
    const [nextOverview, userPage] = await Promise.all([
      request<AdminOverview>("/v1/admin/overview"),
      request<{ items: AdminUser[] }>(`/v1/admin/users${queryString}`),
    ]);
    setOverview(nextOverview);
    setUsers(userPage.items);
  };

  const refreshCodes = async () => {
    const page = await request<{ items: RedemptionCode[] }>("/v1/admin/redemption-codes?limit=200");
    setCodes(page.items);
  };

  const refreshReviews = async () => {
    const page = await request<{ items: ReviewShare[] }>("/v1/admin/inspiration-space?limit=200");
    setReviews(page.items);
  };

  const refreshProviders = async (selectedId: string | null = providerDraft.id) => {
    const page = await request<{ items: AdminProvider[] }>("/v1/admin/providers");
    setProviders(page.items);
    if (selectedId) {
      const selected = page.items.find((provider) => provider.id === selectedId);
      if (selected) setProviderDraft(providerToDraft(selected));
    }
    return page.items;
  };

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    const credential = adminKeyInput.trim();
    if (credential.length < 32) {
      setError("请输入服务器生成的管理员密钥");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      await refreshDashboard(credential);
      setAdminKey(credential);
      setAdminKeyInput("");
      setNotice("管理员后台已连接");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    setAdminKey("");
    setOverview(null);
    setUsers([]);
    setSelectedUser(null);
    setCodes([]);
    setReviews([]);
    setProviders([]);
    setPricing(null);
    setProviderDraft(newProviderDraft());
    setProviderBalance(null);
    clearMessage();
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    clearMessage();
    try {
      await refreshUsers(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "搜索失败");
    } finally {
      setBusy(false);
    }
  };

  const openUser = async (userId: string) => {
    setBusy(true);
    clearMessage();
    try {
      const detail = await request<AdminUserDetail>(`/v1/admin/users/${encodeURIComponent(userId)}`);
      setSelectedUser(detail);
      setAuthorizationName(detail.displayName || detail.licenses[0]?.customer || "");
      setAuthorizationExpiresAt(
        detail.entitlementExpiresAt?.slice(0, 10) || detail.licenses[0]?.expiresAt?.slice(0, 10) || "",
      );
      setAuthorizationStatus(
        (["ACTIVE", "SUSPENDED", "DISABLED"].includes(detail.status) ? detail.status : "ACTIVE") as AuthorizationStatus,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取用户详情失败");
    } finally {
      setBusy(false);
    }
  };

  const updateAuthorization = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    if (authorizationName.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(authorizationExpiresAt)) {
      setError("用户名至少 2 个字符，并请选择有效的到期日期");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const result = await request<{ result: { user: AdminUserDetail } }>(
        `/v1/admin/users/${encodeURIComponent(selectedUser.id)}/authorization`,
        {
          method: "PATCH",
          body: JSON.stringify({
            displayName: authorizationName.trim(),
            expiresAt: authorizationExpiresAt,
            status: authorizationStatus,
            idempotencyKey: operationKey("web-authorization"),
          }),
        },
      );
      setSelectedUser(result.result.user);
      await refreshUsers();
      setNotice("账户授权已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新账户授权失败");
    } finally {
      setBusy(false);
    }
  };

  const grantCredits = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    if (!/^[1-9]\d{0,15}$/.test(amount) || grantNote.trim().length < 3) {
      setError("额度必须是正整数，发放说明至少填写 3 个字符");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      await request(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/credits/grant`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          description: grantNote.trim(),
          idempotencyKey: operationKey("web-grant"),
        }),
      });
      await Promise.all([refreshUsers(), openUser(selectedUser.id)]);
      setNotice(`已发放 ${formatCredits(amount)} 点额度`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "额度发放失败");
    } finally {
      setBusy(false);
    }
  };

  const createCodes = async (event: FormEvent) => {
    event.preventDefault();
    const quantity = Number(codeQuantity);
    const maxRedemptions = Number(codeUses);
    if (
      !/^[1-9]\d{0,15}$/.test(codeCredits)
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 100
      || !Number.isInteger(maxRedemptions) || maxRedemptions < 1
    ) {
      setError("请检查兑换额度、生成数量和可兑换次数");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const result = await request<{ codes: Array<{ code: string }> }>("/v1/admin/redemption-codes", {
        method: "POST",
        body: JSON.stringify({
          credits: codeCredits,
          quantity,
          maxRedemptions,
          expiresAt: codeExpiresAt ? `${codeExpiresAt}T23:59:59+08:00` : null,
          note: codeNote.trim() || null,
        }),
      });
      const plaintext = result.codes.map((item) => item.code);
      setGeneratedCodes(plaintext);
      await refreshCodes();
      setNotice(`已生成 ${plaintext.length} 个兑换码，请立即保存`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "兑换码生成失败");
    } finally {
      setBusy(false);
    }
  };

  const selectProvider = (provider: AdminProvider) => {
    setProviderDraft(providerToDraft(provider));
    setProviderBalance(null);
    clearMessage();
  };

  const toggleProviderCapability = (capability: AdminProviderCapability) => {
    setProviderDraft((current) => {
      const enabled = current.capabilities.includes(capability);
      if (enabled && current.capabilities.length === 1) return current;
      return {
        ...current,
        capabilities: enabled
          ? current.capabilities.filter((item) => item !== capability)
          : [...current.capabilities, capability],
      };
    });
  };

  const parseProviderHeaders = () => {
    const parsed: unknown = JSON.parse(providerDraft.headersText.trim() || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("自定义 Headers 必须是 JSON 对象");
    }
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value !== "string") throw new Error(`Header ${name} 的值必须是字符串`);
      headers[name] = value;
    }
    return headers;
  };

  const saveProvider = async (event: FormEvent) => {
    event.preventDefault();
    if (!providerDraft.name.trim() || !providerDraft.baseUrl.trim()) {
      setError("请填写渠道名称和 Base URL");
      return;
    }
    if (!providerDraft.id && providerDraft.apiKey.trim().length < 8) {
      setError("新渠道必须填写 API Key");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const headers = providerDraft.replaceHeaders ? parseProviderHeaders() : undefined;
      const common = {
        name: providerDraft.name.trim(),
        priority: providerDraft.priority,
        baseUrl: providerDraft.baseUrl.trim(),
        defaultModel: providerDraft.defaultModel.trim(),
        allowInsecureHttp: providerDraft.allowInsecureHttp,
        apiKey: providerDraft.apiKey.trim() || undefined,
        headers,
        capabilities: providerDraft.capabilities,
        enabled: providerDraft.enabled,
        idempotencyKey: operationKey(providerDraft.id ? "web-provider-update" : "web-provider-create"),
      };
      const result = providerDraft.id
        ? await request<{ provider: AdminProvider }>(`/v1/admin/providers/${providerDraft.id}`, {
          method: "PATCH",
          body: JSON.stringify(common),
        })
        : await request<{ provider: AdminProvider }>("/v1/admin/providers", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            kind: providerDraft.kind,
            apiKey: providerDraft.apiKey.trim(),
            headers: headers ?? {},
          }),
        });
      await refreshProviders(result.provider.id);
      setProviderBalance(null);
      setNotice(providerDraft.id ? "渠道配置已更新" : "渠道已加密保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存渠道失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteProvider = async () => {
    if (!providerDraft.id) return;
    if (!window.confirm(`确定删除 ${providerDraft.name || "该渠道"}？删除后无法恢复。`)) return;
    setBusy(true);
    clearMessage();
    try {
      await request(`/v1/admin/providers/${providerDraft.id}`, {
        method: "DELETE",
        body: JSON.stringify({ idempotencyKey: operationKey("web-provider-delete") }),
      });
      const items = await refreshProviders(null);
      setProviderDraft(items[0] ? providerToDraft(items[0]) : newProviderDraft());
      setProviderBalance(null);
      setNotice("渠道已删除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除渠道失败");
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async () => {
    if (!providerDraft.id) {
      setError("请先保存渠道，再测试连接");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const result = await request<{ message: string }>(`/v1/admin/providers/${providerDraft.id}/test`, { method: "POST" });
      await refreshProviders(providerDraft.id);
      setNotice(result.message || "渠道连接成功");
    } catch (reason) {
      await refreshProviders(providerDraft.id).catch(() => undefined);
      setError(reason instanceof Error ? reason.message : "渠道连接测试失败");
    } finally {
      setBusy(false);
    }
  };

  const queryProviderBalance = async () => {
    if (!providerDraft.id) {
      setError("请先保存渠道，再查询余额");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const result = await request<ProviderBalance>(`/v1/admin/providers/${providerDraft.id}/balance`, { method: "POST" });
      setProviderBalance(result);
      setNotice(result.display);
    } catch (reason) {
      setProviderBalance(null);
      setError(reason instanceof Error ? reason.message : "查询渠道余额失败");
    } finally {
      setBusy(false);
    }
  };

  const updateImagePrice = (index: number, field: "credits1k" | "credits2k" | "credits4k", value: string) => {
    setPricing((current) => current ? {
      ...current,
      imageModels: current.imageModels.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    } : current);
  };

  const updateVideoPrice = (index: number, value: string) => {
    setPricing((current) => current ? {
      ...current,
      videoModels: current.videoModels.map((item, itemIndex) => itemIndex === index ? { ...item, credits: value } : item),
    } : current);
  };

  const updateVideoAdvanced = (index: number, field: keyof VideoPricingDraft, value: string) => {
    setVideoAdvanced((current) => ({
      ...current,
      [index]: { ...(current[index] || videoPricingDraft()), [field]: value },
    }));
  };

  const parseCreditMap = (text: string) => {
    if (!text.trim()) return undefined;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("视频高级定价必须是 JSON 对象");
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key.trim() || typeof value !== "string" || !creditPattern.test(value)) {
        throw new Error("视频高级定价中的积分必须是 0 到 1000000 的整数字符串");
      }
      result[key.trim()] = value;
    }
    return result;
  };

  const parseIncludedReferenceImages = (text: string) => {
    if (!text.trim()) return undefined;
    const parsed = Number(text);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100) {
      throw new Error("免费参考图片数量必须是 0 到 100 的整数");
    }
    return parsed;
  };

  const savePricing = async (event: FormEvent) => {
    event.preventDefault();
    if (!pricing) return;
    let videoModels: AdminAiPricing["videoModels"];
    try {
      videoModels = pricing.videoModels.map((item, index) => {
        const advanced = videoAdvanced[index] || videoPricingDraft(item);
        return {
          ...item,
          creditsPerSecond: advanced.creditsPerSecond.trim() || undefined,
          creditsPerVideo: advanced.creditsPerVideo.trim() || undefined,
          creditsByDuration: parseCreditMap(advanced.creditsByDuration),
          creditsByResolution: parseCreditMap(advanced.creditsByResolution),
          creditsByCount: parseCreditMap(advanced.creditsByCount),
          includedReferenceImages: parseIncludedReferenceImages(advanced.includedReferenceImages),
          creditsPerExtraReferenceImage: advanced.creditsPerExtraReferenceImage.trim() || undefined,
          creditsPerReferenceVideoSecond: advanced.creditsPerReferenceVideoSecond.trim() || undefined,
          referenceVideoCreditsByResolution: parseCreditMap(advanced.referenceVideoCreditsByResolution),
        };
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "视频高级定价格式无效");
      return;
    }
    const values = [
      pricing.agentRequestCredits,
      pricing.inspirationAnalysisCredits,
      pricing.imageDefaultCredits,
      pricing.videoDefaultCredits,
      ...pricing.imageModels.flatMap((item) => [item.credits1k, item.credits2k, item.credits4k].filter(Boolean)),
      ...videoModels.flatMap((item) => [
        item.credits,
        item.creditsPerSecond,
        item.creditsPerVideo,
        item.creditsPerExtraReferenceImage,
        item.creditsPerReferenceVideoSecond,
        ...Object.values(item.creditsByDuration || {}),
        ...Object.values(item.creditsByResolution || {}),
        ...Object.values(item.creditsByCount || {}),
        ...Object.values(item.referenceVideoCreditsByResolution || {}),
      ].filter(Boolean)),
    ];
    if (values.some((value) => !creditPattern.test(String(value)))) {
      setError("所有积分必须是 0 到 1000000 的整数");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const result = await request<AdminAiPricing>("/v1/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({ ...pricing, videoModels, updatedAt: undefined }),
      });
      applyPricing(result);
      setNotice("AI 积分定价已保存并立即生效");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存 AI 定价失败");
    } finally {
      setBusy(false);
    }
  };

  const updateReview = async (shareId: string, status: ReviewShare["status"]) => {
    setBusy(true);
    clearMessage();
    try {
      await request(`/v1/admin/inspiration-space/${shareId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshReviews();
      setNotice(status === "PUBLISHED" ? "分享已发布" : "分享已退回");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "审核失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteReview = async (shareId: string) => {
    if (!window.confirm("确定永久删除这条分享及其预览图吗？")) return;
    setBusy(true);
    clearMessage();
    try {
      await request(`/v1/admin/inspiration-space/${shareId}`, { method: "DELETE" });
      await refreshReviews();
      setNotice("分享已删除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  const ledgerLabel = (entry: AdminLedgerEntry) => entry.description || entry.type;

  if (!adminKey) {
    return (
      <section className={styles.loginShell}>
        <form className={styles.loginCard} onSubmit={connect}>
          <span>SECURE WEB CONSOLE</span>
          <h1>管理员后台</h1>
          <p>使用和桌面管理器相同的 ADMIN API KEY。密钥只保留在当前页面内存中。</p>
          <label>
            <strong>管理员密钥</strong>
            <input type="password" value={adminKeyInput} onChange={(event) => setAdminKeyInput(event.target.value)} autoComplete="off" spellCheck={false} placeholder="粘贴管理员密钥" />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <button disabled={busy} type="submit">{busy ? "正在验证…" : "安全连接"}</button>
        </form>
      </section>
    );
  }

  return (
    <section className={styles.console}>
      <header className={styles.consoleHead}>
        <div><span>UNMIND OPERATIONS</span><h1>额度管理器</h1><p>账户、兑换码、渠道、定价与内容审核</p></div>
        <button className={styles.ghost} type="button" onClick={disconnect}>断开连接</button>
      </header>

      <div className={styles.metrics}>
        <article><span>注册用户</span><strong>{overview?.users.total ?? 0}</strong><small>{overview?.users.active ?? 0} 个活跃账户</small></article>
        <article><span>有效授权</span><strong>{overview?.licenses.active ?? 0}</strong><small>服务端实时数据</small></article>
        <article><span>可用总额度</span><strong>{formatCredits(overview?.credits.available)}</strong><small>已发放余额汇总</small></article>
        <article><span>云端渠道</span><strong>{providers.length}</strong><small>{providers.filter((item) => item.enabled).length} 个已启用</small></article>
      </div>

      <nav className={styles.tabs} aria-label="后台功能">
        <button className={tab === "users" ? styles.active : ""} onClick={() => setTab("users")}>用户与额度</button>
        <button className={tab === "codes" ? styles.active : ""} onClick={() => setTab("codes")}>兑换码</button>
        <button className={tab === "providers" ? styles.active : ""} onClick={() => setTab("providers")}>渠道管理</button>
        <button className={tab === "pricing" ? styles.active : ""} onClick={() => setTab("pricing")}>AI 定价</button>
        <button className={tab === "reviews" ? styles.active : ""} onClick={() => setTab("reviews")}>灵感空间审核</button>
      </nav>

      {(error || notice) && <div className={error ? styles.error : styles.notice}>{error || notice}</div>}

      {tab === "users" && (
        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <form className={styles.toolbar} onSubmit={searchUsers}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索邮箱、名称、用户 ID" />
              <button disabled={busy}>搜索</button>
            </form>
            <div className={styles.userList}>
              {users.map((user) => (
                <button key={user.id} className={selectedUser?.id === user.id ? styles.selectedUser : ""} onClick={() => void openUser(user.id)}>
                  <span><strong>{user.displayName || user.email || "未命名用户"}</strong><small>{user.email || user.id}</small></span>
                  <em>{formatCredits(user.wallet?.availableCredits)} 点</em>
                </button>
              ))}
              {!users.length && <p className={styles.empty}>没有找到用户</p>}
            </div>
          </section>
          <section className={`${styles.panel} ${styles.userDetailPanel}`}>
            {selectedUser ? (
              <div className={styles.detailStack}>
                <div className={styles.panelTitle}><strong>{selectedUser.displayName || selectedUser.email || selectedUser.id}</strong><span>{selectedUser.status}</span></div>
                <div className={styles.walletGrid}>
                  <article><small>可用</small><strong>{formatCredits(selectedUser.wallet?.availableCredits)}</strong></article>
                  <article><small>预留</small><strong>{formatCredits(selectedUser.wallet?.reservedCredits)}</strong></article>
                  <article><small>累计发放</small><strong>{formatCredits(selectedUser.wallet?.lifetimeGranted)}</strong></article>
                  <article><small>累计消耗</small><strong>{formatCredits(selectedUser.wallet?.lifetimeConsumed)}</strong></article>
                </div>
                <form className={styles.compactForm} onSubmit={updateAuthorization}>
                  <div className={styles.sectionTitle}>账户授权</div>
                  <div className={styles.formGridThree}>
                    <label><strong>用户名称</strong><input value={authorizationName} onChange={(event) => setAuthorizationName(event.target.value)} maxLength={32} /></label>
                    <label><strong>到期日期</strong><input type="date" value={authorizationExpiresAt} onChange={(event) => setAuthorizationExpiresAt(event.target.value)} /></label>
                    <label><strong>账户状态</strong><select value={authorizationStatus} onChange={(event) => setAuthorizationStatus(event.target.value as AuthorizationStatus)}><option value="ACTIVE">启用</option><option value="SUSPENDED">暂停</option><option value="DISABLED">禁用</option></select></label>
                  </div>
                  <button disabled={busy}>保存授权</button>
                </form>
                <form className={styles.compactForm} onSubmit={grantCredits}>
                  <div className={styles.sectionTitle}>发放额度</div>
                  <div className={styles.formGrid}>
                    <label><strong>额度</strong><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.trim())} /></label>
                    <label><strong>发放说明</strong><input value={grantNote} onChange={(event) => setGrantNote(event.target.value)} maxLength={500} /></label>
                  </div>
                  <button disabled={busy}>确认发放</button>
                </form>
                <div>
                  <div className={styles.panelTitle}><strong>额度流水</strong><span>{selectedUser.ledger.length} 条</span></div>
                  <div className={styles.ledgerList}>
                    {selectedUser.ledger.map((entry) => (
                      <article key={entry.id}>
                        <span><strong>{ledgerLabel(entry)}</strong><small>{formatDateTime(entry.createdAt)} · 余额 {formatCredits(entry.balanceAfter)}</small></span>
                        <em data-negative={entry.amount.startsWith("-")}>{entry.amount.startsWith("-") ? "" : "+"}{formatCredits(entry.amount)}</em>
                      </article>
                    ))}
                    {!selectedUser.ledger.length && <p className={styles.empty}>暂无流水</p>}
                  </div>
                </div>
              </div>
            ) : <p className={styles.empty}>从左侧选择用户</p>}
          </section>
        </div>
      )}

      {tab === "codes" && (
        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <form className={styles.form} onSubmit={createCodes}>
              <span>CREATE REDEMPTION CODES</span><h2>生成额度兑换码</h2>
              <label><strong>每次兑换额度</strong><input inputMode="numeric" value={codeCredits} onChange={(event) => setCodeCredits(event.target.value.trim())} /></label>
              <div className={styles.formGrid}>
                <label><strong>生成数量</strong><input type="number" min={1} max={100} value={codeQuantity} onChange={(event) => setCodeQuantity(event.target.value)} /></label>
                <label><strong>每码可用次数</strong><input type="number" min={1} max={10000} value={codeUses} onChange={(event) => setCodeUses(event.target.value)} /></label>
              </div>
              <label><strong>到期日期</strong><input type="date" value={codeExpiresAt} onChange={(event) => setCodeExpiresAt(event.target.value)} /></label>
              <label><strong>备注</strong><input value={codeNote} onChange={(event) => setCodeNote(event.target.value)} placeholder="例如：活动赠送" /></label>
              <button disabled={busy}>生成兑换码</button>
              {generatedCodes.length > 0 && (
                <div className={styles.generated}>
                  <pre>{generatedCodes.join("\n")}</pre>
                  <button type="button" onClick={() => navigator.clipboard.writeText(generatedCodes.join("\n"))}>复制全部</button>
                </div>
              )}
            </form>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>历史记录</strong><span>{codes.length} 条</span></div>
            <div className={styles.codeList}>
              {codes.map((code) => (
                <article key={code.id}>
                  <span><strong>{code.codeHint}</strong><small>{code.note || "无备注"} · 使用 {code.redeemedCount}/{code.maxRedemptions} · {code.expiresAt ? `到期 ${new Date(code.expiresAt).toLocaleDateString("zh-CN")}` : "长期有效"}</small></span>
                  <em>{formatCredits(code.credits)} 点</em>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "providers" && (
        <div className={styles.providerShell}>
          <section className={styles.panel}>
            <div className={styles.providerCreateBar}>
              {providerKinds.map((kind) => <button key={kind} type="button" onClick={() => { setProviderDraft(newProviderDraft(kind)); setProviderBalance(null); }}>{providerMeta[kind].label}</button>)}
            </div>
            <div className={styles.providerList}>
              {providers.map((provider) => (
                <button key={provider.id} className={providerDraft.id === provider.id ? styles.selectedProvider : ""} type="button" onClick={() => selectProvider(provider)}>
                  <span><strong>{provider.name}</strong><small>{providerMeta[provider.kind].label} · P{provider.priority} · {provider.enabled ? "启用" : "停用"}</small></span>
                  <em data-ok={provider.lastTestStatus === "OK"}>{provider.lastTestStatus === "OK" ? "正常" : provider.lastTestStatus === "FAILED" ? "失败" : "未测试"}</em>
                </button>
              ))}
              {!providers.length && <p className={styles.empty}>还没有云端渠道</p>}
            </div>
          </section>
          <section className={styles.panel}>
            <form className={styles.providerForm} onSubmit={saveProvider}>
              <div className={styles.panelTitle}><strong>{providerDraft.id ? "编辑渠道" : "新建渠道"}</strong><label className={styles.inlineCheck}><input type="checkbox" checked={providerDraft.enabled} onChange={(event) => setProviderDraft((current) => ({ ...current, enabled: event.target.checked }))} />{providerDraft.enabled ? "启用" : "停用"}</label></div>
              <div className={styles.formGrid}>
                <label>
                  <strong>渠道类型</strong>
                  <select disabled={Boolean(providerDraft.id)} value={providerDraft.kind} onChange={(event) => setProviderDraft(newProviderDraft(event.target.value as AdminProviderKind))}>
                    {providerKinds.map((kind) => <option key={kind} value={kind}>{providerMeta[kind].label}</option>)}
                  </select>
                  {providerDraft.id && <small className={styles.fieldHint}>已保存渠道不能修改类型；请点击左侧顶部的渠道按钮新建。</small>}
                </label>
                <label><strong>渠道名称</strong><input value={providerDraft.name} onChange={(event) => setProviderDraft((current) => ({ ...current, name: event.target.value }))} maxLength={80} /></label>
              </div>
              <label><strong>API Base URL</strong><input value={providerDraft.baseUrl} onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))} placeholder={providerMeta[providerDraft.kind].placeholder} spellCheck={false} /></label>
              <div className={styles.formGrid}>
                <label><strong>调用优先级</strong><input type="number" min={0} max={9999} value={providerDraft.priority} onChange={(event) => setProviderDraft((current) => ({ ...current, priority: Math.min(9999, Math.max(0, Number(event.target.value) || 0)) }))} /></label>
                <label><strong>默认模型</strong><input value={providerDraft.defaultModel} onChange={(event) => setProviderDraft((current) => ({ ...current, defaultModel: event.target.value }))} spellCheck={false} /></label>
              </div>
              <label><strong>API Key</strong><input type="password" value={providerDraft.apiKey} onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))} placeholder={providerDraft.id ? `留空保留 ****${providers.find((item) => item.id === providerDraft.id)?.apiKeyLast4 || ""}` : "填写上游 API Key"} autoComplete="new-password" /></label>
              <div className={styles.capabilities}>
                {providerCapabilities.map((item) => <label key={item.value}><input type="checkbox" checked={providerDraft.capabilities.includes(item.value)} onChange={() => toggleProviderCapability(item.value)} /><span>{item.label}</span></label>)}
              </div>
              <label className={styles.inlineCheck}><input type="checkbox" checked={providerDraft.allowInsecureHttp} onChange={(event) => setProviderDraft((current) => ({ ...current, allowInsecureHttp: event.target.checked }))} />允许明文 HTTP</label>
              {providerDraft.id && <label className={styles.inlineCheck}><input type="checkbox" checked={providerDraft.replaceHeaders} onChange={(event) => setProviderDraft((current) => ({ ...current, replaceHeaders: event.target.checked, headersText: "{}" }))} />替换已有自定义 Headers</label>}
              <label><strong>自定义 Headers（JSON）</strong><textarea disabled={Boolean(providerDraft.id) && !providerDraft.replaceHeaders} value={providerDraft.headersText} onChange={(event) => setProviderDraft((current) => ({ ...current, headersText: event.target.value }))} rows={3} spellCheck={false} /></label>
              {providerDraft.id && <div className={styles.providerStatus}><strong>{providers.find((item) => item.id === providerDraft.id)?.lastTestMessage || "尚未测试连接"}</strong><small>{formatDateTime(providers.find((item) => item.id === providerDraft.id)?.lastTestedAt)}</small></div>}
              {providerBalance && <div className={styles.providerStatus}><strong>{providerBalance.unlimited ? "无限额度" : formatCredits(providerBalance.totalAvailable)}</strong><small>{providerBalance.display} · {providerBalance.endpoint}</small></div>}
              <div className={styles.actionRow}>
                <button className={styles.danger} type="button" disabled={!providerDraft.id || busy} onClick={() => void deleteProvider()}>删除渠道</button>
                <button className={styles.ghost} type="button" disabled={!providerDraft.id || busy} onClick={() => void queryProviderBalance()}>查询余额</button>
                <button className={styles.ghost} type="button" disabled={!providerDraft.id || busy} onClick={() => void testProvider()}>测试连接</button>
                <button disabled={busy || providerDraft.capabilities.length === 0}>{providerDraft.id ? "保存修改" : "保存渠道"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {tab === "pricing" && pricing && (
        <form className={styles.pricingShell} onSubmit={savePricing}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>基础定价</strong><span>积分</span></div>
            <div className={styles.basePricingGrid}>
              <label><strong>Agent 请求</strong><input type="number" min={0} max={1000000} value={pricing.agentRequestCredits} onChange={(event) => setPricing({ ...pricing, agentRequestCredits: event.target.value })} /></label>
              <label><strong>图片分析</strong><input type="number" min={0} max={1000000} value={pricing.inspirationAnalysisCredits} onChange={(event) => setPricing({ ...pricing, inspirationAnalysisCredits: event.target.value })} /></label>
              <label><strong>其他生图默认</strong><input type="number" min={0} max={1000000} value={pricing.imageDefaultCredits} onChange={(event) => setPricing({ ...pricing, imageDefaultCredits: event.target.value })} /></label>
              <label><strong>其他视频每秒</strong><input type="number" min={0} max={1000000} value={pricing.videoDefaultCredits} onChange={(event) => setPricing({ ...pricing, videoDefaultCredits: event.target.value })} /></label>
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>生图模型</strong><span>按张计费</span></div>
            <div className={styles.imagePricingList}>
              {pricing.imageModels.map((item, index) => (
                <article key={item.model}>
                  <strong>{pricingLabel(item.model)}</strong>
                  {item.credits1k !== undefined && <label><span>1K</span><input type="number" min={0} max={1000000} value={item.credits1k} onChange={(event) => updateImagePrice(index, "credits1k", event.target.value)} /></label>}
                  <label><span>2K</span><input type="number" min={0} max={1000000} value={item.credits2k} onChange={(event) => updateImagePrice(index, "credits2k", event.target.value)} /></label>
                  <label><span>4K</span><input type="number" min={0} max={1000000} value={item.credits4k} onChange={(event) => updateImagePrice(index, "credits4k", event.target.value)} /></label>
                </article>
              ))}
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>视频模型</strong><span>按秒计费</span></div>
            <div className={styles.videoPricingList}>
              {pricing.videoModels.map((item, index) => (
                <article key={item.model}>
                  <div className={styles.videoPriceHead}><strong>{pricingLabel(item.model)}</strong><label><span>每秒积分</span><input type="number" min={0} max={1000000} value={item.credits} onChange={(event) => updateVideoPrice(index, event.target.value)} /></label></div>
                  <details>
                    <summary>高级定价</summary>
                    <div className={styles.advancedGrid}>
                      <label><strong>每秒价格覆盖</strong><input type="number" min={0} max={1000000} value={videoAdvanced[index]?.creditsPerSecond ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsPerSecond", event.target.value)} /></label>
                      <label><strong>每条额外加分</strong><input type="number" min={0} max={1000000} value={videoAdvanced[index]?.creditsPerVideo ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsPerVideo", event.target.value)} /></label>
                      <label><strong>指定时长总价</strong><input value={videoAdvanced[index]?.creditsByDuration ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsByDuration", event.target.value)} placeholder='{"4":"100"}' /></label>
                      <label><strong>清晰度每秒加分</strong><input value={videoAdvanced[index]?.creditsByResolution ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsByResolution", event.target.value)} placeholder='{"2k":"20"}' /></label>
                      <label><strong>多条生成总价</strong><input value={videoAdvanced[index]?.creditsByCount ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsByCount", event.target.value)} placeholder='{"2":"300"}' /></label>
                    </div>
                    <div className={styles.materialPricingTitle}><strong>输入素材计费</strong><span>音频免费；参考视频按生成时长和输出清晰度计费</span></div>
                    <div className={styles.advancedGrid}>
                      <label><strong>免费参考图片数</strong><input type="number" min={0} max={100} step={1} value={videoAdvanced[index]?.includedReferenceImages ?? ""} onChange={(event) => updateVideoAdvanced(index, "includedReferenceImages", event.target.value)} placeholder="H3 默认 5" /></label>
                      <label><strong>超额图片每张积分</strong><input type="number" min={0} max={1000000} step={1} value={videoAdvanced[index]?.creditsPerExtraReferenceImage ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsPerExtraReferenceImage", event.target.value)} placeholder="H3 默认 9" /></label>
                      <label><strong>参考视频每秒积分</strong><input type="number" min={0} max={1000000} step={1} value={videoAdvanced[index]?.creditsPerReferenceVideoSecond ?? ""} onChange={(event) => updateVideoAdvanced(index, "creditsPerReferenceVideoSecond", event.target.value)} placeholder="768P 基础价 15" /></label>
                      <label><strong>参考视频清晰度每秒加分</strong><input value={videoAdvanced[index]?.referenceVideoCreditsByResolution ?? ""} onChange={(event) => updateVideoAdvanced(index, "referenceVideoCreditsByResolution", event.target.value)} placeholder='{"2k":"10"}' /></label>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>
          <div className={styles.saveBar}><span>{pricing.updatedAt ? `最近保存：${formatDateTime(pricing.updatedAt)}` : "尚未保存自定义定价"}</span><button disabled={busy}>保存并立即生效</button></div>
        </form>
      )}

      {tab === "reviews" && (
        <section className={styles.reviewGrid}>
          {reviews.map((share) => (
            <article key={share.id} className={styles.reviewCard}>
              <div className={styles.reviewImage}>
                {share.previews[0] ? <img src={share.previews[0].url} alt="" /> : <span>JSON</span>}
                <em data-status={share.status}>{share.status === "PENDING" ? "待审核" : share.status === "PUBLISHED" ? "已发布" : "已退回"}</em>
              </div>
              <div className={styles.reviewBody}>
                <small>{share.kind === "WORKFLOW" ? "工作流" : "节点预设"} · {share.authorName}</small>
                <h3>{share.title}</h3>
                <p>{share.description || "没有填写说明"}</p>
                <div>{share.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <footer>
                  <button disabled={busy} onClick={() => void updateReview(share.id, "PUBLISHED")}>发布</button>
                  <button disabled={busy} className={styles.ghost} onClick={() => void updateReview(share.id, "REJECTED")}>退回</button>
                  <button disabled={busy} className={styles.danger} onClick={() => void deleteReview(share.id)}>删除</button>
                </footer>
              </div>
            </article>
          ))}
          {!reviews.length && <p className={styles.empty}>还没有灵感空间投稿</p>}
        </section>
      )}
    </section>
  );
}
