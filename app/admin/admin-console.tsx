"use client";

import { FormEvent, useCallback, useState } from "react";
import { apiBaseUrl } from "../site-shared";
import {
  getUselgOpenAiRoutingHint,
  newProviderDraft,
  normalizePricing,
  pricingLabel,
  providerCapabilities,
  providerKinds,
  providerMeta,
  providerToDraft,
  videoPricingDraft,
  type AdminAiPricing,
  type AdminChatPricing,
  type AdminChatTokenRates,
  type AdminLedgerEntry,
  type AdminMembershipPlan,
  type AdminOverview,
  type AdminProvider,
  type AdminProviderCapability,
  type AdminProviderKind,
  type AdminUser,
  type AdminUserDetail,
  type AdminReferralRule,
  type ProviderBalance,
  type ProviderDraft,
  type RedemptionCode,
  type ReviewShare,
  type VideoPricingDraft,
} from "./admin-model";
import { AiModelCenter } from "./ai-model-center";
import type { AdminAiModelSummary } from "./ai-model-center-model";
import styles from "./admin.module.css";

type Tab = "users" | "membership" | "codes" | "providers" | "models" | "pricing" | "reviews";
type AuthorizationStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

const formatCredits = (value?: string | null) => {
  const normalized = value?.trim() || "0";
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return normalized;
  const negative = match[1] === "-";
  const fraction = (match[3] || "").padEnd(3, "0");
  let hundredths = BigInt(match[2] || "0") * 100n + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) hundredths += 1n;
  const sign = negative && hundredths !== 0n ? "-" : "";
  const whole = hundredths / 100n;
  const cents = (hundredths % 100n).toString().padStart(2, "0");
  return `${sign}${whole.toLocaleString("zh-CN")}.${cents}`;
};

const ledgerPresentation = (entry: AdminLedgerEntry) => {
  const text = entry.description?.trim() || entry.type;
  const segments = text.split(/\s*·\s*/).filter(Boolean);
  if (segments[0] !== "Chat Token 结算" || segments.length < 2) {
    return { title: text, details: [] as string[] };
  }
  return {
    title: segments[0],
    details: segments.slice(2),
  };
};

const formatDateTime = (value?: string | null) => (
  value ? new Date(value).toLocaleString("zh-CN") : "-"
);

const operationKey = (prefix: string) => (
  `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`
);

const creditPattern = /^(?:0|[1-9]\d{0,6})$/;
const membershipDiscountPattern = /^(?:0|[1-9](?:\.\d{1,2})?|10(?:\.0{1,2})?)$/;
type MembershipDiscountKey = "gptImage1K" | "chat" | "video" | "other";
type MembershipDiscountDraft = Record<MembershipDiscountKey, string>;

const emptyMembershipDiscounts = (): MembershipDiscountDraft => ({
  gptImage1K: "10",
  chat: "10",
  video: "10",
  other: "10",
});

const gptImageModel = (model: AdminAiModelSummary) => (
  model.modality === "image"
  && (model.canonicalModelKey.toLowerCase().includes("gpt")
    || model.canonicalModelKey.toLowerCase() === "image2"
    || model.displayName.toLowerCase().includes("gpt image"))
  && Array.isArray(model.capabilities.supportedResolutions)
  && model.capabilities.supportedResolutions.some((value) => String(value).toLowerCase() === "1k")
);

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) {
    throw Object.assign(
      new Error(payload.message || `请求失败（HTTP ${response.status}）`),
      { status: response.status },
    );
  }
  return payload as T;
}

