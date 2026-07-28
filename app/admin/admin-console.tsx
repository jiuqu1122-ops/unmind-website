"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { apiBaseUrl } from "../site-shared";
import styles from "./admin.module.css";

type AdminOverview = {
  users: { total: number; active: number };
  licenses: { active: number };
  credits: { available: string; reserved: string; lifetimeGranted: string; lifetimeConsumed: string };
};

type Wallet = {
  availableCredits: string;
  reservedCredits: string;
  lifetimeGranted: string;
  lifetimeConsumed: string;
};

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  status: string;
  wallet: Wallet | null;
  updatedAt: string;
};

type RedemptionCode = {
  id: string;
  codeHint: string;
  credits: string;
  maxRedemptions: number;
  redeemedCount: number;
  status: string;
  note: string | null;
  expiresAt: string | null;
};

type ReviewShare = {
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

type Tab = "users" | "codes" | "reviews";

const formatCredits = (value?: string | null) => (
  new Intl.NumberFormat("zh-CN").format(Number(value || 0))
);

const operationKey = (prefix: string) => (
  `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`
);

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
  const [codes, setCodes] = useState<RedemptionCode[]>([]);
  const [reviews, setReviews] = useState<ReviewShare[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("1000");
  const [grantNote, setGrantNote] = useState("网页管理员发放");
  const [codeCredits, setCodeCredits] = useState("1000");
  const [codeQuantity, setCodeQuantity] = useState("1");
  const [codeUses, setCodeUses] = useState("1");
  const [codeNote, setCodeNote] = useState("");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

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

  const refreshAll = useCallback(async (credential = adminKey, search = query) => {
    const queryString = search ? `?query=${encodeURIComponent(search)}&limit=80` : "?limit=80";
    const [nextOverview, userPage, codePage, sharePage] = await Promise.all([
      request<AdminOverview>("/v1/admin/overview", {}, credential),
      request<{ items: AdminUser[] }>(`/v1/admin/users${queryString}`, {}, credential),
      request<{ items: RedemptionCode[] }>("/v1/admin/redemption-codes?limit=200", {}, credential),
      request<{ items: ReviewShare[] }>("/v1/admin/inspiration-space?limit=200", {}, credential),
    ]);
    setOverview(nextOverview);
    setUsers(userPage.items);
    setCodes(codePage.items);
    setReviews(sharePage.items);
  }, [adminKey, query, request]);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    const credential = adminKeyInput.trim();
    if (credential.length < 32) {
      setError("请输入服务器生成的管理员密钥");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await refreshAll(credential, "");
      setAdminKey(credential);
      setAdminKeyInput("");
      setNotice("管理员后台已连接");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await refreshAll(adminKey, query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "搜索失败");
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
    setError("");
    try {
      await request(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/credits/grant`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          description: grantNote.trim(),
          idempotencyKey: operationKey("web-grant"),
        }),
      });
      await refreshAll();
      setNotice(`已向 ${selectedUser.displayName || selectedUser.email || selectedUser.id} 发放 ${formatCredits(amount)} 点`);
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
    setError("");
    try {
      const result = await request<{ codes: Array<{ code: string }> }>("/v1/admin/redemption-codes", {
        method: "POST",
        body: JSON.stringify({
          credits: codeCredits,
          quantity,
          maxRedemptions,
          expiresAt: null,
          note: codeNote.trim() || null,
        }),
      });
      const plaintext = result.codes.map((item) => item.code);
      setGeneratedCodes(plaintext);
      await refreshAll();
      setNotice(`已生成 ${plaintext.length} 个兑换码，请立即复制保存`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "兑换码生成失败");
    } finally {
      setBusy(false);
    }
  };

  const updateReview = async (shareId: string, status: ReviewShare["status"]) => {
    setBusy(true);
    setError("");
    try {
      await request(`/v1/admin/inspiration-space/${shareId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshAll();
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
    setError("");
    try {
      await request(`/v1/admin/inspiration-space/${shareId}`, { method: "DELETE" });
      await refreshAll();
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
          <p>使用和桌面管理器相同的 ADMIN API KEY。密钥只保留在当前页面内存中，关闭页面后自动清除。</p>
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
        <div><span>UNMIND OPERATIONS</span><h1>账户与内容管理</h1><p>网页端充值、兑换码发放和灵感空间审核。</p></div>
        <button className={styles.ghost} onClick={() => { setAdminKey(""); setOverview(null); }}>断开连接</button>
      </header>

      <div className={styles.metrics}>
        <article><span>注册用户</span><strong>{overview?.users.total ?? 0}</strong><small>{overview?.users.active ?? 0} 个活跃账户</small></article>
        <article><span>有效授权</span><strong>{overview?.licenses.active ?? 0}</strong><small>服务端实时数据</small></article>
        <article><span>可用总积分</span><strong>{formatCredits(overview?.credits.available)}</strong><small>已发放余额汇总</small></article>
        <article><span>待审核分享</span><strong>{reviews.filter((item) => item.status === "PENDING").length}</strong><small>灵感空间投稿</small></article>
      </div>

      <nav className={styles.tabs} aria-label="后台功能">
        <button className={tab === "users" ? styles.active : ""} onClick={() => setTab("users")}>用户充值</button>
        <button className={tab === "codes" ? styles.active : ""} onClick={() => setTab("codes")}>兑换码</button>
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
                <button key={user.id} className={selectedUserId === user.id ? styles.selectedUser : ""} onClick={() => setSelectedUserId(user.id)}>
                  <span><strong>{user.displayName || user.email || "未命名用户"}</strong><small>{user.email || user.id}</small></span>
                  <em>{formatCredits(user.wallet?.availableCredits)} 点</em>
                </button>
              ))}
              {!users.length && <p className={styles.empty}>没有找到用户</p>}
            </div>
          </section>
          <section className={styles.panel}>
            {selectedUser ? (
              <form className={styles.form} onSubmit={grantCredits}>
                <span>当前账户</span>
                <h2>{selectedUser.displayName || selectedUser.email || selectedUser.id}</h2>
                <div className={styles.balance}><small>可用积分</small><strong>{formatCredits(selectedUser.wallet?.availableCredits)}</strong></div>
                <label><strong>发放积分</strong><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.trim())} /></label>
                <label><strong>发放说明</strong><input value={grantNote} onChange={(event) => setGrantNote(event.target.value)} maxLength={500} /></label>
                <button disabled={busy}>确认发放</button>
              </form>
            ) : <p className={styles.empty}>从左侧选择一个用户进行充值</p>}
          </section>
        </div>
      )}

      {tab === "codes" && (
        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <form className={styles.form} onSubmit={createCodes}>
              <span>CREATE REDEMPTION CODES</span><h2>生成积分兑换码</h2>
              <label><strong>每次兑换积分</strong><input inputMode="numeric" value={codeCredits} onChange={(event) => setCodeCredits(event.target.value.trim())} /></label>
              <div className={styles.formGrid}>
                <label><strong>生成数量</strong><input type="number" min={1} max={100} value={codeQuantity} onChange={(event) => setCodeQuantity(event.target.value)} /></label>
                <label><strong>每码可用次数</strong><input type="number" min={1} max={10000} value={codeUses} onChange={(event) => setCodeUses(event.target.value)} /></label>
              </div>
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
                  <span><strong>{code.codeHint}</strong><small>{code.note || "无备注"} · 使用 {code.redeemedCount}/{code.maxRedemptions}</small></span>
                  <em>{formatCredits(code.credits)} 点</em>
                </article>
              ))}
            </div>
          </section>
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
                <small>{share.kind === "WORKFLOW" ? "工作流" : "节点预设"} · {share.authorName}</small>
                <h3>{share.title}</h3>
                <p>{share.description || "没有填写说明"}</p>
                <div>{share.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <footer>
                  <button disabled={busy} onClick={() => updateReview(share.id, "PUBLISHED")}>发布</button>
                  <button disabled={busy} className={styles.ghost} onClick={() => updateReview(share.id, "REJECTED")}>退回</button>
                  <button disabled={busy} className={styles.danger} onClick={() => deleteReview(share.id)}>删除</button>
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
