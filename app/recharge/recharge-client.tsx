"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl, LogoMark } from "../site-shared";
import styles from "./recharge.module.css";

type RechargeAccount = {
  displayName?: string | null;
  email?: string | null;
  availableCredits: string;
};

type SessionResponse = {
  account: RechargeAccount;
  expiresAt: string;
};

const drawerOrigins = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

function notifyRechargeSuccess() {
  for (const origin of drawerOrigins) {
    try {
      window.parent.postMessage({ type: "wallet-recharge-success" }, origin);
    } catch {
      // Some engines reject custom-protocol target origins. Continue with the
      // two HTTPS-compatible Tauri origins instead of weakening to `*`.
    }
  }
}

declare global {
  interface Window {
    notifyWalletRechargeSuccess?: () => void;
  }
}

export function RechargeClient() {
  const [account, setAccount] = useState<RechargeAccount | null>(null);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    window.notifyWalletRechargeSuccess = notifyRechargeSuccess;
    const handleRechargeSuccess = () => notifyRechargeSuccess();
    window.addEventListener("wallet-recharge-completed", handleRechargeSuccess);
    return () => {
      delete window.notifyWalletRechargeSuccess;
      window.removeEventListener("wallet-recharge-completed", handleRechargeSuccess);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const session = new URLSearchParams(window.location.search).get("session")?.trim();
    if (!session) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setError("充值会话缺失，请返回 Inspiration Drawer 重新打开。");
        }
      });
      return () => controller.abort();
    }

    void fetch(`${apiBaseUrl}/v1/recharge/session/consume`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as SessionResponse & { message?: string };
        if (!response.ok) throw new Error(body.message || "充值会话验证失败");
        return body;
      })
      .then((body) => {
        setAccount(body.account);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "充值会话验证失败");
      });

    return () => controller.abort();
  }, [requestVersion]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <LogoMark small />
          <div>
            <strong>UNMIND</strong>
            <span>INSPIRATION DRAWER</span>
          </div>
        </div>
        <span className={styles.secure}>安全充值会话</span>
      </header>

      <section className={styles.content} aria-live="polite">
        {!account && !error && (
          <div className={styles.loading} aria-label="正在验证充值会话">
            <div className={styles.loadingTitle} />
            <div className={styles.loadingLine} />
            <div className={styles.loadingPanel} />
          </div>
        )}

        {error && (
          <div className={styles.statePanel}>
            <span className={styles.stateMark}>!</span>
            <h1>无法进入充值页面</h1>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setAccount(null);
                setError("");
                setRequestVersion((value) => value + 1);
              }}
            >
              重新验证
            </button>
          </div>
        )}

        {account && (
          <div className={styles.rechargeShell}>
            <div className={styles.intro}>
              <span className={styles.eyebrow}>CREDIT RECHARGE</span>
              <h1>积分充值</h1>
              <p>会话已安全连接。充值完成后，客户端余额会自动同步。</p>
            </div>

            <aside className={styles.accountPanel}>
              <div>
                <span>充值账号</span>
                <strong>{account.displayName || "Inspiration Drawer 用户"}</strong>
                <small>{account.email || "已验证账号"}</small>
              </div>
              <div className={styles.balance}>
                <span>当前积分</span>
                <strong>{account.availableCredits}</strong>
              </div>
            </aside>

            <div className={styles.notice}>
              <span>充值服务正在接入</span>
              <p>正式充值选项将在此官网页面开放；后续内容更新无需重新安装客户端。</p>
            </div>

            <footer className={styles.footer}>
              <span>一次性会话已使用</span>
              <span>支付流程将始终在独立安全页面中完成</span>
            </footer>
          </div>
        )}
      </section>
    </main>
  );
}