export function AdminConsole() {
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [authorizationName, setAuthorizationName] = useState("");
  const [authorizationStatus, setAuthorizationStatus] = useState<AuthorizationStatus>("ACTIVE");
  const [codes, setCodes] = useState<RedemptionCode[]>([]);
  const [reviews, setReviews] = useState<ReviewShare[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(() => newProviderDraft());
  const uselgOpenAiRoutingHint = getUselgOpenAiRoutingHint(
    providerDraft.kind,
    providerDraft.capabilities,
  );
  const [providerBalance, setProviderBalance] = useState<ProviderBalance | null>(null);
  const [pricing, setPricing] = useState<AdminAiPricing | null>(null);
  const [chatPricing, setChatPricing] = useState<AdminChatPricing | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<AdminMembershipPlan[]>([]);
  const [membershipModels, setMembershipModels] = useState<AdminAiModelSummary[]>([]);
  const [referralRules, setReferralRules] = useState<AdminReferralRule[]>([]);
  const [membershipEditingPlanId, setMembershipEditingPlanId] = useState<string | null>(null);
  const [membershipLegacyPrices, setMembershipLegacyPrices] = useState<Record<string, unknown>>({});
  const [membershipCode, setMembershipCode] = useState("pro");
  const [membershipName, setMembershipName] = useState("Pro");
  const [membershipDiscountDraft, setMembershipDiscountDraft] = useState<MembershipDiscountDraft>(() => emptyMembershipDiscounts());
  const [membershipDays, setMembershipDays] = useState("30");
  const [membershipGrantPlan, setMembershipGrantPlan] = useState("");
  const [ruleInviterCredits, setRuleInviterCredits] = useState("100");
  const [ruleInviteeCredits, setRuleInviteeCredits] = useState("100");
  const [ruleRechargeInviterCredits, setRuleRechargeInviterCredits] = useState("0");
  const [ruleRechargeInviteeCredits, setRuleRechargeInviteeCredits] = useState("0");
  const [ruleRechargeMin, setRuleRechargeMin] = useState("0");
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
    const [nextOverview, userPage, codePage, sharePage, providerPage, nextPricing, nextChatPricing] = await Promise.all([
      request<AdminOverview>("/v1/admin/overview", {}, credential),
      request<{ items: AdminUser[] }>(`/v1/admin/users${queryString}`, {}, credential),
      request<{ items: RedemptionCode[] }>("/v1/admin/redemption-codes?limit=200", {}, credential),
      request<{ items: ReviewShare[] }>("/v1/admin/inspiration-space?limit=200", {}, credential),
      request<{ items: AdminProvider[] }>("/v1/admin/providers", {}, credential),
      request<AdminAiPricing>("/v1/admin/pricing", {}, credential),
      request<AdminChatPricing>("/v1/admin/chat-pricing", {}, credential),
    ]);
    setOverview(nextOverview);
    setUsers(userPage.items);
    setCodes(codePage.items);
    setReviews(sharePage.items);
    setProviders(providerPage.items);
    setProviderDraft(providerPage.items[0] ? providerToDraft(providerPage.items[0]) : newProviderDraft());
    applyPricing(nextPricing);
    setChatPricing(nextChatPricing);
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

  const refreshMembershipPlans = async () => {
    const plans = await request<{ items: AdminMembershipPlan[] }>("/v1/admin/membership/plans");
    setMembershipPlans(plans.items);
    setMembershipGrantPlan((current) => (
      plans.items.some((plan) => plan.id === current) ? current : plans.items[0]?.id || ""
    ));
    return plans.items;
  };

  const refreshMembership = async () => {
    const [plans, rules, models] = await Promise.all([
      request<{ items: AdminMembershipPlan[] }>("/v1/admin/membership/plans"),
      request<{ items: AdminReferralRule[] }>("/v1/admin/referral-rules"),
      request<{ items: AdminAiModelSummary[] }>("/v1/admin/ai-models/").catch(() => ({ items: [] })),
    ]);
    setMembershipPlans(plans.items);
    setReferralRules(rules.items);
    setMembershipModels(models.items);
    setMembershipGrantPlan((current) => (
      plans.items.some((plan) => plan.id === current) ? current : plans.items[0]?.id || ""
    ));
    const registration = rules.items.find((rule) => rule.eventType === "REGISTRATION");
    const recharge = rules.items.find((rule) => rule.eventType === "RECHARGE");
    if (registration) {
      setRuleInviterCredits(registration.inviterCredits);
      setRuleInviteeCredits(registration.inviteeCredits);
    }
    if (recharge) {
      setRuleRechargeInviterCredits(recharge.inviterCredits);
      setRuleRechargeInviteeCredits(recharge.inviteeCredits);
      setRuleRechargeMin(recharge.minRecharge || "0");
    }
  };

  const resetMembershipForm = () => {
    setMembershipEditingPlanId(null);
    setMembershipCode("pro");
    setMembershipName("Pro");
    setMembershipDiscountDraft(emptyMembershipDiscounts());
    setMembershipLegacyPrices({});
  };

  const editMembershipPlan = (plan: AdminMembershipPlan) => {
    const prices = plan.versions[0]?.prices;
    const legacyPrices = prices
      ? Object.fromEntries(Object.entries(prices).filter(([key]) => key !== "discounts"))
      : {};
    const discounts = prices && typeof prices.discounts === "object" && !Array.isArray(prices.discounts)
      ? prices.discounts as Record<string, unknown>
      : {};
    const next = emptyMembershipDiscounts();
    (Object.keys(next) as MembershipDiscountKey[]).forEach((key) => {
      const value = discounts[key];
      if (typeof value === "string" || typeof value === "number") next[key] = String(value);
    });
    setMembershipEditingPlanId(plan.id);
    setMembershipCode(plan.code);
    setMembershipName(plan.name);
    setMembershipDiscountDraft(next);
    setMembershipLegacyPrices(legacyPrices);
  };

  const updateMembershipDiscount = (key: MembershipDiscountKey, value: string) => {
    setMembershipDiscountDraft((current) => ({ ...current, [key]: value }));
  };

  const buildMembershipPrices = () => {
    const discounts: Record<string, string> = {};
    (Object.keys(membershipDiscountDraft) as MembershipDiscountKey[]).forEach((key) => {
      const value = membershipDiscountDraft[key].trim() || "10";
      if (!membershipDiscountPattern.test(value)) {
        throw new Error(`“${key}”必须是 0 到 10 的折扣值（例如 5 表示 5 折，0 表示免费）`);
      }
      discounts[key] = value;
    });
    return { ...membershipLegacyPrices, discounts };
  };

  const createMembership = async (event: FormEvent) => {
    event.preventDefault();
    const matchingPlan = membershipPlans.find((plan) => plan.code.toLowerCase() === membershipCode.trim().toLowerCase());
    const targetPlanId = membershipEditingPlanId || matchingPlan?.id || null;
    const editing = Boolean(targetPlanId);
    let prices: Record<string, unknown>;
    try { prices = buildMembershipPrices(); } catch (reason) { setError(reason instanceof Error ? reason.message : "会员价格填写无效"); return; }
    setBusy(true); clearMessage();
    try {
      const path = targetPlanId
        ? `/v1/admin/membership/plans/${encodeURIComponent(targetPlanId)}`
        : "/v1/admin/membership/plans";
      await request(path, {
        method: targetPlanId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(targetPlanId ? {} : { code: membershipCode }),
          name: membershipName,
          prices,
        }),
      });
      await refreshMembership();
      resetMembershipForm();
      setNotice(editing ? "会员计划已更新" : "会员计划已创建");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "会员计划保存失败"); }
    finally { setBusy(false); }
  };

  const saveReferralRule = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); clearMessage();
    try {
      await Promise.all([
        request("/v1/admin/referral-rules", {
          method: "PATCH",
          body: JSON.stringify({ eventType: "REGISTRATION", inviterCredits: ruleInviterCredits, inviteeCredits: ruleInviteeCredits, active: true }),
        }),
        request("/v1/admin/referral-rules", {
          method: "PATCH",
          body: JSON.stringify({
            eventType: "RECHARGE",
            inviterCredits: ruleRechargeInviterCredits,
            inviteeCredits: ruleRechargeInviteeCredits,
            minRecharge: ruleRechargeMin.trim() || null,
            active: true,
          }),
        }),
      ]);
      await refreshMembership(); setNotice("邀请奖励规则已更新");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "邀请规则更新失败"); }
    finally { setBusy(false); }
  };

  const grantSelectedMembership = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedUser || !membershipGrantPlan) return;
    const days = Number(membershipDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError("会员有效天数必须是 1 到 3650 之间的整数");
      return;
    }
    setBusy(true); clearMessage();
    try {
      await request(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/membership/grant`, {
        method: "POST",
        body: JSON.stringify({ planId: membershipGrantPlan, days }),
      });
      await Promise.all([refreshUsers(), openUser(selectedUser.id), refreshMembership()]); setNotice("会员已分配");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "会员分配失败"); }
    finally { setBusy(false); }
  };

  const extendSelectedMembership = async () => {
    if (!selectedUser) return;
    const days = Number(membershipDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError("会员有效天数必须是 1 到 3650 之间的整数");
      return;
    }
    setBusy(true); clearMessage();
    try {
      await request(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/membership/extend`, {
        method: "POST",
        body: JSON.stringify({ days, ...(membershipGrantPlan ? { planId: membershipGrantPlan } : {}) }),
      });
      await Promise.all([refreshUsers(), openUser(selectedUser.id), refreshMembershipPlans()]);
      setNotice("会员期限已延长");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "会员延期失败"); }
    finally { setBusy(false); }
  };

  const revokeSelectedMembership = async () => {
    if (!selectedUser || !window.confirm("确定撤销该用户当前会员吗？")) return;
    setBusy(true); clearMessage();
    try {
      await request(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/membership/revoke`, { method: "POST" });
      await Promise.all([refreshUsers(), openUser(selectedUser.id), refreshMembershipPlans()]);
      setNotice("会员已撤销");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "会员撤销失败"); }
    finally { setBusy(false); }
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
    setMembershipPlans([]);
    setMembershipModels([]);
    setReferralRules([]);
    resetMembershipForm();
    setPricing(null);
    setChatPricing(null);
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
      if (!membershipPlans.length) await refreshMembershipPlans();
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
    if (authorizationName.trim().length < 2) {
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

  const updateChatTokenRate = (
    index: number,
    tier: "standard" | "extended",
    field: keyof AdminChatTokenRates,
    value: string,
  ) => {
    setChatPricing((current) => current ? {
      ...current,
      models: current.models.map((item, itemIndex) => (
        itemIndex === index && item.billingMode === "token"
          ? { ...item, [tier]: { ...item[tier], [field]: value } }
          : item
      )),
    } : current);
  };

  const updateChatThreshold = (index: number, value: string) => {
    setChatPricing((current) => current ? {
      ...current,
      models: current.models.map((item, itemIndex) => (
        itemIndex === index && item.billingMode === "token"
          ? { ...item, contextThresholdTokens: Number(value) }
          : item
      )),
    } : current);
  };

  const updateChatRequestPrice = (index: number, value: string) => {
    setChatPricing((current) => current ? {
      ...current,
      models: current.models.map((item, itemIndex) => (
        itemIndex === index && item.billingMode === "request"
          ? { ...item, creditsPerRequest: value }
          : item
      )),
    } : current);
  };

  const saveChatPricing = async () => {
    if (!chatPricing) return;
    const values = chatPricing.models.flatMap((item) => item.billingMode === "request"
      ? [item.creditsPerRequest]
      : [
        ...Object.values(item.standard),
        ...Object.values(item.extended),
      ]);
    if (values.some((value) => !creditPattern.test(value))) {
      setError("Chat Token 单价必须是 0 到 1000000 的整数");
      return;
    }
    if (chatPricing.models.some((item) => item.billingMode === "token" && (
      !Number.isSafeInteger(item.contextThresholdTokens)
      || item.contextThresholdTokens < 1
      || item.contextThresholdTokens > 10_000_000
    ))) {
      setError("上下文分档必须是 1 到 10000000 的整数 Token");
      return;
    }
    setBusy(true);
    clearMessage();
    try {
      const result = await request<AdminChatPricing>("/v1/admin/chat-pricing", {
        method: "PATCH",
        body: JSON.stringify({ models: chatPricing.models }),
      });
      setChatPricing(result);
      setNotice("Chat Token 定价已保存并立即生效");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存 Chat Token 定价失败");
    } finally {
      setBusy(false);
    }
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
      pricing.canvasTextAgentCredits,
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
        <div><span>UNMIND OPERATIONS</span><h1>运营管理台</h1><p>账户、渠道、Canonical Model、版本定价与内容审核</p></div>
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
        <button className={tab === "models" ? styles.active : ""} onClick={() => setTab("models")}>AI Model Center</button>
        <button className={tab === "pricing" ? styles.active : ""} onClick={() => setTab("pricing")}>AI 定价（含文字节点）</button>
        <button className={tab === "reviews" ? styles.active : ""} onClick={() => setTab("reviews")}>灵感空间审核</button>
      <button className={tab === "membership" ? styles.active : ""} onClick={() => { setTab("membership"); void refreshMembership().catch((reason) => setError(reason instanceof Error ? reason.message : "会员配置加载失败")); }}>会员与邀请</button>
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
                <div className={styles.notice}>
                  会员：{selectedUser.membership?.plan.name || "普通用户"} · 会员到期：{selectedUser.membership ? formatDateTime(selectedUser.membership.expiresAt) : "无会员期限"} · 邀请码：{selectedUser.referral?.inviteCode || "未生成"}
                </div>
                <div className={styles.walletGrid}>
                  <article><small>可用</small><strong>{formatCredits(selectedUser.wallet?.availableCredits)}</strong></article>
                  <article><small>预留</small><strong>{formatCredits(selectedUser.wallet?.reservedCredits)}</strong></article>
                  <article><small>累计发放</small><strong>{formatCredits(selectedUser.wallet?.lifetimeGranted)}</strong></article>
                  <article><small>累计消耗</small><strong>{formatCredits(selectedUser.wallet?.lifetimeConsumed)}</strong></article>
                </div>
                <form className={styles.compactForm} onSubmit={updateAuthorization}>
                  <div className={styles.sectionTitle}>账户授权</div>
                  <div className={styles.formGrid}>
                    <label><strong>用户名称</strong><input value={authorizationName} onChange={(event) => setAuthorizationName(event.target.value)} maxLength={32} /></label>
                    <label><strong>账户状态</strong><select value={authorizationStatus} onChange={(event) => setAuthorizationStatus(event.target.value as AuthorizationStatus)}><option value="ACTIVE">启用</option><option value="SUSPENDED">暂停</option><option value="DISABLED">禁用</option></select></label>
                  </div>
                  <button disabled={busy}>保存授权</button>
                </form>
                <form className={styles.compactForm} onSubmit={grantSelectedMembership}>
                  <div className={styles.sectionTitle}>会员管理</div>
                  <div className={styles.notice}>
                    当前会员：{selectedUser.membership?.plan.name || "普通用户"} · 会员到期：{selectedUser.membership ? formatDateTime(selectedUser.membership.expiresAt) : "无会员期限"}
                  </div>
                  <div className={styles.formGrid}>
                    {membershipPlans.length ? (
                      <label><strong>会员计划</strong><select value={membershipGrantPlan} onChange={(event) => setMembershipGrantPlan(event.target.value)}>{membershipPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
                    ) : (
                      <div className={styles.fieldHint}>
                        暂无可分配的会员计划，请先创建计划。
                        <button type="button" className={styles.ghost} onClick={() => { setTab("membership"); void refreshMembership(); }}>去创建会员计划</button>
                      </div>
                    )}
                    <label><strong>有效天数</strong><input type="number" min={1} max={3650} value={membershipDays} onChange={(event) => setMembershipDays(event.target.value)} /></label>
                  </div>
                  <div className={styles.actionRow}>
                    <button disabled={busy || !membershipGrantPlan}>分配会员</button>
                    <button type="button" className={styles.ghost} disabled={busy || !membershipGrantPlan} onClick={() => void extendSelectedMembership()}>延长会员</button>
                    {selectedUser.membership && <button type="button" className={styles.danger} disabled={busy} onClick={() => void revokeSelectedMembership()}>撤销会员</button>}
                  </div>
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
                    {selectedUser.ledger.map((entry) => {
                      const presentation = ledgerPresentation(entry);
                      return (
                        <article key={entry.id}>
                          <span>
                            <strong>{presentation.title}</strong>
                            {presentation.details.length > 0 && (
                              <span className={styles.ledgerDetails}>
                                {presentation.details.map((detail) => <span key={detail}>{detail}</span>)}
                              </span>
                            )}
                            <small>{formatDateTime(entry.createdAt)} · 余额 {formatCredits(entry.balanceAfter)}</small>
                          </span>
                          <em data-negative={entry.amount.startsWith("-")}>{entry.amount.startsWith("-") ? "" : "+"}{formatCredits(entry.amount)}</em>
                        </article>
                      );
                    })}
                    {!selectedUser.ledger.length && <p className={styles.empty}>暂无流水</p>}
                  </div>
                </div>
              </div>
            ) : <p className={styles.empty}>从左侧选择用户</p>}
          </section>
        </div>
      )}

      {tab === "membership" && (
        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <strong>会员计划</strong>
              <span>{membershipPlans.length} 个计划</span>
            </div>
            <form className={styles.form} onSubmit={createMembership}>
              <div className={styles.membershipFormHeader}>
                <strong>{membershipEditingPlanId ? "编辑会员计划" : "新建会员计划"}</strong>
                {membershipEditingPlanId && <button type="button" className={styles.ghost} onClick={resetMembershipForm}>新建计划</button>}
              </div>
              <label><strong>计划编码{membershipEditingPlanId ? "（不可修改）" : ""}</strong><input value={membershipCode} onChange={(event) => setMembershipCode(event.target.value)} placeholder="pro" readOnly={Boolean(membershipEditingPlanId)} /></label>
              <label><strong>显示名称</strong><input value={membershipName} onChange={(event) => setMembershipName(event.target.value)} placeholder="Pro" /></label>
              <div className={styles.membershipPriceEditor}>
                <div className={styles.fieldHint}>按普通用户目录价格计算。10 折=原价，5 折=半价，0 折=免费；会员实际扣除积分会自动应用这里的折扣。</div>
                <div className={styles.membershipPriceGrid}>
                  <label><strong>GPT Image 家族 1K</strong><input inputMode="decimal" value={membershipDiscountDraft.gptImage1K} onChange={(event) => updateMembershipDiscount("gptImage1K", event.target.value)} placeholder="例如 5" /></label>
                  <label><strong>Chat 模块</strong><input inputMode="decimal" value={membershipDiscountDraft.chat} onChange={(event) => updateMembershipDiscount("chat", event.target.value)} placeholder="例如 8" /></label>
                  <label><strong>视频模块</strong><input inputMode="decimal" value={membershipDiscountDraft.video} onChange={(event) => updateMembershipDiscount("video", event.target.value)} placeholder="例如 8" /></label>
                  <label><strong>其它所有计价</strong><input inputMode="decimal" value={membershipDiscountDraft.other} onChange={(event) => updateMembershipDiscount("other", event.target.value)} placeholder="例如 8" /></label>
                </div>
                <div className={styles.membershipModelHint}>
                  GPT Image 1K 当前覆盖：{membershipModels.filter(gptImageModel).map((model) => model.displayName || model.canonicalModelKey).join("、") || "暂无已发布的 GPT Image 1K 模型"}
                </div>
              </div>
              <button disabled={busy}>{membershipEditingPlanId ? "保存会员计划" : "创建会员计划"}</button>
            </form>
            <div className={styles.codeList}>
              {membershipPlans.map((plan) => (
                <article key={plan.id}>
                  <span><strong>{plan.name}（{plan.code}）</strong><small>{plan.memberCount} 位会员 · {plan.active ? "启用" : "停用"}</small></span>
                  <button type="button" className={styles.ghost} onClick={() => editMembershipPlan(plan)}>编辑</button>
                </article>
              ))}
              {!membershipPlans.length && <p className={styles.empty}>暂无会员计划，请先创建</p>}
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>邀请奖励规则</strong><span>注册与充值可分别配置</span></div>
            <form className={styles.form} onSubmit={saveReferralRule}>
              <div className={styles.referralSection}><strong>注册奖励</strong><span>绑定邀请码时双方各获得一次</span></div>
              <label><strong>邀请人奖励积分</strong><input inputMode="decimal" value={ruleInviterCredits} onChange={(event) => setRuleInviterCredits(event.target.value)} /></label>
              <label><strong>被邀请人奖励积分</strong><input inputMode="decimal" value={ruleInviteeCredits} onChange={(event) => setRuleInviteeCredits(event.target.value)} /></label>
              <div className={styles.referralSection}><strong>充值奖励</strong><span>被邀请人兑换充值码且达到门槛后发放</span></div>
              <label><strong>最低充值积分</strong><input inputMode="decimal" value={ruleRechargeMin} onChange={(event) => setRuleRechargeMin(event.target.value)} placeholder="0 表示不设门槛" /></label>
              <label><strong>邀请人充值奖励积分</strong><input inputMode="decimal" value={ruleRechargeInviterCredits} onChange={(event) => setRuleRechargeInviterCredits(event.target.value)} /></label>
              <label><strong>被邀请人充值奖励积分</strong><input inputMode="decimal" value={ruleRechargeInviteeCredits} onChange={(event) => setRuleRechargeInviteeCredits(event.target.value)} /></label>
              <button disabled={busy}>保存注册与充值奖励</button>
            </form>
            <div className={styles.codeList}>
              {referralRules.map((rule) => <article key={rule.id}><span><strong>{rule.eventType === "REGISTRATION" ? "注册奖励" : rule.eventType === "RECHARGE" ? "充值奖励" : rule.eventType}</strong><small>邀请人 {rule.inviterCredits} · 被邀请人 {rule.inviteeCredits}{rule.minRecharge ? ` · 最低充值 ${rule.minRecharge}` : ""} · {rule.active ? "启用" : "停用"}</small></span></article>)}
              {!referralRules.length && <p className={styles.empty}>暂无邀请规则</p>}
            </div>
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
              {uselgOpenAiRoutingHint && <small className={styles.routingHint}>{uselgOpenAiRoutingHint}</small>}
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

      {tab === "models" && (
        <AiModelCenter
          request={request}
          providers={providers}
          onError={setError}
          onNotice={setNotice}
          onUseLegacy={() => setTab("pricing")}
        />
      )}

      {tab === "pricing" && pricing && chatPricing && (
        <div className={styles.pricingShell}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>Chat Token 定价</strong><span>Token 模型按 1M 计费，Luna 按次计费</span></div>
            <p className={styles.pricingFormula}>正常输入 Token = 输入 Token − 缓存读取 Token；总价按正常输入、缓存读取、输出和缓存写入分别计价后合计。</p>
            <div className={styles.chatPricingHeader} aria-hidden="true">
              <span>模型</span><span>上下文</span><span>输入 /1M</span><span>输出 /1M</span><span>缓存读取 /1M</span><span>缓存写入 /1M</span>
            </div>
            <div className={styles.chatPricingList}>
              {chatPricing.models.flatMap((item, index) => {
                if (item.billingMode === "request") {
                  return [(
                    <article className={styles.chatPricingRow} key={item.model}>
                      <strong>{item.model}</strong>
                      <span className={styles.contextLabel}>按次</span>
                      <label className={styles.requestChatPrice}><span>每次积分</span><input type="number" min={0} max={1000000} value={item.creditsPerRequest} onChange={(event) => updateChatRequestPrice(index, event.target.value)} /></label>
                    </article>
                  )];
                }
                return (["standard", "extended"] as const).map((tier) => {
                  const rates = item[tier];
                  return (
                    <article className={styles.chatPricingRow} key={`${item.model}-${tier}`}>
                      <strong>{item.model}</strong>
                      {tier === "standard"
                        ? <label className={styles.contextInput}><span>≤ Token</span><input type="number" min={1} max={10000000} value={item.contextThresholdTokens} onChange={(event) => updateChatThreshold(index, event.target.value)} /></label>
                        : <span className={styles.contextLabel}>&gt; {item.contextThresholdTokens.toLocaleString("zh-CN")}</span>}
                      {([
                        ["inputCreditsPerMillion", "输入 /1M"],
                        ["outputCreditsPerMillion", "输出 /1M"],
                        ["cachedInputCreditsPerMillion", "缓存读取 /1M"],
                        ["cacheWriteCreditsPerMillion", "缓存写入 /1M"],
                      ] as const).map(([field, label]) => (
                        <label key={field}><span>{label}</span><input type="number" min={0} max={1000000} value={rates[field]} onChange={(event) => updateChatTokenRate(index, tier, field, event.target.value)} /></label>
                      ))}
                    </article>
                  );
                });
              })}
            </div>
            <div className={styles.chatPricingSave}>
              <span>{chatPricing.updatedAt ? `最近保存：${formatDateTime(chatPricing.updatedAt)}` : "当前使用初始定价"}</span>
              <button type="button" disabled={busy} onClick={() => void saveChatPricing()}>保存 Chat 计价</button>
            </div>
          </section>
          <form className={styles.pricingForm} onSubmit={savePricing}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>任务与基础定价</strong><span>积分</span></div>
            <div className={styles.basePricingGrid}>
              <label><strong>Agent 请求</strong><input type="number" min={0} max={1000000} value={pricing.agentRequestCredits} onChange={(event) => setPricing({ ...pricing, agentRequestCredits: event.target.value })} /></label>
              <label><strong>图片分析</strong><input type="number" min={0} max={1000000} value={pricing.inspirationAnalysisCredits} onChange={(event) => setPricing({ ...pricing, inspirationAnalysisCredits: event.target.value })} /></label>
              <label><strong>文字分析节点 / 次</strong><input type="number" min={0} max={1000000} value={pricing.canvasTextAgentCredits} onChange={(event) => setPricing({ ...pricing, canvasTextAgentCredits: event.target.value })} /><small>仅画布文字分析节点按次结算；普通 Chat 和工作流仍按 Token</small></label>
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
        </div>
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
                <small>{share.kind === "WORKFLOW" ? "工作流" : share.kind === "PROMPT" ? "提示词" : "节点预设"} · {share.authorName}</small>
                <h3>{share.title}</h3>
                <p>{share.description || "没有填写说明"}</p>
                {share.kind === "PROMPT" && share.prompt && <pre>{share.prompt}</pre>}
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
